import { MongoClient, Collection, ObjectId } from 'mongodb';
import { SurgePrediction, SurgeFactor, Location } from '../schemas/DataModels';
import { LocationService } from './LocationService';
import { GeospatialUtils } from '../utils/GeospatialUtils';
import { Logger } from '../utils/Logger';
import config from '../config';

/**
 * Interface for surge prediction data stored in the database
 */
interface SurgePredictionData {
  _id?: ObjectId;
  id: string;
  locationId: string;
  h3Index: string;
  timestamp: string;
  surgeMultiplier: number;
  confidence: number;
  predictedDuration: number;
  factors: SurgeFactor[];
}

/**
 * Service for managing surge predictions
 */
export class PredictionService {
  private client: MongoClient | null = null;
  private collection: Collection<SurgePredictionData> | null = null;
  private logger: Logger;
  private isConnected: boolean = false;
  private locationService: LocationService;

  /**
   * Initialize the prediction service
   * @param locationService Location service
   */
  constructor(locationService: LocationService) {
    this.logger = new Logger('PredictionService');
    this.locationService = locationService;
  }

  /**
   * Connect to the MongoDB database
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to MongoDB...');
      this.client = await MongoClient.connect(config.mongodb.uri);
      const db = this.client.db();
      this.collection = db.collection<SurgePredictionData>(config.mongodb.collections.predictions);
      this.isConnected = true;
      this.logger.info('Connected to MongoDB');
      
      // Create indexes
      await this.collection.createIndex({ locationId: 1 }, { name: 'location_index' });
      await this.collection.createIndex({ h3Index: 1 }, { name: 'h3_index' });
      await this.collection.createIndex({ timestamp: -1 }, { name: 'timestamp_index' });
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
   * Get surge predictions within a geospatial area
   * @param latitude Center latitude
   * @param longitude Center longitude
   * @param radiusInMeters Radius in meters
   * @returns Array of surge predictions within the radius
   */
  async getSurgePredictionsInRadius(latitude: number, longitude: number, radiusInMeters: number): Promise<SurgePrediction[]> {
    await this.ensureConnected();
    
    try {
      // Get H3 indexes within the radius
      const h3Indexes = GeospatialUtils.getH3IndexesInRadius(latitude, longitude, radiusInMeters);
      
      // Get the current timestamp
      const now = new Date().toISOString();
      
      // Find predictions for the H3 indexes
      const predictions = await this.collection!.find({
        h3Index: { $in: h3Indexes },
        timestamp: { $lte: now }
      })
      .sort({ timestamp: -1 })
      .limit(h3Indexes.length)
      .toArray();
      
      return predictions.map(prediction => this.formatPrediction(prediction));
    } catch (error) {
      this.logger.error(`Failed to get surge predictions within radius of (${latitude}, ${longitude}):`, error);
      throw error;
    }
  }

  /**
   * Get the latest surge prediction for a location
   * @param locationId Location ID
   * @returns The latest surge prediction or null if not found
   */
  async getLatestPredictionForLocation(locationId: string): Promise<SurgePrediction | null> {
    await this.ensureConnected();
    
    try {
      // Get the location
      const location = await this.locationService.getLocationById(locationId);
      
      if (!location) {
        return null;
      }
      
      // Find the latest prediction for the location
      const prediction = await this.collection!.findOne(
        { locationId },
        { sort: { timestamp: -1 } }
      );
      
      // If no prediction exists, generate one
      if (!prediction) {
        return this.generatePredictionForLocation(location);
      }
      
      return this.formatPrediction(prediction);
    } catch (error) {
      this.logger.error(`Failed to get latest prediction for location ${locationId}:`, error);
      throw error;
    }
  }

  /**
   * Store a surge prediction
   * @param prediction Surge prediction to store
   * @returns The stored prediction
   */
  async storePrediction(prediction: SurgePrediction): Promise<SurgePrediction> {
    await this.ensureConnected();
    
    try {
      // Create a new prediction ID if not provided
      if (!prediction.id) {
        prediction.id = new ObjectId().toString();
      }
      
      // Store the prediction
      await this.collection!.insertOne(prediction as any);
      
      // Update the location's current surge
      await this.locationService.updateCurrentSurge(prediction.locationId, prediction.surgeMultiplier);
      
      return prediction;
    } catch (error) {
      this.logger.error(`Failed to store prediction for location ${prediction.locationId}:`, error);
      throw error;
    }
  }

