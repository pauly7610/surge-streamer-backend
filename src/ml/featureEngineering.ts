import { GeoPoint, DemandSupplyData } from '../types';
import { fetchAllExternalData } from '../services/externalData';

/**
 * Generate features for prediction
 */
export const generateFeatures = async (
  location: GeoPoint,
  demandSupply: DemandSupplyData
): Promise<number[]> => {
  // Get current date and time
  const now = new Date();
  const hourOfDay = now.getHours();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;
  
  // Fetch external data
  const externalData = await fetchAllExternalData(location);
  
  // Extract weather data
  const temperature = externalData.weatherData.temperature;
  const precipitation = externalData.weatherData.precipitation;
  const windSpeed = externalData.weatherData.windSpeed;
  
  // Extract traffic data
  const trafficCongestion = externalData.trafficData.congestionLevel;
  
  // Calculate event proximity (simplified)
  let eventProximity = 0;
  if (externalData.eventData.length > 0) {
    // Find the closest event
    const closestEvent = externalData.eventData.reduce((closest, event) => {
      const distance = Math.sqrt(
        Math.pow(event.location.latitude - location.latitude, 2) +
        Math.pow(event.location.longitude - location.longitude, 2)
      );
      
      return distance < closest.distance ? { event, distance } : closest;
    }, { event: externalData.eventData[0], distance: Infinity });
    
    // Normalize distance to 0-1 (closer = higher value)
    eventProximity = Math.max(0, 1 - (closestEvent.distance * 100));
  }
  
  // Calculate demand and supply
  const demandCount = demandSupply.demand.length;
  const supplyCount = demandSupply.supply.filter(d => d.status === 'available').length;
  
  // Feature vector
  const featureVector = [
    hourOfDay / 24, // Normalize hour to 0-1
    dayOfWeek / 6, // Normalize day to 0-1
    isWeekend,
    0, // isHoliday placeholder
    temperature / 40, // Normalize temperature
    precipitation / 10, // Normalize precipitation
    windSpeed / 20, // Normalize wind speed
    trafficCongestion / 10, // Normalize traffic
    eventProximity, // Event proximity (0-1)
    demandCount / 100, // Normalize demand
    supplyCount / 100, // Normalize supply
  ];
  
  return featureVector;
}; 