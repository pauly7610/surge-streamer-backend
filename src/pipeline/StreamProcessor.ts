import { Subject, Observable, Subscription, merge } from 'rxjs';
import { filter, map, buffer, debounceTime, mergeMap, groupBy, bufferTime, tap } from 'rxjs/operators';
import { DataEvent, DataSourceConnector } from '../connectors/DataSourceConnector';
import { RideRequestData, WeatherData, TrafficData, EventData, GridCellData, GeoLocation } from '../schemas/DataModels';
import config from '../config';
import * as GeospatialUtils from '../utils/GeospatialUtils';
import { Kafka, Producer } from 'kafkajs';

/**
 * Stream processor options
 */
export interface StreamProcessorOptions {
  batchSize?: number;
  batchIntervalMs?: number;
  enableKafka?: boolean;
  kafkaTopic?: string;
}

/**
 * Stream processor stage function
 */
export type ProcessorStage<T, R> = (data: T) => Promise<R>;

/**
 * Stream processor for handling data from multiple connectors
 */
export class StreamProcessor {
  private connectors: DataSourceConnector[] = [];
  private combinedStream: Observable<DataEvent> | null = null;
  private gridCellSubject = new Subject<GridCellData>();
  private kafka: Kafka;
  private producer: Producer;
  private isRunning = false;
  private gridCells = new Map<string, GridCellData>();

