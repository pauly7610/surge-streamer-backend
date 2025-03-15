import { Kafka, Producer } from 'kafkajs';
import { Logger } from '../utils/Logger';
import config from '../config';

/**
 * Kafka producer for sending messages to Kafka topics
 */
export class KafkaProducer {
  private producer: Producer;
  private logger: Logger;
  private isConnected: boolean = false;

  /**
   * Initialize the Kafka producer
   */
  constructor() {
    this.logger = new Logger('KafkaProducer');
    
    const kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers
    });
    
    this.producer = kafka.producer();
  }

  /**
   * Connect to Kafka
   */
  public async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        this.logger.info('Connecting to Kafka...');
        await this.producer.connect();
        this.isConnected = true;
        this.logger.info('Connected to Kafka');
      } catch (error) {
        this.logger.error('Failed to connect to Kafka:', error);
        throw error;
      }
    }
  }

  /**
   * Disconnect from Kafka
   */
  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      try {
        await this.producer.disconnect();
        this.isConnected = false;
        this.logger.info('Disconnected from Kafka');
      } catch (error) {
        this.logger.error('Failed to disconnect from Kafka:', error);
        throw error;
      }
    }
  }

  /**
   * Send a message to a Kafka topic
   * @param topic Topic name
   * @param key Message key
   * @param value Message value
   */
  public async sendMessage(topic: string, key: string, value: string): Promise<void> {
    try {
      await this.ensureConnected();
      
      await this.producer.send({
        topic,
        messages: [
          {
            key,
            value
          }
        ]
      });
      
      this.logger.debug(`Sent message to topic ${topic} with key ${key}`);
    } catch (error) {
      this.logger.error(`Failed to send message to topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Ensure the producer is connected
   */
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }
} 