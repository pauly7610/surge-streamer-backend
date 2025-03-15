import { Logger } from '../utils/Logger';
import { SurgePrediction } from '../types';
import { KafkaProducer } from '../kafka/KafkaProducer';
import config from '../config';

/**
 * Notification options
 */
export interface NotificationOptions {
  level: number;
  users: string[];
  prediction: SurgePrediction;
  message: string;
  actionUrl?: string;
  expiresIn: number; // in minutes
}

/**
 * Service for handling user notifications
 */
export class NotificationService {
  private logger: Logger;
  private kafkaProducer: KafkaProducer;

  constructor() {
    this.logger = new Logger('NotificationService');
    this.kafkaProducer = new KafkaProducer();
  }

  /**
   * Send a tiered notification based on prediction confidence
   */
  public async sendTieredNotification(options: NotificationOptions): Promise<void> {
    try {
      const { level, users, prediction, message, actionUrl, expiresIn } = options;
      
      // Create notification payload
      const notification = {
        id: `notification-${prediction.id}-${level}`,
        level,
        message,
        actionUrl,
        predictionId: prediction.id,
        locationId: prediction.locationId,
        surgeMultiplier: prediction.surgeMultiplier,
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expiresIn * 60 * 1000).toISOString()
      };
      
      // Send notification to Kafka for each user
      for (const userId of users) {
        await this.sendNotificationToUser(userId, notification);
      }
      
      this.logger.info(`Sent level ${level} notifications to ${users.length} users for location ${prediction.locationId}`);
    } catch (error) {
      this.logger.error('Failed to send tiered notification:', error);
      throw error;
    }
  }

  /**
   * Send a notification to a specific user
   */
  private async sendNotificationToUser(userId: string, notification: any): Promise<void> {
    try {
      // Send to Kafka
      await this.kafkaProducer.sendMessage(
        config.kafka.topics.notifications,
        userId,
        JSON.stringify({
          userId,
          notification
        })
      );
      
      // In a real implementation, this would also:
      // 1. Store the notification in a database
      // 2. Send push notifications via FCM/APNS
      // 3. Send SMS for high-priority notifications
      // 4. Send email for certain notification types
      
      this.logger.debug(`Sent notification to user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to send notification to user ${userId}:`, error);
    }
  }

  /**
   * Get notifications for a user
   */
  public async getUserNotifications(userId: string): Promise<any[]> {
    try {
      // In a real implementation, this would query a database
      // For now, return an empty array
      return [];
    } catch (error) {
      this.logger.error(`Failed to get notifications for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Mark a notification as read
   */
  public async markNotificationAsRead(userId: string, notificationId: string): Promise<boolean> {
    try {
      // In a real implementation, this would update a database
      // For now, return success
      this.logger.info(`Marked notification ${notificationId} as read for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to mark notification ${notificationId} as read for user ${userId}:`, error);
      return false;
    }
  }
} 