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
  centerCoordinates: GeoLocation;
}

/**
 * Geographic location
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
}

/**
 * Base data interface with common properties
 */
export interface BaseData {
  timestamp: string;
  h3Index?: string;
}

/**
 * Ride request data from the Ride Request API
 */
export interface RideRequestData extends BaseData {
  requestId: string;
  userId: string;
  location: GeoLocation;
  destination?: GeoLocation;
  estimatedDistance?: number;
  estimatedDuration?: number;
  requestStatus: 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'COMPLETED';
  surgeMultiplier?: number;
}

/**
 * Weather data from the Weather API
 */
export interface WeatherData extends BaseData {
  location: GeoLocation;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  weatherCondition: 'CLEAR' | 'CLOUDY' | 'RAIN' | 'SNOW' | 'STORM' | 'FOG' | 'DRIZZLE';
}

/**
 * Traffic data from the Traffic API
 */
export interface TrafficData extends BaseData {
  location: GeoLocation;
  congestionLevel: number; // 0-100
  averageSpeed: number; // km/h
  incidentCount: number;
  roadClosures: boolean;
}

/**
 * Event venue information
 */
export interface EventVenue {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  capacity: number;
  type: 'STADIUM' | 'ARENA' | 'THEATER' | 'CONVENTION_CENTER' | 'OUTDOOR' | 'PARK' | 'OTHER';
}

/**
 * Event data from the Events API
 */
export interface EventData extends BaseData {
  id: string;
  name: string;
  type: 'SPORTS' | 'CONCERT' | 'FESTIVAL' | 'CONFERENCE' | 'POLITICAL' | 'PARADE' | 'OTHER';
  startTime: string;
  endTime: string;
  venue: EventVenue;
  location?: GeoLocation;
  estimatedAttendance: number;
  ticketsSold?: number;
  isHighDemand: boolean;
}

/**
 * Aggregated data for a specific H3 grid cell
 */
export interface GridCellData {
  h3Index: string;
  centerPoint: GeoLocation;
  timestamp: string;
  rideRequests: number;
  activeDrivers?: number;
  weatherData?: WeatherData;
  trafficData?: TrafficData;
  nearbyEvents?: EventData[];
}

/**
 * Surge prediction result
 */
export interface SurgePrediction {
  id: string;
  locationId: string;
  h3Index: string;
  timestamp: string;
  surgeMultiplier: number;
  confidence: number;
  predictedDuration: number; // minutes
  factors: SurgeFactor[];
}

/**
 * Historical surge data for model training
 */
export interface HistoricalSurgeData {
  locationId: string;
  h3Index: string;
  timestamp: string;
  surgeMultiplier: number;
  demandLevel: number;
  supplyLevel: number;
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

/**
 * Surge factor
 */
export interface SurgeFactor {
  name: string;
  impact: number; // 0-1 representing percentage impact
  description: string;
}

/**
 * Location model (aligned with frontend)
 */
export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  h3Index: string;
  radius: number; // meters
  isActive: boolean;
  settings?: LocationSettings;
  currentSurge?: number;
  lastUpdated?: string;
}

/**
 * Location settings
 */
export interface LocationSettings {
  alertThreshold: number;
  monitorWeather: boolean;
  monitorTraffic: boolean;
  monitorEvents: boolean;
  updateFrequency: number; // minutes
}

/**
 * Surge alert
 */
export interface SurgeAlert {
  id: string;
  locationId: string;
  timestamp: string;
  surgeMultiplier: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  factors: SurgeFactor[];
  estimatedDuration: number; // minutes
}

/**
 * Data event interface
 */
export interface DataEvent {
  source: string;
  timestamp: Date;
  payload: any;
} 