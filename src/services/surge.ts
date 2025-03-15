import { supabase } from './supabase';

// Surge Pricing Prediction
export const getSurgePredictions = async (latitude: number, longitude: number) => {
  const { data, error } = await supabase
    .from('surge_predictions')
    .select('*')
    .lte('latitude', latitude + 0.05)
    .gte('latitude', latitude - 0.05)
    .lte('longitude', longitude + 0.05)
    .gte('longitude', longitude - 0.05)
    .gte('valid_until', new Date().toISOString());
  
  if (error) {
    console.error('Error fetching surge predictions:', error);
    return { error };
  }
  
  return { data };
};

export const subscribeToSurgePredictions = (latitude: number, longitude: number, callback: (payload: any) => void) => {
  // This is a simplified version - in a real app, you'd need more complex filtering
  return supabase
    .channel('public:surge_predictions')
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'surge_predictions'
    }, callback)
    .subscribe();
}; 