import { createDataPipeline } from './dataStream';
import { Subscription } from 'rxjs';
import { supabase } from './supabase';
import { BoundingBox, ProcessedData } from '../types';

// Global subscription reference
let pipelineSubscription: Subscription | null = null;
let pipeline: any = null;

/**
 * Start the data pipeline
 */
export async function startPipeline() {
  console.log('Starting Surge Streamer data pipeline...');
  
  try {
    // Create and start the data pipeline
    pipeline = await createDataPipeline();
    await pipeline.start();
    
    console.log('Data pipeline started successfully');
  } catch (error) {
    console.error('Failed to start data pipeline:', error);
    throw error;
  }
}

/**
 * Stop the data pipeline
 */
export async function stopPipeline() {
  if (pipeline) {
    console.log('Shutting down data pipeline...');
    await pipeline.stop();
    console.log('Data pipeline stopped');
    pipeline = null;
  } else {
    console.log('No pipeline running');
  }
}

/**
 * Save processed surge data to the database
 */
export async function saveSurgePredictions(predictions: ProcessedData[]): Promise<void> {
  if (!predictions.length) return;
  
  const { error } = await supabase
    .from('surge_predictions')
    .upsert(predictions, { onConflict: 'h3_index' });
  
  if (error) {
    console.error('Error saving surge predictions:', error);
    throw error;
  }
  
  console.log(`Saved ${predictions.length} surge predictions`);
}

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