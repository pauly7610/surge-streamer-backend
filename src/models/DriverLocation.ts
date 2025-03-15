export interface DriverLocation {
  id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  is_available: boolean | null;
  timestamp: string;
}

export interface UpdateDriverLocationInput {
  driver_id: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  is_available?: boolean;
}

export interface NearbyDriversParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
} 