export * from './auth';
export * from './rides';
export * from './locations';
export * from './surge';

// Import and re-export with explicit names to avoid conflicts
import { 
  subscribeToDriverLocations as realtimeSubscribeToDriverLocations,
  subscribeToRideRequests as realtimeSubscribeToRideRequests,
  subscribeToSurgePredictions as realtimeSubscribeToSurgePredictions
} from './realtime';

export {
  realtimeSubscribeToDriverLocations,
  realtimeSubscribeToRideRequests,
  realtimeSubscribeToSurgePredictions
};

export * from './geospatial';
export * from './prediction';
export * from './dataStream';
export { supabase } from './supabase';

// Import and export startPipeline and stopPipeline
import { 
  startPipeline, 
  stopPipeline,
  saveSurgePredictions,
  getCurrentProcessingArea
} from './startPipeline';

export {
  startPipeline,
  stopPipeline,
  saveSurgePredictions,
  getCurrentProcessingArea
}; 