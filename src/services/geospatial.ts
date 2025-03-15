/**
 * Geospatial utilities for the Surge Streamer backend
 * 
 * This is a simplified implementation of the H3 hexagonal grid system
 * mentioned in the technical specification. In a production environment,
 * you would use the actual H3 library.
 */

import { cellToLatLng, latLngToCell } from 'h3-js';
import { BoundingBox, GeoPoint } from '../types';

// Constants for Earth calculations
const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// Hexagon resolution (in km)
const HEX_RESOLUTION = 0.5; // ~500m hexagon edge length

/**
 * Default H3 resolution for surge pricing calculations
 */
export const DEFAULT_H3_RESOLUTION = 8;

/**
 * Convert a point to an H3 index
 */
export const pointToH3 = (point: GeoPoint, resolution = DEFAULT_H3_RESOLUTION): string => {
  return latLngToCell(point.latitude, point.longitude, resolution);
};

/**
 * Convert an H3 index to a point
 */
export const h3ToPoint = (h3Index: string): GeoPoint => {
  const [lat, lng] = cellToLatLng(h3Index);
  return { latitude: lat, longitude: lng };
};

/**
 * Convert latitude and longitude to a hexagonal grid cell ID
 * This is a simplified version of H3's geoToH3 function
 */
export const latLongToHexId = (lat: number, lng: number): string => {
  // Simple implementation: divide the world into a grid
  // In a real implementation, you would use the H3 library
  const latGrid = Math.floor(lat / HEX_RESOLUTION);
  const lngGrid = Math.floor(lng / HEX_RESOLUTION);
  return `${latGrid}:${lngGrid}`;
};

/**
 * Get the center coordinates of a hex cell
 */
export const hexIdToLatLong = (hexId: string): { lat: number; lng: number } => {
  const [latGrid, lngGrid] = hexId.split(':').map(Number);
  return {
    lat: latGrid * HEX_RESOLUTION + HEX_RESOLUTION / 2,
    lng: lngGrid * HEX_RESOLUTION + HEX_RESOLUTION / 2
  };
};

/**
 * Get neighboring hexagons for a given hex
 */
export const getNeighboringHexes = (hexId: string): string[] => {
  const [latGrid, lngGrid] = hexId.split(':').map(Number);
  
  // Get the 6 neighboring hexes in a simplified way
  // In a real implementation, this would handle edge cases better
  const neighbors = [
    `${latGrid}:${lngGrid + 1}`,     // East
    `${latGrid + 1}:${lngGrid + 1}`, // Northeast
    `${latGrid + 1}:${lngGrid}`,     // Northwest
    `${latGrid}:${lngGrid - 1}`,     // West
    `${latGrid - 1}:${lngGrid - 1}`, // Southwest
    `${latGrid - 1}:${lngGrid}`      // Southeast
  ];
  
  return neighbors;
};

/**
 * Calculate distance between two points in kilometers using the Haversine formula
 */
export const calculateDistance = (point1: GeoPoint, point2: GeoPoint): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(point1.latitude)) * Math.cos(toRad(point2.latitude)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Convert degrees to radians
 */
const toRad = (degrees: number): number => {
  return degrees * Math.PI / 180;
};

/**
 * Create a bounding box around a center point with a given radius in kilometers
 */
export const createBoundingBox = (center: GeoPoint, radiusKm: number): BoundingBox => {
  // Approximate degrees per km
  const latDegPerKm = 1 / 110.574;
  const lngDegPerKm = 1 / (111.32 * Math.cos(toRad(center.latitude)));
  
  const latDelta = radiusKm * latDegPerKm;
  const lngDelta = radiusKm * lngDegPerKm;
  
  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLng: center.longitude - lngDelta,
    maxLng: center.longitude + lngDelta
  };
};

/**
 * Check if a point is within a bounding box
 */
export const isPointInBoundingBox = (point: GeoPoint, boundingBox: BoundingBox): boolean => {
  return (
    point.latitude >= boundingBox.minLat &&
    point.latitude <= boundingBox.maxLat &&
    point.longitude >= boundingBox.minLng &&
    point.longitude <= boundingBox.maxLng
  );
};

/**
 * Convert a bounding box to a list of hex IDs that cover the area
 */
export const boundingBoxToHexIds = (
  minLat: number, 
  minLng: number, 
  maxLat: number, 
  maxLng: number
): string[] => {
  const hexIds: string[] = [];
  
  // Simple implementation: iterate through the grid
  // In a real implementation, this would be more efficient
  for (let lat = minLat; lat <= maxLat; lat += HEX_RESOLUTION) {
    for (let lng = minLng; lng <= maxLng; lng += HEX_RESOLUTION) {
      hexIds.push(latLongToHexId(lat, lng));
    }
  }
  
  // Remove duplicates
  return [...new Set(hexIds)];
}; 