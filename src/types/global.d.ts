// Global type declarations

// Declare modules that don't have type definitions
declare module 'h3-js';
declare module 'dotenv';
declare module 'dotenv-expand';

// Extend existing modules
declare namespace NodeJS {
  interface ProcessEnv {
    SUPABASE_URL: string;
    SUPABASE_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    NODE_ENV: 'development' | 'production' | 'test' | 'staging';
    PORT: string;
    HOST: string;
    LOG_LEVEL: string;
    DEFAULT_H3_RESOLUTION: string;
    DEFAULT_BOUNDING_BOX_RADIUS_KM: string;
    PIPELINE_INTERVAL_MS: string;
    MAX_BATCH_SIZE: string;
    CACHE_TTL_SECONDS: string;
    WORKER_THREADS: string;
    MAX_CONNECTIONS: string;
  }
}

// Add any other global type declarations here 