import { withFilter } from 'graphql-subscriptions';
import { PubSub } from 'graphql-subscriptions';
import { GeospatialUtils } from '../utils/GeospatialUtils';
import { DataService } from '../services/DataService';
import { PredictionService } from '../services/PredictionService';
import { SystemMonitoringService } from '../services/SystemMonitoringService';
import { WeatherConnector } from '../connectors/WeatherConnector';
import { GraphQLScalarType, Kind } from 'graphql';
import { LocationService } from '../services/LocationService';
import { TrafficConnector } from '../connectors/TrafficConnector';
import { EventsConnector } from '../connectors/EventsConnector';
import { PipelineManager } from '../pipeline/PipelineManager';

// Topics for subscriptions
export const TOPICS = {
  RIDE_REQUEST_UPDATED: 'RIDE_REQUEST_UPDATED',
  WEATHER_UPDATED: 'WEATHER_UPDATED',
  TRAFFIC_UPDATED: 'TRAFFIC_UPDATED',
  EVENT_UPDATED: 'EVENT_UPDATED',
  SURGE_PREDICTION_UPDATED: 'SURGE_PREDICTION_UPDATED',
  GRID_CELL_UPDATED: 'GRID_CELL_UPDATED',
  SYSTEM_HEALTH_UPDATED: 'SYSTEM_HEALTH_UPDATED',
  SURGE_ALERT: 'SURGE_ALERT',
};

// Create PubSub instance for subscriptions
const pubsub = new PubSub();

// Define DateTime scalar type
const DateTime = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO-8601 formatted date-time string',
  serialize(value: Date | string | number) {
    // Convert outgoing Date to ISO string for JSON
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  },
  parseValue(value: string | number) {
    // Convert incoming ISO string to Date
    return new Date(value);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      // Convert AST string to Date
      return new Date(ast.value);
    }
    return null;
  }
});

/**
 * GraphQL resolvers for the Surge Streamer API
 */
