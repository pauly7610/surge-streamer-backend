import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import config from '../config';
import { DriverLocation, RideRequest, SurgePrediction } from '../types';

// Initialize Kafka client
const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers
});

// Global producer instance
let producer: Producer | null = null;

// Track consumers for graceful shutdown
const consumers: Record<string, Consumer> = {};

/**
 * Initialize Kafka producer
 */
export const initProducer = async (): Promise<Producer> => {
  if (producer) {
    return producer;
  }

  producer = kafka.producer();
  await producer.connect();
  console.log('Kafka producer connected');
  return producer;
};

/**
 * Send driver location to Kafka
 */
export const sendDriverLocation = async (location: DriverLocation): Promise<void> => {
  const prod = await initProducer();
  await prod.send({
    topic: config.kafka.topics.driverLocations,
    messages: [
      { 
        key: location.driver_id, 
        value: JSON.stringify(location) 
      }
    ]
  });
};

/**
 * Send ride request to Kafka
 */
export const sendRideRequest = async (request: RideRequest): Promise<void> => {
  const prod = await initProducer();
  await prod.send({
    topic: config.kafka.topics.rideRequests,
    messages: [
      { 
        key: request.id, 
        value: JSON.stringify(request) 
      }
    ]
  });
};

/**
 * Send surge prediction to Kafka
 */
export const sendSurgePrediction = async (prediction: SurgePrediction): Promise<void> => {
  const prod = await initProducer();
  await prod.send({
    topic: config.kafka.topics.surgeEvents,
    messages: [
      {
        key: prediction.h3Index || prediction.id,
        value: JSON.stringify(prediction)
      }
    ]
  });
};

/**
 * Create a Kafka consumer for a specific topic
 */
export const createConsumer = async (
  groupId: string,
  topic: string,
  messageHandler: (payload: EachMessagePayload) => Promise<void>
): Promise<Consumer> => {
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });
  
  await consumer.run({
    eachMessage: messageHandler
  });
  
  // Track consumer for shutdown
  consumers[groupId] = consumer;
  
  console.log(`Kafka consumer connected for topic: ${topic}`);
  return consumer;
};

/**
 * Disconnect all Kafka clients
 */
export const disconnectKafka = async (): Promise<void> => {
  console.log('Disconnecting Kafka clients...');
  
  // Disconnect producer
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
  
  // Disconnect all consumers
  for (const groupId in consumers) {
    try {
      await consumers[groupId].disconnect();
      delete consumers[groupId];
    } catch (error) {
      console.error(`Error disconnecting consumer ${groupId}:`, error);
    }
  }
  
  console.log('All Kafka clients disconnected');
}; 