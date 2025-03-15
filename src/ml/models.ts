import * as tf from '@tensorflow/tfjs-node';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import { ProcessedData } from '../types';

// Initialize logger
const logger = new Logger('MLModels');

// Create model directory if it doesn't exist
const modelDir = path.join(__dirname, '../../models');
if (!fs.existsSync(modelDir)) {
  fs.mkdirSync(modelDir, { recursive: true });
}

// Define model paths
const MODEL_PATH = path.join(modelDir, 'surge-prediction-model');
const NORM_PARAMS_PATH = path.join(modelDir, 'normalization.json');
const ARIMA_MODEL_PATH = path.join(modelDir, 'arima-model');
const LSTM_MODEL_PATH = path.join(modelDir, 'lstm-model');
const GB_MODEL_PATH = path.join(modelDir, 'gb-model');

// Feature normalization parameters
let featureMeans = Array(22).fill(0);
let featureStds = Array(22).fill(1);

// Model hyperparameters
const LEARNING_RATE = 0.001;
const BATCH_SIZE = 32;
const EPOCHS = 100;
const VALIDATION_SPLIT = 0.2;

// Model instances
let mainModel: tf.Sequential | null = null;
let lstmModel: tf.Sequential | null = null;
let arimaModel: tf.Sequential | null = null;
let gbModel: tf.Sequential | null = null;

// Type assertion for TensorFlow.js to fix linter errors
const tfAny = tf as any;

/**
 * Create the main surge prediction model
 */
export const createSurgePredictionModel = (): tf.Sequential => {
  logger.info('Creating surge prediction model');
  
  const model = tf.sequential();
  
  // Input layer
  model.add(tf.layers.dense({
    units: 64,
    activation: 'relu',
    inputShape: [22],
    kernelInitializer: 'heNormal',
    kernelRegularizer: tfAny.regularizers.l2({ l2: 0.001 })
  }));
  
  // Add batch normalization
  model.add(tfAny.layers.batchNormalization());
  
  // Hidden layer 1
  model.add(tf.layers.dense({
    units: 32,
    activation: 'relu',
    kernelInitializer: 'heNormal',
    kernelRegularizer: tfAny.regularizers.l2({ l2: 0.001 })
  }));
  
  // Add batch normalization
  model.add(tfAny.layers.batchNormalization());
  
  // Add dropout for regularization
  model.add(tf.layers.dropout({ rate: 0.3 }));
  
  // Output layer
  model.add(tf.layers.dense({
    units: 1,
    activation: 'sigmoid'
  }));
  
  // Compile the model
  model.compile({
    optimizer: tf.train.adam(LEARNING_RATE),
    loss: 'meanSquaredError',
    metrics: ['mse']
  });
  
  logger.info('Model created successfully');
  return model;
};

/**
 * Create LSTM model for time series prediction
 */
export const createLSTMModel = (): tf.Sequential => {
  logger.info('Creating LSTM model');
  
  const model = tf.sequential();
  
  // Input layer
  model.add(tfAny.layers.reshape({
    targetShape: [1, 22],
    inputShape: [22]
  }));
  
  // LSTM layer
  model.add(tfAny.layers.lstm({
    units: 64,
    returnSequences: false,
    recurrentRegularizer: tfAny.regularizers.l2({ l2: 0.001 })
  }));
  
  // Dense hidden layer
  model.add(tf.layers.dense({
    units: 32,
    activation: 'relu'
  }));
  
  // Dropout for regularization
  model.add(tf.layers.dropout({ rate: 0.3 }));
  
  // Output layer
  model.add(tf.layers.dense({
    units: 1,
    activation: 'sigmoid'
  }));
  
  // Compile the model
  model.compile({
    optimizer: tf.train.adam(LEARNING_RATE),
    loss: 'meanSquaredError',
    metrics: ['mse']
  });
  
  logger.info('LSTM model created successfully');
  return model;
};

/**
 * Create ARIMA-like model (using a simple RNN as a proxy)
 */
export const createARIMAModel = (): tf.Sequential => {
  logger.info('Creating ARIMA-like model');
  
  const model = tf.sequential();
  
  // Input layer
  model.add(tfAny.layers.reshape({
    targetShape: [1, 22],
    inputShape: [22]
  }));
  
  // Simple RNN layer
  model.add(tfAny.layers.simpleRNN({
    units: 32,
    returnSequences: false
  }));
  
  // Dense hidden layer
  model.add(tf.layers.dense({
    units: 16,
    activation: 'relu'
  }));
  
  // Output layer
  model.add(tf.layers.dense({
    units: 1,
    activation: 'sigmoid'
  }));
  
  // Compile the model
  model.compile({
    optimizer: tf.train.adam(LEARNING_RATE),
    loss: 'meanSquaredError',
    metrics: ['mse']
  });
  
  logger.info('ARIMA-like model created successfully');
  return model;
};

