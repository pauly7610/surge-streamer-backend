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
}

export interface RideRequest extends GeoPoint {
  id: string;
  user_id: string;
  timestamp: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  destination_latitude?: number;
  destination_longitude?: number;
}

export interface SurgePrediction extends GeoPoint {
  id: string;
  timestamp: string;
  surge_factor: number;
  h3_index?: string;
  demand_count?: number;
  supply_count?: number;
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