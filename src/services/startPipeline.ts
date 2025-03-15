import { Subscription } from 'rxjs';
import { supabase } from './supabase';
import { BoundingBox, ProcessedData } from '../types';
import { initializePredictionService, shutdownPredictionService } from '../ml/predictionService';
import { startDataStream } from './dataStream';
import { initProducer, disconnectKafka } from './kafka';
import { trainModel } from '../ml/models';
import config from '../config';

// Global subscription reference
let pipelineSubscription: Subscription | null = null;
let pipeline: any = null;

// Pipeline cleanup function
let cleanupFunction: (() => Promise<void>) | null = null;

/**
 * Start the data processing pipeline
 */
export const startPipeline = async (): Promise<void> => {
  console.log('Starting data processing pipeline...');
  
  try {
    // Initialize Kafka producer
    await initProducer();
    
    // Initialize ML prediction service
    await initializePredictionService();
    
    // Start data stream processing
    const cleanup = await startDataStream();
    
    // Store cleanup function
    cleanupFunction = async () => {
      console.log('Cleaning up data processing pipeline...');
      
      // Stop data stream processing
      if (cleanup) {
        cleanup();
      }
      
      // Shutdown prediction service
      await shutdownPredictionService();
      
      // Disconnect Kafka
      await disconnectKafka();
      
      console.log('Data processing pipeline cleaned up');
    };
    
    console.log('Data processing pipeline started');
  } catch (error) {
    console.error('Failed to start data processing pipeline:', error);
    throw error;
  }
};

/**
 * Stop the data processing pipeline
 */
export const stopPipeline = async (): Promise<void> => {
  if (cleanupFunction) {
    await cleanupFunction();
    cleanupFunction = null;
  }
};

/**
 * Save surge predictions to database
 */
export const saveSurgePredictions = async (predictions: any[]): Promise<void> => {
  // This is a placeholder function that would save predictions to a database
  console.log(`Saving ${predictions.length} surge predictions to database`);
  
  // In a real implementation, this would save to Supabase or another database
  // For example:
  // const { error } = await supabase
  //   .from('surge_predictions')
  //   .insert(predictions);
  
  // if (error) {
  //   throw error;
  // }
};

/**
 * Get the current bounding box for data processing
 * This could be dynamically adjusted based on system load or other factors
 */
export function getCurrentProcessingArea(): BoundingBox {
  // Default to San Francisco area
  return {
    minLat: 37.7,
    maxLat: 37.85,
    minLng: -122.5,
    maxLng: -122.35
  };
}

/**
 * Schedule periodic model training
 */
function scheduleModelTraining() {
  const trainingInterval = setInterval(async () => {
    try {
      console.log('Starting scheduled model training...');
      
      // Fetch historical data
      const { data, error } = await supabase
        .from('surge_predictions')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000);
      
      if (error) {
        console.error('Error fetching training data:', error);
        return;
      }
      
      if (data.length === 0) {
        console.log('No data available for training');
        return;
      }
      
      // Train the model
      await trainModel(data as ProcessedData[]);
      
      console.log('Scheduled model training completed');
    } catch (error) {
      console.error('Error during scheduled model training:', error);
    }
  }, 24 * 60 * 60 * 1000); // Train once a day
  
  // Return a function to clear the interval
  return () => clearInterval(trainingInterval);
}

/**
 * Stop the data processing pipeline
 */
export const stopDataProcessingPipeline = async (): Promise<void> => {
  if (cleanupFunction) {
    await cleanupFunction();
    cleanupFunction = null;
  }
}; 