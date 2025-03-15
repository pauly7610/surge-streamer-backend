import { GeoPoint, DemandSupplyData } from '../types';
import { fetchAllExternalData } from '../services/externalData';
import { Logger } from '../utils/Logger';
import * as GeospatialUtils from '../utils/GeospatialUtils';

// Initialize logger
const logger = new Logger('FeatureEngineering');

/**
 * Generate features for prediction
 */
export const generateFeatures = async (
  location: GeoPoint,
  demandSupply: DemandSupplyData,
  historicalData?: any[]
): Promise<number[]> => {
  logger.info(`Generating features for location (${location.latitude}, ${location.longitude})`);
  
  // Get current date and time
  const now = new Date();
  const hourOfDay = now.getHours();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;
  
  // Check if it's a holiday (simplified)
  const isHoliday = isPublicHoliday(now) ? 1 : 0;
  
  // Fetch external data
  const externalData = await fetchAllExternalData(location);
  
  // Extract weather data
  const temperature = normalizeTemperature(externalData.weatherData.temperature);
  const precipitation = normalizePrecipitation(externalData.weatherData.precipitation);
  const windSpeed = normalizeWindSpeed(externalData.weatherData.windSpeed);
  const weatherImpact = calculateWeatherImpact(externalData.weatherData);
  
  // Extract traffic data
  const trafficCongestion = externalData.trafficData.congestionLevel / 100; // Normalize to 0-1
  const trafficIncidents = Math.min(externalData.trafficData.incidentCount / 10, 1); // Normalize to 0-1
  const roadClosures = externalData.trafficData.roadClosures ? 1 : 0;
  
  // Calculate event proximity and impact
  const eventProximity = calculateEventProximity(location, externalData.eventData);
  const eventImpact = calculateEventImpact(externalData.eventData);
  
  // Calculate demand and supply metrics
  const demandCount = demandSupply.demand.length;
  const supplyCount = demandSupply.supply.filter(d => d.status === 'available').length;
  const demandSupplyRatio = supplyCount > 0 ? demandCount / supplyCount : demandCount;
  
  // Calculate historical metrics if available
  const historicalSurge = calculateHistoricalSurge(historicalData, hourOfDay, dayOfWeek);
  const demandTrend = calculateDemandTrend(historicalData);
  
  // Time-based features
  const hourSin = Math.sin((hourOfDay * 2 * Math.PI) / 24); // Cyclical encoding for hour
  const hourCos = Math.cos((hourOfDay * 2 * Math.PI) / 24);
  const daySin = Math.sin((dayOfWeek * 2 * Math.PI) / 7); // Cyclical encoding for day
  const dayCos = Math.cos((dayOfWeek * 2 * Math.PI) / 7);
  
  // Geospatial features
  const h3Index = GeospatialUtils.GeospatialUtils.latLngToH3(location.latitude, location.longitude);
  const normalizedLat = (location.latitude + 90) / 180; // Normalize to 0-1
  const normalizedLng = (location.longitude + 180) / 360; // Normalize to 0-1
  
  // Feature vector
  const featureVector = [
    hourSin,
    hourCos,
    daySin,
    dayCos,
    isWeekend,
    isHoliday,
    temperature,
    precipitation,
    windSpeed,
    weatherImpact,
    trafficCongestion,
    trafficIncidents,
    roadClosures,
    eventProximity,
    eventImpact,
    normalizeValue(demandCount, 0, 100),
    normalizeValue(supplyCount, 0, 50),
    normalizeValue(demandSupplyRatio, 0, 10),
    historicalSurge,
    demandTrend,
    normalizedLat,
    normalizedLng
  ];
  
  logger.info(`Generated ${featureVector.length} features`);
  return featureVector;
};

/**
 * Check if a date is a public holiday (simplified)
 */
const isPublicHoliday = (date: Date): boolean => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  // Major US holidays (simplified)
  if (
    (month === 1 && day === 1) || // New Year's Day
    (month === 7 && day === 4) || // Independence Day
    (month === 12 && day === 25) || // Christmas
    (month === 11 && (day >= 22 && day <= 28) && date.getDay() === 4) || // Thanksgiving (4th Thursday in November)
    (month === 5 && (day >= 25 && day <= 31) && date.getDay() === 1) || // Memorial Day (last Monday in May)
    (month === 9 && (day >= 1 && day <= 7) && date.getDay() === 1) // Labor Day (first Monday in September)
  ) {
    return true;
  }
  
  return false;
};

/**
 * Normalize temperature to a 0-1 scale
 */
const normalizeTemperature = (temperature: number): number => {
  // Assuming temperature range from -20°C to 40°C
  return Math.max(0, Math.min(1, (temperature + 20) / 60));
};

/**
 * Normalize precipitation to a 0-1 scale
 */
const normalizePrecipitation = (precipitation: number): number => {
  // Assuming precipitation range from 0mm to 50mm
  return Math.min(1, precipitation / 50);
};

/**
 * Normalize wind speed to a 0-1 scale
 */
const normalizeWindSpeed = (windSpeed: number): number => {
  // Assuming wind speed range from 0km/h to 100km/h
  return Math.min(1, windSpeed / 100);
};

/**
 * Calculate weather impact based on weather conditions
 */
const calculateWeatherImpact = (weatherData: any): number => {
  let impact = 0;
  
  // Base impact from weather condition
  switch (weatherData.weatherCondition) {
    case 'STORM':
      impact += 0.8;
      break;
    case 'SNOW':
      impact += 0.7;
      break;
    case 'RAIN':
      impact += 0.5;
      break;
    case 'FOG':
      impact += 0.4;
      break;
    case 'DRIZZLE':
      impact += 0.3;
      break;
    case 'CLOUDY':
      impact += 0.1;
      break;
    case 'CLEAR':
    default:
      impact += 0;
      break;
  }
  
  // Additional impact from precipitation
  impact += normalizePrecipitation(weatherData.precipitation) * 0.3;
  
  // Additional impact from wind speed
  impact += normalizeWindSpeed(weatherData.windSpeed) * 0.2;
  
  return Math.min(1, impact);
};

