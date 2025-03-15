import { EventEmitter } from 'events';
import { WeatherData, GeoLocation, DataEvent } from '../schemas/DataModels';
import config from '../config';
import { GeospatialUtils } from '../utils/GeospatialUtils';
import { BaseConnector } from './Connector';
import { Logger } from '../utils/Logger';
import { Observable, Subject } from 'rxjs';
import { ConnectorMetadata, DataSourceConnector } from './DataSourceConnector';

/**
 * Weather condition type
 */
type WeatherCondition = 'CLEAR' | 'CLOUDY' | 'RAIN' | 'SNOW' | 'STORM' | 'FOG' | 'DRIZZLE';

/**
 * Monitored location interface
 */
interface MonitoredLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * Connector for weather data
 */
export class WeatherConnector extends BaseConnector implements DataSourceConnector {
  private refreshIntervalMs: number;
  private pollingInterval: NodeJS.Timeout | null = null;
  private monitoredLocations: MonitoredLocation[] = [];
  private isPolling: boolean = false;
  private logger: Logger;
  private dataSubject: Subject<DataEvent> = new Subject<DataEvent>();

  /**
   * Initialize the weather connector
   */
  constructor() {
    super('WeatherConnector');
    this.refreshIntervalMs = config.streaming.refreshInterval;
    this.logger = new Logger('WeatherConnector');
    this.initializeDefaultLocations();
  }

