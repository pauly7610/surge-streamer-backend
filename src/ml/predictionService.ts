import * as tf from '@tensorflow/tfjs-node';
import { loadSurgePredictionModel, makePredictions } from './models';
import { fetchAllExternalData } from '../services/externalData';
import { sendSurgePrediction } from '../services/kafka';
import { saveSurgePredictions } from '../services/startPipeline';
import { pointToH3, h3ToPoint } from '../services/geospatial';
import { ProcessedData, DemandSupplyData, GeoPoint, SurgePrediction } from '../types';
import config from '../config';
import { supabase } from '../services/supabase';
import { v4 as uuidv4 } from 'uuid';

// Global model instance
let surgePredictionModel: tf.Sequential | null = null;

/**
 * Initialize the prediction service
 */
export const initPredictionService = async (): Promise<void> => {
  try {
    console.log('Initializing prediction service...');
    surgePredictionModel = await loadSurgePredictionModel();
    console.log('Prediction service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize prediction service:', error);
    throw error;
  }
};

/**
 * Generate surge predictions for a given area
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
      await initPredictionService();
    }
    
    if (!surgePredictionModel) {
      throw new Error('Model not initialized');
    }
    
    // Generate features for prediction
    const processedData: ProcessedData = {
      h3_index: h3Index,
      demand_count: demandCount,
      supply_count: supplyCount,
      surge_factor: 0, // Will be filled by prediction
      latitude,
      longitude,
      timestamp: new Date().toISOString()
    };
    
    // Make prediction
    const predictions = makePredictions(surgePredictionModel, [processedData]);
    
    if (!predictions || predictions.length === 0) {
      throw new Error('Failed to generate prediction');
    }
    
    // Update the surge factor with the prediction
    const surgeFactor = Math.max(1.0, predictions[0]);
    
    // Create surge prediction object
    const surgePrediction: SurgePrediction = {
      id: uuidv4(),
      h3_index: h3Index,
      latitude,
      longitude,
      timestamp: processedData.timestamp,
      surge_factor: surgeFactor,
      demand_count: demandCount,
      supply_count: supplyCount
    };
    
    // Save to database
    await saveSurgePrediction(surgePrediction);
    
    // Send to Kafka
    await sendSurgePrediction(surgePrediction);
    
    return surgePrediction;
  } catch (error) {
    console.error('Error generating surge prediction:', error);
    throw error;
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
 * Start the prediction service
 */
export const startPredictionService = async (): Promise<() => void> => {
  // Initialize the prediction service
  await initPredictionService();
  
  // Set up interval for periodic predictions
  const intervalId = setInterval(async () => {
    try {
      // This would be replaced with actual data from Kafka
      // For now, we'll use placeholder data
      const boundingBox = {
        minLat: 37.7,
        maxLat: 37.85,
        minLng: -122.5,
        maxLng: -122.35,
      };
      
      // Placeholder demand/supply map
      const demandSupplyMap = new Map<string, DemandSupplyData>();
      
      // Generate predictions
      await generateSurgePredictionsForGrid(boundingBox, demandSupplyMap);
      
    } catch (error) {
      console.error('Error generating predictions:', error);
    }
  }, config.ml.predictionInterval);
  
  // Return a function to stop the prediction service
  return () => {
    clearInterval(intervalId);
    console.log('Prediction service stopped');
  };
};

/**
 * Save surge prediction to database
 */
const saveSurgePrediction = async (prediction: SurgePrediction): Promise<void> => {
  try {
    const { error } = await supabase
      .from('surge_predictions')
      .insert(prediction);
    
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error saving surge prediction to database:', error);
    throw error;
  }
};

/**
 * Shutdown the prediction service
 */
export const shutdownPredictionService = async (): Promise<void> => {
  console.log('Shutting down prediction service...');
  surgePredictionModel = null;
}; 