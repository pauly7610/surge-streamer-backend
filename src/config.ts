import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import * as path from 'path';
import * as fs from 'fs';

// Determine which .env file to use based on NODE_ENV
const NODE_ENV = process.env.NODE_ENV || 'development';
const envFile = `.env.${NODE_ENV}`;

// First load the default .env file
let env = dotenv.config();
dotenvExpand.expand(env);

// Then try to load the environment-specific .env file
const envPath = path.resolve(process.cwd(), envFile);
if (fs.existsSync(envPath)) {
  env = dotenv.config({ path: envPath });
  dotenvExpand.expand(env);
}

// Configuration object with typed values
export const config = {
  env: NODE_ENV,
  
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  
  geospatial: {
    defaultH3Resolution: parseInt(process.env.DEFAULT_H3_RESOLUTION || '8', 10),
    defaultBoundingBoxRadiusKm: parseFloat(process.env.DEFAULT_BOUNDING_BOX_RADIUS_KM || '10'),
  },
  
  pipeline: {
    intervalMs: parseInt(process.env.PIPELINE_INTERVAL_MS || '60000', 10),
    maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '1000', 10),
    cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
  },
  
  performance: {
    workerThreads: parseInt(process.env.WORKER_THREADS || '1', 10),
    maxConnections: parseInt(process.env.MAX_CONNECTIONS || '100', 10),
  },
  
  kafka: {
    clientId: 'surge-streamer',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
    topics: {
      driverLocations: 'driver-locations',
      rideRequests: 'ride-requests',
      surgePredictions: 'surge-predictions',
      weatherData: 'weather-data',
      trafficData: 'traffic-data',
      eventData: 'event-data'
    },
    consumerGroup: 'surge-streamer-group'
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    cacheTtl: parseInt(process.env.REDIS_CACHE_TTL || '3600', 10)
  },
  
  ml: {
    modelPath: process.env.ML_MODEL_PATH || path.join(__dirname, '../models'),
    predictionInterval: parseInt(process.env.ML_PREDICTION_INTERVAL || '300000', 10), // 5 minutes
    trainingInterval: parseInt(process.env.ML_TRAINING_INTERVAL || '86400000', 10), // 24 hours
    historyWindowSize: parseInt(process.env.ML_HISTORY_WINDOW_SIZE || '168', 10), // 7 days in hours
    features: [
      'hour_of_day',
      'day_of_week',
      'is_weekend',
      'is_holiday',
      'temperature',
      'precipitation',
      'wind_speed',
      'traffic_congestion',
      'event_proximity',
      'historical_demand',
      'historical_supply'
    ]
  },
  
  externalApis: {
    weather: {
      apiKey: process.env.WEATHER_API_KEY || '',
      baseUrl: process.env.WEATHER_API_URL || 'https://api.openweathermap.org/data/2.5'
    },
    traffic: {
      apiKey: process.env.TRAFFIC_API_KEY || '',
      baseUrl: process.env.TRAFFIC_API_URL || 'https://api.tomtom.com/traffic/services'
    },
    events: {
      apiKey: process.env.EVENTS_API_KEY || '',
      baseUrl: process.env.EVENTS_API_URL || 'https://api.predicthq.com/v1'
    }
  },
  
  // Additional environment-specific settings
  isDevelopment: NODE_ENV === 'development',
  isProduction: NODE_ENV === 'production',
  isTest: NODE_ENV === 'test',
  isStaging: NODE_ENV === 'staging',
};

export default config; 