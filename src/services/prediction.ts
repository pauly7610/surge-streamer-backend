import { supabase } from './supabase';
import { hexIdToLatLong, latLongToHexId, boundingBoxToHexIds } from './geospatial';
import { 
  SurgePredictionData, 
  HeatmapCell, 
  SurgeTimelinePoint, 
  BoundingBox,
  SurgePredictionParams,
  SurgeTimelineParams,
  HeatmapDataParams
} from '../models/SurgePredictionData';

/**
 * Get surge prediction for a specific location and time
 */
export const getSurgePrediction = async (params: SurgePredictionParams): Promise<SurgePredictionData> => {
  const { latitude, longitude, timestamp = new Date(), predictionHorizon = 0 } = params;
  
  // Convert to hex ID
  const hexId = latLongToHexId(latitude, longitude);
  
  // Calculate the target time
  const targetTime = new Date(timestamp.getTime() + predictionHorizon * 60 * 1000);
  
  try {
    // Query Supabase for the prediction
    const { data, error } = await supabase
      .from('surge_predictions')
      .select('*')
      .eq('hex_id', hexId)
      .lte('predicted_at', targetTime.toISOString())
      .gte('valid_until', targetTime.toISOString())
      .order('predicted_at', { ascending: false })
      .limit(1);
      
    if (error) {
      console.error("Error fetching surge prediction:", error);
      throw new Error("Failed to fetch surge prediction");
    }
    
    // If we have a prediction, return it
    if (data && data.length > 0) {
      return mapToPredictionData(data[0]);
    }
    
    // Otherwise, generate a new prediction
    // In a real system, this would call a machine learning model
    // For now, we'll return a simple prediction based on time of day
    const hour = targetTime.getHours();
    let surgeMultiplier = 1.0;
    
    // Simple time-based surge (rush hours)
    if (hour >= 7 && hour <= 9) surgeMultiplier = 1.8; // Morning rush
    else if (hour >= 16 && hour <= 19) surgeMultiplier = 2.0; // Evening rush
    else if (hour >= 22 || hour <= 2) surgeMultiplier = 1.5; // Night life
    
    const prediction: SurgePredictionData = {
      hexId,
      latitude,
      longitude,
      surgeMultiplier,
      confidence: 0.7,
      demandLevel: Math.floor(Math.random() * 10) + 1,
      supplyLevel: Math.floor(Math.random() * 5) + 1,
      factors: [
        { name: 'time_of_day', contribution: 0.8, description: 'Based on historical patterns' },
        { name: 'location', contribution: 0.2, description: 'Area characteristics' }
      ],
      predictedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      modelVersion: 'fallback-v1'
    };
    
    // Store the prediction
    await storeSurgePrediction(prediction);
    
    return prediction;
  } catch (error) {
    console.error("Error in getSurgePrediction:", error);
    throw error;
  }
};

/**
 * Get surge timeline for a location
 */
export const getSurgeTimeline = async (params: SurgeTimelineParams): Promise<SurgeTimelinePoint[]> => {
  const { latitude, longitude, startTime, endTime, resolution = 15 } = params;
  
  // Convert to hex ID
  const hexId = latLongToHexId(latitude, longitude);
  
  try {
    // Query Supabase for existing predictions
    const { data, error } = await supabase
      .from('surge_predictions')
      .select('*')
      .eq('hex_id', hexId)
      .gte('predicted_at', startTime.toISOString())
      .lte('predicted_at', endTime.toISOString())
      .order('predicted_at', { ascending: true });
      
    if (error) {
      console.error("Error fetching surge timeline:", error);
      throw new Error("Failed to fetch surge timeline");
    }
    
    // If we have predictions, map them to timeline points
    const existingPoints: SurgeTimelinePoint[] = data.map(prediction => ({
      timestamp: prediction.predicted_at,
      surgeMultiplier: prediction.surge_multiplier,
      confidence: prediction.confidence || 0.7
    }));
    
    // Fill in gaps in the timeline
    const timeline: SurgeTimelinePoint[] = [];
    const totalMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (60 * 1000));
    
    for (let minute = 0; minute <= totalMinutes; minute += resolution) {
      const pointTime = new Date(startTime.getTime() + minute * 60 * 1000);
      const timeString = pointTime.toISOString();
      
      // Check if we already have a prediction for this time
      const existingPoint = existingPoints.find(p => 
        new Date(p.timestamp).getTime() >= pointTime.getTime() &&
        new Date(p.timestamp).getTime() < pointTime.getTime() + resolution * 60 * 1000
      );
      
      if (existingPoint) {
        timeline.push(existingPoint);
      } else {
        // Generate a prediction for this time
        const prediction = await getSurgePrediction({
          latitude,
          longitude,
          timestamp: pointTime
        });
        
        timeline.push({
          timestamp: prediction.predictedAt,
          surgeMultiplier: prediction.surgeMultiplier,
          confidence: prediction.confidence
        });
      }
    }
    
    return timeline;
  } catch (error) {
    console.error("Error in getSurgeTimeline:", error);
    throw error;
  }
};

