// Type definitions for the application

// Geospatial types
export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

// Database entity types
export interface DriverLocation extends GeoPoint {
  id: string;
  driver_id: string;
  timestamp: string;
  status: 'available' | 'busy' | 'offline';
  heading?: number;
  speed?: number;
  accuracy?: number;
}

export interface RideRequest extends GeoPoint {
  id: string;
  user_id: string;
  timestamp: string;
  destination: GeoPoint;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  estimated_fare?: number;
  estimated_duration?: number;
  estimated_distance?: number;
}

export interface SurgePrediction {
  id: string;
  locationId: string;
  h3Index: string;
  timestamp: string;
  surgeMultiplier: number;
  confidence: number;
  predictedDuration: number;
  factors: PredictionFactor[];
}

export interface PredictionFactor {
  name: string;
  description: string;
  impact: number;
}

// Subscription types
export interface SubscriptionCallback<T> {
  (payload: T[]): void;
}

// Data stream types
export interface DemandSupplyData {
  demand: RideRequest[];
  supply: DriverLocation[];
}

export interface ProcessedData {
  h3_index: string;
  demand_count: number;
  supply_count: number;
  surge_factor: number;
  latitude: number;
  longitude: number;
  timestamp: string;
} 