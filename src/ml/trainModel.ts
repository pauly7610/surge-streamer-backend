import * as fs from 'fs';
import { supabase } from '../services/supabase';
import { trainModel as trainMLModel } from './models';
import { ProcessedData } from '../types';
import config from '../config';
import { Logger } from '../utils/Logger';

// Initialize logger
const logger = new Logger('TrainModel');

/**
 * Fetch historical data for training
 */
const fetchHistoricalData = async (): Promise<ProcessedData[]> => {
  // Calculate the start date (e.g., 7 days ago)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - config.ml.historyWindowSize);
  
  console.log(`Fetching historical data from ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  // Fetch data from Supabase
  const { data, error } = await supabase
    .from('surge_predictions')
    .select('*')
    .gte('timestamp', startDate.toISOString())
    .lte('timestamp', endDate.toISOString())
    .order('timestamp', { ascending: true });
  
  if (error) {
    console.error('Error fetching historical data:', error);
    throw error;
  }
  
  console.log(`Fetched ${data.length} historical data points`);
  
  return data as ProcessedData[];
};

/**
 * Train the model with historical data
 */
const trainModel = async () => {
  try {
    console.log('Starting model training...');
    
    // Fetch historical data
    const historicalData = await fetchHistoricalData();
    
    if (historicalData.length === 0) {
      console.log('No historical data available for training');
      return;
    }
    
    // Train the model
    const model = await trainMLModel(historicalData);
    
    console.log('Model training completed successfully');
    
    // Optional: Evaluate the model
    // This would involve splitting the data into training and test sets
    // and evaluating the model on the test set
    
  } catch (error) {
    console.error('Error training model:', error);
  }
};

// Run the training if this script is executed directly
if (require.main === module) {
  trainModel()
    .then(() => {
      console.log('Training script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Training script failed:', error);
      process.exit(1);
    });
} 