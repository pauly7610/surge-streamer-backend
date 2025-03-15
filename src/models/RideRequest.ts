import { Database } from "../types/supabase";

export type RideStatus = Database["public"]["Enums"]["ride_status"];

export interface RideRequest {
  id: string;
  rider_id: string;
  driver_id?: string | null;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_address?: string | null;
  destination_latitude: number;
  destination_longitude: number;
  destination_address?: string | null;
  status: RideStatus | null;
  estimated_fare?: number | null;
  actual_fare?: number | null;
  created_at: string;
  updated_at: string;
  accepted_at?: string | null;
  completed_at?: string | null;
}

export interface CreateRideRequestInput {
  rider_id: string;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_address?: string;
  destination_latitude: number;
  destination_longitude: number;
  destination_address?: string;
  estimated_fare?: number;
}

export interface UpdateRideStatusInput {
  status: RideStatus;
  driver_id?: string;
  actual_fare?: number;
  accepted_at?: string;
  completed_at?: string;
} 