/**
 * Get heatmap data for driver positioning
 */
export const getHeatmapData = async (params: HeatmapDataParams): Promise<HeatmapCell[]> => {
  const { boundingBox, timestamp = new Date(), resolution = 8 } = params;
  
  try {
    // Get all hex IDs in the bounding box
    const hexIds = boundingBoxToHexIds(
      boundingBox.minLat,
      boundingBox.minLng,
      boundingBox.maxLat,
      boundingBox.maxLng
    );
    
    // Query Supabase for predictions in these hexes
    const { data, error } = await supabase
      .from('surge_predictions')
      .select('*')
      .in('hex_id', hexIds)
      .lte('predicted_at', timestamp.toISOString())
      .gte('valid_until', timestamp.toISOString())
      .order('predicted_at', { ascending: false });
      
    if (error) {
      console.error("Error fetching heatmap data:", error);
      throw new Error("Failed to fetch heatmap data");
    }
    
    // Group by hex ID (taking the most recent prediction for each hex)
    const hexMap = new Map<string, any>();
    data.forEach(prediction => {
      if (!hexMap.has(prediction.hex_id)) {
        hexMap.set(prediction.hex_id, prediction);
      }
    });
    
    // Convert to heatmap cells
    const heatmapCells: HeatmapCell[] = [];
    
    for (const hexId of hexIds) {
      const prediction = hexMap.get(hexId);
      
      if (prediction) {
        // We have a prediction for this hex
        heatmapCells.push({
          hexId,
          center: hexIdToLatLong(hexId),
          demandLevel: prediction.demand_level || 0,
          supplyLevel: prediction.supply_level || 0,
          surgeMultiplier: prediction.surge_multiplier
        });
      } else {
        // Generate a fallback prediction
        const center = hexIdToLatLong(hexId);
        const surgePrediction = await getSurgePrediction({
          latitude: center.lat,
          longitude: center.lng,
          timestamp
        });
        
        heatmapCells.push({
          hexId,
          center,
          demandLevel: surgePrediction.demandLevel,
          supplyLevel: surgePrediction.supplyLevel,
          surgeMultiplier: surgePrediction.surgeMultiplier
        });
      }
    }
    
    return heatmapCells;
  } catch (error) {
    console.error("Error in getHeatmapData:", error);
    throw error;
  }
};

/**
 * Store a surge prediction in Supabase
 */
const storeSurgePrediction = async (prediction: SurgePredictionData): Promise<void> => {
  try {
    const { error } = await supabase
      .from('surge_predictions')
      .insert({
        hex_id: prediction.hexId,
        latitude: prediction.latitude,
        longitude: prediction.longitude,
        surge_multiplier: prediction.surgeMultiplier,
        confidence: prediction.confidence,
        demand_level: prediction.demandLevel,
        supply_level: prediction.supplyLevel,
        factors: prediction.factors,
        predicted_at: prediction.predictedAt,
        valid_until: prediction.validUntil,
        model_version: prediction.modelVersion
      });
      
    if (error) {
      console.error("Error storing surge prediction:", error);
    }
  } catch (error) {
    console.error("Error in storeSurgePrediction:", error);
  }
};

/**
 * Map a database record to a SurgePredictionData object
 */
const mapToPredictionData = (record: any): SurgePredictionData => {
  return {
    id: record.id,
    hexId: record.hex_id,
    latitude: record.latitude,
    longitude: record.longitude,
    surgeMultiplier: record.surge_multiplier,
    confidence: record.confidence || 0.7,
    demandLevel: record.demand_level || 0,
    supplyLevel: record.supply_level || 0,
    factors: record.factors || [],
    predictedAt: record.predicted_at,
    validUntil: record.valid_until,
    modelVersion: record.model_version
  };
}; 