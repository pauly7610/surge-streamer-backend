// Global type declarations

// Declare modules that don't have type definitions
declare module 'h3-js';
declare module 'dotenv';
declare module 'dotenv-expand';
declare module 'cors';
declare module 'helmet';
declare module 'compression';

// TensorFlow.js declarations
declare module '@tensorflow/tfjs-node' {
  export interface Sequential {
    add(layer: any): void;
    compile(config: any): void;
    predict(x: any): any;
    fit(x: any, y: any, config?: any): Promise<any>;
    save(path: string): Promise<any>;
  }

  export interface Tensor {
    dataSync(): Float32Array;
    dispose(): void;
  }

  export namespace layers {
    function dense(config: any): any;
    function dropout(config: any): any;
  }

  export namespace train {
    function adam(learningRate: number): any;
  }

  export function sequential(): Sequential;
  export function tensor1d(values: number[]): Tensor;
  export function tensor2d(values: number[][]): Tensor;
  export function loadLayersModel(path: string): Promise<Sequential>;
  export function mean(tensor: any, axis?: number): Tensor;
  export function std(tensor: any, axis?: number): Tensor;
}

// Kafka.js declarations
declare module 'kafkajs' {
  export interface Producer {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    send(record: any): Promise<any>;
  }

  export interface Consumer {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    subscribe(options: any): Promise<void>;
    run(options: any): Promise<void>;
  }

  export interface EachMessagePayload {
    topic: string;
    partition: number;
    message: {
      key: Buffer | null;
      value: Buffer | null;
      headers: Record<string, Buffer>;
      timestamp: string;
      offset: string;
    };
  }

  export interface Kafka {
    producer(options?: any): Producer;
    consumer(options: any): Consumer;
  }

  export class Kafka {
    constructor(config: any);
    producer(options?: any): Producer;
    consumer(options: any): Consumer;
  }
}

// Feature Engineering module
declare module './featureEngineering' {
  import { GeoPoint, DemandSupplyData } from '../types';
  export function generateFeatures(
    location: GeoPoint,
    demandSupply: DemandSupplyData
  ): Promise<number[]>;
}

// Express module
declare module 'express' {
  import { Server } from 'http';
  
  interface Response {
    status(code: number): Response;
    json(body: any): Response;
    send(body: any): Response;
  }
  
  interface Request {
    query: {
      [key: string]: string | string[] | undefined;
    };
    body: any;
  }
  
  interface Application {
    use(middleware: any): Application;
    get(path: string, handler: (req: Request, res: Response) => void): Application;
    post(path: string, handler: (req: Request, res: Response) => void): Application;
    put(path: string, handler: (req: Request, res: Response) => void): Application;
    delete(path: string, handler: (req: Request, res: Response) => void): Application;
    listen(port: number, callback?: () => void): Server;
  }
  
  function express(): Application;
  
  namespace express {
    function json(): any;
    function urlencoded(options: { extended: boolean }): any;
    function static(root: string): any;
  }
  
  export = express;
}

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
    KAFKA_BROKERS: string;
    REDIS_HOST: string;
    REDIS_PORT: string;
    REDIS_PASSWORD: string;
    REDIS_CACHE_TTL: string;
    ML_MODEL_PATH: string;
    ML_PREDICTION_INTERVAL: string;
    ML_TRAINING_INTERVAL: string;
    ML_HISTORY_WINDOW_SIZE: string;
    WEATHER_API_KEY: string;
    WEATHER_API_URL: string;
    TRAFFIC_API_KEY: string;
    TRAFFIC_API_URL: string;
    EVENTS_API_KEY: string;
    EVENTS_API_URL: string;
  }
}

// Add any other global type declarations here 