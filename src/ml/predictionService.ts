import * as tf from '@tensorflow/tfjs-node';
import { loadModel, makePrediction } from './models';
import { fetchAllExternalData } from '../services/externalData';
import { sendSurgePrediction } from '../services/kafka';
import { saveSurgePredictions } from '../services/startPipeline';
import { pointToH3, h3ToPoint } from '../services/geospatial';
import { ProcessedData, DemandSupplyData, GeoPoint, SurgePrediction, PredictionFactor } from '../types';
import config from '../config';
import { supabase } from '../services/supabase';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/Logger';
import * as h3 from 'h3-js';

// Global model instance
let surgePredictionModel: tf.Sequential | null = null;

// Initialize logger
const logger = new Logger('PredictionService');

/**
 * Initialize the prediction service
 */
export async function initializePredictionService(): Promise<void> {
  try {
    logger.info('Initializing prediction service...');
    await loadModel();
    logger.info('Prediction service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize prediction service:', error);
    throw error;
  }
}

/**
 * Generate a surge prediction for a specific location
 */
export async function generateSurgePrediction(
  latitude: number,
  longitude: number,
  timestamp: string = new Date().toISOString()
): Promise<SurgePrediction> {
  try {
    // Get H3 index for the location (using a mock function since h3-js types are not available)
    const h3Index = `${Math.floor(latitude * 100)}_${Math.floor(longitude * 100)}`;
    
    // Fetch external data
    const externalData = await fetchAllExternalData({ latitude, longitude });
    
    // Process data for prediction
    const processedData = {
      timestamp,
      latitude,
      longitude,
      demand_count: 10, // Mock data
      supply_count: 5,  // Mock data
      weather: externalData.weatherData,
      traffic: externalData.trafficData,
      events: externalData.eventData,
      surge_factor: 1.0 // Default value, will be replaced by prediction
    };
    
    // Make prediction
    const prediction = await makePrediction([
      processedData.demand_count / 100,
      processedData.supply_count / 100,
      Math.sin((new Date(timestamp).getHours() * 2 * Math.PI) / 24), // Hour of day (sin)
      Math.cos((new Date(timestamp).getHours() * 2 * Math.PI) / 24), // Hour of day (cos)
      Math.sin((new Date(timestamp).getDay() * 2 * Math.PI) / 7),    // Day of week (sin)
      Math.cos((new Date(timestamp).getDay() * 2 * Math.PI) / 7),    // Day of week (cos)
      // Add more features to match the expected 22 features
      // Padding with zeros for now
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ]);
    
    // Create prediction factors
    const factors: PredictionFactor[] = [
      {
        name: 'Time of Day',
        description: 'Current hour affects demand patterns',
        impact: 0.3
      },
      {
        name: 'Supply/Demand Ratio',
        description: 'Current ratio of drivers to ride requests',
        impact: 0.5
      }
    ];
    
    // Create surge prediction object
    const surgePrediction: SurgePrediction = {
      id: uuidv4(),
      h3Index: h3Index,
      locationId: `${latitude.toFixed(6)},${longitude.toFixed(6)}`,
      timestamp,
      surgeMultiplier: prediction.surgeMultiplier,
      confidence: prediction.confidence,
      predictedDuration: 15, // 15 minutes
      factors
    };
    
    // Send prediction to Kafka
    await sendSurgePrediction(surgePrediction);
    
    // Store prediction in database
    await storePrediction(surgePrediction);
    
    return surgePrediction;
  } catch (error) {
    logger.error('Failed to generate surge prediction:', error);
    
    // Return default prediction in case of error
    return {
      id: uuidv4(),
      h3Index: `${Math.floor(latitude * 100)}_${Math.floor(longitude * 100)}`,
      locationId: `${latitude.toFixed(6)},${longitude.toFixed(6)}`,
      timestamp,
      surgeMultiplier: 1.0,
      confidence: 0.5,
      predictedDuration: 15, // 15 minutes
      factors: []
    };
  }
}

/**
 * Store a prediction in the database
 */
async function storePrediction(prediction: SurgePrediction): Promise<void> {
  try {
    const { error } = await supabase
      .from('surge_predictions')
      .insert(prediction);
    
    if (error) {
      logger.error('Failed to store prediction:', error);
    } else {
      logger.debug(`Stored prediction ${prediction.id}`);
    }
  } catch (error) {
    logger.error('Failed to store prediction:', error);
  }
}

/**
 * Generate surge predictions
 */
