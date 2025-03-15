import { Logger } from '../utils/Logger';
import { RideRequestData, WeatherData, TrafficData, EventData, GridCellData, GeospatialQuery } from '../schemas/DataModels';
import { GeospatialUtils } from '../utils/GeospatialUtils';
import { MongoClient, Collection, Db } from 'mongodb';
import { config } from '../config';

/**
 * Service for handling data queries and storage
 */
export class DataService {
  private logger: Logger;
  private mongoClient: MongoClient;
  private rideRequestsCollection: Collection<RideRequestData>;
  private weatherDataCollection: Collection<WeatherData>;
  private trafficDataCollection: Collection<TrafficData>;
  private eventsCollection: Collection<EventData>;
  private gridCellDataCollection: Collection<GridCellData>;
  private isConnected: boolean = false;
  
  // Public properties for database access
  public db: Db;
  public collections = {
    locations: config.mongodb.collections.locations || 'locations',
    predictions: config.mongodb.collections.predictions || 'predictions',
    historicalData: config.mongodb.collections.historicalData || 'historical_data',
    events: config.mongodb.collections.events || 'events',
    weatherData: config.mongodb.collections.weatherData || 'weather_data',
    trafficData: config.mongodb.collections.trafficData || 'traffic_data',
    rideRequests: config.mongodb.collections.rideRequests || 'ride_requests',
    gridCells: config.mongodb.collections.gridCells || 'grid_cells'
  };

  constructor() {
    this.logger = new Logger('DataService');
  }

  /**
   * Connect to the MongoDB database
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to MongoDB...');
      this.mongoClient = await MongoClient.connect(config.mongodb.uri);
      this.db = this.mongoClient.db();
      
      // Initialize collections
      this.rideRequestsCollection = this.db.collection<RideRequestData>(this.collections.rideRequests);
      this.weatherDataCollection = this.db.collection<WeatherData>(this.collections.weatherData);
      this.trafficDataCollection = this.db.collection<TrafficData>(this.collections.trafficData);
      this.eventsCollection = this.db.collection<EventData>(this.collections.events);
      this.gridCellDataCollection = this.db.collection<GridCellData>(this.collections.gridCells);
      
      // Create indexes
      await this.createIndexes();
      
      this.isConnected = true;
      this.logger.info('Connected to MongoDB');
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the database
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.mongoClient.close();
      this.isConnected = false;
      this.logger.info('Disconnected from MongoDB');
    } catch (error) {
      this.logger.error('Failed to disconnect from MongoDB', error);
      throw error;
    }
  }

  /**
   * Build a MongoDB query from a geospatial query
   * @param query The geospatial query
   * @returns MongoDB query object
   */
  private buildMongoQuery(query: GeospatialQuery): any {
    const mongoQuery: any = {};
    
    // Add H3 indexes if provided
    if (query.h3Indexes && query.h3Indexes.length > 0) {
      mongoQuery.h3Index = { $in: query.h3Indexes };
    }
    
    // Add time window if provided
    if (query.timeWindow) {
      mongoQuery.timestamp = {
        $gte: query.timeWindow.start,
        $lte: query.timeWindow.end,
      };
    }
    
    // If center and radius are provided, convert to H3 indexes
    if (query.center && query.radius) {
      const h3Indexes = GeospatialUtils.getH3IndexesInRadius(
        query.center.latitude,
        query.center.longitude,
        query.radius,
        query.resolution || 9
      );
      
      if (mongoQuery.h3Index) {
        // Intersect with existing h3Indexes
        const existingIndexes = mongoQuery.h3Index.$in;
        mongoQuery.h3Index.$in = existingIndexes.filter((index: string) => h3Indexes.includes(index));
      } else {
        mongoQuery.h3Index = { $in: h3Indexes };
      }
    }
    
    return mongoQuery;
  }

  /**
   * Get ride requests within a geospatial area
   * @param query The geospatial query
   * @returns Array of ride requests
   */
  public async getRideRequests(query: GeospatialQuery): Promise<RideRequestData[]> {
    await this.ensureConnected();
    const mongoQuery = this.buildMongoQuery(query);
    return this.rideRequestsCollection.find(mongoQuery).sort({ timestamp: -1 }).limit(1000).toArray();
  }

  /**
   * Get weather data within a geospatial area
   * @param query The geospatial query
   * @returns Array of weather data
   */
  public async getWeatherData(query: GeospatialQuery): Promise<WeatherData[]> {
    await this.ensureConnected();
    const mongoQuery = this.buildMongoQuery(query);
    return this.weatherDataCollection.find(mongoQuery).sort({ timestamp: -1 }).limit(1000).toArray();
  }

  /**
   * Get traffic data within a geospatial area
   * @param query The geospatial query
   * @returns Array of traffic data
   */
  public async getTrafficData(query: GeospatialQuery): Promise<TrafficData[]> {
    await this.ensureConnected();
    const mongoQuery = this.buildMongoQuery(query);
    return this.trafficDataCollection.find(mongoQuery).sort({ timestamp: -1 }).limit(1000).toArray();
  }

  /**
   * Get events within a geospatial area
   * @param query The geospatial query
   * @returns Array of events
   */
  public async getEvents(query: GeospatialQuery): Promise<EventData[]> {
    await this.ensureConnected();
    const mongoQuery = this.buildMongoQuery(query);
    return this.eventsCollection.find(mongoQuery).sort({ timestamp: -1 }).limit(1000).toArray();
  }

  /**
   * Get grid cell data within a geospatial area
   * @param query The geospatial query
   * @returns Array of grid cell data
   */
  public async getGridCellData(query: GeospatialQuery): Promise<GridCellData[]> {
    await this.ensureConnected();
    const mongoQuery = this.buildMongoQuery(query);
    return this.gridCellDataCollection.find(mongoQuery).sort({ timestamp: -1 }).limit(1000).toArray();
  }

  /**
   * Store ride request data
   * @param data The ride request data
   */
  public async storeRideRequest(data: RideRequestData): Promise<void> {
    await this.ensureConnected();
    await this.rideRequestsCollection.insertOne(data);
  }

  /**
   * Store weather data
   * @param data The weather data
   */
  public async storeWeatherData(data: WeatherData): Promise<void> {
    await this.ensureConnected();
    await this.weatherDataCollection.insertOne(data);
  }

  /**
   * Store traffic data
   * @param data The traffic data
   */
  public async storeTrafficData(data: TrafficData): Promise<void> {
    await this.ensureConnected();
    await this.trafficDataCollection.insertOne(data);
  }

  /**
   * Store event data
   * @param data The event data
   */
  public async storeEventData(data: EventData): Promise<void> {
    await this.ensureConnected();
    await this.eventsCollection.insertOne(data);
  }

  /**
   * Store grid cell data
   * @param data The grid cell data
   */
  public async storeGridCellData(data: GridCellData): Promise<void> {
    await this.ensureConnected();
    await this.gridCellDataCollection.insertOne(data);
  }

  /**
   * Ensure the service is connected to the database
   */
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  private async createIndexes(): Promise<void> {
    // Implementation of createIndexes method
  }
} 