  /**
   * Connect to the Weather API service
   */
  async connect(): Promise<void> {
    if (this.connected) {
      this.logger.warn('Already connected to Weather API service');
      return;
    }

    try {
      this.logger.info('Connecting to Weather API service...');
      
      // In a real implementation, this would establish a connection to the Weather API
      // For now, we'll just simulate a successful connection
      
      // Start polling for weather data
      this.connected = true;
      this.logger.info('Connected to Weather API service');
    } catch (error) {
      this.logger.error('Failed to connect to Weather API service:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the Weather API service
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      this.logger.warn('Not connected to Weather API service');
      return;
    }

    try {
      this.logger.info('Disconnecting from Weather API service...');
      
      // Stop polling for weather data
      await this.stop();
      
      this.connected = false;
      this.logger.info('Disconnected from Weather API service');
    } catch (error) {
      this.logger.error('Failed to disconnect from Weather API service:', error);
      throw error;
    }
  }

  /**
   * Start polling for weather data
   */
  async start(): Promise<void> {
    this.logger.info('Starting WeatherConnector');
    
    if (this.isPolling) {
      this.logger.warn('WeatherConnector is already polling');
      return;
    }
    
    this.isPolling = true;
    
    // Start polling
    this.pollWeatherData();
    
    this.logger.info('WeatherConnector started');
  }

  /**
   * Stop polling for weather data
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping WeatherConnector');
    
    if (!this.isPolling) {
      this.logger.warn('WeatherConnector is not polling');
      return;
    }
    
    this.isPolling = false;
    
    // Clear polling interval
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    this.logger.info('WeatherConnector stopped');
  }

  /**
   * Add a location to monitor for weather data
   * @param location Location to monitor or latitude
   * @param longitude Longitude (if first parameter is latitude)
   * @param name Optional name for the location
   */
  addMonitoredLocation(location: GeoLocation | number, longitude?: number, name?: string): void {
    let lat: number;
    let lng: number;
    let locationName: string;
    
    if (typeof location === 'object') {
      // Handle GeoLocation object
      lat = location.latitude;
      lng = location.longitude;
      locationName = name || `Location ${this.monitoredLocations.length + 1}`;
    } else {
      // Handle separate latitude/longitude parameters
      lat = location;
      lng = longitude!;
      locationName = name || `Location ${this.monitoredLocations.length + 1}`;
    }
    
    // Check if location already exists
    const exists = this.monitoredLocations.some(
      loc => loc.latitude === lat && loc.longitude === lng
    );
    
    if (!exists) {
      this.monitoredLocations.push({
        id: `loc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: locationName,
        latitude: lat,
        longitude: lng
      });
      
      this.logger.info(`Added monitored location: ${locationName} (${lat}, ${lng})`);
    }
  }

  /**
   * Remove a location from monitoring
   * @param location Location to remove or latitude
   * @param longitude Longitude (if first parameter is latitude)
   */
  removeMonitoredLocation(location: GeoLocation | number, longitude?: number): void {
    let lat: number;
    let lng: number;
    
    if (typeof location === 'object') {
      // Handle GeoLocation object
      lat = location.latitude;
      lng = location.longitude;
    } else {
      // Handle separate latitude/longitude parameters
      lat = location;
      lng = longitude!;
    }
    
    // Find and remove the location
    const initialLength = this.monitoredLocations.length;
    this.monitoredLocations = this.monitoredLocations.filter(
      loc => !(loc.latitude === lat && loc.longitude === lng)
    );
    
    if (this.monitoredLocations.length < initialLength) {
      this.logger.info(`Removed monitored location at (${lat}, ${lng})`);
    }
  }

  /**
   * Poll for weather data
   */
  private async pollWeatherData(): Promise<void> {
    if (!this.isPolling) {
      return;
    }
    
    try {
      this.logger.debug('Polling for weather data');
      
      // For now, we'll generate mock data for each location
      for (const location of this.monitoredLocations) {
        const weatherData = await this.fetchWeatherData(location);
        
        // Create a data event
        const event: DataEvent = {
          source: 'weather-api',
          timestamp: new Date(),
          payload: weatherData,
        };
        
        // Emit the event
        this.emitWeatherData(weatherData);
      }
    } catch (error) {
      this.logger.error('Failed to poll weather data:', error);
    } finally {
      // Schedule next poll
      this.pollingInterval = setTimeout(() => this.pollWeatherData(), this.refreshIntervalMs);
    }
  }

  /**
   * Fetch weather data for a specific location
   * @param location Location to fetch weather data for
   * @returns Weather data for the location
   */
  private async fetchWeatherData(location: MonitoredLocation): Promise<WeatherData> {
    try {
      // In a real implementation, this would call the weather API
      // For now, we'll generate mock data
      const weatherData = this.getMockWeatherData(location);
      
      // Calculate H3 index for the location
      const h3Index = GeospatialUtils.latLngToH3(location.latitude, location.longitude);
      
      // Add H3 index to weather data
      return {
        ...weatherData,
        h3Index
      };
    } catch (error) {
      this.logger.error(`Failed to fetch weather data for location ${location.name}:`, error);
      throw error;
    }
  }

  /**
   * Generate mock weather data
   * @param location Location to generate weather data for
   * @returns Mock weather data
   */
  private getMockWeatherData(location: MonitoredLocation): WeatherData {
    // Get current date
    const now = new Date();
    
    // Determine season based on month and hemisphere
    const month = now.getMonth();
    const isNorthernHemisphere = location.latitude > 0;
    
    let season: 'winter' | 'spring' | 'summer' | 'fall';
    
    if (isNorthernHemisphere) {
      if (month >= 11 || month <= 1) season = 'winter';
      else if (month >= 2 && month <= 4) season = 'spring';
      else if (month >= 5 && month <= 7) season = 'summer';
      else season = 'fall';
    } else {
      if (month >= 11 || month <= 1) season = 'summer';
      else if (month >= 2 && month <= 4) season = 'fall';
      else if (month >= 5 && month <= 7) season = 'winter';
      else season = 'spring';
    }
    
    // Determine time of day
    const hour = now.getHours();
    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
    else timeOfDay = 'night';
    
    // Base temperature varies by latitude (colder at poles, warmer at equator)
    const latitudeEffect = Math.cos(location.latitude * Math.PI / 180) * 30;
    
    // Season effect
    const seasonEffect = {
      winter: -10,
      spring: 5,
      summer: 15,
      fall: 0
    }[season];
    
    // Time of day effect
    const timeEffect = {
      morning: -2,
      afternoon: 5,
      evening: 0,
      night: -5
    }[timeOfDay];
    
    // Random variation
    const randomVariation = Math.random() * 5 - 2.5;
    
    // Calculate temperature
    const temperature = Math.round(latitudeEffect + seasonEffect + timeEffect + randomVariation);
    
    // Calculate humidity (higher near equator and in summer)
    const baseHumidity = Math.cos((location.latitude - 23) * Math.PI / 180) * 50 + 50;
    const seasonHumidityEffect = {
      winter: -20,
      spring: 0,
      summer: 20,
      fall: 0
    }[season];
    const humidity = Math.min(100, Math.max(0, Math.round(baseHumidity + seasonHumidityEffect + (Math.random() * 20 - 10))));
    
    // Calculate wind speed (higher in winter and at higher latitudes)
    const baseWindSpeed = Math.abs(location.latitude) / 90 * 20;
    const seasonWindEffect = {
      winter: 10,
      spring: 5,
      summer: -5,
      fall: 0
    }[season];
    const windSpeed = Math.max(0, Math.round(baseWindSpeed + seasonWindEffect + (Math.random() * 10 - 5)));
    
    // Calculate wind direction (random)
    const windDirection = Math.round(Math.random() * 360);
    
    // Calculate precipitation (higher in spring and fall)
    const basePrecipitation = humidity / 100 * 10;
    const seasonPrecipEffect = {
      winter: 0,
      spring: 5,
      summer: 2,
      fall: 5
    }[season];
    const precipitation = Math.max(0, Math.round((basePrecipitation + seasonPrecipEffect) * (Math.random() * 1.5)));
    
    // Determine weather condition based on precipitation, temperature, and humidity
    let weatherCondition: WeatherCondition;
    
    if (precipitation > 10) {
      weatherCondition = temperature < 0 ? 'SNOW' : 'RAIN';
    } else if (precipitation > 5) {
      weatherCondition = temperature < 0 ? 'SNOW' : 'DRIZZLE';
    } else if (humidity > 90) {
      weatherCondition = 'FOG';
    } else if (humidity > 70) {
      weatherCondition = 'CLOUDY';
    } else {
      weatherCondition = 'CLEAR';
    }
    
    return {
      timestamp: now.toISOString(),
      temperature,
      humidity,
      windSpeed,
      windDirection,
      precipitation,
      weatherCondition,
      location: {
        latitude: location.latitude,
        longitude: location.longitude
      }
    };
  }

  /**
   * Initialize default monitored locations
   */
  private initializeDefaultLocations(): void {
    // Add some default locations to monitor
    this.addMonitoredLocation(40.7128, -74.0060, 'New York');
    this.addMonitoredLocation(34.0522, -118.2437, 'Los Angeles');
    this.addMonitoredLocation(41.8781, -87.6298, 'Chicago');
    this.addMonitoredLocation(29.7604, -95.3698, 'Houston');
    this.addMonitoredLocation(39.9526, -75.1652, 'Philadelphia');
    this.addMonitoredLocation(51.5074, -0.1278, 'London');
    this.addMonitoredLocation(48.8566, 2.3522, 'Paris');
    this.addMonitoredLocation(35.6762, 139.6503, 'Tokyo');
    this.addMonitoredLocation(-33.8688, 151.2093, 'Sydney');
    this.addMonitoredLocation(-22.9068, -43.1729, 'Rio de Janeiro');
  }

  /**
   * Get the data stream from this connector
   */
  getStream(): Observable<DataEvent> {
    return this.dataSubject.asObservable();
  }

  /**
   * Get metadata about this connector
   */
  getMetadata(): ConnectorMetadata {
    return {
      name: this.getName(),
      type: 'weather',
      description: 'Provides real-time weather data for monitored locations',
      updateFrequency: `${this.refreshIntervalMs}ms`,
      status: this.isConnected() ? 'connected' : 'disconnected',
      lastConnected: this.connected ? new Date() : undefined
    };
  }

  /**
   * Emit a weather data event
   * @param weatherData The weather data to emit
   * @private
   */
  private emitWeatherData(weatherData: WeatherData): void {
    const event: DataEvent = {
      source: 'weather-api',
      timestamp: new Date(),
      payload: weatherData
    };
    
    // Emit to event emitter for backward compatibility
    this.emit('data', event);
    
    // Emit to rxjs subject for stream processor
    this.dataSubject.next(event);
  }
} 