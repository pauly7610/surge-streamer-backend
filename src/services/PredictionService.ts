import { SurgePrediction, PredictionFactor, GeoPoint, DemandSupplyData } from '../types';
import { DataService } from './DataService';
import { LocationService } from './LocationService';
import { StreamProcessor } from '../pipeline/StreamProcessor';
import { Logger } from '../utils/Logger';
import { v4 as uuidv4 } from 'uuid';
import { generateFeatures } from '../ml/featureEngineering';
import * as MLModels from '../ml/models';
import { KafkaProducer } from '../kafka/KafkaProducer';
import { NotificationService } from './NotificationService';
import { PriceLockService } from './PriceLockService';
import config from '../config';

// Confidence thresholds for tiered notifications
const CONFIDENCE_THRESHOLDS = {
  LEVEL_1: 0.65, // 65% confidence - Early warning
  LEVEL_2: 0.75, // 75% confidence - Detailed surge prediction
  LEVEL_3: 0.85  // 85% confidence - Actionable alert with price lock options
};

export class PredictionService {
  private dataService: DataService;
  private locationService: LocationService;
  private streamProcessor: StreamProcessor;
  private logger: Logger;
  private kafkaProducer: KafkaProducer;
  private notificationService: NotificationService;
  private priceLockService: PriceLockService;
  private isConnected: boolean = false;
  private modelLoaded: boolean = false;

  constructor(
    dataService: DataService,
    locationService: LocationService,
    streamProcessor: StreamProcessor,
    notificationService: NotificationService,
    priceLockService: PriceLockService
  ) {
    this.dataService = dataService;
    this.locationService = locationService;
    this.streamProcessor = streamProcessor;
    this.notificationService = notificationService;
    this.priceLockService = priceLockService;
    this.logger = new Logger('PredictionService');
    this.kafkaProducer = new KafkaProducer();
  }

  /**
   * Initialize the prediction service
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing prediction service');
      await this.ensureConnected();
      await this.loadModel();
      this.logger.info('Prediction service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize prediction service', error);
      throw error;
    }
  }

  /**
   * Load the ML model
   */
  private async loadModel(): Promise<void> {
    try {
      this.logger.info('Loading ML model');
      await MLModels.loadModel();
      this.modelLoaded = true;
      this.logger.info('ML model loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load ML model', error);
      this.modelLoaded = false;
      throw error;
    }
  }

  /**
   * Generate predictions for all locations
   */
  public async generatePredictionsForAllLocations(): Promise<SurgePrediction[]> {
    try {
      this.logger.info('Generating predictions for all locations');
      await this.ensureConnected();

      // Get all locations
      const locations = await this.locationService.getAllLocations();
      this.logger.info(`Found ${locations.length} locations to generate predictions for`);

      const predictions: SurgePrediction[] = [];

      // Generate predictions for each location
      for (const location of locations) {
        try {
          const prediction = await this.generatePredictionForLocation(location.id, {
            latitude: location.latitude,
            longitude: location.longitude
          });

          predictions.push(prediction);

          // Send prediction to Kafka
          await this.sendPredictionToKafka(prediction);

          // Process notifications based on confidence level
          await this.processTieredNotifications(prediction);

          // Allocate price locks based on prediction
          await this.allocatePriceLocks(prediction);
        } catch (error) {
          this.logger.error(`Failed to generate prediction for location ${location.id}`, error);
        }
      }

      this.logger.info(`Generated ${predictions.length} predictions`);
      return predictions;
    } catch (error) {
      this.logger.error('Failed to generate predictions for all locations', error);
      throw error;
    }
  }

