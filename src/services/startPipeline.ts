import { Subscription } from 'rxjs';
import { supabase } from './supabase';
import { BoundingBox, ProcessedData } from '../types';

// Global subscription reference
let pipelineSubscription: Subscription | null = null;

/**
 * Start the data processing pipeline
 */
export const startPipeline = async (): Promise<void> => {
  if (pipelineSubscription) {
    console.warn('Pipeline already running, stopping previous instance');
    await stopPipeline();
  }

  console.log('Starting data processing pipeline');
  
  // Here we would set up the RxJS pipeline to process data
  // This is a placeholder for the actual implementation
  
  console.log('Pipeline started successfully');
};

/**
 * Stop the data processing pipeline
 */
export const stopPipeline = async (): Promise<void> => {
  if (pipelineSubscription) {
    console.log('Stopping data processing pipeline');
    pipelineSubscription.unsubscribe();
    pipelineSubscription = null;
    console.log('Pipeline stopped successfully');
  } else {
    console.log('No pipeline running');
  }
};

/**
 * Save processed surge data to the database
 */
export const saveSurgePredictions = async (predictions: ProcessedData[]): Promise<void> => {
  if (!predictions.length) return;
  
  const { error } = await supabase
    .from('surge_predictions')
    .upsert(predictions, { onConflict: 'h3_index' });
  
  if (error) {
    console.error('Error saving surge predictions:', error);
    throw error;
  }
  
  console.log(`Saved ${predictions.length} surge predictions`);
};

/**
 * Get the current bounding box for data processing
 * This could be dynamically adjusted based on system load or other factors
 */
export const getCurrentProcessingArea = (): BoundingBox => {
  // Default to San Francisco area
  return {
    minLat: 37.7,
    maxLat: 37.85,
    minLng: -122.5,
    maxLng: -122.35
  };
}; 