import { 
  realtimeSubscribeToDriverLocations as subscribeToDriverLocations, 
  realtimeSubscribeToRideRequests as subscribeToRideRequests, 
  realtimeSubscribeToSurgePredictions as subscribeToSurgePredictions,
  createBoundingBox,
  startPipeline,
  stopPipeline
} from './services';
import { DriverLocation, RideRequest, SurgePrediction, SubscriptionCallback } from './types';

// Example usage of the real-time subscriptions
const setupSubscriptions = () => {
  // Create a bounding box for San Francisco area
  const sfCenter = { latitude: 37.7749, longitude: -122.4194 };
  const boundingBox = createBoundingBox(sfCenter, 10); // 10km radius
  
  // Subscribe to driver locations
  const unsubscribeDrivers = subscribeToDriverLocations(boundingBox, ((payload: DriverLocation[]) => {
    console.log('Driver location update:', payload);
    // Process driver location updates
  }) as SubscriptionCallback<DriverLocation>);
  
  // Subscribe to ride requests
  const unsubscribeRides = subscribeToRideRequests(boundingBox, ((payload: RideRequest[]) => {
    console.log('Ride request update:', payload);
    // Process ride request updates
  }) as SubscriptionCallback<RideRequest>);
  
  // Subscribe to surge predictions
  const unsubscribeSurge = subscribeToSurgePredictions(boundingBox, ((payload: SurgePrediction[]) => {
    console.log('Surge prediction update:', payload);
    // Process surge prediction updates
  }) as SubscriptionCallback<SurgePrediction>);
  
  // Return a function to unsubscribe from all
  return () => {
    unsubscribeDrivers();
    unsubscribeRides();
    unsubscribeSurge();
  };
};

// Start the data processing pipeline
const startServer = async () => {
  console.log('Starting Surge Streamer Backend...');
  
  // Setup real-time subscriptions
  const unsubscribeAll = setupSubscriptions();
  
  // Start the data processing pipeline
  await startPipeline();
  
  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    unsubscribeAll();
    await stopPipeline();
    process.exit(0);
  };
  
  // Listen for termination signals
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  console.log('Surge Streamer Backend is running');
};

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 