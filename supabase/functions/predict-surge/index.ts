
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { latitude, longitude } = await req.json();
    
    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: "Latitude and longitude are required" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        }
      );
    }
    
    // Simple surge prediction algorithm based on:
    // 1. Time of day (rush hours have higher surge)
    // 2. Number of active drivers in the area
    // 3. Number of recent ride requests in the area
    
    const now = new Date();
    const hour = now.getUTCHours();
    
    // Check if it's rush hour (7-9 AM or 4-7 PM)
    const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);
    
    // Get number of available drivers in the area
    const { data: driverLocations, error: driversError } = await supabase
      .from("driver_locations")
      .select("*")
      .eq("is_available", true)
      .lte("latitude", latitude + 0.05)
      .gte("latitude", latitude - 0.05)
      .lte("longitude", longitude + 0.05)
      .gte("longitude", longitude - 0.05);
    
    if (driversError) {
      throw driversError;
    }
    
    // Get recent ride requests in the area (last 30 minutes)
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    
    const { data: recentRides, error: ridesError } = await supabase
      .from("ride_requests")
      .select("*")
      .gte("created_at", thirtyMinutesAgo)
      .lte("pickup_latitude", latitude + 0.05)
      .gte("pickup_latitude", latitude - 0.05)
      .lte("pickup_longitude", longitude + 0.05)
      .gte("pickup_longitude", longitude - 0.05);
    
    if (ridesError) {
      throw ridesError;
    }
    
    // Calculate surge multiplier
    let surgeMultiplier = 1.0;
    
    // Base factors
    const driverCount = driverLocations?.length || 0;
    const rideCount = recentRides?.length || 0;
    
    // Adjust for rush hour
    if (isRushHour) {
      surgeMultiplier += 0.5;
    }
    
    // Adjust for driver availability (fewer drivers = higher surge)
    if (driverCount < 3) {
      surgeMultiplier += 0.8;
    } else if (driverCount < 8) {
      surgeMultiplier += 0.4;
    }
    
    // Adjust for demand (more rides = higher surge)
    if (rideCount > 15) {
      surgeMultiplier += 1.0;
    } else if (rideCount > 8) {
      surgeMultiplier += 0.6;
    } else if (rideCount > 3) {
      surgeMultiplier += 0.3;
    }
    
    // Cap the surge multiplier
    surgeMultiplier = Math.min(3.5, Math.max(1.0, surgeMultiplier));
    
    // Generate a demand level (1-10) based on the surge multiplier
    const demandLevel = Math.round(((surgeMultiplier - 1) / 2.5) * 10);
    
    // Calculate expiration time (valid for 15 minutes)
    const validUntil = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    
    // Store the prediction in the database
    const { data: prediction, error: predictionError } = await supabase
      .from("surge_predictions")
      .insert({
        latitude,
        longitude,
        surge_multiplier: surgeMultiplier,
        demand_level: demandLevel,
        valid_until: validUntil,
        area_name: `Area near (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
      })
      .select()
      .single();
    
    if (predictionError) {
      throw predictionError;
    }
    
    return new Response(
      JSON.stringify({ 
        success: true,
        prediction
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
    
  } catch (error) {
    console.error("Error in predict-surge function:", error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
