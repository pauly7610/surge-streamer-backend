/**
 * Models for the surge prediction data stream
 */

export interface SurgeFactor {
  name: string;
  contribution: number;
  description?: string;
}

export interface SurgePredictionData {
  id?: string;
  hexId: string;
  latitude: number;
  longitude: number;
  surgeMultiplier: number;
  confidence: number;
  demandLevel: number;
  supplyLevel: number;
  factors: SurgeFactor[];
  predictedAt: string;
  validUntil: string;
  modelVersion?: string;
}

export interface HeatmapCell {
  hexId: string;
  center: {
    lat: number;
    lng: number;
  };
  demandLevel: number;
  supplyLevel: number;
  surgeMultiplier: number;
}

export interface SurgeTimelinePoint {
  timestamp: string;
  surgeMultiplier: number;
  confidence: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface SurgePredictionParams {
  latitude: number;
  longitude: number;
  timestamp?: Date;
  predictionHorizon?: number; // minutes
}

export interface SurgeTimelineParams {
  latitude: number;
  longitude: number;
  startTime: Date;
  endTime: Date;
  resolution?: number; // minutes
}

export interface HeatmapDataParams {
  boundingBox: BoundingBox;
  timestamp?: Date;
  resolution?: number; // hex resolution
} 