  /**
   * Process tiered notifications based on prediction confidence
   */
  private async processTieredNotifications(prediction: SurgePrediction): Promise<void> {
    try {
      const { confidence, surgeMultiplier, locationId } = prediction;

      // Only send notifications for significant surge predictions (>1.2x)
      if (surgeMultiplier <= 1.2) {
        return;
      }

      // Get users in the location area
      const usersInArea = await this.getUsersInLocation(locationId);

      if (usersInArea.length === 0) {
        return;
      }

      // Determine notification level based on confidence
      if (confidence >= CONFIDENCE_THRESHOLDS.LEVEL_3) {
        // Level 3 notification (Actionable alert with price lock options)
        await this.notificationService.sendTieredNotification({
          level: 3,
          users: usersInArea,
          prediction,
          message: `Surge pricing of ${surgeMultiplier.toFixed(1)}x expected soon. Lock in current rates now!`,
          actionUrl: `/price-lock?locationId=${locationId}&predictionId=${prediction.id}`,
          expiresIn: 30 // 30 minutes
        });

        this.logger.info(`Sent Level 3 notifications to ${usersInArea.length} users for location ${locationId}`);
      } else if (confidence >= CONFIDENCE_THRESHOLDS.LEVEL_2) {
        // Level 2 notification (Detailed surge prediction)
        await this.notificationService.sendTieredNotification({
          level: 2,
          users: usersInArea,
          prediction,
          message: `Surge pricing of ${surgeMultiplier.toFixed(1)}x likely in your area soon.`,
          expiresIn: 45 // 45 minutes
        });

        this.logger.info(`Sent Level 2 notifications to ${usersInArea.length} users for location ${locationId}`);
      } else if (confidence >= CONFIDENCE_THRESHOLDS.LEVEL_1) {
        // Level 1 notification (Early warning)
        await this.notificationService.sendTieredNotification({
          level: 1,
          users: usersInArea,
          prediction,
          message: `Demand increasing in your area. Possible surge pricing soon.`,
          expiresIn: 60 // 60 minutes
        });

        this.logger.info(`Sent Level 1 notifications to ${usersInArea.length} users for location ${locationId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process notifications for prediction ${prediction.id}`, error);
    }
  }

  /**
   * Allocate price locks based on prediction
   * Using the formula: Q_locked = min(D_pred × (1+α), S_avail × β)
   * Where:
   * - Q_locked = Quantity of rides allocated to price locks
   * - D_pred = Predicted Demand
   * - α = Prediction Confidence Adjustment (0.1-0.3)
   * - S_avail = Available Supply
   * - β = Buffer Factor (0.7-0.9)
   */
  private async allocatePriceLocks(prediction: SurgePrediction): Promise<void> {
    try {
      const { confidence, surgeMultiplier, locationId, h3Index } = prediction;

      // Only allocate price locks for significant surge predictions (>1.2x)
      if (surgeMultiplier <= 1.2 || confidence < CONFIDENCE_THRESHOLDS.LEVEL_1) {
        return;
      }

      // Get demand and supply data
      const demandSupplyData = this.streamProcessor.getDemandSupplyForH3(h3Index);

      // Calculate predicted demand (current demand + 20% growth)
      const currentDemand = typeof demandSupplyData.demand === 'number' ?
        demandSupplyData.demand :
        (Array.isArray(demandSupplyData.demand) ? demandSupplyData.demand.length : 0);

      const predictedDemand = currentDemand * 1.2;

      // Calculate available supply
      const availableSupply = typeof demandSupplyData.supply === 'number' ?
        demandSupplyData.supply :
        (Array.isArray(demandSupplyData.supply) ? demandSupplyData.supply.length : 0);

      // Calculate confidence adjustment (α) - higher confidence = higher adjustment
      const confidenceAdjustment = 0.1 + (confidence - CONFIDENCE_THRESHOLDS.LEVEL_1) * 0.5;
      const alpha = Math.min(0.3, Math.max(0.1, confidenceAdjustment));

      // Calculate buffer factor (β) - higher confidence = higher buffer
      const bufferFactor = 0.7 + (confidence - CONFIDENCE_THRESHOLDS.LEVEL_1) * 0.5;
      const beta = Math.min(0.9, Math.max(0.7, bufferFactor));

      // Calculate quantity of rides to allocate to price locks
      const demandBasedAllocation = predictedDemand * (1 + alpha);
      const supplyBasedAllocation = availableSupply * beta;

      // Take the minimum to ensure we don't over-allocate
      const priceLockQuantity = Math.min(
        Math.floor(demandBasedAllocation),
        Math.floor(supplyBasedAllocation)
      );

      if (priceLockQuantity <= 0) {
        return;
      }

      // Allocate price locks
      await this.priceLockService.allocatePriceLocks({
        locationId,
        predictionId: prediction.id,
        quantity: priceLockQuantity,
        currentRate: 1.0, // Base rate
        expiresIn: 30, // 30 minutes
        maxPerUser: 1 // Maximum 1 lock per user
      });

      this.logger.info(`Allocated ${priceLockQuantity} price locks for location ${locationId}`);
    } catch (error) {
      this.logger.error(`Failed to allocate price locks for prediction ${prediction.id}`, error);
    }
  }

  /**
   * Get users in a location area
   */
  private async getUsersInLocation(locationId: string): Promise<string[]> {
    try {
      // This would typically query a user location service or database
      // For now, we'll return a mock list of user IDs
      return ['user1', 'user2', 'user3', 'user4', 'user5'];
    } catch (error) {
      this.logger.error(`Failed to get users in location ${locationId}`, error);
      return [];
    }
  }

  /**
   * Send prediction to Kafka
   */
  private async sendPredictionToKafka(prediction: SurgePrediction): Promise<void> {
    try {
      await this.kafkaProducer.sendMessage(
        config.kafka.topics.predictionResults,
        prediction.id,
        JSON.stringify(prediction)
      );
      this.logger.info(`Sent prediction ${prediction.id} to Kafka`);
    } catch (error) {
      this.logger.error(`Failed to send prediction ${prediction.id} to Kafka`, error);
    }
  }

  /**
   * Get the latest prediction for a location
   */
  public async getLatestPredictionForLocation(locationId: string): Promise<SurgePrediction> {
    try {
      this.logger.info(`Getting latest prediction for location ${locationId}`);
      await this.ensureConnected();

      // Get the location
      const location = await this.locationService.getLocationById(locationId);
      if (!location) {
        throw new Error(`Location ${locationId} not found`);
      }

      // Get the latest prediction from the database
      const latestPrediction = await this.dataService.db.collection(this.dataService.collections.predictions)
        .findOne({ locationId }, { sort: { timestamp: -1 } });

      // If a prediction exists and is less than 15 minutes old, return it
      if (latestPrediction &&
        new Date().getTime() - new Date(latestPrediction.timestamp).getTime() < 15 * 60 * 1000) {
        this.logger.info(`Found recent prediction for location ${locationId}`);
        return this.formatPrediction(latestPrediction);
      }

      // Otherwise, generate a new prediction
      this.logger.info(`No recent prediction found for location ${locationId}, generating new one`);
      return this.generatePredictionForLocation(locationId, {
        latitude: location.latitude,
        longitude: location.longitude
      });
    } catch (error) {
      this.logger.error(`Failed to get latest prediction for location ${locationId}`, error);
      throw error;
    }
  }

  /**
   * Store a prediction in the database
   */
  public async storePrediction(prediction: SurgePrediction): Promise<SurgePrediction> {
    try {
      this.logger.info(`Storing prediction for location ${prediction.locationId}`);
      await this.ensureConnected();

      // Ensure prediction has an ID
      if (!prediction.id) {
        prediction.id = uuidv4();
      }

      // Insert the prediction
      await this.dataService.db.collection(this.dataService.collections.predictions)
        .insertOne(prediction);

      // Update the location's current surge
      await this.locationService.updateCurrentSurge(prediction.locationId, prediction.surgeMultiplier);

      this.logger.info(`Stored prediction ${prediction.id} for location ${prediction.locationId}`);
      return prediction;
    } catch (error) {
      this.logger.error(`Failed to store prediction for location ${prediction.locationId}`, error);
      throw error;
    }
  }

  /**
   * Generate a prediction for a location
   */
  public async generatePredictionForLocation(locationId: string, coordinates: GeoPoint): Promise<SurgePrediction> {
    try {
      this.logger.info(`Generating prediction for location ${locationId}`);
      await this.ensureConnected();

      // Ensure model is loaded
      if (!this.modelLoaded) {
        await this.loadModel();
      }

      // Get demand and supply data from the stream processor
      const h3Index = this.streamProcessor.latLngToH3(coordinates.latitude, coordinates.longitude);
      const demandSupplyData = this.streamProcessor.getDemandSupplyForH3(h3Index);

      // Get historical data
      const historicalData = await this.getHistoricalDataForLocation(locationId);

      // Generate features
      const features = await generateFeatures(coordinates, demandSupplyData, historicalData);

      // Make prediction using ML model
      const { surgeMultiplier, confidence } = await MLModels.makePrediction(features);

      // Round to one decimal place
      const finalSurgeMultiplier = Math.round(surgeMultiplier * 10) / 10;

      // Create factors array
      const factors: PredictionFactor[] = this.generatePredictionFactors(features, demandSupplyData);

      // Create prediction object
      const prediction: SurgePrediction = {
        id: uuidv4(),
        locationId,
        h3Index,
        timestamp: new Date().toISOString(),
        surgeMultiplier: finalSurgeMultiplier,
        confidence,
        predictedDuration: 15, // 15 minutes
        factors
      };

      // Store the prediction
      await this.storePrediction(prediction);

      this.logger.info(`Generated prediction for location ${locationId} with surge ${finalSurgeMultiplier} (confidence: ${(confidence * 100).toFixed(0)}%)`);
      return prediction;
    } catch (error) {
      this.logger.error(`Failed to generate prediction for location ${locationId}`, error);
      throw error;
    }
  }

  /**
   * Get historical data for a location
   */
  private async getHistoricalDataForLocation(locationId: string): Promise<any[]> {
    try {
      // Get historical predictions for this location
      const historicalPredictions = await this.dataService.db.collection(this.dataService.collections.predictions)
        .find({ locationId })
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray();

      // Get historical demand data
      const historicalDemand = await this.dataService.db.collection(this.dataService.collections.historicalData)
        .find({ locationId })
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray();

      // Combine and format the data
      return [...historicalPredictions, ...historicalDemand].map(item => ({
        timestamp: item.timestamp,
        surgeMultiplier: item.surgeMultiplier || 1.0,
        demandCount: item.demandCount || 0
      }));
    } catch (error) {
      this.logger.error(`Failed to get historical data for location ${locationId}`, error);
      return [];
    }
  }

  /**
   * Generate prediction factors based on features
   */
  private generatePredictionFactors(features: number[], demandSupplyData: any): PredictionFactor[] {
    const factors: PredictionFactor[] = [];
    const now = new Date();
    const hourOfDay = now.getHours();

    // Time of day factor
    factors.push({
      name: 'Time of Day',
      description: this.getTimeOfDayDescription(hourOfDay),
      impact: 0.4
    });

    // Day of week factor
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    factors.push({
      name: 'Day of Week',
      description: isWeekend ? 'Weekend traffic patterns' : 'Weekday traffic patterns',
      impact: 0.2
    });

    // Weather factor (if significant)
    if (features[9] > 0.2) { // Weather impact feature
      factors.push({
        name: 'Weather Conditions',
        description: this.getWeatherDescription(features[9]),
        impact: features[9]
      });
    }

    // Traffic factor (if significant)
    if (features[10] > 0.3) { // Traffic congestion feature
      factors.push({
        name: 'Traffic Conditions',
        description: this.getTrafficDescription(features[10]),
        impact: features[10]
      });
    }

    // Event factor (if significant)
    if (features[14] > 0.2) { // Event impact feature
      factors.push({
        name: 'Nearby Events',
        description: 'Events in the area affecting demand',
        impact: features[14]
      });
    }

    // Demand/supply factor
    const demandSupplyRatio = features[17]; // Demand/supply ratio feature
    if (demandSupplyRatio > 0.3) {
      factors.push({
        name: 'Demand/Supply Ratio',
        description: this.getDemandSupplyDescription(demandSupplyRatio),
        impact: Math.min(0.8, demandSupplyRatio)
      });
    }

    // Historical surge factor (if significant)
    if (Math.abs(features[18] - 0.33) > 0.1) { // Historical surge feature
      factors.push({
        name: 'Historical Patterns',
        description: 'Based on historical surge patterns',
        impact: 0.3
      });
    }

    return factors;
  }

  /**
   * Get description for weather impact
   */
  private getWeatherDescription(weatherImpact: number): string {
    if (weatherImpact > 0.7) {
      return 'Severe weather conditions';
    } else if (weatherImpact > 0.4) {
      return 'Moderate weather affecting travel';
    } else {
      return 'Mild weather conditions';
    }
  }

  /**
   * Get description for traffic congestion
   */
  private getTrafficDescription(trafficCongestion: number): string {
    if (trafficCongestion > 0.7) {
      return 'Heavy traffic congestion';
    } else if (trafficCongestion > 0.4) {
      return 'Moderate traffic congestion';
    } else {
      return 'Light traffic conditions';
    }
  }

  /**
   * Get description for demand/supply ratio
   */
  private getDemandSupplyDescription(ratio: number): string {
    if (ratio > 0.7) {
      return 'Very high demand relative to supply';
    } else if (ratio > 0.5) {
      return 'High demand relative to supply';
    } else if (ratio > 0.3) {
      return 'Moderate demand relative to supply';
    } else {
      return 'Balanced demand and supply';
    }
  }

  /**
   * Format a prediction from the database
   */
  private formatPrediction(prediction: any): SurgePrediction {
    return {
      id: prediction._id.toString(),
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
   */
  private getTimeOfDayDescription(hour: number): string {
    if (hour >= 7 && hour < 10) {
      return 'Morning rush hour';
    } else if (hour >= 10 && hour < 12) {
      return 'Mid-morning';
    } else if (hour >= 12 && hour < 14) {
      return 'Lunch time';
    } else if (hour >= 14 && hour < 16) {
      return 'Afternoon';
    } else if (hour >= 16 && hour < 19) {
      return 'Evening rush hour';
    } else if (hour >= 19 && hour < 22) {
      return 'Evening';
    } else {
      return 'Late night';
    }
  }

  /**
   * Ensure the service is connected to the database
   */
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.dataService.connect();
      this.isConnected = true;
    }
  }
} 