  /**
   * Create a new stream processor
   */
  constructor() {
    // Initialize Kafka
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
    });
    
    this.producer = this.kafka.producer();
  }

  /**
   * Add a data source connector to the processor
   * @param connector Data source connector
   */
  addConnector(connector: DataSourceConnector): void {
    this.connectors.push(connector);
  }

  /**
   * Start the stream processor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Stream processor is already running');
      return;
    }

    try {
      // Connect all data source connectors
      await Promise.all(this.connectors.map(connector => connector.connect()));
      
      // Connect to Kafka
      await this.producer.connect();
      
      // Create combined stream from all connectors
      this.combinedStream = merge(
        ...this.connectors.map(connector => connector.getStream())
      );
      
      // Process the combined stream
      this.processCombinedStream();
      
      this.isRunning = true;
      console.log('Stream processor started');
    } catch (error) {
      console.error('Failed to start stream processor:', error);
      throw error;
    }
  }

  /**
   * Stop the stream processor
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('Stream processor is not running');
      return;
    }

    try {
      // Disconnect all data source connectors
      await Promise.all(this.connectors.map(connector => connector.disconnect()));
      
      // Disconnect from Kafka
      await this.producer.disconnect();
      
      this.isRunning = false;
      console.log('Stream processor stopped');
    } catch (error) {
      console.error('Failed to stop stream processor:', error);
      throw error;
    }
  }

  /**
   * Get the stream of grid cell data
   */
  getGridCellStream(): Observable<GridCellData> {
    return this.gridCellSubject.asObservable();
  }

  /**
   * Process the combined stream of data events
   * @private
   */
  private processCombinedStream(): void {
    if (!this.combinedStream) {
      throw new Error('Combined stream is not initialized');
    }

    // Process ride request events
    this.processRideRequests();
    
    // Process weather events
    this.processWeatherData();
    
    // Process traffic events
    this.processTrafficData();
    
    // Process event events
    this.processEventData();
    
    // Aggregate data by H3 grid cell
    this.aggregateByGridCell();
  }

  /**
   * Process ride request events
   * @private
   */
  private processRideRequests(): void {
    if (!this.combinedStream) {
      throw new Error('Combined stream is not initialized');
    }

    this.combinedStream.pipe(
      // Filter for ride request events
      filter(event => event.source === 'ride-request-api'),
      
      // Map to ride request data
      map(event => event.payload as RideRequestData),
      
      // Send to Kafka
      tap(async (rideRequest) => {
        try {
          await this.producer.send({
            topic: config.kafka.topics.locationData,
            messages: [
              {
                key: rideRequest.requestId,
                value: JSON.stringify(rideRequest),
              },
            ],
          });
        } catch (error) {
          console.error('Error sending ride request to Kafka:', error);
        }
      })
    ).subscribe();
  }

  /**
   * Process weather data events
   * @private
   */
  private processWeatherData(): void {
    if (!this.combinedStream) {
      throw new Error('Combined stream is not initialized');
    }

    this.combinedStream.pipe(
      // Filter for weather events
      filter(event => event.source === 'weather-api'),
      
      // Map to weather data
      map(event => event.payload as WeatherData),
      
      // Send to Kafka
      tap(async (weatherData) => {
        try {
          await this.producer.send({
            topic: config.kafka.topics.locationData,
            messages: [
              {
                key: `${weatherData.location.latitude},${weatherData.location.longitude}`,
                value: JSON.stringify(weatherData),
              },
            ],
          });
        } catch (error) {
          console.error('Error sending weather data to Kafka:', error);
        }
      })
    ).subscribe();
  }

  /**
   * Process traffic data events
   * @private
   */
  private processTrafficData(): void {
    if (!this.combinedStream) {
      throw new Error('Combined stream is not initialized');
    }

    this.combinedStream.pipe(
      // Filter for traffic events
      filter(event => event.source === 'traffic-api'),
      
      // Map to traffic data
      map(event => event.payload as TrafficData),
      
      // Send to Kafka
      tap(async (trafficData) => {
        try {
          await this.producer.send({
            topic: config.kafka.topics.locationData,
            messages: [
              {
                key: `${trafficData.location.latitude},${trafficData.location.longitude}`,
                value: JSON.stringify(trafficData),
              },
            ],
          });
        } catch (error) {
          console.error('Error sending traffic data to Kafka:', error);
        }
      })
    ).subscribe();
  }

  /**
   * Process event data events
   * @private
   */
  private processEventData(): void {
    if (!this.combinedStream) {
      throw new Error('Combined stream is not initialized');
    }

    this.combinedStream.pipe(
      // Filter for event events
      filter(event => event.source === 'events-api'),
      
      // Map to event data
      map(event => event.payload as EventData),
      
      // Send to Kafka
      tap(async (eventData) => {
        try {
          await this.producer.send({
            topic: config.kafka.topics.locationData,
            messages: [
              {
                key: eventData.id,
                value: JSON.stringify(eventData),
              },
            ],
          });
        } catch (error) {
          console.error('Error sending event data to Kafka:', error);
        }
      })
    ).subscribe();
  }

  /**
   * Aggregate data by H3 grid cell
   * @private
   */
  private aggregateByGridCell(): void {
    if (!this.combinedStream) {
      throw new Error('Combined stream is not initialized');
    }

    // Process all events and group by H3 index
    this.combinedStream.pipe(
      // Filter for events with H3 index
      filter(event => event.payload.h3Index !== undefined),
      
      // Group by H3 index
      groupBy(event => event.payload.h3Index as string),
      
      // Process each group
      mergeMap(group => group.pipe(
        // Buffer events for each grid cell
        bufferTime(config.pipeline.intervalMs),
        
        // Process buffered events
        map(events => {
          if (events.length === 0) return null;
          
          const h3Index = events[0].payload.h3Index as string;
          
          // Get or create grid cell data
          let gridCell = this.gridCells.get(h3Index);
          if (!gridCell) {
            gridCell = {
              h3Index,
              centerPoint: this.h3ToCenterPoint(h3Index),
              timestamp: new Date().toISOString(),
              rideRequests: 0,
              activeDrivers: 0,
            };
            this.gridCells.set(h3Index, gridCell);
          }
          
          // Update grid cell data with new events
          for (const event of events) {
            if (event.source === 'ride-request-api') {
              gridCell.rideRequests++;
            } else if (event.source === 'weather-api') {
              gridCell.weatherData = event.payload as WeatherData;
            } else if (event.source === 'traffic-api') {
              gridCell.trafficData = event.payload as TrafficData;
            } else if (event.source === 'events-api') {
              gridCell.nearbyEvents = event.payload as EventData[];
            }
          }
          
          gridCell.timestamp = new Date().toISOString();
          
          // Create grid cell data
          const gridCellData: GridCellData = {
            h3Index,
            centerPoint: gridCell.centerPoint,
            timestamp: gridCell.timestamp,
            rideRequests: gridCell.rideRequests,
            activeDrivers: gridCell.activeDrivers,
            weatherData: gridCell.weatherData,
            trafficData: gridCell.trafficData,
            nearbyEvents: gridCell.nearbyEvents,
          };
          
          return gridCellData;
        }),
        
        // Filter out null values
        filter((gridCellData): gridCellData is GridCellData => gridCellData !== null)
      ))
    ).subscribe(gridCellData => {
      // Emit grid cell data
      this.gridCellSubject.next(gridCellData);
      
      // Send to Kafka
      this.sendGridCellDataToKafka(gridCellData);
    });
  }

  /**
   * Convert H3 index to center point
   * @param h3Index H3 index
   * @returns Center point as GeoLocation
   * @private
   */
  private h3ToCenterPoint(h3Index: string): GeoLocation {
    return GeospatialUtils.h3ToLatLng(h3Index);
  }

  /**
   * Calculate the average fare multiplier for a list of ride requests
   * @param rideRequests List of ride requests
   * @returns Average fare multiplier
   * @private
   */
  private calculateAverageFareMultiplier(rideRequests: RideRequestData[]): number {
    if (rideRequests.length === 0) {
      return 1.0; // Default multiplier
    }
    
    const multipliers = rideRequests
      .filter(request => request.surgeMultiplier !== undefined)
      .map(request => request.surgeMultiplier as number);
    
    if (multipliers.length === 0) {
      return 1.0; // Default multiplier
    }
    
    return multipliers.reduce((sum, multiplier) => sum + multiplier, 0) / multipliers.length;
  }

  /**
   * Send grid cell data to Kafka
   * @param gridCellData Grid cell data
   * @private
   */
  private async sendGridCellDataToKafka(gridCellData: GridCellData): Promise<void> {
    try {
      await this.producer.send({
        topic: config.kafka.topics.predictionResults,
        messages: [
          { 
            key: gridCellData.h3Index,
            value: JSON.stringify(gridCellData),
          },
        ],
      });
    } catch (error) {
      console.error('Error sending grid cell data to Kafka:', error);
    }
  }

  /**
   * Update grid cell data
   * @param h3Index H3 index
   * @param rideRequests Ride requests
   * @param weatherData Weather data
   * @param trafficData Traffic data
   * @param eventData Event data
   * @private
   */
  private updateGridCellData(
    h3Index: string,
    rideRequests: RideRequestData[],
    weatherData?: WeatherData,
    trafficData?: TrafficData,
    eventData?: EventData[]
  ): void {
    // Get or create grid cell
    let gridCell = this.gridCells.get(h3Index);
    
    if (!gridCell) {
      // Create new grid cell
      const centerPoint = this.h3ToCenterPoint(h3Index);
      
      gridCell = {
        h3Index,
        centerPoint,
        timestamp: new Date().toISOString(),
        rideRequests: 0,
        activeDrivers: 0,
      };
      
      this.gridCells.set(h3Index, gridCell);
    }
    
    // Update grid cell data
    gridCell.timestamp = new Date().toISOString();
    gridCell.rideRequests = rideRequests.length;
    
    // Update weather data if provided
    if (weatherData) {
      gridCell.weatherData = weatherData;
    }
    
    // Update traffic data if provided
    if (trafficData) {
      gridCell.trafficData = trafficData;
    }
    
    // Update event data if provided
    if (eventData && eventData.length > 0) {
      gridCell.nearbyEvents = eventData;
    }
  }

  /**
   * Calculate surge factor for a grid cell
   * @param h3Index H3 index
   * @returns Surge factor
   * @private
   */
  private calculateSurgeFactor(h3Index: string): number {
    const gridCell = this.gridCells.get(h3Index);
    
    if (!gridCell) {
      return 1.0; // Default surge factor
    }
    
    // Calculate surge factor based on ride requests
    // This is a simple implementation - in a real system, this would be more complex
    const rideRequestFactor = Math.min(3.0, 1.0 + (gridCell.rideRequests / 10) * 0.5);
    
    // Calculate surge factor based on weather
    let weatherFactor = 1.0;
    if (gridCell.weatherData) {
      const weatherCondition = gridCell.weatherData.weatherCondition;
      if (weatherCondition === 'RAIN' || weatherCondition === 'SNOW') {
        weatherFactor = 1.5;
      } else if (weatherCondition === 'STORM') {
        weatherFactor = 2.0;
      }
    }
    
    // Calculate surge factor based on traffic
    let trafficFactor = 1.0;
    if (gridCell.trafficData) {
      trafficFactor = 1.0 + (gridCell.trafficData.congestionLevel / 100) * 0.5;
    }
    
    // Calculate surge factor based on events
    let eventFactor = 1.0;
    if (gridCell.nearbyEvents && gridCell.nearbyEvents.length > 0) {
      // Check if any high-demand events are happening
      const highDemandEvents = gridCell.nearbyEvents.filter(event => event.isHighDemand);
      if (highDemandEvents.length > 0) {
        eventFactor = 1.5;
      }
    }
    
    // Combine factors
    const surgeFactor = rideRequestFactor * weatherFactor * trafficFactor * eventFactor;
    
    // Cap surge factor
    return Math.min(3.0, Math.max(1.0, surgeFactor));
  }

  /**
   * Convert latitude and longitude to H3 index
   * @param latitude Latitude
   * @param longitude Longitude
   * @returns H3 index
   */
  public latLngToH3(latitude: number, longitude: number): string {
    return GeospatialUtils.GeospatialUtils.latLngToH3(latitude, longitude);
  }

  /**
   * Get demand and supply data for an H3 index
   * @param h3Index H3 index
   * @returns Demand and supply data
   */
  public getDemandSupplyForH3(h3Index: string): any {
    const gridCell = this.gridCells.get(h3Index);
    
    if (!gridCell) {
      return {
        demand: [],
        supply: []
      };
    }
    
    return {
      demand: gridCell.rideRequests || 0,
      supply: gridCell.activeDrivers || 0
    };
  }
} 