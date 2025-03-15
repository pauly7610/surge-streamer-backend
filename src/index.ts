import { 
  realtimeSubscribeToDriverLocations as subscribeToDriverLocations, 
  realtimeSubscribeToRideRequests as subscribeToRideRequests, 
  realtimeSubscribeToSurgePredictions as subscribeToSurgePredictions,
  createBoundingBox,
  startPipeline,
  stopPipeline
} from './services';
import { DriverLocation, RideRequest, SurgePrediction, SubscriptionCallback } from './types';
import { sendDriverLocation, sendRideRequest } from './services/kafka';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import config from './config';

// Create Express server
const app = express();

// Apply middleware
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());

// Example usage of the real-time subscriptions
const setupSubscriptions = () => {
  // Create a bounding box for San Francisco area
  const sfCenter = { latitude: 37.7749, longitude: -122.4194 };
  const boundingBox = createBoundingBox(sfCenter, 10); // 10km radius
  
  // Subscribe to driver locations
  const unsubscribeDrivers = subscribeToDriverLocations(boundingBox, ((payload: DriverLocation[]) => {
    console.log('Driver location update:', payload);
    
    // Forward to Kafka
    payload.forEach(location => {
      sendDriverLocation(location).catch(err => {
        console.error('Error sending driver location to Kafka:', err);
      });
    });
  }) as SubscriptionCallback<DriverLocation>);
  
  // Subscribe to ride requests
  const unsubscribeRides = subscribeToRideRequests(boundingBox, ((payload: RideRequest[]) => {
    console.log('Ride request update:', payload);
    
    // Forward to Kafka
    payload.forEach(request => {
      sendRideRequest(request).catch(err => {
        console.error('Error sending ride request to Kafka:', err);
      });
    });
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

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/surge/current', async (req, res) => {
  try {
    const lat = req.query.lat as string | undefined;
    const lng = req.query.lng as string | undefined;
    const radius = req.query.radius as string | undefined;
    
    // Validate parameters
    if (!lat || !lng) {
      return res.json({ error: 'Missing required parameters: lat, lng' });
    }
    
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusKm = radius ? parseFloat(radius) : 5;
    
    // Create bounding box
    const center = { latitude, longitude };
    const boundingBox = createBoundingBox(center, radiusKm);
    
    // Query Supabase for current surge predictions
    const { data, error } = await import('./services/supabase').then(m => m.supabase)
      .then(supabase => supabase
        .from('surge_predictions')
        .select('*')
        .gte('latitude', boundingBox.minLat)
        .lte('latitude', boundingBox.maxLat)
        .gte('longitude', boundingBox.minLng)
        .lte('longitude', boundingBox.maxLng)
        .order('timestamp', { ascending: false })
      );
    
    if (error) {
      console.error('Error fetching surge predictions:', error);
      return res.json({ error: 'Failed to fetch surge predictions' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error handling request:', error);
    res.json({ error: 'Internal server error' });
  }
});

// Start the data processing pipeline
const startServer = async () => {
  console.log('Starting Surge Streamer Backend...');
  
  // Setup real-time subscriptions
  const unsubscribeAll = setupSubscriptions();
  
  // Start the data processing pipeline
  await startPipeline();
  
  // Start Express server
  const port = config.server.port;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
  
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