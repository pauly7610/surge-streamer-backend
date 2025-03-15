import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PipelineManager } from './pipeline/PipelineManager';
import config from './config';
import { RideRequestConnector } from './connectors/RideRequestConnector';
import { WeatherConnector } from './connectors/WeatherConnector';
import { TrafficConnector } from './connectors/TrafficConnector';
import { EventsConnector } from './connectors/EventsConnector';
import { StreamProcessor } from './pipeline/StreamProcessor';
import { DataService } from './services/DataService';
import { LocationService } from './services/LocationService';
import { PredictionService } from './services/PredictionService';
import { NotificationService } from './services/NotificationService';
import { PriceLockService } from './services/PriceLockService';
import { DriverGuidanceService } from './services/DriverGuidanceService';
import { Logger } from './utils/Logger';

// Initialize logger
const logger = new Logger('Main');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Create pipeline manager
const pipelineManager = new PipelineManager();

// Health check endpoint
app.get('/health', (req, res) => {
  const status = pipelineManager.getStatus();
  res.json({
    status: 'ok',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.env,
    pipeline: status
  });
});

// API routes
app.get('/api/status', (req, res) => {
  const status = pipelineManager.getStatus();
  res.json(status);
});

// Start the pipeline
app.post('/api/pipeline/start', async (req, res) => {
  try {
    await pipelineManager.start();
    res.json({ success: true, message: 'Pipeline started' });
  } catch (error) {
    console.error('Error starting pipeline:', error);
    res.status(500).json({ success: false, message: 'Failed to start pipeline', error: (error as Error).message });
  }
});

// Stop the pipeline
app.post('/api/pipeline/stop', async (req, res) => {
  try {
    await pipelineManager.stop();
    res.json({ success: true, message: 'Pipeline stopped' });
  } catch (error) {
    console.error('Error stopping pipeline:', error);
    res.status(500).json({ success: false, message: 'Failed to stop pipeline', error: (error as Error).message });
  }
});

/**
 * Main application class
 */
