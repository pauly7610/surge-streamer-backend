import * as h3 from 'h3-js';
import { GeoCoordinates, GeoBoundingBox, H3Cell } from '../schemas/DataModels';
import config from '../config';

/**
 * Default H3 resolution to use
 */
const DEFAULT_H3_RESOLUTION = config.geospatial.defaultH3Resolution;

/**
 * Convert latitude and longitude to an H3 index
 * @param lat Latitude
 * @param lng Longitude
 * @param resolution H3 resolution (0-15)
 * @returns H3 index
 */
export function latLngToH3(
  lat: number,
  lng: number,
  resolution: number = DEFAULT_H3_RESOLUTION
): string {
  return h3.latLngToCell(lat, lng, resolution);
}

/**
 * Convert GeoCoordinates to an H3 index
 * @param coords GeoCoordinates
 * @param resolution H3 resolution (0-15)
 * @returns H3 index
 */
export function coordsToH3(
  coords: GeoCoordinates,
  resolution: number = DEFAULT_H3_RESOLUTION
): string {
  return h3.latLngToCell(coords.latitude, coords.longitude, resolution);
}

/**
 * Convert an H3 index to GeoCoordinates (center of the hexagon)
 * @param h3Index H3 index
 * @returns GeoCoordinates
 */
export function h3ToCoords(h3Index: string): GeoCoordinates {
  const [lat, lng] = h3.cellToLatLng(h3Index);
  return { latitude: lat, longitude: lng };
}

/**
 * Get the H3 cell information
 * @param h3Index H3 index
 * @returns H3Cell information
 */
export function getH3Cell(h3Index: string): H3Cell {
  const resolution = h3.getResolution(h3Index);
  const centerCoordinates = h3ToCoords(h3Index);
  
  return {
    h3Index,
    resolution,
    centerCoordinates
  };
}

/**
 * Get the boundary of an H3 cell as an array of GeoCoordinates
 * @param h3Index H3 index
 * @returns Array of GeoCoordinates representing the boundary
 */
export function getH3Boundary(h3Index: string): GeoCoordinates[] {
  const boundary = h3.cellToBoundary(h3Index);
  return boundary.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
}

/**
 * Get the bounding box of an H3 cell
 * @param h3Index H3 index
 * @returns GeoBoundingBox
 */
export function getH3BoundingBox(h3Index: string): GeoBoundingBox {
  const boundary = getH3Boundary(h3Index);
  
  let minLat = Number.MAX_VALUE;
  let maxLat = Number.MIN_VALUE;
  let minLng = Number.MAX_VALUE;
  let maxLng = Number.MIN_VALUE;
  
  for (const coord of boundary) {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLng = Math.min(minLng, coord.longitude);
    maxLng = Math.max(maxLng, coord.longitude);
  }
  
  return {
    northEast: { latitude: maxLat, longitude: maxLng },
    southWest: { latitude: minLat, longitude: minLng }
  };
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
 * Get the H3 cells within a bounding box
 * @param bbox GeoBoundingBox
 * @param resolution H3 resolution (0-15)
 * @returns Array of H3 indices
 */
export function getH3CellsInBoundingBox(
  bbox: GeoBoundingBox,
  resolution: number = DEFAULT_H3_RESOLUTION
): string[] {
  // Convert the bounding box to a polygon
  const polygon = [
    [bbox.northEast.latitude, bbox.northEast.longitude],
    [bbox.northEast.latitude, bbox.southWest.longitude],
    [bbox.southWest.latitude, bbox.southWest.longitude],
    [bbox.southWest.latitude, bbox.northEast.longitude],
    [bbox.northEast.latitude, bbox.northEast.longitude]
  ];
  
  // Get the H3 cells that intersect with the polygon
  return h3.polygonToCells(polygon, resolution);
}

/**
 * Get the H3 cells within a radius of a point
 * @param center GeoCoordinates
 * @param radiusKm Radius in kilometers
 * @param resolution H3 resolution (0-15)
 * @returns Array of H3 indices
 */
export function getH3CellsInRadius(
  center: GeoCoordinates,
  radiusKm: number = config.geospatial.defaultBoundingBoxRadiusKm,
  resolution: number = DEFAULT_H3_RESOLUTION
): string[] {
  const centerH3 = coordsToH3(center, resolution);
  return h3.gridDisk(centerH3, Math.ceil(radiusKm / getH3CellArea(centerH3)));
}

/**
 * Get the distance between two points in kilometers
 * @param point1 GeoCoordinates
 * @param point2 GeoCoordinates
 * @returns Distance in kilometers
 */
export function getDistanceKm(point1: GeoCoordinates, point2: GeoCoordinates): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(point2.latitude - point1.latitude);
  const dLon = toRadians(point2.longitude - point1.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.latitude)) * Math.cos(toRadians(point2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get the neighbors of an H3 cell
 * @param h3Index H3 index
 * @returns Array of neighboring H3 indices
 */
export function getH3Neighbors(h3Index: string): string[] {
  return h3.gridDisk(h3Index, 1).filter(idx => idx !== h3Index);
}

/**
 * Check if two H3 cells are neighbors
 * @param h3Index1 First H3 index
 * @param h3Index2 Second H3 index
 * @returns True if the cells are neighbors
 */
export function areH3CellsNeighbors(h3Index1: string, h3Index2: string): boolean {
  return h3.areNeighborCells(h3Index1, h3Index2);
}

/**
 * Get the H3 cells at a different resolution
 * @param h3Index H3 index
 * @param resolution Target resolution (0-15)
 * @returns Array of H3 indices at the target resolution
 */
export function changeH3Resolution(h3Index: string, resolution: number): string[] {
  const currentResolution = h3.getResolution(h3Index);
  
  if (currentResolution === resolution) {
    return [h3Index];
  } else if (currentResolution < resolution) {
    // Going to a finer resolution
    return h3.cellToChildren(h3Index, resolution);
  } else {
    // Going to a coarser resolution
    return [h3.cellToParent(h3Index, resolution)];
  }
}

/**
 * Convert degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 * @private
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
} 