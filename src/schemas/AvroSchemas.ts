/**
 * Avro schemas for Kafka messages
 */

/**
 * Geo coordinates schema
 */
export const geoCoordinatesSchema = {
  type: 'record',
  name: 'GeoCoordinates',
  namespace: 'com.surgestreamer.schemas',
  fields: [
    { name: 'latitude', type: 'double' },
    { name: 'longitude', type: 'double' }
  ]
};

/**
 * Driver location schema
 */
export const driverLocationSchema = {
  type: 'record',
  name: 'DriverLocation',
  namespace: 'com.surgestreamer.schemas',
  fields: [
    { name: 'driverId', type: 'string' },
    { name: 'timestamp', type: 'string' },
    { name: 'location', type: geoCoordinatesSchema },
    { name: 'heading', type: ['null', 'int'], default: null },
    { name: 'speed', type: ['null', 'double'], default: null },
    { 
      name: 'availability', 
      type: { 
        type: 'enum', 
        name: 'DriverAvailability', 
        symbols: ['AVAILABLE', 'BUSY', 'OFFLINE'] 
      } 
    },
    { 
      name: 'vehicleType', 
      type: { 
        type: 'enum', 
        name: 'VehicleType', 
        symbols: ['ECONOMY', 'COMFORT', 'PREMIUM'] 
      } 
    },
    { name: 'batteryLevel', type: ['null', 'double'], default: null },
    { name: 'h3Index', type: ['null', 'string'], default: null }
  ]
};

/**
 * Ride request schema
 */
export const rideRequestSchema = {
  type: 'record',
  name: 'RideRequest',
  namespace: 'com.surgestreamer.schemas',
  fields: [
    { name: 'requestId', type: 'string' },
    { name: 'userId', type: 'string' },
    { name: 'timestamp', type: 'string' },
    { name: 'pickupLocation', type: geoCoordinatesSchema },
    { name: 'dropoffLocation', type: geoCoordinatesSchema },
    { 
      name: 'requestStatus', 
      type: { 
        type: 'enum', 
        name: 'RequestStatus', 
        symbols: ['PENDING', 'ACCEPTED', 'CANCELLED', 'COMPLETED'] 
      } 
    },
    { 
      name: 'vehicleType', 
      type: { 
        type: 'enum', 
        name: 'VehicleType', 
        symbols: ['ECONOMY', 'COMFORT', 'PREMIUM'] 
      } 
    },
    { name: 'estimatedDistance', type: 'double' },
    { name: 'estimatedDuration', type: 'double' },
    { name: 'paymentMethod', type: 'string' },
    { name: 'specialRequests', type: { type: 'array', items: 'string' }, default: [] },
    { name: 'h3Index', type: ['null', 'string'], default: null }
  ]
};

/**
 * Weather data schema
 */
export const weatherDataSchema = {
  type: 'record',
  name: 'WeatherData',
  namespace: 'com.surgestreamer.schemas',
  fields: [
    { name: 'timestamp', type: 'string' },
    { name: 'location', type: geoCoordinatesSchema },
    { name: 'temperature', type: 'double' },
    { name: 'precipitation', type: 'double' },
    { name: 'humidity', type: 'double' },
    { name: 'windSpeed', type: 'double' },
    { name: 'windDirection', type: 'double' },
    { name: 'weatherCondition', type: 'string' },
    { name: 'h3Index', type: ['null', 'string'], default: null }
  ]
};

/**
 * Traffic data schema
 */
export const trafficDataSchema = {
  type: 'record',
  name: 'TrafficData',
  namespace: 'com.surgestreamer.schemas',
  fields: [
    { name: 'timestamp', type: 'string' },
    { name: 'location', type: geoCoordinatesSchema },
    { name: 'roadSegmentId', type: 'string' },
    { name: 'congestionLevel', type: 'double' },
    { name: 'averageSpeed', type: 'double' },
    { 
      name: 'incidentType', 
      type: ['null', { 
        type: 'enum', 
        name: 'IncidentType', 
        symbols: ['ACCIDENT', 'CONSTRUCTION', 'CLOSURE', 'OTHER'] 
      }],
      default: null
    },
    { 
      name: 'incidentSeverity', 
      type: ['null', { 
        type: 'enum', 
        name: 'IncidentSeverity', 
        symbols: ['LOW', 'MEDIUM', 'HIGH'] 
      }],
      default: null
    },
    { name: 'h3Index', type: ['null', 'string'], default: null }
  ]
};

/**
 * Event data schema
 */