  /**
   * Generate a surge prediction for a location
   * @param location Location to generate prediction for
   * @returns The generated prediction
   */
  async generatePredictionForLocation(location: Location): Promise<SurgePrediction> {
    try {
      // Get the current time
      const now = new Date();
      
      // Calculate base surge multiplier based on time of day
      const hour = now.getHours();
      let baseMultiplier = 1.0;
      
      // Morning rush hour (7-9 AM)
      if (hour >= 7 && hour <= 9) {
        baseMultiplier = 1.5;
      }
      // Evening rush hour (4-7 PM)
      else if (hour >= 16 && hour <= 19) {
        baseMultiplier = 1.8;
      }
      // Late night (10 PM - 2 AM)
      else if (hour >= 22 || hour <= 2) {
        baseMultiplier = 1.3;
      }
      
      // Adjust for day of week
      const day = now.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = day === 0 || day === 6;
      const dayFactor = isWeekend ? 1.2 : 1.0;
      
      // Create factors array
      const factors: SurgeFactor[] = [
        {
          name: 'Time of Day',
          impact: 0.4,
          description: `${this.getTimeOfDayDescription(hour)} typically has ${baseMultiplier > 1 ? 'higher' : 'normal'} demand`
        },
        {
          name: 'Day of Week',
          impact: 0.2,
          description: `${isWeekend ? 'Weekend' : 'Weekday'} traffic patterns`
        }
      ];
      
      // Add weather factor if available (mock for now)
      const weatherImpact = Math.random() * 0.3;
      if (weatherImpact > 0.1) {
        factors.push({
          name: 'Weather',
          impact: weatherImpact,
          description: 'Current weather conditions affecting demand'
        });
      }
      
      // Add event factor if available (mock for now)
      const eventImpact = Math.random() * 0.4;
      if (eventImpact > 0.2) {
        factors.push({
          name: 'Events',
          impact: eventImpact,
          description: 'Nearby events increasing demand'
        });
      }
      
      // Calculate final surge multiplier
      let surgeMultiplier = baseMultiplier * dayFactor;
      
      // Add impact from other factors
      factors.forEach(factor => {
        if (factor.name !== 'Time of Day' && factor.name !== 'Day of Week') {
          surgeMultiplier += factor.impact;
        }
      });
      
      // Ensure surge multiplier is within reasonable bounds
      surgeMultiplier = Math.max(1.0, Math.min(3.0, surgeMultiplier));
      
      // Round to 1 decimal place
      surgeMultiplier = Math.round(surgeMultiplier * 10) / 10;
      
      // Create the prediction
      const prediction: SurgePrediction = {
        id: new ObjectId().toString(),
        locationId: location.id,
        h3Index: location.h3Index,
        timestamp: now.toISOString(),
        surgeMultiplier,
        confidence: 0.85,
        predictedDuration: 30, // 30 minutes
        factors
      };
      
      // Store the prediction
      return this.storePrediction(prediction);
    } catch (error) {
      this.logger.error(`Failed to generate prediction for location ${location.id}:`, error);
      throw error;
    }
  }

  /**
   * Format a prediction from the database
   * @param prediction Prediction from the database
   * @returns Formatted prediction
   * @private
   */
  private formatPrediction(prediction: SurgePredictionData): SurgePrediction {
    return {
      id: prediction._id ? prediction._id.toString() : prediction.id,
      locationId: prediction.locationId,
      h3Index: prediction.h3Index,
      timestamp: prediction.timestamp,
      surgeMultiplier: prediction.surgeMultiplier,
      confidence: prediction.confidence,
      predictedDuration: prediction.predictedDuration,
      factors: prediction.factors
    };
  }

  /**
   * Get a description of the time of day
   * @param hour Hour of the day (0-23)
   * @returns Description of the time of day
   * @private
   */
  private getTimeOfDayDescription(hour: number): string {
    if (hour >= 5 && hour < 9) return 'Morning rush hour';
    if (hour >= 9 && hour < 12) return 'Mid-morning';
    if (hour >= 12 && hour < 14) return 'Lunch time';
    if (hour >= 14 && hour < 16) return 'Afternoon';
    if (hour >= 16 && hour < 20) return 'Evening rush hour';
    if (hour >= 20 && hour < 24) return 'Evening';
    return 'Late night';
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