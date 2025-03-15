import { MongoClient, Collection, ObjectId } from 'mongodb';
import { GeospatialUtils } from '../utils/GeospatialUtils';
import { Location, LocationSettings } from '../schemas/DataModels';
import config from '../config';
import { Logger } from '../utils/Logger';

/**
 * Service for managing locations
 */
export class LocationService {
  private client: MongoClient | null = null;
  private collection: Collection<Location> | null = null;
  private logger: Logger;
  private isConnected: boolean = false;

  /**
   * Initialize the location service
   */
  constructor() {
    this.logger = new Logger('LocationService');
  }

  /**
   * Connect to the MongoDB database
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to MongoDB...');
      this.client = await MongoClient.connect(config.mongodb.uri);
      const db = this.client.db();
      this.collection = db.collection<Location>(config.mongodb.collections.locations);
      this.isConnected = true;
      this.logger.info('Connected to MongoDB');
      
      // Create geospatial index
      await this.collection.createIndex({ latitude: 1, longitude: 1 }, { name: 'geospatial_index' });
      await this.collection.createIndex({ h3Index: 1 }, { name: 'h3_index' });
      
      // Initialize default locations if none exist
      const count = await this.collection.countDocuments();
      if (count === 0) {
        await this.initializeDefaultLocations();
      }
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the MongoDB database
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.collection = null;
      this.isConnected = false;
      this.logger.info('Disconnected from MongoDB');
    }
  }

  /**
   * Get a location by ID
   * @param id Location ID
   * @returns Location or null if not found
   */
  async getLocationById(id: string): Promise<Location | null> {
    await this.ensureConnected();
    
    try {
      const location = await this.collection!.findOne({ _id: new ObjectId(id) });
      return location ? this.formatLocation(location) : null;
    } catch (error) {
      this.logger.error(`Failed to get location with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all active locations
   * @returns Array of active locations
   */
  async getActiveLocations(): Promise<Location[]> {
    await this.ensureConnected();
    
    try {
      const locations = await this.collection!.find({ isActive: true }).toArray();
      return locations.map(location => this.formatLocation(location));
    } catch (error) {
      this.logger.error('Failed to get active locations:', error);
      throw error;
    }
  }

  /**
   * Get locations within a radius of a point
   * @param latitude Center latitude
   * @param longitude Center longitude
   * @param radiusInMeters Radius in meters
   * @returns Array of locations within the radius
   */
  async getLocationsInRadius(latitude: number, longitude: number, radiusInMeters: number): Promise<Location[]> {
    await this.ensureConnected();
    
    try {
      // Convert radius from meters to degrees (approximate)
      const radiusInDegrees = radiusInMeters / 111000; // 1 degree is approximately 111km
      
      // Find locations within the radius
      const locations = await this.collection!.find({
        latitude: { $gte: latitude - radiusInDegrees, $lte: latitude + radiusInDegrees },
        longitude: { $gte: longitude - radiusInDegrees, $lte: longitude + radiusInDegrees }
      }).toArray();
      
      // Filter locations by actual distance
      return locations
        .filter(location => {
          const distance = this.calculateDistance(
            latitude, longitude,
            location.latitude, location.longitude
          );
          return distance <= radiusInMeters;
        })
        .map(location => this.formatLocation(location));
    } catch (error) {
      this.logger.error(`Failed to get locations within radius of (${latitude}, ${longitude}):`, error);
      throw error;
    }
  }

  /**
   * Add a new location
   * @param name Location name
   * @param latitude Latitude
   * @param longitude Longitude
   * @param radius Radius in meters
   * @returns The created location
   */
  async addLocation(name: string, latitude: number, longitude: number, radius: number): Promise<Location> {
    await this.ensureConnected();
    
    try {
      // Calculate H3 index
      const h3Index = GeospatialUtils.latLngToH3(latitude, longitude);
      
      // Create default settings
      const settings: LocationSettings = {
        alertThreshold: 1.5,
        monitorWeather: true,
        monitorTraffic: true,
        monitorEvents: true,
        updateFrequency: 5
      };
      
      // Create location
      const location: Omit<Location, 'id'> = {
        name,
        latitude,
        longitude,
        h3Index,
        radius,
        isActive: true,
        settings,
        lastUpdated: new Date().toISOString()
      };
      
      // Insert location
      const result = await this.collection!.insertOne(location as any);
      
      // Return created location
      return {
        ...location,
        id: result.insertedId.toString()
      };
    } catch (error) {
      this.logger.error(`Failed to add location ${name}:`, error);
      throw error;
    }
  }

  /**
   * Update a location
   * @param id Location ID
   * @param updates Updates to apply
   * @returns The updated location
   */
  async updateLocation(id: string, updates: Partial<Location>): Promise<Location | null> {
    await this.ensureConnected();
    
    try {
      // Exclude id from updates
      const { id: _, ...validUpdates } = updates;
      
      // Add last updated timestamp
      const updatesWithTimestamp = {
        ...validUpdates,
        lastUpdated: new Date().toISOString()
      };
      
      // Update location
      const result = await this.collection!.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updatesWithTimestamp },
        { returnDocument: 'after' }
      );
      
      if (!result) return null;
      return this.formatLocation(result);
    } catch (error) {
      this.logger.error(`Failed to update location with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update location settings
   * @param id Location ID
   * @param settings Settings to update
   * @returns The updated location
   */
  async updateLocationSettings(id: string, settings: Partial<LocationSettings>): Promise<Location | null> {
    await this.ensureConnected();
    
    try {
      // Get current location
      const location = await this.collection!.findOne({ _id: new ObjectId(id) });
      
      if (!location) {
        return null;
      }
      
      // Merge settings
      const updatedSettings = {
        ...location.settings,
        ...settings
      };
      
      // Update location
      const result = await this.collection!.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            settings: updatedSettings,
            lastUpdated: new Date().toISOString()
          } 
        },
        { returnDocument: 'after' }
      );
      
      if (!result) return null;
      return this.formatLocation(result);
    } catch (error) {
      this.logger.error(`Failed to update settings for location with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Remove a location
   * @param id Location ID
   * @returns True if the location was removed, false otherwise
   */
  async removeLocation(id: string): Promise<boolean> {
    await this.ensureConnected();
    
    try {
      const result = await this.collection!.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to remove location with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update the current surge value for a location
   * @param id Location ID
   * @param surgeMultiplier Surge multiplier
   * @returns The updated location
   */
  async updateCurrentSurge(id: string, surgeMultiplier: number): Promise<Location | null> {
    await this.ensureConnected();
    
    try {
      const result = await this.collection!.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            currentSurge: surgeMultiplier,
            lastUpdated: new Date().toISOString()
          } 
        },
        { returnDocument: 'after' }
      );
      
      if (!result) return null;
      return this.formatLocation(result);
    } catch (error) {
      this.logger.error(`Failed to update surge for location with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get a location by H3 index
   * @param h3Index H3 index
   * @returns Location or null if not found
   */
  async getLocationByH3Index(h3Index: string): Promise<Location | null> {
    await this.ensureConnected();
    
    try {
      const location = await this.collection!.findOne({ h3Index });
      return location ? this.formatLocation(location) : null;
    } catch (error) {
      this.logger.error(`Failed to get location with H3 index ${h3Index}:`, error);
      throw error;
    }
  }

  /**
   * Initialize default locations
   * @private
   */
  private async initializeDefaultLocations(): Promise<void> {
    this.logger.info('Initializing default locations');
    
    const defaultLocations = [
      { name: 'Downtown', latitude: 40.7128, longitude: -74.0060, radius: 2000 },
      { name: 'Midtown', latitude: 40.7549, longitude: -73.9840, radius: 1500 },
      { name: 'Uptown', latitude: 40.8075, longitude: -73.9626, radius: 1500 },
      { name: 'Brooklyn', latitude: 40.6782, longitude: -73.9442, radius: 3000 },
      { name: 'Queens', latitude: 40.7282, longitude: -73.7949, radius: 3000 },
    ];
    
    for (const location of defaultLocations) {
      await this.addLocation(location.name, location.latitude, location.longitude, location.radius);
    }
    
    this.logger.info('Default locations initialized');
  }

  /**
   * Format a location from the database
   * @param location Location from the database
   * @returns Formatted location
   * @private
   */
  private formatLocation(location: any): Location {
    return {
      id: location._id.toString(),
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      h3Index: location.h3Index,
      radius: location.radius,
      isActive: location.isActive,
      settings: location.settings,
      currentSurge: location.currentSurge,
      lastUpdated: location.lastUpdated
    };
  }

  /**
   * Calculate distance between two points in meters
   * @param lat1 Latitude of first point
   * @param lon1 Longitude of first point
   * @param lat2 Latitude of second point
   * @param lon2 Longitude of second point
   * @returns Distance in meters
   * @private
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  /**
   * Ensure the service is connected to the database
   * @private
   */
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }
} 