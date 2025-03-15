import { Logger } from '../utils/Logger';
import { DataService } from './DataService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Price lock allocation options
 */
export interface PriceLockAllocationOptions {
  locationId: string;
  predictionId: string;
  quantity: number;
  currentRate: number;
  expiresIn: number; // in minutes
  maxPerUser: number;
}

/**
 * Price lock request options
 */
export interface PriceLockRequestOptions {
  userId: string;
  locationId: string;
  predictionId: string;
}

/**
 * Price lock data
 */
export interface PriceLock {
  id: string;
  userId?: string;
  locationId: string;
  predictionId: string;
  rate: number;
  createdAt: string;
  expiresAt: string;
  status: 'available' | 'reserved' | 'used' | 'expired';
}

/**
 * Service for managing price locks
 */
export class PriceLockService {
  private logger: Logger;
  private dataService: DataService;
  private isConnected: boolean = false;

  constructor(dataService: DataService) {
    this.logger = new Logger('PriceLockService');
    this.dataService = dataService;
  }

  /**
   * Allocate price locks for a prediction
   */
  public async allocatePriceLocks(options: PriceLockAllocationOptions): Promise<number> {
    try {
      await this.ensureConnected();
      
      const { locationId, predictionId, quantity, currentRate, expiresIn, maxPerUser } = options;
      
      // Create price locks
      const priceLocks: PriceLock[] = [];
      const expiresAt = new Date(Date.now() + expiresIn * 60 * 1000).toISOString();
      
      for (let i = 0; i < quantity; i++) {
        priceLocks.push({
          id: uuidv4(),
          locationId,
          predictionId,
          rate: currentRate,
          createdAt: new Date().toISOString(),
          expiresAt,
          status: 'available'
        });
      }
      
      // Store price locks in database
      if (priceLocks.length > 0) {
        await this.dataService.db.collection('price_locks').insertMany(priceLocks);
      }
      
      // Store allocation metadata
      await this.dataService.db.collection('price_lock_allocations').insertOne({
        id: uuidv4(),
        locationId,
        predictionId,
        quantity,
        allocated: priceLocks.length,
        currentRate,
        maxPerUser,
        createdAt: new Date().toISOString(),
        expiresAt
      });
      
      this.logger.info(`Allocated ${priceLocks.length} price locks for location ${locationId}`);
      return priceLocks.length;
    } catch (error) {
      this.logger.error(`Failed to allocate price locks:`, error);
      return 0;
    }
  }

  /**
   * Request a price lock for a user
   */
  public async requestPriceLock(options: PriceLockRequestOptions): Promise<PriceLock | null> {
    try {
      await this.ensureConnected();
      
      const { userId, locationId, predictionId } = options;
      
      // Check if user already has a price lock for this location
      const existingLock = await this.dataService.db.collection('price_locks').findOne({
        userId,
        locationId,
        status: { $in: ['reserved', 'available'] },
        expiresAt: { $gt: new Date().toISOString() }
      });
      
      if (existingLock) {
        return existingLock as unknown as PriceLock;
      }
      
      // Find an available price lock
      const result = await this.dataService.db.collection('price_locks').findOneAndUpdate(
        {
          locationId,
          predictionId,
          status: 'available',
          expiresAt: { $gt: new Date().toISOString() }
        },
        {
          $set: {
            userId,
            status: 'reserved',
            updatedAt: new Date().toISOString()
          }
        },
        { returnDocument: 'after' }
      );
      
      if (!result) {
        this.logger.warn(`No available price locks for location ${locationId}`);
        return null;
      }
      
      this.logger.info(`Reserved price lock ${result.id} for user ${userId}`);
      return result as unknown as PriceLock;
    } catch (error) {
      this.logger.error(`Failed to request price lock:`, error);
      return null;
    }
  }

  /**
   * Use a price lock
   */
  public async usePriceLock(priceLockId: string, userId: string): Promise<boolean> {
    try {
      await this.ensureConnected();
      
      // Find and update the price lock
      const result = await this.dataService.db.collection('price_locks').findOneAndUpdate(
        {
          id: priceLockId,
          userId,
          status: 'reserved',
          expiresAt: { $gt: new Date().toISOString() }
        },
        {
          $set: {
            status: 'used',
            usedAt: new Date().toISOString()
          }
        }
      );
      
      if (!result) {
        this.logger.warn(`Price lock ${priceLockId} not found or expired`);
        return false;
      }
      
      this.logger.info(`Used price lock ${priceLockId} for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to use price lock:`, error);
      return false;
    }
  }

  /**
   * Get available price locks for a location
   */
  public async getAvailablePriceLocks(locationId: string): Promise<number> {
    try {
      await this.ensureConnected();
      
      // Count available price locks
      const count = await this.dataService.db.collection('price_locks').countDocuments({
        locationId,
        status: 'available',
        expiresAt: { $gt: new Date().toISOString() }
      });
      
      return count;
    } catch (error) {
      this.logger.error(`Failed to get available price locks:`, error);
      return 0;
    }
  }

  /**
   * Clean up expired price locks
   */
  public async cleanupExpiredLocks(): Promise<number> {
    try {
      await this.ensureConnected();
      
      // Update expired locks
      const result = await this.dataService.db.collection('price_locks').updateMany(
        {
          status: { $in: ['available', 'reserved'] },
          expiresAt: { $lte: new Date().toISOString() }
        },
        {
          $set: {
            status: 'expired',
            updatedAt: new Date().toISOString()
          }
        }
      );
      
      this.logger.info(`Cleaned up ${result.modifiedCount} expired price locks`);
      return result.modifiedCount;
    } catch (error) {
      this.logger.error(`Failed to clean up expired price locks:`, error);
      return 0;
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