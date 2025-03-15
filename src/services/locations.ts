import { supabase } from './supabase';

// Driver Location Tracking
export const updateDriverLocation = async (driverId: string, latitude: number, longitude: number, heading: number | null = null, isAvailable: boolean = true) => {
  const { data, error } = await supabase
    .from('driver_locations')
    .upsert({
      driver_id: driverId,
      latitude,
      longitude,
      heading,
      is_available: isAvailable,
      timestamp: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error updating driver location:', error);
    return { error };
  }
  
  return { data };
};

export const getNearbyDrivers = async (latitude: number, longitude: number, radiusKm: number = 5) => {
  const { data: drivers, error: driversError } = await supabase
    .from('driver_locations')
    .select('*, drivers(*)')
    .eq('is_available', true);
  
  if (driversError) {
    console.error('Error fetching drivers:', driversError);
    return { error: driversError };
  }
  
  // Filter drivers within radius
  const nearbyDrivers = drivers?.filter(driver => {
    const distance = calculateDistance(
      latitude, 
      longitude, 
      driver.latitude, 
      driver.longitude
    );
    return distance <= radiusKm;
  });
  
  return { data: nearbyDrivers };
};

// Helper function to calculate distance between two points
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
};

const deg2rad = (deg: number): number => {
  return deg * (Math.PI/180);
};

export const subscribeToDriverLocations = (callback: (payload: any) => void) => {
  return supabase
    .channel('public:driver_locations')
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'driver_locations' 
    }, callback)
    .subscribe();
}; 