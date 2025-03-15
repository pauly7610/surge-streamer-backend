import { supabase } from './supabase';
import type { Database } from '../types/supabase';

export const createRideRequest = async (rideData: Database['public']['Tables']['ride_requests']['Insert']) => {
  const { data, error } = await supabase
    .from('ride_requests')
    .insert(rideData)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating ride request:', error);
    return { error };
  }
  
  return { data };
};

export const getRideRequests = async (userId: string, isDriver: boolean = false) => {
  let query = supabase
    .from('ride_requests')
    .select('*, drivers(*)');
    
  if (isDriver) {
    query = query.eq('driver_id', userId);
  } else {
    query = query.eq('rider_id', userId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching ride requests:', error);
    return { error };
  }
  
  return { data };
};

export const updateRideStatus = async (rideId: string, status: Database['public']['Enums']['ride_status'], updates: any = {}) => {
  const { data, error } = await supabase
    .from('ride_requests')
    .update({ status, ...updates })
    .eq('id', rideId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating ride status:', error);
    return { error };
  }
  
  return { data };
};

export const subscribeToRideRequests = (userId: string, isDriver: boolean, callback: (payload: any) => void) => {
  const column = isDriver ? 'driver_id' : 'rider_id';
  
  return supabase
    .channel(`public:ride_requests:${column}:${userId}`)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'ride_requests',
      filter: `${column}=eq.${userId}`
    }, callback)
    .subscribe();
}; 