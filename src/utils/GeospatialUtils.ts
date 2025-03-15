import * as h3 from 'h3-js';
import { GeoLocation } from '../schemas/DataModels';

/**
 * Default H3 resolution for grid cells
 * Resolution 9 has cells with ~0.1 km2 area (about 174m edge length)
 * This is appropriate for urban surge pricing zones
 */
export const DEFAULT_H3_RESOLUTION = 9;

/**
 * Utility class for geospatial operations
 */
export class GeospatialUtils {
  /**
   * Convert latitude and longitude to H3 index
   * @param latitude Latitude
   * @param longitude Longitude
   * @param resolution H3 resolution (default: 9)
   * @returns H3 index
   */
  static latLngToH3(latitude: number, longitude: number, resolution: number = DEFAULT_H3_RESOLUTION): string {
    return h3.latLngToCell(latitude, longitude, resolution);
  }

  /**
   * Convert H3 index to latitude and longitude
   * @param h3Index H3 index
   * @returns Latitude and longitude
   */
  static h3ToLatLng(h3Index: string): GeoLocation {
    const [lat, lng] = h3.cellToLatLng(h3Index);
    return {
      latitude: lat,
      longitude: lng
    };
  }

  /**
   * Get all H3 indexes within a radius of a center point
   * @param centerLat Center latitude
   * @param centerLng Center longitude
   * @param radiusInMeters Radius in meters
   * @param resolution H3 resolution (0-15)
   * @returns Array of H3 indexes
   */
  static getH3IndexesInRadius(
    centerLat: number,
    centerLng: number,
    radiusInMeters: number,
    resolution: number = DEFAULT_H3_RESOLUTION
  ): string[] {
    // Convert center point to H3
    const centerH3 = GeospatialUtils.latLngToH3(centerLat, centerLng, resolution);
    
    // Estimate the number of rings needed to cover the radius
    // H3 cell size varies by resolution and location, but this is a rough estimate
    const cellSizeInMeters = 1000; // Approximate size at resolution 9
    const ringsNeeded = Math.ceil(radiusInMeters / cellSizeInMeters);
    
    // Get all H3 indexes within the rings
    const h3Indexes = h3.gridDisk(centerH3, ringsNeeded);
    
    // Filter by actual distance
    return h3Indexes.filter(h3Index => {
      const [lat, lng] = h3.cellToLatLng(h3Index);
      const distance = GeospatialUtils.calculateDistance(centerLat, centerLng, lat, lng);
      return distance <= radiusInMeters;
    });
  }

  /**
   * Calculate distance between two points in meters
   * @param lat1 Latitude of first point
   * @param lng1 Longitude of first point
   * @param lat2 Latitude of second point
   * @param lng2 Longitude of second point
   * @returns Distance in meters
   */
  static calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    // Haversine formula
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }
}

/**
 * Convert H3 index to latitude and longitude (center of the hexagon)
 * @param h3Index H3 index
 * @returns GeoLocation object with latitude and longitude
 */
export function h3ToLatLng(h3Index: string): GeoLocation {
  const [lat, lng] = h3.cellToLatLng(h3Index);
  return { latitude: lat, longitude: lng };
}

/**
 * Get the area of an H3 cell in square kilometers
 * @param h3Index H3 index
 * @returns Area in square kilometers
 */
export function getH3CellArea(h3Index: string): number {
  return h3.cellArea(h3Index, 'km2');
}

/**
 * Get the perimeter of an H3 cell in kilometers
 * @param h3Index H3 index
 * @returns Perimeter in kilometers
 */
export function getH3CellPerimeter(h3Index: string): number {
  // h3.cellPerimeter doesn't exist in the current version of h3-js
  // Calculate perimeter based on the hexagon edge length
  const resolution = getH3Resolution(h3Index);
  // Approximate edge length in km for each resolution
  const edgeLengthKm = 0.174 * Math.pow(0.5, resolution - 9); // Resolution 9 has ~0.174km edge length
  // Hexagon perimeter = 6 * edge length
  return 6 * edgeLengthKm;
}

/**
 * Get the resolution of an H3 index
 * @param h3Index H3 index
 * @returns Resolution (0-15)
 */
export function getH3Resolution(h3Index: string): number {
  return h3.getResolution(h3Index);
}

/**
 * Check if two H3 indexes are neighbors
 * @param h3Index1 First H3 index
 * @param h3Index2 Second H3 index
 * @returns True if the cells are neighbors
 */
export function areNeighbors(h3Index1: string, h3Index2: string): boolean {
  return h3.areNeighborCells(h3Index1, h3Index2);
}

/**
 * Get all neighboring H3 indexes for a given H3 index
 * @param h3Index H3 index
 * @returns Array of neighboring H3 indexes
 */
export function getNeighbors(h3Index: string): string[] {
  return h3.gridDisk(h3Index, 1).filter(neighbor => neighbor !== h3Index);
}

/**
 * Get all H3 indexes within a given distance of the specified H3 index
 * @param h3Index H3 index
 * @param distance Distance in grid cells (k-ring distance)
 * @returns Array of H3 indexes within the specified distance
 */
export function getH3IndexesWithinDistance(h3Index: string, distance: number): string[] {
  return h3.gridDisk(h3Index, distance);
}

/**
 * Calculate the distance between two geographic points in kilometers
 * @param lat1 Latitude of first point
 * @param lng1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lng2 Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistanceBetweenLocations(loc1: GeoLocation, loc2: GeoLocation): number {
  return GeospatialUtils.calculateDistance(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude);
}

/**
 * Convert degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a location is within a specified radius of another location
 * @param center Center location
 * @param point Point to check
 * @param radiusKm Radius in kilometers
 * @returns True if the point is within the radius
 */
export function isWithinRadius(center: GeoLocation, point: GeoLocation, radiusKm: number): boolean {
  const distance = calculateDistanceBetweenLocations(center, point);
  return distance <= radiusKm;
}

/**
 * Get all H3 indexes within a radius of a point
 * @param lat Latitude of center point
 * @param lng Longitude of center point
 * @param radiusKm Radius in kilometers
 * @param resolution H3 resolution
 * @returns Array of H3 indexes within the radius
 */
export function getH3IndexesWithinRadius(
  lat: number, 
  lng: number, 
  radiusKm: number, 
  resolution: number = DEFAULT_H3_RESOLUTION
): string[] {
  return GeospatialUtils.getH3IndexesInRadius(lat, lng, radiusKm, resolution);
} 