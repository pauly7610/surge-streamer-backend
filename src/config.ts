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
  env: NODE_ENV as 'development' | 'production' | 'test' | 'staging',
  
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
    defaultBoundingBoxRadiusKm: parseFloat(process.env.DEFAULT_BOUNDING_BOX_RADIUS_KM || '5'),
  },
  
  pipeline: {
    intervalMs: parseInt(process.env.PIPELINE_INTERVAL_MS || '5000', 10),
    maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '100', 10),
  },
  
  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
  },
  
  performance: {
    workerThreads: parseInt(process.env.WORKER_THREADS || '4', 10),
    maxConnections: parseInt(process.env.MAX_CONNECTIONS || '100', 10),
  },
  
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || 'surge-streamer',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    consumerGroup: process.env.KAFKA_CONSUMER_GROUP || 'surge-streamer-group',
    topics: {
      driverLocations: 'driver-locations',
      rideRequests: 'ride-requests',
      surgePredictions: 'surge-predictions',
      weatherData: 'weather-data',
      trafficData: 'traffic-data',
      eventData: 'event-data',
    },
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    cacheTtl: parseInt(process.env.REDIS_CACHE_TTL || '3600', 10),
  },
  
  ml: {
    modelPath: process.env.ML_MODEL_PATH || './models/surge-prediction',
    predictionInterval: parseInt(process.env.ML_PREDICTION_INTERVAL || '300000', 10), // 5 minutes
    trainingInterval: parseInt(process.env.ML_TRAINING_INTERVAL || '86400000', 10), // 24 hours
    historyWindowSize: parseInt(process.env.ML_HISTORY_WINDOW_SIZE || '7', 10), // 7 days
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
      'historical_supply',
    ],
  },
  
  dataSources: {
    rideRequest: {
      apiUrl: process.env.RIDE_REQUEST_API_URL || 'https://api.example.com/ride-requests',
      clientId: process.env.RIDE_REQUEST_CLIENT_ID || 'client-id',
      clientSecret: process.env.RIDE_REQUEST_CLIENT_SECRET || 'client-secret',
      refreshIntervalMs: parseInt(process.env.RIDE_REQUEST_REFRESH_INTERVAL_MS || '1000', 10),
    },
    driverLocation: {
      wsUrl: process.env.DRIVER_LOCATION_WS_URL || 'wss://api.example.com/driver-locations',
      jwtSecret: process.env.DRIVER_LOCATION_JWT_SECRET || 'jwt-secret',
      refreshIntervalMs: parseInt(process.env.DRIVER_LOCATION_REFRESH_INTERVAL_MS || '1000', 10),
    },
    weather: {
      apiUrl: process.env.WEATHER_API_URL || 'https://api.example.com/weather',
      apiKey: process.env.WEATHER_API_KEY || 'api-key',
      refreshIntervalMs: parseInt(process.env.WEATHER_REFRESH_INTERVAL_MS || '300000', 10), // 5 minutes
    },
    traffic: {
      apiUrl: process.env.TRAFFIC_API_URL || 'https://api.example.com/traffic',
      apiKey: process.env.TRAFFIC_API_KEY || 'api-key',
      refreshIntervalMs: parseInt(process.env.TRAFFIC_REFRESH_INTERVAL_MS || '30000', 10), // 30 seconds
    },
    events: {
      apiUrl: process.env.EVENTS_API_URL || 'https://api.example.com/events',
      apiKey: process.env.EVENTS_API_KEY || 'api-key',
      refreshIntervalMs: parseInt(process.env.EVENTS_REFRESH_INTERVAL_MS || '3600000', 10), // 1 hour
    },
    social: {
      apiUrl: process.env.SOCIAL_API_URL || 'https://api.example.com/social',
      oauthKey: process.env.SOCIAL_OAUTH_KEY || 'oauth-key',
      oauthSecret: process.env.SOCIAL_OAUTH_SECRET || 'oauth-secret',
      refreshIntervalMs: parseInt(process.env.SOCIAL_REFRESH_INTERVAL_MS || '60000', 10), // 1 minute
    },
  },
  
  // Additional environment-specific settings
  isDev: NODE_ENV === 'development',
  isProd: NODE_ENV === 'production',
  isTest: NODE_ENV === 'test',
  isStaging: NODE_ENV === 'staging',
};

export default config; 