import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { BoundingBox, DriverLocation, RideRequest, SurgePrediction, SubscriptionCallback } from '../types';

// Channels for different data streams
let driverLocationsChannel: RealtimeChannel | null = null;
let rideRequestsChannel: RealtimeChannel | null = null;
let surgePredictionsChannel: RealtimeChannel | null = null;

/**
 * Subscribe to real-time driver location updates within a bounding box
 */
export const subscribeToDriverLocations = (
  boundingBox: BoundingBox,
  callback: SubscriptionCallback<DriverLocation>
) => {
  // Unsubscribe from existing channel if any
  if (driverLocationsChannel) {
    driverLocationsChannel.unsubscribe();
  }

  // Create a new subscription
  driverLocationsChannel = supabase
    .channel('driver-locations-feed')
    .on(
      'postgres_changes' as any, 
      {
        event: '*',
        schema: 'public',
        table: 'driver_locations',
        filter: `latitude.gte.${boundingBox.minLat}
                AND latitude.lte.${boundingBox.maxLat}
                AND longitude.gte.${boundingBox.minLng}
                AND longitude.lte.${boundingBox.maxLng}`
      }, 
      callback as any
    )
    .subscribe();

  return () => {
    if (driverLocationsChannel) {
      driverLocationsChannel.unsubscribe();
      driverLocationsChannel = null;
    }
  };
};

/**
 * Subscribe to real-time ride request updates
 */
export const subscribeToRideRequests = (
  boundingBox: BoundingBox,
  callback: SubscriptionCallback<RideRequest>
) => {
  // Unsubscribe from existing channel if any
  if (rideRequestsChannel) {
    rideRequestsChannel.unsubscribe();
  }

  // Create a new subscription
  rideRequestsChannel = supabase
    .channel('ride-requests-feed')
    .on(
      'postgres_changes' as any, 
      {
        event: '*',
        schema: 'public',
        table: 'ride_requests',
        filter: `latitude.gte.${boundingBox.minLat}
                AND latitude.lte.${boundingBox.maxLat}
                AND longitude.gte.${boundingBox.minLng}
                AND longitude.lte.${boundingBox.maxLng}`
      }, 
      callback as any
    )
    .subscribe();

  return () => {
    if (rideRequestsChannel) {
      rideRequestsChannel.unsubscribe();
      rideRequestsChannel = null;
    }
  };
};

/**
 * Subscribe to real-time surge prediction updates
 */
export const subscribeToSurgePredictions = (
  boundingBox: BoundingBox,
  callback: SubscriptionCallback<SurgePrediction>
) => {
  // Unsubscribe from existing channel if any
  if (surgePredictionsChannel) {
    surgePredictionsChannel.unsubscribe();
  }

  // Create a new subscription
  surgePredictionsChannel = supabase
    .channel('surge-predictions-feed')
    .on(
      'postgres_changes' as any, 
      {
        event: '*',
        schema: 'public',
        table: 'surge_predictions',
        filter: `latitude.gte.${boundingBox.minLat}
                AND latitude.lte.${boundingBox.maxLat}
                AND longitude.gte.${boundingBox.minLng}
                AND longitude.lte.${boundingBox.maxLng}`
      }, 
      callback as any
    )
    .subscribe();

  return () => {
    if (surgePredictionsChannel) {
      surgePredictionsChannel.unsubscribe();
      surgePredictionsChannel = null;
    }
  };
}; 