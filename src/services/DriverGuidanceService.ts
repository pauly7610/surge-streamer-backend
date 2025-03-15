import { Logger } from '../utils/Logger';
import { DataService } from './DataService';
import { LocationService } from './LocationService';
import { StreamProcessor } from '../pipeline/StreamProcessor';
import { KafkaProducer } from '../kafka/KafkaProducer';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';

/**
 * Driver guidance recommendation
 */
export interface DriverGuidanceRecommendation {
  id: string;
  h3Index: string;
  locationId: string;
  latitude: number;
  longitude: number;
  earningsPotential: number;
  demandLevel: number;
  supplyLevel: number;
  incentiveMultiplier: number;
  timestamp: string;
  expiresAt: string;
}

/**
 * Location with base rate
 */
interface LocationWithRate {
  id: string;
  latitude: number;
  longitude: number;
  baseRate?: number;
}

/**
 * Service for providing driver positioning recommendations
 */
export class DriverGuidanceService {
  private logger: Logger;
  private dataService: DataService;
  private locationService: LocationService;
  private streamProcessor: StreamProcessor;
  private kafkaProducer: KafkaProducer;
  private isConnected: boolean = false;

  constructor(
    dataService: DataService,
    locationService: LocationService,
    streamProcessor: StreamProcessor
  ) {
    this.logger = new Logger('DriverGuidanceService');
    this.dataService = dataService;
    this.locationService = locationService;
    this.streamProcessor = streamProcessor;
    this.kafkaProducer = new KafkaProducer();
  }

  /**
   * Generate driver positioning recommendations
   * Using the formula: E_potential = (P_demand × R_base)/D_driver × (1 + B_incentive)
   * Where:
   * - E_potential = Predicted Earnings Potential
   * - P_demand = Predicted Demand
   * - R_base = Base Rate
   * - D_driver = Driver Density
   * - B_incentive = Dynamic Bonus Multiplier
   */
  public async generateDriverRecommendations(): Promise<DriverGuidanceRecommendation[]> {
    try {
      this.logger.info('Generating driver positioning recommendations');
      await this.ensureConnected();
      
      // Get all active locations
      const locations = await this.locationService.getActiveLocations() as LocationWithRate[];
      this.logger.info(`Found ${locations.length} active locations for driver recommendations`);
      
      const recommendations: DriverGuidanceRecommendation[] = [];
      
      // Generate recommendations for each location
      for (const location of locations) {
        try {
          // Get the H3 index for the location
          const h3Index = this.streamProcessor.latLngToH3(location.latitude, location.longitude);
          
          // Get demand and supply data
          const demandSupplyData = this.streamProcessor.getDemandSupplyForH3(h3Index);
          
          // Calculate predicted demand (current demand + 20% growth)
          const currentDemand = typeof demandSupplyData.demand === 'number' ? 
            demandSupplyData.demand : 
            (Array.isArray(demandSupplyData.demand) ? demandSupplyData.demand.length : 0);
          
          const predictedDemand = currentDemand * 1.2;
          
          // Calculate driver density
          const driverCount = typeof demandSupplyData.supply === 'number' ? 
            demandSupplyData.supply : 
            (Array.isArray(demandSupplyData.supply) ? demandSupplyData.supply.length : 0);
          
          // Avoid division by zero
          const driverDensity = Math.max(1, driverCount);
          
          // Get base rate for the location
          const baseRate = location.baseRate || 1.0;
          
          // Calculate dynamic bonus multiplier based on demand/supply ratio
          const demandSupplyRatio = predictedDemand / driverDensity;
          let bonusIncentive = 0;
          
          if (demandSupplyRatio > 2.0) {
            bonusIncentive = 0.5; // High demand relative to supply
          } else if (demandSupplyRatio > 1.5) {
            bonusIncentive = 0.3; // Moderate demand relative to supply
          } else if (demandSupplyRatio > 1.0) {
            bonusIncentive = 0.1; // Slight demand relative to supply
          }
          
          // Calculate earnings potential
          const earningsPotential = (predictedDemand * baseRate) / driverDensity * (1 + bonusIncentive);
          
          // Create recommendation
          const recommendation: DriverGuidanceRecommendation = {
            id: uuidv4(),
            h3Index,
            locationId: location.id,
            latitude: location.latitude,
            longitude: location.longitude,
            earningsPotential,
            demandLevel: predictedDemand,
            supplyLevel: driverDensity,
            incentiveMultiplier: 1 + bonusIncentive,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
          };
          
          // Store recommendation
          await this.storeRecommendation(recommendation);
          
          // Send to Kafka
          await this.sendRecommendationToKafka(recommendation);
          
          recommendations.push(recommendation);
        } catch (error) {
          this.logger.error(`Failed to generate recommendation for location ${location.id}`, error);
        }
      }
      
      this.logger.info(`Generated ${recommendations.length} driver recommendations`);
      return recommendations;
    } catch (error) {
      this.logger.error('Failed to generate driver recommendations', error);
      throw error;
    }
  }

  /**
   * Store a driver recommendation in the database
   */
  private async storeRecommendation(recommendation: DriverGuidanceRecommendation): Promise<void> {
    try {
      await this.dataService.db.collection(config.mongodb.collections.driverGuidance)
        .insertOne(recommendation);
      
      this.logger.debug(`Stored driver recommendation ${recommendation.id}`);
    } catch (error) {
      this.logger.error(`Failed to store driver recommendation ${recommendation.id}`, error);
    }
  }

  /**
   * Send a driver recommendation to Kafka
   */
  private async sendRecommendationToKafka(recommendation: DriverGuidanceRecommendation): Promise<void> {
    try {
      await this.kafkaProducer.sendMessage(
        config.kafka.topics.driverGuidance,
        recommendation.id,
        JSON.stringify(recommendation)
      );
      
      this.logger.debug(`Sent driver recommendation ${recommendation.id} to Kafka`);
    } catch (error) {
      this.logger.error(`Failed to send driver recommendation ${recommendation.id} to Kafka`, error);
    }
  }

  /**
   * Get driver recommendations for a specific area
   */
  public async getDriverRecommendationsForArea(latitude: number, longitude: number, radiusInKm: number): Promise<DriverGuidanceRecommendation[]> {
    try {
      await this.ensureConnected();
      
      // Convert radius to degrees (approximate)
      const radiusInDegrees = radiusInKm / 111.32; // 1 degree is approximately 111.32 km
      
      // Query recommendations within the radius
      const recommendations = await this.dataService.db.collection(config.mongodb.collections.driverGuidance)
        .find({
          latitude: { $gte: latitude - radiusInDegrees, $lte: latitude + radiusInDegrees },
          longitude: { $gte: longitude - radiusInDegrees, $lte: longitude + radiusInDegrees },
          expiresAt: { $gt: new Date().toISOString() }
        })
        .sort({ earningsPotential: -1 })
        .limit(10)
        .toArray();
      
      // Filter by actual distance
      const filteredRecommendations = recommendations.filter(rec => {
        const distance = this.calculateDistance(
          latitude, longitude,
          rec.latitude, rec.longitude
        );
        return distance <= radiusInKm;
      });
      
      return filteredRecommendations as unknown as DriverGuidanceRecommendation[];
    } catch (error) {
      this.logger.error(`Failed to get driver recommendations for area`, error);
      return [];
    }
  }

  /**
   * Calculate distance between two points in kilometers
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  }

  /**
   * Convert degrees to radians
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
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