/**
 * Create Gradient Boosting-like model (using a deep neural network as a proxy)
 */
export const createGBModel = (): tf.Sequential => {
  logger.info('Creating Gradient Boosting-like model');
  
  const model = tf.sequential();
  
  // Input layer
  model.add(tf.layers.dense({
    units: 128,
    activation: 'relu',
    inputShape: [22]
  }));
  
  // Hidden layers with residual connections
  for (let i = 0; i < 3; i++) {
    // Use type assertion to access layers property
    const modelAny = model as any;
    const input = modelAny.layers[modelAny.layers.length - 1].output;
    const dense = tf.layers.dense({
      units: 128,
      activation: 'relu'
    }).apply(input);
    
    // Add residual connection
    const output = tfAny.layers.add().apply([input, dense]);
    model.add(tfAny.layers.activation({ activation: 'relu' }));
  }
  
  // Output layer
  model.add(tf.layers.dense({
    units: 1,
    activation: 'sigmoid'
  }));
  
  // Compile the model
  model.compile({
    optimizer: tf.train.adam(LEARNING_RATE),
    loss: 'meanSquaredError',
    metrics: ['mse']
  });
  
  logger.info('Gradient Boosting-like model created successfully');
  return model;
};

/**
 * Normalize features for model input
 */
export const normalizeFeatures = (features: number[][]): number[][] => {
  return features.map(feature => 
    feature.map((value, index) => 
      (value - featureMeans[index]) / featureStds[index]
    )
  );
};

/**
 * Calculate feature means and standard deviations
 */
export const calculateNormalizationParams = (features: number[][]): void => {
  const numFeatures = features[0].length;
  const numSamples = features.length;
  
  // Calculate means
  featureMeans = Array(numFeatures).fill(0);
  for (let i = 0; i < numSamples; i++) {
    for (let j = 0; j < numFeatures; j++) {
      featureMeans[j] += features[i][j] / numSamples;
    }
  }
  
  // Calculate standard deviations
  featureStds = Array(numFeatures).fill(0);
  for (let i = 0; i < numSamples; i++) {
    for (let j = 0; j < numFeatures; j++) {
      featureStds[j] += Math.pow(features[i][j] - featureMeans[j], 2) / numSamples;
    }
  }
  featureStds = featureStds.map(std => Math.sqrt(std));
  
  // Replace zero standard deviations with 1 to avoid division by zero
  for (let j = 0; j < numFeatures; j++) {
    if (featureStds[j] < 0.0001) {
      featureStds[j] = 1;
    }
  }
  
  // Save normalization parameters
  try {
    fs.writeFileSync(
      NORM_PARAMS_PATH,
      JSON.stringify({ means: featureMeans, stds: featureStds })
    );
    logger.info('Normalization parameters saved successfully');
  } catch (error) {
    logger.error('Failed to save normalization parameters:', error);
  }
};

/**
 * Load normalization parameters
 */
export const loadNormalizationParams = (): void => {
  try {
    if (fs.existsSync(NORM_PARAMS_PATH)) {
      const normData = JSON.parse(fs.readFileSync(NORM_PARAMS_PATH, 'utf8'));
      featureMeans = normData.means;
      featureStds = normData.stds;
      logger.info('Normalization parameters loaded successfully');
    } else {
      logger.warn('Normalization parameters file not found');
    }
  } catch (error) {
    logger.error('Failed to load normalization parameters:', error);
  }
};

/**
 * Preprocesses the data for model training
 */
export const preprocessData = (data: ProcessedData[]): { features: tf.Tensor; labels: tf.Tensor } => {
  logger.info(`Preprocessing ${data.length} data points`);
  
  // Extract features and labels
  const features: number[][] = [];
  const labels: number[] = [];
  
  for (const point of data) {
    // Extract features (this is a simplified example)
    const feature = [
      Math.sin((new Date(point.timestamp).getHours() * 2 * Math.PI) / 24), // Hour of day (sin)
      Math.cos((new Date(point.timestamp).getHours() * 2 * Math.PI) / 24), // Hour of day (cos)
      Math.sin((new Date(point.timestamp).getDay() * 2 * Math.PI) / 7),    // Day of week (sin)
      Math.cos((new Date(point.timestamp).getDay() * 2 * Math.PI) / 7),    // Day of week (cos)
      point.demand_count / 100, // Normalize demand
      point.supply_count / 100, // Normalize supply
      // Add more features as needed
    ];
    
    // Pad with zeros to match expected feature count
    while (feature.length < 22) {
      feature.push(0);
    }
    
    features.push(feature);
    labels.push((point.surge_factor - 1) / 2); // Normalize surge factor to 0-1
  }
  
  // Calculate normalization parameters
  calculateNormalizationParams(features);
  
  // Normalize features
  const normalizedFeatures = normalizeFeatures(features);
  
  // Convert to tensors
  const featureTensor = tf.tensor2d(normalizedFeatures);
  // Create a 2D tensor directly
  const labelTensor = tf.tensor2d(labels.map(l => [l]));
  
  return { features: featureTensor, labels: labelTensor };
};

