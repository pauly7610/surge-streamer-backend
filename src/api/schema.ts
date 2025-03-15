import { gql } from 'apollo-server-express';

/**
 * GraphQL schema definition
 */
export const typeDefs = gql`
  scalar DateTime

  type GeoLocation {
    latitude: Float!
    longitude: Float!
  }

  type Location {
    id: ID!
    name: String!
    latitude: Float!
    longitude: Float!
    h3Index: String!
    radius: Float!
    isActive: Boolean!
    settings: LocationSettings
    currentSurge: Float
    lastUpdated: DateTime
  }

  type LocationSettings {
    alertThreshold: Float!
    monitorWeather: Boolean!
    monitorTraffic: Boolean!
    monitorEvents: Boolean!
    updateFrequency: Int!
  }

  enum AlertSeverity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  type SurgeFactor {
    name: String!
    impact: Float!
    description: String!
  }

  type SurgePrediction {
    id: ID!
    locationId: ID!
    timestamp: DateTime!
    surgeMultiplier: Float!
    confidence: Float!
    predictedDuration: Int!
    factors: [SurgeFactor!]!
  }

  type SurgeAlert {
    id: ID!
    locationId: ID!
    timestamp: DateTime!
    surgeMultiplier: Float!
    severity: AlertSeverity!
    message: String!
    factors: [SurgeFactor!]!
    estimatedDuration: Int!
  }

  type HistoricalSurgeData {
    locationId: ID!
    timestamp: DateTime!
    surgeMultiplier: Float!
    demandLevel: Int!
    supplyLevel: Int!
  }

  type Weather {
    locationId: ID!
    timestamp: DateTime!
    temperature: Float!
    humidity: Float!
    windSpeed: Float!
    windDirection: Float!
    precipitation: Float!
    condition: String!
  }

  type Traffic {
    locationId: ID!
    timestamp: DateTime!
    congestionLevel: Float!
    averageSpeed: Float!
    incidentCount: Int!
    roadClosures: Boolean!
  }

  type EventVenue {
    id: ID!
    name: String!
    latitude: Float!
    longitude: Float!
    capacity: Int!
    type: String!
  }

  type Event {
    id: ID!
    name: String!
    type: String!
    startTime: DateTime!
    endTime: DateTime!
    venue: EventVenue!
    estimatedAttendance: Int!
    ticketsSold: Int
    isHighDemand: Boolean!
  }

  type SystemHealth {
    status: String!
    uptime: Float!
    connectorStatus: [ConnectorStatus!]!
    lastUpdated: DateTime!
  }

  type ConnectorStatus {
    name: String!
    status: String!
    lastUpdated: DateTime!
    message: String
  }

  input GeospatialQueryInput {
    latitude: Float!
    longitude: Float!
    radius: Float!
  }

  input LocationSettingsInput {
    alertThreshold: Float
    monitorWeather: Boolean
    monitorTraffic: Boolean
    monitorEvents: Boolean
    updateFrequency: Int
  }

  type Query {
    # Location queries
    getLocation(id: ID!): Location
    getActiveLocations: [Location!]!
    getLocationsInRadius(input: GeospatialQueryInput!): [Location!]!
    
    # Surge prediction queries
    getSurgePrediction(locationId: ID!): SurgePrediction
    getSurgePredictionsInRadius(input: GeospatialQueryInput!): [SurgePrediction!]!
    getHistoricalSurge(locationId: ID!, startTime: DateTime!, endTime: DateTime!): [HistoricalSurgeData!]!
    
    # Environmental data queries
    getWeatherData(locationId: ID!): Weather
    getWeatherInRadius(input: GeospatialQueryInput!): [Weather!]!
    getTrafficData(locationId: ID!): Traffic
    getTrafficInRadius(input: GeospatialQueryInput!): [Traffic!]!
    getEvents(locationId: ID!): [Event!]!
    getEventsInRadius(input: GeospatialQueryInput!): [Event!]!
    
    # System queries
    getSystemHealth: SystemHealth!
  }

  type Mutation {
    # Location mutations
    addLocation(name: String!, latitude: Float!, longitude: Float!, radius: Float!): Location!
    updateLocation(id: ID!, name: String, isActive: Boolean): Location!
    updateLocationSettings(id: ID!, settings: LocationSettingsInput!): Location!
    removeLocation(id: ID!): Boolean!
    
    # Prediction mutations
    triggerPredictionUpdate(locationId: ID!): SurgePrediction!
    
    # System mutations
    startPipeline: Boolean!
    stopPipeline: Boolean!
    resetSystem: Boolean!
  }

  type Subscription {
    # Surge subscriptions
    surgePredictionUpdated(locationId: ID): SurgePrediction!
    surgeAlerts(locationId: ID, minSeverity: AlertSeverity): SurgeAlert!
    
    # Environmental subscriptions
    weatherUpdated(locationId: ID): Weather!
    trafficUpdated(locationId: ID): Traffic!
    eventUpdated(locationId: ID): Event!
    
    # System subscriptions
    systemHealthUpdated: SystemHealth!
  }
`;

export default typeDefs; 