class SurgeStreamerApp {
  private dataService: DataService;
  private locationService: LocationService;
  private streamProcessor: StreamProcessor;
  private pipelineManager: PipelineManager;
  private predictionService: PredictionService;
  private notificationService: NotificationService;
  private priceLockService: PriceLockService;
  private driverGuidanceService: DriverGuidanceService;
  private predictionInterval: NodeJS.Timeout | null = null;
  private driverGuidanceInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize services
    this.dataService = new DataService();
    this.locationService = new LocationService();
    this.streamProcessor = new StreamProcessor();
    this.pipelineManager = new PipelineManager();
    this.notificationService = new NotificationService();
    this.priceLockService = new PriceLockService(this.dataService);
    this.predictionService = new PredictionService(
      this.dataService,
      this.locationService,
      this.streamProcessor,
      this.notificationService,
      this.priceLockService
    );
    this.driverGuidanceService = new DriverGuidanceService(
      this.dataService,
      this.locationService,
      this.streamProcessor
    );
  }

  /**
   * Initialize the application
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing Surge Streamer application');
      
      // Connect to database
      await this.dataService.connect();
      logger.info('Connected to database');
      
      // Initialize location service
      await this.locationService.connect();
      logger.info('Location service initialized');
      
      // Initialize stream processor
      // Note: StreamProcessor doesn't have a connect method, but we'll assume it's initialized in the constructor
      logger.info('Stream processor initialized');
      
      // Start pipeline manager
      await this.pipelineManager.start();
      logger.info('Pipeline manager initialized');
      
      // Initialize prediction service
      await this.predictionService.initialize();
      logger.info('Prediction service initialized');
      
      logger.info('Surge Streamer application initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  /**
   * Start the application
   */
  public async start(): Promise<void> {
    try {
      logger.info('Starting Surge Streamer application');
      
      // Schedule regular predictions
      this.schedulePredictions();
      
      // Schedule driver guidance recommendations
      this.scheduleDriverGuidance();
      
      // Schedule cleanup tasks
      this.scheduleCleanupTasks();
      
      logger.info('Surge Streamer application started successfully');
    } catch (error) {
      logger.error('Failed to start application:', error);
      throw error;
    }
  }

  /**
   * Stop the application
   */
  public async stop(): Promise<void> {
    try {
      logger.info('Stopping Surge Streamer application');
      
      // Stop the pipeline manager
      await this.pipelineManager.stop();
      
      // Clear intervals
      if (this.predictionInterval) {
        clearInterval(this.predictionInterval);
        this.predictionInterval = null;
      }
      
      if (this.driverGuidanceInterval) {
        clearInterval(this.driverGuidanceInterval);
        this.driverGuidanceInterval = null;
      }
      
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      
      logger.info('Surge Streamer application stopped successfully');
    } catch (error) {
      logger.error('Failed to stop application:', error);
      throw error;
    }
  }

  /**
   * Schedule regular predictions
   */
  private schedulePredictions(): void {
    // Generate predictions every 5 minutes
    const predictionIntervalMs = 5 * 60 * 1000;
    
    // Generate initial predictions
    this.generatePredictions();
    
    // Schedule regular predictions
    this.predictionInterval = setInterval(() => {
      this.generatePredictions();
    }, predictionIntervalMs);
    
    logger.info('Scheduled predictions every 5 minutes');
  }

  /**
   * Generate predictions for all locations
   */
  private async generatePredictions(): Promise<void> {
    try {
      logger.info('Generating predictions for all locations');
      const predictions = await this.predictionService.generatePredictionsForAllLocations();
      logger.info(`Generated ${predictions.length} predictions`);
    } catch (error) {
      logger.error('Failed to generate predictions:', error);
    }
  }

  /**
   * Schedule driver guidance recommendations
   */
  private scheduleDriverGuidance(): void {
    // Generate driver guidance every 10 minutes
    const driverGuidanceIntervalMs = 10 * 60 * 1000;
    
    // Generate initial driver guidance
    this.generateDriverGuidance();
    
    // Schedule regular driver guidance
    this.driverGuidanceInterval = setInterval(() => {
      this.generateDriverGuidance();
    }, driverGuidanceIntervalMs);
    
    logger.info('Scheduled driver guidance every 10 minutes');
  }

  /**
   * Generate driver guidance recommendations
   */
  private async generateDriverGuidance(): Promise<void> {
    try {
      logger.info('Generating driver guidance recommendations');
      const recommendations = await this.driverGuidanceService.generateDriverRecommendations();
      logger.info(`Generated ${recommendations.length} driver guidance recommendations`);
    } catch (error) {
      logger.error('Failed to generate driver guidance:', error);
    }
  }

  /**
   * Schedule cleanup tasks
   */
  private scheduleCleanupTasks(): void {
    // Run cleanup tasks every hour
    const cleanupIntervalMs = 60 * 60 * 1000;
    
    // Schedule regular cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanupTasks();
    }, cleanupIntervalMs);
    
    logger.info('Scheduled cleanup tasks every hour');
  }

  /**
   * Run cleanup tasks
   */
  private async runCleanupTasks(): Promise<void> {
    try {
      logger.info('Running cleanup tasks');
      
      // Clean up expired price locks
      const expiredLocks = await this.priceLockService.cleanupExpiredLocks();
      logger.info(`Cleaned up ${expiredLocks} expired price locks`);
      
      // Add more cleanup tasks as needed
      
      logger.info('Cleanup tasks completed');
    } catch (error) {
      logger.error('Failed to run cleanup tasks:', error);
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    const app = new SurgeStreamerApp();
    
    // Handle shutdown signals
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT signal');
      await app.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM signal');
      await app.stop();
      process.exit(0);
    });
    
    // Initialize and start the application
    await app.initialize();
    await app.start();
    
    logger.info('Surge Streamer application is running');
  } catch (error) {
    logger.error('Application failed to start:', error);
    process.exit(1);
  }
}

// Start the application
main();

// Start the server
const PORT = config.server.port;
const HOST = config.server.host;

app.listen(PORT, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});