/**
 * Train the model
 */
export const trainModel = async (data: ProcessedData[]): Promise<void> => {
  try {
    logger.info('Training model...');
    
    // Preprocess data
    const { features, labels } = preprocessData(data);
    
    // Create models if they don't exist
    if (!mainModel) mainModel = createSurgePredictionModel();
    if (!lstmModel) lstmModel = createLSTMModel();
    if (!arimaModel) arimaModel = createARIMAModel();
    if (!gbModel) gbModel = createGBModel();
    
    // Train main model
    await mainModel.fit(features, labels, {
      epochs: EPOCHS,
      batchSize: BATCH_SIZE,
      validationSplit: VALIDATION_SPLIT,
      callbacks: tfAny.callbacks ? {
        onEpochEnd: (epoch: number, logs: any) => {
          logger.info(`Epoch ${epoch + 1}/${EPOCHS}, Loss: ${logs?.loss.toFixed(4)}, Val Loss: ${logs?.val_loss.toFixed(4)}`);
        }
      } : undefined
    });
    
    // Train LSTM model
    await lstmModel.fit(features, labels, {
      epochs: EPOCHS,
      batchSize: BATCH_SIZE,
      validationSplit: VALIDATION_SPLIT
    });
    
    // Train ARIMA model
    await arimaModel.fit(features, labels, {
      epochs: EPOCHS,
      batchSize: BATCH_SIZE,
      validationSplit: VALIDATION_SPLIT
    });
    
    // Train GB model
    await gbModel.fit(features, labels, {
      epochs: EPOCHS,
      batchSize: BATCH_SIZE,
      validationSplit: VALIDATION_SPLIT
    });
    
    // Save models
    await saveModel();
    
    logger.info('Model training completed successfully');
  } catch (error) {
    logger.error('Failed to train model:', error);
    throw error;
  } finally {
    // Clean up tensors
    if (typeof tfAny.dispose === 'function') {
      tfAny.dispose();
    }
  }
};

/**
 * Save the model
 */
export const saveModel = async (): Promise<void> => {
  try {
    logger.info('Saving models...');
    
    if (mainModel) {
      await mainModel.save(`file://${MODEL_PATH}`);
      logger.info('Main model saved successfully');
    }
    
    if (lstmModel) {
      await lstmModel.save(`file://${LSTM_MODEL_PATH}`);
      logger.info('LSTM model saved successfully');
    }
    
    if (arimaModel) {
      await arimaModel.save(`file://${ARIMA_MODEL_PATH}`);
      logger.info('ARIMA model saved successfully');
    }
    
    if (gbModel) {
      await gbModel.save(`file://${GB_MODEL_PATH}`);
      logger.info('GB model saved successfully');
    }
  } catch (error) {
    logger.error('Failed to save models:', error);
    throw error;
  }
};

/**
 * Load the ML model
 */
export async function loadModel(): Promise<void> {
  try {
    // Check if model exists
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    
    // Load main model
    if (fs.existsSync(MODEL_PATH)) {
      mainModel = await tf.loadLayersModel(`file://${MODEL_PATH}/model.json`);
      logger.info('Main model loaded successfully');
    } else {
      // Create a new model if it doesn't exist
      logger.info('Main model not found, creating a new one');
      mainModel = createSurgePredictionModel();
    }
    
    // Load LSTM model
    if (fs.existsSync(LSTM_MODEL_PATH)) {
      lstmModel = await tf.loadLayersModel(`file://${LSTM_MODEL_PATH}/model.json`);
      logger.info('LSTM model loaded successfully');
    } else {
      logger.info('LSTM model not found, creating a new one');
      lstmModel = createLSTMModel();
    }
    
    // Load ARIMA model
    if (fs.existsSync(ARIMA_MODEL_PATH)) {
      arimaModel = await tf.loadLayersModel(`file://${ARIMA_MODEL_PATH}/model.json`);
      logger.info('ARIMA model loaded successfully');
    } else {
      logger.info('ARIMA model not found, creating a new one');
      arimaModel = createARIMAModel();
    }
    
    // Load GB model
    if (fs.existsSync(GB_MODEL_PATH)) {
      gbModel = await tf.loadLayersModel(`file://${GB_MODEL_PATH}/model.json`);
      logger.info('GB model loaded successfully');
    } else {
      logger.info('GB model not found, creating a new one');
      gbModel = createGBModel();
    }
    
    // Load normalization parameters
    if (fs.existsSync(NORM_PARAMS_PATH)) {
      const normParamsJson = fs.readFileSync(NORM_PARAMS_PATH, 'utf8');
      const normParams = JSON.parse(normParamsJson);
      featureMeans = normParams.means;
      featureStds = normParams.stds;
      logger.info('Normalization parameters loaded successfully');
    } else {
      logger.warn('Normalization parameters not found, using defaults');
    }
  } catch (error) {
    logger.error('Failed to load model:', error);
    throw error;
  }
}

