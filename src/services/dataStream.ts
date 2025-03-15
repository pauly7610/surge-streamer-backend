import { Subscription, interval, Observable, Subject, from } from 'rxjs';
import { mergeMap, map, buffer, filter, concatMap } from 'rxjs/operators';
import { EachMessagePayload } from 'kafkajs';
import { createConsumer } from './kafka';
import { pointToH3 } from './geospatial';
import { startPredictionService } from '../ml/predictionService';
import { DriverLocation, RideRequest, DemandSupplyData, ProcessedData } from '../types';
import config from '../config';
import { createBoundingBox } from './geospatial';
import { generateSurgePredictions } from '../ml/predictionService';

// Global map to store demand/supply data by H3 index
const demandSupplyMap = new Map<string, DemandSupplyData>();

// Subscription for the data pipeline
let subscription: Subscription | null = null;

// Subjects for incoming data
const driverLocationSubject = new Subject<DriverLocation>();
const rideRequestSubject = new Subject<RideRequest>();

/**
 * Process driver location message from Kafka
 */
const processDriverLocationMessage = async (payload: EachMessagePayload) => {
  try {
    const { message } = payload;
    if (!message.value) return;
    
    const driverLocation: DriverLocation = JSON.parse(message.value.toString());
    console.log(`Received driver location: ${driverLocation.driver_id}`);
    
    // Update the demand/supply map
    updateDemandSupplyMap(driverLocation);
  } catch (error) {
    console.error('Error processing driver location message:', error);
  }
};

/**
 * Process ride request message from Kafka
 */
const processRideRequestMessage = async (payload: EachMessagePayload) => {
  try {
    const { message } = payload;
    if (!message.value) return;
    
    const rideRequest: RideRequest = JSON.parse(message.value.toString());
    console.log(`Received ride request: ${rideRequest.id}`);
    
    // Update the demand/supply map
    updateDemandSupplyMap(undefined, rideRequest);
  } catch (error) {
    console.error('Error processing ride request message:', error);
  }
};

/**
 * Update the demand/supply map with new data
 */
const updateDemandSupplyMap = (
  driverLocation?: DriverLocation,
  rideRequest?: RideRequest
) => {
  // Get the H3 index for the location
  let h3Index: string;
  let location: { latitude: number; longitude: number };
  
  if (driverLocation) {
    location = {
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude
    };
    h3Index = getH3IndexForLocation(location);
    
    // Initialize if not exists
    if (!demandSupplyMap.has(h3Index)) {
      demandSupplyMap.set(h3Index, { demand: [], supply: [] });
    }
    
    // Add to supply if driver is available
    if (driverLocation.status === 'available') {
      const data = demandSupplyMap.get(h3Index)!;
      
      // Remove old entries for this driver
      data.supply = data.supply.filter(d => d.driver_id !== driverLocation.driver_id);
      
      // Add new entry
      data.supply.push(driverLocation);
      
      // Update map
      demandSupplyMap.set(h3Index, data);
    }
  }
  
  if (rideRequest) {
    location = {
      latitude: rideRequest.latitude,
      longitude: rideRequest.longitude
    };
    h3Index = getH3IndexForLocation(location);
    
    // Initialize if not exists
    if (!demandSupplyMap.has(h3Index)) {
      demandSupplyMap.set(h3Index, { demand: [], supply: [] });
    }
    
    // Add to demand if request is pending
    if (rideRequest.status === 'pending') {
      const data = demandSupplyMap.get(h3Index)!;
      
      // Remove old entries for this request
      data.demand = data.demand.filter(r => r.id !== rideRequest.id);
      
      // Add new entry
      data.demand.push(rideRequest);
      
      // Update map
      demandSupplyMap.set(h3Index, data);
    }
  }
};

/**
 * Get H3 index for a location
 */
const getH3IndexForLocation = (location: { latitude: number; longitude: number }): string => {
  // This is a placeholder - in a real implementation, use the h3-js library
  // to convert lat/lng to H3 index
  return `${Math.floor(location.latitude * 100)}_${Math.floor(location.longitude * 100)}`;
};

/**
 * Clean up old data from the demand/supply map
 */
const cleanupOldData = () => {
  const now = new Date();
  const maxAgeMs = 15 * 60 * 1000; // 15 minutes
  
  demandSupplyMap.forEach((data, h3Index) => {
    // Filter out old driver locations
    data.supply = data.supply.filter(d => {
      const timestamp = new Date(d.timestamp);
      return now.getTime() - timestamp.getTime() < maxAgeMs;
    });
    
    // Filter out old ride requests
    data.demand = data.demand.filter(r => {
      const timestamp = new Date(r.timestamp);
      return now.getTime() - timestamp.getTime() < maxAgeMs;
    });
    
    // Update or remove if empty
    if (data.supply.length === 0 && data.demand.length === 0) {
      demandSupplyMap.delete(h3Index);
    } else {
      demandSupplyMap.set(h3Index, data);
    }
  });
};

/**
 * Generate surge predictions for all areas
 */
const generateAllSurgePredictions = async () => {
  console.log(`Generating surge predictions for ${demandSupplyMap.size} areas`);
  
  // Clean up old data first
  cleanupOldData();
  
  // Generate predictions for each area
  const predictions = [];
  
  for (const [h3Index, data] of demandSupplyMap.entries()) {
    try {
      // Skip areas with no demand or supply
      if (data.demand.length === 0 && data.supply.length === 0) continue;
      
      // Calculate center point of the area
      const center = calculateCenterPoint(data);
      
      // Generate prediction
      const prediction = await generateSurgePredictions(
        data.demand.length,
        data.supply.length,
        h3Index,
        center.latitude,
        center.longitude
      );
      
      predictions.push(prediction);
    } catch (error) {
      console.error(`Error generating prediction for area ${h3Index}:`, error);
    }
  }
  
  console.log(`Generated ${predictions.length} surge predictions`);
  return predictions;
};

/**
 * Calculate the center point of an area based on demand and supply
 */
const calculateCenterPoint = (data: DemandSupplyData) => {
  const allPoints = [...data.demand, ...data.supply];
  
  if (allPoints.length === 0) {
    return { latitude: 0, longitude: 0 };
  }
  
  const sumLat = allPoints.reduce((sum, point) => sum + point.latitude, 0);
  const sumLng = allPoints.reduce((sum, point) => sum + point.longitude, 0);
  
  return {
    latitude: sumLat / allPoints.length,
    longitude: sumLng / allPoints.length
  };
};

/**
 * Start the data stream processing
 */
export const startDataStream = async () => {
  console.log('Starting data stream processing...');
  
  // Create Kafka consumers
  await createConsumer(
    `${config.kafka.consumerGroup}-driver-locations`,
    config.kafka.topics.driverLocations,
    processDriverLocationMessage
  );
  
  await createConsumer(
    `${config.kafka.consumerGroup}-ride-requests`,
    config.kafka.topics.rideRequests,
    processRideRequestMessage
  );
  
  // Set up periodic surge prediction generation
  const interval = setInterval(async () => {
    try {
      await generateAllSurgePredictions();
    } catch (error) {
      console.error('Error in surge prediction cycle:', error);
    }
  }, config.ml.predictionInterval);
  
  // Return cleanup function
  return () => {
    clearInterval(interval);
    if (subscription) {
      subscription.unsubscribe();
      subscription = null;
    }
  };
}; 