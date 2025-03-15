export interface SurgePrediction {
  id: string;
  latitude: number;
  longitude: number;
  surge_multiplier: number;
  demand_level: number | null;
  area_name: string | null;
  predicted_at: string;
  valid_until: string;
}

export interface SurgePredictionParams {
  latitude: number;
  longitude: number;
} 