export const resolvers = {
  Query: {
    /**
     * Get ride requests within a geospatial area
     */
    rideRequests: async (_, { query }, { dataService }: { dataService: DataService }) => {
      return dataService.getRideRequests(query);
    },

    /**
     * Get weather data within a geospatial area
     */
    weatherData: async (_, { query }, { dataService }: { dataService: DataService }) => {
      return dataService.getWeatherData(query);
    },

    /**
     * Get traffic data within a geospatial area
     */
    trafficData: async (_, { query }, { dataService }: { dataService: DataService }) => {
      return dataService.getTrafficData(query);
    },

    /**
     * Get events within a geospatial area
     */
    events: async (_, { query }, { dataService }: { dataService: DataService }) => {
      return dataService.getEvents(query);
    },

    /**
     * Get system health metrics
     */
    systemHealth: async (_, __, { services }) => {
      const { pipelineManager } = services;
      const systemMonitoringService = new SystemMonitoringService(pipelineManager);
      return {
        status: 'HEALTHY',
        uptime: 3600, // seconds
        connectorStatus: [
          {
            name: 'WeatherConnector',
            status: 'CONNECTED',
            lastUpdated: new Date().toISOString(),
            message: null,
          },
          {
            name: 'TrafficConnector',
            status: 'CONNECTED',
            lastUpdated: new Date().toISOString(),
            message: null,
          },
          {
            name: 'EventsConnector',
            status: 'CONNECTED',
            lastUpdated: new Date().toISOString(),
            message: null,
          },
        ],
        lastUpdated: new Date().toISOString(),
      };
    },
    
    /**
     * Get surge prediction for a location
     */
    getSurgePrediction: async (_, { locationId }, { services }) => {
      const { predictionService } = services;
      return predictionService.getLatestPredictionForLocation(locationId);
    },
    
    /**
     * Get surge predictions in a radius
     */
    getSurgePredictionsInRadius: async (_, { latitude, longitude, radius }, { services }) => {
      const { predictionService } = services;
      return predictionService.getSurgePredictionsInRadius(latitude, longitude, radius);
    },

    /**
     * Get historical surge data
     */
    getHistoricalSurge: async (_, { locationId, startTime, endTime }, { services }) => {
      // Implementation will be added later
      return [];
    },

    /**
     * Get active locations
     */
    getActiveLocations: async (_, __, { services }) => {
      const { locationService } = services;
      return locationService.getActiveLocations();
    },

    /**
     * Get grid cell data within a geospatial area
     */
    gridCellData: async (_, { query }, { dataService }: { dataService: DataService }) => {
      return dataService.getGridCellData(query);
    },

    // Location queries
    getLocation: async (_, { id }, { services }) => {
      return services.locationService.getLocationById(id);
    },
    
    getLocationsInRadius: async (_, { input }, { services }) => {
      const { latitude, longitude, radius } = input;
      return services.locationService.getLocationsInRadius(latitude, longitude, radius);
    },
    
    // Environmental data queries
    getWeatherInRadius: async (_, { input }, { connectors }) => {
      // This would fetch weather data for locations within a radius
      // For now, return mock data
      return [
        {
          locationId: '1',
          timestamp: new Date().toISOString(),
          temperature: 22.5,
          humidity: 65,
          windSpeed: 10,
          windDirection: 180,
          precipitation: 0,
          condition: 'CLEAR',
        },
      ];
    },
    
    getTrafficData: async (_, { locationId }, { connectors }) => {
      // This would fetch traffic data for a specific location
      // For now, return mock data
      return {
        locationId,
        timestamp: new Date().toISOString(),
        congestionLevel: 45,
        averageSpeed: 35,
        incidentCount: 0,
        roadClosures: false,
      };
    },
    
    getTrafficInRadius: async (_, { input }, { connectors }) => {
      // This would fetch traffic data for locations within a radius
      // For now, return mock data
      return [
        {
          locationId: '1',
          timestamp: new Date().toISOString(),
          congestionLevel: 45,
          averageSpeed: 35,
          incidentCount: 0,
          roadClosures: false,
        },
      ];
    },
    
    getEvents: async (_, { locationId }, { connectors }) => {
      // This would fetch events for a specific location
      // For now, return mock data
      return [
        {
          id: '1',
          name: 'Concert',
          type: 'CONCERT',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
          venue: {
            id: '1',
            name: 'Stadium',
            latitude: 40.7128,
            longitude: -74.0060,
            capacity: 50000,
            type: 'STADIUM',
          },
          estimatedAttendance: 35000,
          ticketsSold: 30000,
          isHighDemand: true,
        },
      ];
    },
    
    getEventsInRadius: async (_, { input }, { connectors }) => {
      // This would fetch events for locations within a radius
      // For now, return mock data
      return [
        {
          id: '1',
          name: 'Concert',
          type: 'CONCERT',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
          venue: {
            id: '1',
            name: 'Stadium',
            latitude: 40.7128,
            longitude: -74.0060,
            capacity: 50000,
            type: 'STADIUM',
          },
          estimatedAttendance: 35000,
          ticketsSold: 30000,
          isHighDemand: true,
        },
      ];
    },
  },

  Mutation: {
    /**
     * Add a monitored location for weather data
     */
    addWeatherMonitoredLocation: async (_, { latitude, longitude }, { weatherConnector }: { weatherConnector: WeatherConnector }) => {
      try {
        weatherConnector.addMonitoredLocation({ latitude, longitude });
        return true;
      } catch (error) {
        console.error('Failed to add monitored location', error);
        return false;
      }
    },

    /**
     * Remove a monitored location for weather data
     */
    removeWeatherMonitoredLocation: async (_, { latitude, longitude }, { weatherConnector }: { weatherConnector: WeatherConnector }) => {
      try {
        weatherConnector.removeMonitoredLocation({ latitude, longitude });
        return true;
      } catch (error) {
        console.error('Failed to remove monitored location', error);
        return false;
      }
    },

    /**
     * Trigger a manual prediction update
     */
    triggerPredictionUpdate: async (_, { locationId }, { services }) => {
      const location = await services.locationService.getLocationById(locationId);
      if (!location) {
        throw new Error(`Location with ID ${locationId} not found`);
      }
      
      const prediction = await services.predictionService.generatePredictionForLocation(location);
      
      // Publish the prediction update
      pubsub.publish(TOPICS.SURGE_PREDICTION_UPDATED, {
        surgePredictionUpdated: prediction,
      });
      
      return prediction;
    },

    // Location mutations
    addLocation: async (_, { name, latitude, longitude, radius }, { services }) => {
      return services.locationService.addLocation(name, latitude, longitude, radius);
    },
    
    updateLocation: async (_, { id, name, isActive }, { services }) => {
      return services.locationService.updateLocation(id, { name, isActive });
    },
    
    updateLocationSettings: async (_, { id, settings }, { services }) => {
      return services.locationService.updateLocationSettings(id, settings);
    },
    
    removeLocation: async (_, { id }, { services }) => {
      return services.locationService.removeLocation(id);
    },

    // System mutations
    startPipeline: async (_, __, { services }) => {
      await services.pipelineManager.start();
      return true;
    },
    
    stopPipeline: async (_, __, { services }) => {
      await services.pipelineManager.stop();
      return true;
    },
    
    resetSystem: async (_, __, { services }) => {
      await services.pipelineManager.stop();
      // Additional reset logic would go here
      await services.pipelineManager.start();
      return true;
    },

    /**
     * Add a monitored location
     */
    addMonitoredLocation: async (_, { latitude, longitude, name }, { services }) => {
      const { locationService } = services;
      return locationService.addLocation({
        name,
        latitude,
        longitude,
        isActive: true,
      });
    },

    /**
     * Remove a monitored location
     */
    removeMonitoredLocation: async (_, { id }, { services }) => {
      const { locationService } = services;
      return locationService.removeLocation(id);
    },
  },

  Subscription: {
    /**
     * Subscribe to ride requests in real-time
     */
    rideRequestUpdates: {
      subscribe: withFilter(
        (_, __, { pubsub }: { pubsub: PubSub }) => pubsub.asyncIterator([TOPICS.RIDE_REQUEST_UPDATED]),
        (payload, variables) => {
          if (!variables.h3Indexes || variables.h3Indexes.length === 0) {
            return true;
          }
          return variables.h3Indexes.includes(payload.rideRequestUpdates.h3Index);
        }
      ),
    },

    /**
     * Subscribe to weather updates in real-time
     */
    weatherUpdates: {
      subscribe: () => pubsub.asyncIterator([TOPICS.WEATHER_UPDATED]),
    },

    /**
     * Subscribe to traffic updates in real-time
     */
    trafficUpdates: {
      subscribe: () => pubsub.asyncIterator([TOPICS.TRAFFIC_UPDATED]),
    },

    /**
     * Subscribe to event updates in real-time
     */
    eventUpdates: {
      subscribe: () => pubsub.asyncIterator([TOPICS.EVENT_UPDATED]),
    },

    /**
     * Subscribe to surge prediction updates in real-time
     */
    surgePredictionUpdates: {
      subscribe: withFilter(
        (_, __, { pubsub }: { pubsub: PubSub }) => pubsub.asyncIterator([TOPICS.SURGE_PREDICTION_UPDATED]),
        (payload, variables) => {
          if (!variables.h3Indexes || variables.h3Indexes.length === 0) {
            return true;
          }
          return variables.h3Indexes.includes(payload.surgePredictionUpdates.h3Index);
        }
      ),
    },

    /**
     * Subscribe to grid cell data updates in real-time
     */
    gridCellUpdates: {
      subscribe: withFilter(
        (_, __, { pubsub }: { pubsub: PubSub }) => pubsub.asyncIterator([TOPICS.GRID_CELL_UPDATED]),
        (payload, variables) => {
          if (!variables.h3Indexes || variables.h3Indexes.length === 0) {
            return true;
          }
          return variables.h3Indexes.includes(payload.gridCellUpdates.h3Index);
        }
      ),
    },

    /**
     * Subscribe to system health updates
     */
    systemHealthUpdates: {
      subscribe: (_, __, { pubsub }: { pubsub: PubSub }) => pubsub.asyncIterator([TOPICS.SYSTEM_HEALTH_UPDATED]),
    },

    /**
     * Subscribe to surge prediction updates
     */
    surgePredictionUpdated: {
      subscribe: () => pubsub.asyncIterator([TOPICS.SURGE_PREDICTION_UPDATED]),
    },
    
    /**
     * Subscribe to surge alerts
     */
    surgeAlerts: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([TOPICS.SURGE_ALERT]),
        (payload, variables) => {
          const alert = payload.surgeAlerts;
          
          // Filter by locationId
          if (variables.locationId && alert.locationId !== variables.locationId) {
            return false;
          }
          
          // Filter by minSeverity
          if (variables.minSeverity) {
            const severityLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
            const minIndex = severityLevels.indexOf(variables.minSeverity);
            const alertIndex = severityLevels.indexOf(alert.severity);
            
            if (alertIndex < minIndex) {
              return false;
            }
          }
          
          return true;
        }
      ),
    },

    /**
     * Subscribe to real-time surge alerts
     */
    realTimeSurgeAlerts: {
      subscribe: () => pubsub.asyncIterator([TOPICS.SURGE_ALERT]),
    },
  },

  // Custom scalar for DateTime
  DateTime,
};

export default resolvers; 