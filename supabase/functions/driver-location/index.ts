
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
    
    // Check if user is a driver
    const { data: driverData, error: driverError } = await supabase
      .from("drivers")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (driverError || !driverData) {
      return new Response(
        JSON.stringify({ error: "User is not registered as a driver" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403 
        }
      );
    }
    
    // Process based on HTTP method
    if (req.method === "POST") {
      const { latitude, longitude, heading, is_available } = await req.json();
      
      if (!latitude || !longitude) {
        return new Response(
          JSON.stringify({ error: "Latitude and longitude are required" }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400 
          }
        );
      }
      
      // Update driver location
      const { data: location, error: locationError } = await supabase
        .from("driver_locations")
        .upsert({
          driver_id: driverData.id,
          latitude,
          longitude,
          heading: heading || null,
          is_available: is_available !== undefined ? is_available : true,
          timestamp: new Date().toISOString()
        })
        .select()
        .single();
      
      if (locationError) {
        throw locationError;
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          location
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        }
      );
    } else if (req.method === "GET") {
      // Get driver's current location
      const { data: location, error: locationError } = await supabase
        .from("driver_locations")
        .select("*")
        .eq("driver_id", driverData.id)
        .single();
      
      if (locationError && locationError.code !== 'PGRST116') { // Ignore not found error
        throw locationError;
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          location: location || null
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
    console.error("Error in driver-location function:", error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