/**
 * Make a prediction using the ML model
 * @param features Input features
 * @returns Predicted surge multiplier and confidence
 */
export async function makePrediction(features: number[]): Promise<{ surgeMultiplier: number, confidence: number }> {
  try {
    // Ensure models are loaded
    if (!mainModel || !lstmModel || !arimaModel || !gbModel) {
      await loadModel();
    }
    
    // Normalize features
    const normalizedFeatures = normalizeFeatures([[...features]]);
    
    // Convert to tensor
    const inputTensor = tf.tensor2d(normalizedFeatures);
    
    // Make predictions with each model
    const mainPrediction = mainModel!.predict(inputTensor) as tf.Tensor;
    const lstmPrediction = lstmModel!.predict(inputTensor) as tf.Tensor;
    const arimaPrediction = arimaModel!.predict(inputTensor) as tf.Tensor;
    const gbPrediction = gbModel!.predict(inputTensor) as tf.Tensor;
    
    // Get prediction values
    const mainValue = mainPrediction.dataSync()[0];
    const lstmValue = lstmPrediction.dataSync()[0];
    const arimaValue = arimaPrediction.dataSync()[0];
    const gbValue = gbPrediction.dataSync()[0];
    
    // Clean up tensors
    inputTensor.dispose();
    mainPrediction.dispose();
    lstmPrediction.dispose();
    arimaPrediction.dispose();
    gbPrediction.dispose();
    
    // Calculate volatility (standard deviation of predictions)
    const predictions = [mainValue, lstmValue, arimaValue, gbValue];
    const mean = predictions.reduce((sum, val) => sum + val, 0) / predictions.length;
    const variance = predictions.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / predictions.length;
    const volatility = Math.sqrt(variance);
    
    // Select best model based on volatility
    let finalPrediction: number;
    if (volatility > 0.2) {
      // High volatility - use GB model (more robust to outliers)
      finalPrediction = gbValue;
      logger.info('Using GB model due to high volatility');
    } else if (volatility > 0.1) {
      // Medium volatility - use LSTM model
      finalPrediction = lstmValue;
      logger.info('Using LSTM model due to medium volatility');
    } else {
      // Low volatility - use consensus (average)
      finalPrediction = mean;
      logger.info('Using consensus model due to low volatility');
    }
    
    // Calculate confidence based on volatility (inverse relationship)
    // Lower volatility = higher confidence
    const confidence = Math.max(0.5, Math.min(0.95, 1 - volatility * 2));
    
    // Convert prediction to surge multiplier (between 1.0 and 3.0)
    const surgeMultiplier = 1.0 + finalPrediction * 2.0;
    
    logger.info(`Prediction: ${surgeMultiplier.toFixed(2)}, Confidence: ${(confidence * 100).toFixed(0)}%`);
    
    return { 
      surgeMultiplier, 
      confidence 
    };
  } catch (error) {
    logger.error('Failed to make prediction:', error);
    return { 
      surgeMultiplier: 1.0, // Default surge multiplier
      confidence: 0.5 // Default confidence
    };
  }
}

/**
 * Evaluate the model performance
 */
export async function evaluateModel(testData: ProcessedData[]): Promise<{ mse: number, mae: number }> {
  try {
    // Ensure model is loaded
    if (!mainModel) {
      await loadModel();
    }
    
    // Preprocess test data
    const { features, labels } = preprocessData(testData);
    
    // Evaluate model
    const result = await (mainModel as any).evaluate(features, labels) as tf.Tensor[];
    const mse = result[0].dataSync()[0];
    
    // Calculate MAE manually
    const predictions = mainModel!.predict(features) as tf.Tensor;
    const predValues = predictions.dataSync();
    const labelValues = labels.dataSync();
    
    let sumAbsError = 0;
    for (let i = 0; i < predValues.length; i++) {
      sumAbsError += Math.abs(predValues[i] - labelValues[i]);
    }
    const mae = sumAbsError / predValues.length;
    
    // Clean up tensors
    features.dispose();
    labels.dispose();
    predictions.dispose();
    result.forEach(tensor => tensor.dispose());
    
    logger.info(`Model evaluation - MSE: ${mse.toFixed(4)}, MAE: ${mae.toFixed(4)}`);
    
    return { mse, mae };
  } catch (error) {
    logger.error('Failed to evaluate model:', error);
    throw error;
  }
}