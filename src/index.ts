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
  private streamProcessor: StreamProcessor;
  private connectors: {
    rideRequest: RideRequestConnector;
    weather: WeatherConnector;
    traffic: TrafficConnector;
    events: EventsConnector;
  };

  /**
   * Initialize the application
   */
  constructor() {
    // Create stream processor
    this.streamProcessor = new StreamProcessor();
    
    // Create connectors
    this.connectors = {
      rideRequest: new RideRequestConnector(),
      weather: new WeatherConnector(),
      traffic: new TrafficConnector(),
      events: new EventsConnector(),
    };
    
    // Add connectors to stream processor
    this.streamProcessor.addConnector(this.connectors.rideRequest);
    this.streamProcessor.addConnector(this.connectors.weather);
    this.streamProcessor.addConnector(this.connectors.traffic);
    this.streamProcessor.addConnector(this.connectors.events);
    
    // Set up shutdown handlers
    this.setupShutdownHandlers();
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    console.log('Starting Surge Streamer application...');
    
    try {
      // Start the stream processor
      await this.streamProcessor.start();
      
      console.log('Surge Streamer application started successfully');
    } catch (error) {
      console.error('Failed to start Surge Streamer application:', error);
      process.exit(1);
    }
  }

  /**
   * Stop the application
   */
  async stop(): Promise<void> {
    console.log('Stopping Surge Streamer application...');
    
    try {
      // Stop the stream processor
      await this.streamProcessor.stop();
      
      console.log('Surge Streamer application stopped successfully');
    } catch (error) {
      console.error('Failed to stop Surge Streamer application:', error);
      process.exit(1);
    }
  }

  /**
   * Set up shutdown handlers
   */
  private setupShutdownHandlers(): void {
    // Handle process termination signals
    process.on('SIGINT', async () => {
      console.log('Received SIGINT signal');
      await this.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM signal');
      await this.stop();
      process.exit(0);
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await this.stop();
      process.exit(1);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled promise rejection:', reason);
      await this.stop();
      process.exit(1);
    });
  }
}

// Create and start the application
const appInstance = new SurgeStreamerApp();
appInstance.start().catch((error) => {
  console.error('Error starting application:', error);
  process.exit(1);
});

// Start the server
const PORT = config.server.port;
const HOST = config.server.host;

app.listen(PORT, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  console.log(`Environment: ${config.env}`);
  
  // Auto-start pipeline in production
  if (config.isProd) {
    console.log('Auto-starting pipeline in production mode...');
    pipelineManager.start()
      .then(() => {
        console.log('Pipeline started successfully');
      })
      .catch((error) => {
        console.error('Failed to auto-start pipeline:', error);
      });
  } else {
    console.log('Pipeline not auto-started in development mode. Use /api/pipeline/start to start manually.');
  }
});

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pipelineManager.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await pipelineManager.stop();
  process.exit(0);
}); 