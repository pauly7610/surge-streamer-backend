/**
 * Core data models for the Surge Streamer system
 */

/**
 * Geographic coordinates
 */
export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Geographic area defined by a bounding box
 */
export interface GeoBoundingBox {
  northEast: GeoCoordinates;
  southWest: GeoCoordinates;
}

/**
 * H3 grid cell information
 */
export interface H3Cell {
  h3Index: string;
  resolution: number;
  centerCoordinates: GeoCoordinates;
}

/**
 * Ride request data model
 */
export interface RideRequest {
  requestId: string;
  userId: string;
  timestamp: string;
  pickupLocation: GeoCoordinates;
  dropoffLocation: GeoCoordinates;
  requestStatus: 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'COMPLETED';
  vehicleType: 'ECONOMY' | 'COMFORT' | 'PREMIUM';
  estimatedDistance: number; // in kilometers
  estimatedDuration: number; // in minutes
  paymentMethod: string;
  specialRequests?: string[];
  h3Index?: string; // H3 index of the pickup location
}

/**
 * Driver location data model
 */
export interface DriverLocation {
  driverId: string;
  timestamp: string;
  location: GeoCoordinates;
  heading?: number; // 0-359 degrees
  speed?: number; // km/h
  availability: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  vehicleType: 'ECONOMY' | 'COMFORT' | 'PREMIUM';
  batteryLevel?: number; // percentage
  h3Index?: string; // H3 index of the current location
}

/**
 * Weather data model
 */
export interface WeatherData {
  timestamp: string;
  location: GeoCoordinates;
  temperature: number; // Celsius
  precipitation: number; // mm
  humidity: number; // percentage
  windSpeed: number; // km/h
  windDirection: number; // 0-359 degrees
  weatherCondition: string; // e.g., "clear", "rain", "snow"
  h3Index?: string;
}

/**
 * Traffic data model
 */
export interface TrafficData {
  timestamp: string;
  location: GeoCoordinates;
  roadSegmentId: string;
  congestionLevel: number; // 0-1 scale
  averageSpeed: number; // km/h
  incidentType?: 'ACCIDENT' | 'CONSTRUCTION' | 'CLOSURE' | 'OTHER';
  incidentSeverity?: 'LOW' | 'MEDIUM' | 'HIGH';
  h3Index?: string;
}

/**
 * Event data model
 */
export interface EventData {
  eventId: string;
  title: string;
  description?: string;
  location: GeoCoordinates;
  venue?: string;
  startTime: string;
  endTime: string;
  category: string;
  expectedAttendance: number;
  h3Index?: string;
}

/**
 * Surge prediction data model
 */
export interface SurgePrediction {
  predictionId: string;
  timestamp: string;
  h3Index: string;
  resolution: number;
  demandLevel: number; // 0-1 scale
  confidenceScore: number; // 0-1 scale
  predictionWindow: number; // minutes
  features?: Record<string, number>; // Feature values used for prediction
}

/**
 * Surge pricing data model
 */
export interface SurgePricing {
  h3Index: string;
  timestamp: string;
  multiplier: number; // e.g., 1.5x, 2.0x
  basePrice: number;
  currency: string;
  vehicleTypes: ('ECONOMY' | 'COMFORT' | 'PREMIUM')[];
  expiresAt: string;
}

/**
 * Supply-demand metrics
 */
export interface SupplyDemandMetrics {
  h3Index: string;
  timestamp: string;
  resolution: number;
  activeDrivers: number;
  pendingRequests: number;
  completedRides: number;
  cancelledRides: number;
  averageWaitTime: number; // seconds
  supplyDemandRatio: number;
}

/**
 * Historical data aggregation
 */
export interface HistoricalAggregate {
  h3Index: string;
  resolution: number;
  timeWindow: string; // e.g., "2023-04-01T12:00:00Z/2023-04-01T13:00:00Z"
  avgDemand: number;
  avgSupply: number;
  avgSurgeMultiplier: number;
  peakDemand: number;
  peakDemandTime: string;
  totalRides: number;
  totalCancellations: number;
  avgRideDistance: number; // kilometers
  avgRideDuration: number; // minutes
}

/**
 * System health metrics
 */
export interface SystemHealthMetrics {
  timestamp: string;
  componentName: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  latency: number; // milliseconds
  errorRate: number; // percentage
  throughput: number; // events per second
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  activeConnections: number;
}

/**
 * User feedback data
 */
export interface UserFeedback {
  feedbackId: string;
  userId: string;
  rideId?: string;
  timestamp: string;
  rating: number; // 1-5
  comments?: string;
  categories?: string[];
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  h3Index?: string;
}

/**
 * Notification message
 */
export interface NotificationMessage {
  messageId: string;
  recipientId: string;
  recipientType: 'USER' | 'DRIVER' | 'ADMIN';
  messageType: 'SURGE_ALERT' | 'DRIVER_INCENTIVE' | 'SYSTEM_ALERT' | 'MARKETING';
  title: string;
  body: string;
  timestamp: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  expiresAt?: string;
  actionUrl?: string;
  h3Index?: string;
}

/**
 * Feature vector for ML model
 */
export interface FeatureVector {
  h3Index: string;
  timestamp: string;
  features: number[];
  featureNames: string[];
}

/**
 * ML model metadata
 */
export interface ModelMetadata {
  modelId: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  modelType: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainingDataSize: number;
  featureNames: string[];
  hyperparameters: Record<string, any>;
}

/**
 * Pipeline processing metrics
 */
export interface PipelineMetrics {
  pipelineId: string;
  timestamp: string;
  stage: string;
  inputCount: number;
  outputCount: number;
  errorCount: number;
  processingTimeMs: number;
  batchSize: number;
  queueSize: number;
  lag: number; // milliseconds behind real-time
}

/**
 * Geospatial query parameters
 */
export interface GeospatialQuery {
  center?: GeoCoordinates;
  boundingBox?: GeoBoundingBox;
  h3Indexes?: string[];
  resolution?: number;
  radius?: number; // kilometers
  timeWindow?: {
    start: string;
    end: string;
  };
} 