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
  
  // Additional environment-specific settings
  isDevelopment: NODE_ENV === 'development',
  isProduction: NODE_ENV === 'production',
  isTest: NODE_ENV === 'test',
  isStaging: NODE_ENV === 'staging',
};

export default config; 