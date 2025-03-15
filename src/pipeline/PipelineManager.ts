import { StreamProcessor } from './StreamProcessor';
import { DataSourceConnector, DataEvent } from '../connectors/DataSourceConnector';
import { RideRequestConnector } from '../connectors/RideRequestConnector';
import { DriverLocationConnector } from '../connectors/DriverLocationConnector';
import * as GeospatialUtils from '../utils/GeospatialUtils';
import config from '../config';

/**
 * Pipeline manager for coordinating data processing pipelines
 */
export class PipelineManager {
  private connectors: Map<string, DataSourceConnector> = new Map();
  private processors: Map<string, StreamProcessor> = new Map();
  private isRunning: boolean = false;
  private subscriptions: { connector: string; processor: string }[] = [];

  /**
   * Create a new pipeline manager
   */
  constructor() {
    // Initialize connectors
    this.initializeConnectors();
    
    // Initialize processors
    this.initializeProcessors();
    
    // Set up subscriptions
    this.setupSubscriptions();
  }

  /**
   * Start all connectors and processors
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      // Start all connectors
      for (const [name, connector] of this.connectors.entries()) {
        await connector.connect();
        console.log(`Started connector: ${name}`);
      }

      // Start all processors
      for (const [name, processor] of this.processors.entries()) {
        processor.start();
        console.log(`Started processor: ${name}`);
      }

      this.isRunning = true;
      console.log('Pipeline manager started');
    } catch (error) {
      console.error('Error starting pipeline manager:', error);
      await this.stop();
      throw error;
    }
  }

  /**
   * Stop all connectors and processors
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop all processors
      for (const [name, processor] of this.processors.entries()) {
        processor.stop();
        console.log(`Stopped processor: ${name}`);
      }

      // Stop all connectors
      for (const [name, connector] of this.connectors.entries()) {
        await connector.disconnect();
        console.log(`Stopped connector: ${name}`);
      }

      this.isRunning = false;
      console.log('Pipeline manager stopped');
    } catch (error) {
      console.error('Error stopping pipeline manager:', error);
      throw error;
    }
  }

  /**
   * Get the status of all connectors and processors
   */
  getStatus(): {
    isRunning: boolean;
    connectors: { name: string; status: string }[];
    processors: { name: string; metrics: any }[];
  } {
    const connectorStatus = Array.from(this.connectors.entries()).map(([name, connector]) => ({
      name,
      status: connector.isConnected() ? 'connected' : 'disconnected',
      metadata: connector.getMetadata()
    }));

    const processorStatus = Array.from(this.processors.entries()).map(([name, processor]) => ({
      name,
      metrics: processor.getMetrics()
    }));

    return {
      isRunning: this.isRunning,
      connectors: connectorStatus,
      processors: processorStatus
    };
  }

  /**
   * Initialize data source connectors
   * @private
   */
  private initializeConnectors(): void {
    // Ride request connector
    const rideRequestConnector = new RideRequestConnector();
    this.connectors.set('ride-request', rideRequestConnector);

    // Driver location connector
    const driverLocationConnector = new DriverLocationConnector();
    this.connectors.set('driver-location', driverLocationConnector);

    // Add more connectors as needed
  }

  /**
   * Initialize data processors
   * @private
   */
  private initializeProcessors(): void {
    // Ride request processor
    const rideRequestProcessor = new StreamProcessor('ride-request-processor', {
      enableKafka: true,
      kafkaTopic: config.kafka.topics.rideRequests
    });

    // Add processing stages
    rideRequestProcessor.addStage(this.enrichRideRequestWithH3);
    this.processors.set('ride-request', rideRequestProcessor);

    // Driver location processor
    const driverLocationProcessor = new StreamProcessor('driver-location-processor', {
      enableKafka: true,
      kafkaTopic: config.kafka.topics.driverLocations
    });

    // Add processing stages
    driverLocationProcessor.addStage(this.enrichDriverLocationWithH3);
    this.processors.set('driver-location', driverLocationProcessor);

    // Supply-demand processor
    const supplyDemandProcessor = new StreamProcessor('supply-demand-processor');
    this.processors.set('supply-demand', supplyDemandProcessor);

    // Add more processors as needed
  }

  /**
   * Set up subscriptions between connectors and processors
   * @private
   */
  private setupSubscriptions(): void {
    // Subscribe ride request processor to ride request connector
    const rideRequestConnector = this.connectors.get('ride-request');
    const rideRequestProcessor = this.processors.get('ride-request');

    if (rideRequestConnector && rideRequestProcessor) {
      rideRequestConnector.getStream().subscribe({
        next: (event) => {
          rideRequestProcessor.processEvent(event);
        },
        error: (error) => {
          console.error('Error in ride request subscription:', error);
        }
      });

      this.subscriptions.push({
        connector: 'ride-request',
        processor: 'ride-request'
      });
    }

    // Subscribe driver location processor to driver location connector
    const driverLocationConnector = this.connectors.get('driver-location');
    const driverLocationProcessor = this.processors.get('driver-location');

    if (driverLocationConnector && driverLocationProcessor) {
      driverLocationConnector.getStream().subscribe({
        next: (event) => {
          driverLocationProcessor.processEvent(event);
        },
        error: (error) => {
          console.error('Error in driver location subscription:', error);
        }
      });

      this.subscriptions.push({
        connector: 'driver-location',
        processor: 'driver-location'
      });
    }

    // Set up more subscriptions as needed
  }

  /**
   * Enrich ride request data with H3 index
   * @param rideRequest Ride request data
   * @private
   */
  private async enrichRideRequestWithH3(rideRequest: any): Promise<any> {
    try {
      // Add H3 index for the pickup location
      if (rideRequest.pickupLocation) {
        const h3Index = GeospatialUtils.coordsToH3({
          latitude: rideRequest.pickupLocation.latitude,
          longitude: rideRequest.pickupLocation.longitude
        });

        return {
          ...rideRequest,
          h3Index
        };
      }

      return rideRequest;
    } catch (error) {
      console.error('Error enriching ride request with H3:', error);
      return rideRequest;
    }
  }

  /**
   * Enrich driver location data with H3 index
   * @param driverLocation Driver location data
   * @private
   */
  private async enrichDriverLocationWithH3(driverLocation: any): Promise<any> {
    try {
      // Add H3 index for the driver location
      if (driverLocation.latitude !== undefined && driverLocation.longitude !== undefined) {
        const h3Index = GeospatialUtils.latLngToH3(
          driverLocation.latitude,
          driverLocation.longitude
        );

        return {
          ...driverLocation,
          h3Index
        };
      } else if (driverLocation.location) {
        const h3Index = GeospatialUtils.coordsToH3({
          latitude: driverLocation.location.latitude,
          longitude: driverLocation.location.longitude
        });

        return {
          ...driverLocation,
          h3Index
        };
      }

      return driverLocation;
    } catch (error) {
      console.error('Error enriching driver location with H3:', error);
      return driverLocation;
    }
  }
} 