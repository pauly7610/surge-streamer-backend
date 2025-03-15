import { StreamProcessor } from './StreamProcessor';
import { RideRequestConnector } from '../connectors/RideRequestConnector';
import { WeatherConnector } from '../connectors/WeatherConnector';
import { TrafficConnector } from '../connectors/TrafficConnector';
import { EventsConnector } from '../connectors/EventsConnector';
import config from '../config';
import { Logger } from '../utils/Logger';
import { DataSourceConnector } from '../connectors/DataSourceConnector';

/**
 * Pipeline manager for coordinating data flow
 */
export class PipelineManager {
  private streamProcessor: StreamProcessor;
  private connectors: {
    rideRequest: RideRequestConnector;
    weather: WeatherConnector;
    traffic: TrafficConnector;
    events: EventsConnector;
  };
  private isRunning: boolean = false;

  /**
   * Create a new pipeline manager
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
  }

  /**
   * Start the pipeline
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Pipeline is already running');
      return;
    }

    try {
      // Start the stream processor
      await this.streamProcessor.start();
      
      this.isRunning = true;
      console.log('Pipeline started successfully');
    } catch (error) {
      console.error('Failed to start pipeline:', error);
      throw error;
    }
  }

  /**
   * Stop the pipeline
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('Pipeline is not running');
      return;
    }

    try {
      // Stop the stream processor
      await this.streamProcessor.stop();
      
      this.isRunning = false;
      console.log('Pipeline stopped successfully');
    } catch (error) {
      console.error('Failed to stop pipeline:', error);
      throw error;
    }
  }

  /**
   * Check if the pipeline is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get the status of the pipeline
   */
  getStatus(): {
    isRunning: boolean;
    connectors: {
      rideRequest: boolean;
      weather: boolean;
      traffic: boolean;
      events: boolean;
    };
  } {
    return {
      isRunning: this.isRunning,
      connectors: {
        rideRequest: this.connectors.rideRequest.isConnected(),
        weather: this.connectors.weather.isConnected(),
        traffic: this.connectors.traffic.isConnected(),
        events: this.connectors.events.isConnected(),
      },
    };
  }

  /**
   * Get all connectors
   * @returns Array of connectors
   */
  getConnectors(): DataSourceConnector[] {
    return Object.values(this.connectors);
  }
} 