export const generateSurgePredictions = async (
  demandCount: number,
  supplyCount: number,
  h3Index: string,
  latitude: number,
  longitude: number
): Promise<SurgePrediction> => {
  try {
    // Ensure model is loaded
    if (!surgePredictionModel) {
      await initializePredictionService();
    }
    
    // Create processed data
    const processedData = {
      timestamp: new Date().toISOString(),
      latitude,
      longitude,
      demand_count: demandCount,
      supply_count: supplyCount,
      surge_factor: 1.0 // Default value, will be replaced by prediction
    };
    
    // Make prediction
    const predictionResult = await makePrediction([
      processedData.demand_count / 100,
      processedData.supply_count / 100,
      Math.sin((new Date().getHours() * 2 * Math.PI) / 24), // Hour of day (sin)
      Math.cos((new Date().getHours() * 2 * Math.PI) / 24), // Hour of day (cos)
      Math.sin((new Date().getDay() * 2 * Math.PI) / 7),    // Day of week (sin)
      Math.cos((new Date().getDay() * 2 * Math.PI) / 7),    // Day of week (cos)
      // Add more features to match the expected 22 features
      // Padding with zeros for now
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ]);
    
    if (!predictionResult) {
      throw new Error('Failed to generate prediction');
    }
    
    // Create prediction factors
    const factors: PredictionFactor[] = [
      {
        name: 'Time of Day',
        description: 'Current hour affects demand patterns',
        impact: 0.3
      },
      {
        name: 'Supply/Demand Ratio',
        description: 'Current ratio of drivers to ride requests',
        impact: 0.5
      }
    ];
    
    // Create surge prediction object
    const surgePrediction: SurgePrediction = {
      id: uuidv4(),
      h3Index: h3Index,
      locationId: `${latitude.toFixed(6)},${longitude.toFixed(6)}`,
      timestamp: processedData.timestamp,
      surgeMultiplier: predictionResult.surgeMultiplier,
      confidence: predictionResult.confidence,
      predictedDuration: 15, // 15 minutes
      factors
    };
    
    // Save to database
    await storePrediction(surgePrediction);
    
    // Send to Kafka
    await sendSurgePrediction(surgePrediction);
    
    return surgePrediction;
  } catch (error) {
    logger.error('Error generating surge prediction:', error);
    
    // Return default prediction in case of error
    return {
      id: uuidv4(),
      h3Index: h3Index,
      locationId: `${latitude.toFixed(6)},${longitude.toFixed(6)}`,
      timestamp: new Date().toISOString(),
      surgeMultiplier: 1.0,
      confidence: 0.5,
      predictedDuration: 15, // 15 minutes
      factors: []
    };
  }
};

/**
 * Generate surge predictions for a grid of locations
 */
export const generateSurgePredictionsForGrid = async (
  boundingBox: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  },
  demandSupplyMap: Map<string, DemandSupplyData>
): Promise<SurgePrediction[]> => {
  // Generate a grid of H3 hexagons within the bounding box
  const predictions: SurgePrediction[] = [];
  
  // For each H3 hexagon in the bounding box
  for (const [h3Index, demandSupply] of demandSupplyMap.entries()) {
    // Convert H3 index to lat/lng
    const point = h3ToPoint(h3Index);
    
    // Check if point is within bounding box
    if (
      point.latitude >= boundingBox.minLat &&
      point.latitude <= boundingBox.maxLat &&
      point.longitude >= boundingBox.minLng &&
      point.longitude <= boundingBox.maxLng
    ) {
      // Generate surge prediction
      const prediction = await generateSurgePredictions(
        demandSupply.demand.length,
        demandSupply.supply.length,
        h3Index,
        point.latitude,
        point.longitude
      );
      predictions.push(prediction);
    }
  }
  
  // Save predictions to database
  await saveSurgePredictions(predictions);
  
  return predictions;
};

/**
 * Generate surge predictions for all locations
 */
export const generatePredictionsForAllLocations = async (): Promise<SurgePrediction[]> => {
  try {
    // Ensure model is loaded
    if (!surgePredictionModel) {
      await initializePredictionService();
    }
    
    // Get all active locations
    const { data: locations, error } = await supabase
      .from('locations')
      .select('*')
      .eq('active', true);
    
    if (error) {
      throw error;
    }
    
    const predictions: SurgePrediction[] = [];
    
    // Generate predictions for each location
    for (const location of locations) {
      try {
        // Generate prediction for this location
        const prediction = await generateSurgePrediction(
          location.latitude,
          location.longitude
        );
        
        predictions.push(prediction);
      } catch (locationError) {
        logger.error(`Error generating prediction for location ${location.id}:`, locationError);
      }
    }
    
    return predictions;
  } catch (error) {
    logger.error('Error generating predictions for all locations:', error);
    return [];
  }
};

/**
 * Start the prediction service
 */
export const startPredictionService = async (): Promise<() => void> => {
  // Initialize the prediction service
  await initializePredictionService();
  
  // Set up interval for periodic predictions
  const predictionInterval = setInterval(async () => {
    try {
      await generatePredictionsForAllLocations();
    } catch (error) {
      logger.error('Error in prediction interval:', error);
    }
  }, 5 * 60 * 1000); // Run every 5 minutes
  
  // Return cleanup function
  return () => {
    clearInterval(predictionInterval);
    shutdownPredictionService();
  };
};

/**
 * Shutdown the prediction service
 */
export const shutdownPredictionService = (): void => {
  // Clean up resources
  surgePredictionModel = null;
}; 