/**
 * Calculate event proximity (0-1 scale, 1 = very close)
 */
const calculateEventProximity = (location: GeoPoint, events: any[]): number => {
  if (events.length === 0) {
    return 0;
  }
  
  // Find the closest event
  const closestEvent = events.reduce((closest, event) => {
    const distance = GeospatialUtils.GeospatialUtils.calculateDistance(
      location.latitude,
      location.longitude,
      event.venue.latitude,
      event.venue.longitude
    );
    
    return distance < closest.distance ? { event, distance } : closest;
  }, { event: events[0], distance: Infinity });
  
  // Normalize distance (closer = higher value)
  // Assuming 10km as the maximum relevant distance
  const normalizedProximity = Math.max(0, 1 - (closestEvent.distance / 10000));
  
  return normalizedProximity;
};

/**
 * Calculate event impact based on event type, attendance, etc.
 */
const calculateEventImpact = (events: any[]): number => {
  if (events.length === 0) {
    return 0;
  }
  
  // Calculate impact for each event
  const impacts = events.map(event => {
    let baseImpact = 0;
    
    // Impact based on event type
    switch (event.type) {
      case 'SPORTS':
        baseImpact += 0.7;
        break;
      case 'CONCERT':
        baseImpact += 0.8;
        break;
      case 'FESTIVAL':
        baseImpact += 0.9;
        break;
      case 'CONFERENCE':
        baseImpact += 0.5;
        break;
      case 'POLITICAL':
        baseImpact += 0.6;
        break;
      case 'PARADE':
        baseImpact += 0.7;
        break;
      default:
        baseImpact += 0.3;
        break;
    }
    
    // Impact based on attendance
    const attendanceImpact = Math.min(1, event.estimatedAttendance / 50000);
    
    // Impact based on high demand flag
    const highDemandImpact = event.isHighDemand ? 0.3 : 0;
    
    // Calculate time relevance (events about to start or end have higher impact)
    const now = new Date();
    const startTime = new Date(event.startTime);
    const endTime = new Date(event.endTime);
    
    let timeRelevance = 0;
    if (now >= startTime && now <= endTime) {
      // Event is ongoing
      timeRelevance = 1.0;
    } else if (now < startTime) {
      // Event is upcoming
      const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilStart <= 1) {
        // Less than 1 hour until start
        timeRelevance = 0.8;
      } else if (hoursUntilStart <= 2) {
        // Less than 2 hours until start
        timeRelevance = 0.6;
      } else if (hoursUntilStart <= 3) {
        // Less than 3 hours until start
        timeRelevance = 0.4;
      } else {
        // More than 3 hours until start
        timeRelevance = 0.2;
      }
    } else {
      // Event has ended
      const hoursAfterEnd = (now.getTime() - endTime.getTime()) / (1000 * 60 * 60);
      if (hoursAfterEnd <= 0.5) {
        // Less than 30 minutes after end
        timeRelevance = 0.9;
      } else if (hoursAfterEnd <= 1) {
        // Less than 1 hour after end
        timeRelevance = 0.7;
      } else if (hoursAfterEnd <= 2) {
        // Less than 2 hours after end
        timeRelevance = 0.4;
      } else {
        // More than 2 hours after end
        timeRelevance = 0.1;
      }
    }
    
    // Combine all factors
    return (baseImpact * 0.3 + attendanceImpact * 0.3 + highDemandImpact * 0.1) * timeRelevance;
  });
  
  // Return the maximum impact from all events
  return Math.min(1, Math.max(...impacts));
};

/**
 * Calculate historical surge based on historical data
 */
const calculateHistoricalSurge = (historicalData: any[] | undefined, hour: number, day: number): number => {
  if (!historicalData || historicalData.length === 0) {
    return 0.33; // Default value if no historical data
  }
  
  // Filter historical data for the same hour and day
  const relevantData = historicalData.filter(data => {
    const timestamp = new Date(data.timestamp);
    return timestamp.getHours() === hour && timestamp.getDay() === day;
  });
  
  if (relevantData.length === 0) {
    return 0.33; // Default value if no relevant historical data
  }
  
  // Calculate average surge factor
  const avgSurge = relevantData.reduce((sum, data) => sum + data.surgeMultiplier, 0) / relevantData.length;
  
  // Normalize to 0-1 (assuming surge factor range of 1-3)
  return (avgSurge - 1) / 2;
};

/**
 * Calculate demand trend based on historical data
 */
const calculateDemandTrend = (historicalData: any[] | undefined): number => {
  if (!historicalData || historicalData.length < 2) {
    return 0.5; // Default value if insufficient historical data
  }
  
  // Sort historical data by timestamp
  const sortedData = [...historicalData].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // Calculate demand trend over the last few data points
  const recentData = sortedData.slice(-5); // Last 5 data points
  
  if (recentData.length < 2) {
    return 0.5;
  }
  
  // Calculate slope of demand
  const firstDemand = recentData[0].demandCount || 0;
  const lastDemand = recentData[recentData.length - 1].demandCount || 0;
  
  const demandChange = lastDemand - firstDemand;
  
  // Normalize to 0-1 (0.5 = no change, >0.5 = increasing, <0.5 = decreasing)
  return Math.max(0, Math.min(1, 0.5 + demandChange / 20));
};

/**
 * Normalize a value to a 0-1 scale
 */
const normalizeValue = (value: number, min: number, max: number): number => {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}; 