export const eventDataSchema = {
  type: 'record',
  name: 'EventData',
  namespace: 'com.surgestreamer.schemas',
  fields: [
    { name: 'eventId', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'description', type: ['null', 'string'], default: null },
    { name: 'location', type: geoCoordinatesSchema },
    { name: 'venue', type: ['null', 'string'], default: null },
    { name: 'startTime', type: 'string' },
    { name: 'endTime', type: 'string' },
    { name: 'category', type: 'string' },
    { name: 'expectedAttendance', type: 'int' },
    { name: 'h3Index', type: ['null', 'string'], default: null }
  ]
};

/**
 * Surge prediction schema
 */
export const surgePredictionSchema = {
  type: 'record',
  name: 'SurgePrediction',
  namespace: 'com.surgestreamer.schemas',
  fields: [
    { name: 'predictionId', type: 'string' },
    { name: 'timestamp', type: 'string' },
    { name: 'h3Index', type: 'string' },
    { name: 'resolution', type: 'int' },
    { name: 'demandLevel', type: 'double' },
    { name: 'confidenceScore', type: 'double' },
    { name: 'predictionWindow', type: 'int' },
    { 
      name: 'features', 
      type: ['null', { type: 'map', values: 'double' }],
      default: null
    }
  ]
};

/**
 * Surge pricing schema
 */
export const surgePricingSchema = {
  type: 'record',
  name: 'SurgePricing',
  namespace: 'com.surgestreamer.schemas',
  fields: [
    { name: 'h3Index', type: 'string' },
    { name: 'timestamp', type: 'string' },
    { name: 'multiplier', type: 'double' },
    { name: 'basePrice', type: 'double' },
    { name: 'currency', type: 'string' },
    { 
      name: 'vehicleTypes', 
      type: { 
        type: 'array', 
        items: { 
          type: 'enum', 
          name: 'VehicleType', 
          symbols: ['ECONOMY', 'COMFORT', 'PREMIUM'] 
        } 
      } 
    },
    { name: 'expiresAt', type: 'string' }
  ]
};

/**
 * Supply-demand metrics schema
 */
export const supplyDemandMetricsSchema = {
  type: 'record',
  name: 'SupplyDemandMetrics',
  namespace: 'com.surgestreamer.schemas',
  fields: [
    { name: 'h3Index', type: 'string' },
    { name: 'timestamp', type: 'string' },
    { name: 'resolution', type: 'int' },
    { name: 'activeDrivers', type: 'int' },
    { name: 'pendingRequests', type: 'int' },
    { name: 'completedRides', type: 'int' },
    { name: 'cancelledRides', type: 'int' },
    { name: 'averageWaitTime', type: 'double' },
    { name: 'supplyDemandRatio', type: 'double' }
  ]
};

/**
 * Feature vector schema
 */
export const featureVectorSchema = {
  type: 'record',
  name: 'FeatureVector',
  namespace: 'com.surgestreamer.schemas',
  fields: [
    { name: 'h3Index', type: 'string' },
    { name: 'timestamp', type: 'string' },
    { name: 'features', type: { type: 'array', items: 'double' } },
    { name: 'featureNames', type: { type: 'array', items: 'string' } }
  ]
};

/**
 * System health metrics schema
 */
export const systemHealthMetricsSchema = {
  type: 'record',
  name: 'SystemHealthMetrics',
  namespace: 'com.surgestreamer.schemas',
  fields: [
    { name: 'timestamp', type: 'string' },
    { name: 'componentName', type: 'string' },
    { 
      name: 'status', 
      type: { 
        type: 'enum', 
        name: 'SystemStatus', 
        symbols: ['HEALTHY', 'DEGRADED', 'UNHEALTHY'] 
      } 
    },
    { name: 'latency', type: 'double' },
    { name: 'errorRate', type: 'double' },
    { name: 'throughput', type: 'double' },
    { name: 'cpuUsage', type: 'double' },
    { name: 'memoryUsage', type: 'double' },
    { name: 'activeConnections', type: 'int' }
  ]
};

/**
 * Pipeline metrics schema
 */
export const pipelineMetricsSchema = {
  type: 'record',
  name: 'PipelineMetrics',
  namespace: 'com.surgestreamer.schemas',
  fields: [
    { name: 'pipelineId', type: 'string' },
    { name: 'timestamp', type: 'string' },
    { name: 'stage', type: 'string' },
    { name: 'inputCount', type: 'int' },
    { name: 'outputCount', type: 'int' },
    { name: 'errorCount', type: 'int' },
    { name: 'processingTimeMs', type: 'double' },
    { name: 'batchSize', type: 'int' },
    { name: 'queueSize', type: 'int' },
    { name: 'lag', type: 'double' }
  ]
}; 