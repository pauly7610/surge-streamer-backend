import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

// Create a Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Hex grid utilities
const HEX_RESOLUTION = 0.5; // ~500m hexagon edge length

const latLongToHexId = (lat: number, lng: number): string => {
  const latGrid = Math.floor(lat / HEX_RESOLUTION);
  const lngGrid = Math.floor(lng / HEX_RESOLUTION);
  return `${latGrid}:${lngGrid}`;
};

const hexIdToLatLong = (hexId: string): { lat: number; lng: number } => {
  const [latGrid, lngGrid] = hexId.split(':').map(Number);
  return {
    lat: latGrid * HEX_RESOLUTION + HEX_RESOLUTION / 2,
    lng: lngGrid * HEX_RESOLUTION + HEX_RESOLUTION / 2
  };
};

// Prediction service
async function getSurgePrediction(params: {
  latitude: number;
  longitude: number;
  timestamp?: string;
  predictionHorizon?: number;
}) {
  const { latitude, longitude, timestamp, predictionHorizon = 0 } = params;
  
  // Convert to hex ID
  const hexId = latLongToHexId(latitude, longitude);
  
  // Calculate the target time
  const targetTime = timestamp 
    ? new Date(timestamp) 
    : new Date();
  
  if (predictionHorizon > 0) {
    targetTime.setMinutes(targetTime.getMinutes() + predictionHorizon);
  }
  
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
    
    const prediction = {
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
}

async function storeSurgePrediction(prediction: any): Promise<void> {
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
}

function mapToPredictionData(record: any): any {
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
}

// Handle HTTP requests
serve(async (req) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers }
      );
    }

    // Parse request body
    const body = await req.json();
    const { latitude, longitude, timestamp, predictionHorizon } = body;

    // Validate required parameters
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid latitude/longitude' }),
        { status: 400, headers }
      );
    }

    // Get surge prediction
    const prediction = await getSurgePrediction({
      latitude,
      longitude,
      timestamp,
      predictionHorizon
    });

    // Return the prediction
    return new Response(
      JSON.stringify(prediction),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers }
    );
  }
});
