
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
  
  // Verify authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401 
      }
    );
  }
  
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401 
        }
      );
    }
    
    // Process based on HTTP method
    if (req.method === "POST") {
      // Create a new ride request
      const {
        pickup_latitude,
        pickup_longitude,
        pickup_address,
        destination_latitude,
        destination_longitude,
        destination_address
      } = await req.json();
      
      // Validate required fields
      if (!pickup_latitude || !pickup_longitude || !destination_latitude || !destination_longitude) {
        return new Response(
          JSON.stringify({ error: "Missing required location information" }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400 
          }
        );
      }
      
      // Get surge prediction for pickup location
      const { data: surgePredictions } = await supabase
        .from("surge_predictions")
        .select("*")
        .lte("latitude", pickup_latitude + 0.05)
        .gte("latitude", pickup_latitude - 0.05)
        .lte("longitude", pickup_longitude + 0.05)
        .gte("longitude", pickup_longitude - 0.05)
        .gte("valid_until", new Date().toISOString())
        .order("predicted_at", { ascending: false })
        .limit(1);
      
      // Calculate estimated fare based on distance and surge
      const distance = calculateDistance(
        pickup_latitude, 
        pickup_longitude, 
        destination_latitude, 
        destination_longitude
      );
      
      const surgeMultiplier = surgePredictions?.[0]?.surge_multiplier || 1.0;
      const baseRate = 2.50; // Base fare in dollars
      const perKmRate = 1.50; // Rate per kilometer
      const estimatedFare = (baseRate + (distance * perKmRate)) * surgeMultiplier;
      
      // Create the ride request
      const { data: rideRequest, error: rideError } = await supabase
        .from("ride_requests")
        .insert({
          rider_id: user.id,
          pickup_latitude,
          pickup_longitude,
          pickup_address: pickup_address || null,
          destination_latitude,
          destination_longitude,
          destination_address: destination_address || null,
          estimated_fare: parseFloat(estimatedFare.toFixed(2)),
          status: "pending"
        })
        .select()
        .single();
      
      if (rideError) {
        throw rideError;
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          ride: rideRequest,
          surge_multiplier: surgeMultiplier
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        }
      );
    } else if (req.method === "GET") {
      // Get user's ride requests (or by ID if provided)
      const url = new URL(req.url);
      const rideId = url.searchParams.get("id");
      
      let query = supabase.from("ride_requests").select("*, drivers(*)");
      
      if (rideId) {
        // Get specific ride request
        query = query.eq("id", rideId);
      } else {
        // Get all rides for the user
        const isDriver = url.searchParams.get("as_driver") === "true";
        
        if (isDriver) {
          // Check if user is a driver
          const { data: driverData } = await supabase
            .from("drivers")
            .select("id")
            .eq("user_id", user.id)
            .single();
          
          if (driverData) {
            query = query.eq("driver_id", driverData.id);
          } else {
            return new Response(
              JSON.stringify({ error: "User is not registered as a driver" }),
              { 
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 403 
              }
            );
          }
        } else {
          query = query.eq("rider_id", user.id);
        }
      }
      
      const { data: rides, error: ridesError } = await query;
      
      if (ridesError) {
        throw ridesError;
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          rides: rides || []
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        }
      );
    } else if (req.method === "PATCH") {
      // Update ride status
      const { ride_id, status, ...updates } = await req.json();
      
      if (!ride_id || !status) {
        return new Response(
          JSON.stringify({ error: "Ride ID and status are required" }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400 
          }
        );
      }
      
      // Check if the user has permission to update this ride
      let ride;
      
      // Check if user is a driver
      const { data: driverData } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (driverData) {
        // Driver is updating the ride
        const { data: rideData, error: rideError } = await supabase
          .from("ride_requests")
          .select("*")
          .eq("id", ride_id)
          .eq("driver_id", driverData.id)
          .maybeSingle();
        
        if (rideError) {
          throw rideError;
        }
        
        ride = rideData;
      } else {
        // Rider is updating the ride
        const { data: rideData, error: rideError } = await supabase
          .from("ride_requests")
          .select("*")
          .eq("id", ride_id)
          .eq("rider_id", user.id)
          .maybeSingle();
        
        if (rideError) {
          throw rideError;
        }
        
        ride = rideData;
      }
      
      if (!ride) {
        return new Response(
          JSON.stringify({ error: "Ride not found or you don't have permission" }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 404 
          }
        );
      }
      
      // Process status-specific updates
      const updateData: any = { status };
      
      if (status === "accepted" && driverData) {
        updateData.driver_id = driverData.id;
        updateData.accepted_at = new Date().toISOString();
      } else if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
        
        // If there's an actual fare provided, use it
        if (updates.actual_fare) {
          updateData.actual_fare = updates.actual_fare;
        }
      }
      
      // Update the ride
      const { data: updatedRide, error: updateError } = await supabase
        .from("ride_requests")
        .update(updateData)
        .eq("id", ride_id)
        .select()
        .single();
      
      if (updateError) {
        throw updateError;
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          ride: updatedRide
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 405 
        }
      );
    }
    
  } catch (error) {
    console.error("Error in ride-request function:", error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});

// Helper function to calculate distance
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI/180);
}
