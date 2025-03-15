import { Kafka, Producer, Consumer } from 'kafkajs';
import { EventEmitter } from 'events';
import config from '../config';
import * as AvroUtils from './AvroUtils';

/**
 * Kafka message type definition
 */
export interface KafkaMessage {
  key: Buffer | null;
  value: Buffer | null;
  timestamp: string;
  size: number;
  attributes: number;
  offset: string;
  headers?: Record<string, Buffer>;
}

/**
 * Kafka message handler function type
 */
export type MessageHandler = (message: KafkaMessage) => Promise<void>;

/**
 * Kafka service for handling Kafka connections and message processing
 */
export class KafkaService {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumers: Map<string, Consumer> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private isConnected: boolean = false;
  private isProducerConnected: boolean = false;
  private topicHandlers: Map<string, Set<MessageHandler>> = new Map();
  private healthStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'UNHEALTHY';
  private lastError: Error | null = null;

  /**
   * Create a new Kafka service
   * @param clientId The client ID to use
   * @param brokers The Kafka brokers to connect to
   */
  constructor(
    private readonly clientId: string = config.kafka.clientId,
    private readonly brokers: string[] = config.kafka.brokers,
    private readonly consumerGroupId: string = config.kafka.consumerGroup
  ) {
    this.kafka = new Kafka({
      clientId: this.clientId,
      brokers: this.brokers,
      retry: {
        initialRetryTime: 300,
        retries: 10
      }
    });
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    try {
      await this.connectProducer();
      this.isConnected = true;
      this.healthStatus = 'HEALTHY';
      console.log('Connected to Kafka');
    } catch (error) {
      this.isConnected = false;
      this.healthStatus = 'UNHEALTHY';
      this.lastError = error as Error;
      console.error('Failed to connect to Kafka:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    try {
      if (this.producer && this.isProducerConnected) {
        await this.producer.disconnect();
        this.isProducerConnected = false;
      }

      for (const [topic, consumer] of this.consumers.entries()) {
        await consumer.disconnect();
        this.consumers.delete(topic);
      }

      this.isConnected = false;
      this.healthStatus = 'UNHEALTHY';
      console.log('Disconnected from Kafka');
    } catch (error) {
      console.error('Error disconnecting from Kafka:', error);
      throw error;
    }
  }

  /**
   * Check if connected to Kafka
   */
  isKafkaConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get the health status of the Kafka service
   */
  getHealthStatus(): { status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY', error?: string } {
    return {
      status: this.healthStatus,
      ...(this.lastError && { error: this.lastError.message })
    };
  }

  /**
   * Send a message to a Kafka topic
   * @param topic The topic to send the message to
   * @param message The message to send
   * @param key The message key (optional)
   * @param headers The message headers (optional)
   */
  async sendMessage(
    topic: string,
    message: any,
    key?: string,
    headers?: Record<string, string>
  ): Promise<void> {
    if (!this.isProducerConnected) {
      await this.connectProducer();
    }

    try {
      await this.producer!.send({
        topic,
        compression: 2, // GZIP
        messages: [
          {
            value: JSON.stringify(message),
            ...(key && { key }),
            ...(headers && { headers })
          }
        ]
      });
    } catch (error) {
      console.error(`Error sending message to topic ${topic}:`, error);
      this.healthStatus = 'DEGRADED';
      this.lastError = error as Error;
      throw error;
    }
  }

  /**
   * Send a message to a Kafka topic using Avro serialization
   * @param topic The topic to send the message to
   * @param schemaName The name of the Avro schema to use
   * @param message The message to send
   * @param key The message key (optional)
   * @param headers The message headers (optional)
   */
  async sendAvroMessage<T>(
    topic: string,
    schemaName: string,
    message: T,
    key?: string,
    headers?: Record<string, string>
  ): Promise<void> {
    if (!this.isProducerConnected) {
      await this.connectProducer();
    }

    try {
      // For now, we'll just send the message as JSON
      // In a real implementation, we would use Avro serialization
      await this.sendMessage(topic, message, key, {
        'schema': schemaName,
        ...(headers || {})
      });
    } catch (error) {
      console.error(`Error sending Avro message to topic ${topic}:`, error);
      this.healthStatus = 'DEGRADED';
      this.lastError = error as Error;
      throw error;
    }
  }

  /**
   * Subscribe to a Kafka topic
   * @param topic The topic to subscribe to
   * @param handler The message handler function
   * @param fromBeginning Whether to read from the beginning of the topic
   */
  async subscribe(
    topic: string,
    handler: MessageHandler,
    fromBeginning: boolean = false
  ): Promise<void> {
    try {
      // Create a new handler set if one doesn't exist
      if (!this.topicHandlers.has(topic)) {
        this.topicHandlers.set(topic, new Set());
      }

      // Add the handler to the set
      this.topicHandlers.get(topic)!.add(handler);

      // If we already have a consumer for this topic, we're done
      if (this.consumers.has(topic)) {
        return;
      }

      // Create a new consumer
      const consumer = this.kafka.consumer({
        groupId: `${this.consumerGroupId}-${topic}`,
        sessionTimeout: 30000,
        heartbeatInterval: 3000
      });

      // Connect the consumer
      await consumer.connect();

      // Subscribe to the topic
      await consumer.subscribe({
        topic,
        fromBeginning
      });

      // Start consuming messages
      await consumer.run({
        eachMessage: async ({ topic: messageTopic, partition, message }) => {
          try {
            // Get the handlers for this topic
            const handlers = this.topicHandlers.get(messageTopic);
            if (!handlers) {
              return;
            }

            // Call each handler
            for (const handler of handlers) {
              await handler(message as unknown as KafkaMessage);
            }
          } catch (error) {
            console.error(`Error processing message from topic ${messageTopic}:`, error);
            this.healthStatus = 'DEGRADED';
            this.lastError = error as Error;
          }
        }
      });

      // Store the consumer
      this.consumers.set(topic, consumer);

      console.log(`Subscribed to Kafka topic: ${topic}`);
    } catch (error) {
      console.error(`Error subscribing to Kafka topic ${topic}:`, error);
      this.healthStatus = 'DEGRADED';
      this.lastError = error as Error;
      throw error;
    }
  }

  /**
   * Subscribe to a Kafka topic with Avro deserialization
   * @param topic The topic to subscribe to
   * @param schemaName The name of the Avro schema to use
   * @param handler The message handler function
   * @param fromBeginning Whether to read from the beginning of the topic
   */
  async subscribeAvro<T>(
    topic: string,
    schemaName: string,
    handler: (data: T, message: KafkaMessage) => Promise<void>,
    fromBeginning: boolean = false
  ): Promise<void> {
    // Create a message handler that deserializes Avro messages
    const messageHandler: MessageHandler = async (message: KafkaMessage) => {
      try {
        if (!message.value) {
          return;
        }

        // For now, we'll just parse the message as JSON
        // In a real implementation, we would use Avro deserialization
        const decodedMessage = JSON.parse(message.value.toString()) as T;

        // Call the handler with the decoded message
        await handler(decodedMessage, message);
      } catch (error) {
        console.error(`Error decoding Avro message from topic ${topic}:`, error);
        throw error;
      }
    };

    // Subscribe to the topic with the Avro message handler
    await this.subscribe(topic, messageHandler, fromBeginning);
  }

  /**
   * Unsubscribe from a Kafka topic
   * @param topic The topic to unsubscribe from
   * @param handler The message handler function to remove (optional)
   */
  async unsubscribe(topic: string, handler?: MessageHandler): Promise<void> {
    try {
      // If a handler is provided, remove it from the set
      if (handler && this.topicHandlers.has(topic)) {
        this.topicHandlers.get(topic)!.delete(handler);
      }

      // If there are no more handlers for this topic, disconnect the consumer
      if (!handler || this.topicHandlers.get(topic)?.size === 0) {
        const consumer = this.consumers.get(topic);
        if (consumer) {
          await consumer.disconnect();
          this.consumers.delete(topic);
        }

        // Remove the topic from the handlers map
        this.topicHandlers.delete(topic);
      }

      console.log(`Unsubscribed from Kafka topic: ${topic}`);
    } catch (error) {
      console.error(`Error unsubscribing from Kafka topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Create a Kafka topic
   * @param topic The topic to create
   * @param numPartitions The number of partitions for the topic
   * @param replicationFactor The replication factor for the topic
   */
  async createTopic(
    topic: string,
    numPartitions: number = 1,
    replicationFactor: number = 1
  ): Promise<void> {
    try {
      // In a real implementation, we would use the Kafka admin API
      // For now, we'll just log that we're creating the topic
      console.log(`Created Kafka topic: ${topic} (simulated)`);
    } catch (error) {
      console.error(`Error creating Kafka topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Connect the Kafka producer
   * @private
   */
  private async connectProducer(): Promise<void> {
    if (this.isProducerConnected) {
      return;
    }

    try {
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: true,
        transactionTimeout: 30000
      });

      await this.producer.connect();
      this.isProducerConnected = true;
    } catch (error) {
      console.error('Error connecting Kafka producer:', error);
      this.isProducerConnected = false;
      throw error;
    }
  }
} 