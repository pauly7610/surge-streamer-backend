import * as tf from '@tensorflow/tfjs-node';
import * as fs from 'fs';
import * as path from 'path';
import config from '../config';
import { ProcessedData } from '../types';

// Ensure model directory exists
const modelDir = config.ml.modelPath;
if (!fs.existsSync(modelDir)) {
  fs.mkdirSync(modelDir, { recursive: true });
}

// Define model paths
const surgePredictionModelPath = path.join(modelDir, 'surge-prediction-model');

// Feature normalization parameters
let featureMeans: number[] = [];
let featureStds: number[] = [];

// Constants for model configuration
const MODEL_PATH = path.join(__dirname, '../../models/surge_prediction_model');
const FEATURES = [
  'hour_of_day',
  'day_of_week',
  'demand_count',
  'supply_count',
  'latitude',
  'longitude'
];
const NUM_FEATURES = FEATURES.length;
const HIDDEN_LAYER_SIZES = [64, 32];
const LEARNING_RATE = 0.001;
const BATCH_SIZE = 32;
const EPOCHS = 50;
const VALIDATION_SPLIT = 0.2;

/**
 * Creates a new surge prediction model with the specified architecture
 */
export const createSurgePredictionModel = (): tf.Sequential => {
  const model = tf.sequential();
  
  // Input layer
  model.add(tf.layers.dense({
    inputShape: [NUM_FEATURES],
    units: HIDDEN_LAYER_SIZES[0],
    activation: 'relu',
    kernelInitializer: 'glorotNormal'
  }));
  
  // Hidden layers
  for (let i = 1; i < HIDDEN_LAYER_SIZES.length; i++) {
    model.add(tf.layers.dense({
      units: HIDDEN_LAYER_SIZES[i],
      activation: 'relu',
      kernelInitializer: 'glorotNormal'
    }));
    
    // Add dropout for regularization
    model.add(tf.layers.dropout({ rate: 0.2 }));
  }
  
  // Output layer (surge factor prediction)
  model.add(tf.layers.dense({
    units: 1,
    activation: 'linear'
  }));
  
  // Compile the model
  model.compile({
    optimizer: tf.train.adam(LEARNING_RATE),
    loss: 'meanSquaredError',
    metrics: ['mse']
  });
  
  return model;
};

/**
 * Normalize features
 */
export const normalizeFeatures = (features: number[][]): number[][] => {
  const featuresTensor = tf.tensor2d(features);
  
  // Calculate mean and std if not already calculated
  if (featureMeans.length === 0 || featureStds.length === 0) {
    featureMeans = Array.from(tf.mean(featuresTensor, 0).dataSync());
    featureStds = Array.from(tf.std(featuresTensor, 0).dataSync());
  }
  
  // Normalize features
  const normalizedFeatures = features.map(feature => 
    feature.map((value, index) => 
      (value - featureMeans[index]) / (featureStds[index] || 1)
    )
  );
  
  return normalizedFeatures;
};

/**
 * Preprocesses the data for model training
 */
export const preprocessData = (data: ProcessedData[]) => {
  // Extract features and labels
  const features: number[][] = [];
  const labels: number[] = [];
  
  data.forEach(item => {
    const timestamp = new Date(item.timestamp);
    const hourOfDay = timestamp.getHours() / 24; // Normalize to [0, 1]
    const dayOfWeek = timestamp.getDay() / 6; // Normalize to [0, 1]
    
    // Normalize latitude and longitude (simple min-max scaling)
    // This is a simplification - in production, use proper geospatial normalization
    const normalizedLat = (item.latitude + 90) / 180;
    const normalizedLng = (item.longitude + 180) / 360;
    
    // Normalize demand and supply counts (simple log normalization)
    const normalizedDemand = item.demand_count ? Math.log1p(item.demand_count) / 10 : 0;
    const normalizedSupply = item.supply_count ? Math.log1p(item.supply_count) / 10 : 0;
    
    features.push([
      hourOfDay,
      dayOfWeek,
      normalizedDemand,
      normalizedSupply,
      normalizedLat,
      normalizedLng
    ]);
    
    labels.push(item.surge_factor);
  });
  
  return {
    features: tf.tensor2d(features),
    labels: tf.tensor1d(labels)
  };
};

/**
 * Trains the surge prediction model with the provided data
 */
export const trainSurgePredictionModel = async (data: ProcessedData[]): Promise<tf.Sequential> => {
  console.log(`Training model with ${data.length} data points...`);
  
  if (data.length < 10) {
    throw new Error('Insufficient data for training. Need at least 10 data points.');
  }
  
  // Preprocess the data
  const { features, labels } = preprocessData(data);
  
  // Create or load the model
  let model: tf.Sequential;
  try {
    model = await loadSurgePredictionModel();
    console.log('Loaded existing model for further training');
  } catch (error) {
    console.log('Creating new model');
    model = createSurgePredictionModel();
  }
  
  // Train the model
  const history = await model.fit(features, labels, {
    epochs: EPOCHS,
    batchSize: BATCH_SIZE,
    validationSplit: VALIDATION_SPLIT,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch + 1}/${EPOCHS} - loss: ${logs?.loss.toFixed(4)} - mse: ${logs?.mse.toFixed(4)}`);
      }
    }
  });
  
  // Save the trained model
  await saveModel(model);
  
  // Clean up tensors
  features.dispose();
  labels.dispose();
  
  console.log('Model training completed');
  return model;
};

/**
 * Saves the model to disk
 */
export const saveModel = async (model: tf.Sequential): Promise<void> => {
  try {
    // Ensure directory exists
    if (!fs.existsSync(path.dirname(MODEL_PATH))) {
      fs.mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
    }
    
    await model.save(`file://${MODEL_PATH}`);
    console.log(`Model saved to ${MODEL_PATH}`);
  } catch (error) {
    console.error('Error saving model:', error);
    throw error;
  }
};

/**
 * Loads the surge prediction model from disk
 */
export const loadSurgePredictionModel = async (): Promise<tf.Sequential> => {
  try {
    const model = await tf.loadLayersModel(`file://${MODEL_PATH}/model.json`);
    console.log(`Model loaded from ${MODEL_PATH}`);
    return model as tf.Sequential;
  } catch (error) {
    console.error('Error loading model:', error);
    throw error;
  }
};

/**
 * Makes predictions using the trained model
 */
export const makePredictions = (
  model: tf.Sequential,
  data: ProcessedData[]
): number[] => {
  // Preprocess the data
  const { features } = preprocessData(data);
  
  // Make predictions
  const predictions = model.predict(features) as tf.Tensor;
  
  // Convert to array
  const predictionValues = Array.from(predictions.dataSync());
  
  // Clean up tensors
  features.dispose();
  predictions.dispose();
  
  return predictionValues;
}; 