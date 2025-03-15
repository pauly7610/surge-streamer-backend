import axios from 'axios';
import config from '../config';
import { GeoPoint } from '../types';

// Types for external data
export interface WeatherData {
  location: GeoPoint;
  timestamp: string;
  temperature: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  weatherCondition: string;
}

export interface TrafficData {
  location: GeoPoint;
  timestamp: string;
  congestionLevel: number; // 0-10 scale
  averageSpeed: number;
  incidentCount: number;
}

export interface EventData {
  id: string;
  title: string;
  location: GeoPoint;
  startTime: string;
  endTime: string;
  category: string;
  expectedAttendance: number;
}

/**
 * Fetch weather data for a location
 */
export const fetchWeatherData = async (location: GeoPoint): Promise<any> => {
  try {
    // In a real implementation, this would call a weather API
    // For now, return mock data
    return {
      temperature: 20 + Math.random() * 10, // 20-30°C
      precipitation: Math.random() * 5, // 0-5mm
      windSpeed: Math.random() * 20, // 0-20km/h
      humidity: 50 + Math.random() * 30, // 50-80%
      conditions: ['clear', 'cloudy', 'rainy', 'stormy'][Math.floor(Math.random() * 4)],
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    // Return default data on error
    return {
      temperature: 25,
      precipitation: 0,
      windSpeed: 5,
      humidity: 60,
      conditions: 'clear',
    };
  }
};

/**
 * Fetch traffic data for a location
 */
export const fetchTrafficData = async (location: GeoPoint): Promise<any> => {
  try {
    // In a real implementation, this would call a traffic API
    // For now, return mock data
    return {
      congestionLevel: Math.floor(Math.random() * 10), // 0-10 scale
      averageSpeed: 20 + Math.random() * 40, // 20-60km/h
      incidents: Math.random() < 0.2 ? [{
        type: ['accident', 'construction', 'closure'][Math.floor(Math.random() * 3)],
        severity: Math.floor(Math.random() * 5) + 1, // 1-5 scale
        distance: Math.random() * 2, // 0-2km
      }] : [],
    };
  } catch (error) {
    console.error('Error fetching traffic data:', error);
    // Return default data on error
    return {
      congestionLevel: 3,
      averageSpeed: 40,
      incidents: [],
    };
  }
};

/**
 * Fetch event data for a location
 */
export const fetchEventData = async (location: GeoPoint): Promise<any[]> => {
  try {
    // In a real implementation, this would call an events API
    // For now, return mock data
    const eventCount = Math.random() < 0.3 ? Math.floor(Math.random() * 3) + 1 : 0;
    const events = [];
    
    for (let i = 0; i < eventCount; i++) {
      const eventTypes = ['concert', 'sports', 'festival', 'conference', 'parade'];
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      
      // Generate a nearby location
      const latOffset = (Math.random() - 0.5) * 0.02; // ~1-2km
      const lngOffset = (Math.random() - 0.5) * 0.02;
      
      events.push({
        type: eventType,
        name: `${eventType.charAt(0).toUpperCase() + eventType.slice(1)} Event`,
        attendees: Math.floor(Math.random() * 10000) + 1000,
        location: {
          latitude: location.latitude + latOffset,
          longitude: location.longitude + lngOffset,
        },
        startTime: new Date(Date.now() + Math.random() * 3600000).toISOString(),
        endTime: new Date(Date.now() + 3600000 + Math.random() * 3600000).toISOString(),
      });
    }
    
    return events;
  } catch (error) {
    console.error('Error fetching event data:', error);
    // Return empty array on error
    return [];
  }
};

/**
 * Fetch all external data for a location
 */
export const fetchAllExternalData = async (location: GeoPoint): Promise<{
  weatherData: any;
  trafficData: any;
  eventData: any[];
}> => {
  // Fetch all data in parallel
  const [weatherData, trafficData, eventData] = await Promise.all([
    fetchWeatherData(location),
    fetchTrafficData(location),
    fetchEventData(location),
  ]);
  
  return {
    weatherData,
    trafficData,
    eventData,
  };
}; 