import { supabase } from './supabase';
import { latLongToHexId, getNeighboringHexes } from './geospatial';
import { Subject, Observable } from 'rxjs';
import { map, filter, bufferTime, mergeMap } from 'rxjs/operators';
import { Subscription } from 'rxjs';

// Global map for demand/supply data
const demandSupplyMap = new Map<string, any>();

// Data event types
export interface DataEvent {
  source: string;
  timestamp: Date;
  payload: any;
}

export interface RideRequestEvent extends DataEvent {
  payload: {
    requestId: string;
    userId: string;
    pickupLatitude: number;
    pickupLongitude: number;
    dropoffLatitude: number;
    dropoffLongitude: number;
    estimatedDistance?: number;
    estimatedDuration?: number;
    rideType: 'ECONOMY' | 'COMFORT' | 'PREMIUM';
    status: 'CREATED' | 'MATCHED' | 'CANCELLED' | 'COMPLETED';
    deviceType?: string;
    appVersion?: string;
  };
}

export interface DriverLocationEvent extends DataEvent {
  payload: {
    driverId: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    availability: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
    vehicleType: 'ECONOMY' | 'COMFORT' | 'PREMIUM';
    batteryLevel?: number;
  };
}

export interface WeatherEvent extends DataEvent {
  payload: {
    latitude: number;
    longitude: number;
    temperature: number;
    precipitation: number;
    windSpeed: number;
    condition: string;
  };
}

export interface TrafficEvent extends DataEvent {
  payload: {
    latitude: number;
    longitude: number;
    congestionLevel: number;
    averageSpeed: number;
    incidentCount: number;
  };
}

export interface EventCalendarEvent extends DataEvent {
  payload: {
    eventId: string;
    name: string;
    latitude: number;
    longitude: number;
    startTime: Date;
    endTime: Date;
    expectedAttendees: number;
    category: string;
  };
}

export interface SocialMediaEvent extends DataEvent {
  payload: {
    platform: string;
    latitude: number;
    longitude: number;
    postCount: number;
    sentiment: number;
    keywords: string[];
  };
}

// Data source connector interface
export interface DataSourceConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getStream(): Observable<DataEvent>;
  getMetadata(): ConnectorMetadata;
}

export interface ConnectorMetadata {
  name: string;
  type: string;
  updateFrequency: string;
}

// Base connector implementation
abstract class BaseConnector implements DataSourceConnector {
  protected connected: boolean = false;
  protected eventStream: Subject<DataEvent> = new Subject<DataEvent>();
  
  abstract connect(): Promise<void>;
  
  async disconnect(): Promise<void> {
    this.connected = false;
    // Implement specific disconnection logic in subclasses
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  getStream(): Observable<DataEvent> {
    return this.eventStream.asObservable();
  }
  
  abstract getMetadata(): ConnectorMetadata;
}

// Ride Request Connector using Supabase
export class RideRequestConnector extends BaseConnector {
  private pollingInterval: NodeJS.Timeout | null = null;
  
  constructor(
    private readonly refreshIntervalMs: number = 1000,
  ) {
    super();
  }
  
  async connect(): Promise<void> {
    try {
      this.startPolling();
      this.connected = true;
    } catch (error) {
      console.error("Failed to connect to Ride Request API:", error);
      throw new Error("Connection failed");
    }
  }
  
  async disconnect(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    await super.disconnect();
  }
  
  getMetadata(): ConnectorMetadata {
    return {
      name: "Ride Request Connector",
      type: "REST API Client",
      updateFrequency: "Real-time (event-based)"
    };
  }
  
  private startPolling(): void {
    this.pollingInterval = setInterval(async () => {
      try {
        // Get the latest ride requests from Supabase
        const { data, error } = await supabase
          .from('ride_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
          
        if (error) {
          console.error("Error fetching ride requests:", error);
          return;
        }
        
        // Convert to events and emit
        if (data) {
          data.forEach(request => {
            const event: RideRequestEvent = {
              source: 'ride_requests',
              timestamp: new Date(request.created_at),
              payload: {
                requestId: request.id,
                userId: request.rider_id,
                pickupLatitude: request.pickup_latitude,
                pickupLongitude: request.pickup_longitude,
                dropoffLatitude: request.destination_latitude,
                dropoffLongitude: request.destination_longitude,
                estimatedDistance: request.estimated_distance,
                estimatedDuration: request.estimated_duration,
                rideType: request.ride_type || 'ECONOMY',
                status: this.mapStatus(request.status),
                deviceType: request.device_type,
                appVersion: request.app_version
              }
            };
            
            this.eventStream.next(event);
          });
        }
      } catch (error) {
        console.error("Error in ride request polling:", error);
      }
    }, this.refreshIntervalMs);
  }
  
  private mapStatus(status: string): 'CREATED' | 'MATCHED' | 'CANCELLED' | 'COMPLETED' {
    switch (status) {
      case 'pending': return 'CREATED';
      case 'accepted': return 'MATCHED';
      case 'cancelled': return 'CANCELLED';
      case 'completed': return 'COMPLETED';
      default: return 'CREATED';
    }
  }
}

// Driver Location Connector using Supabase
export class DriverLocationConnector extends BaseConnector {
  private pollingInterval: NodeJS.Timeout | null = null;
  
  constructor(
    private readonly refreshIntervalMs: number = 5000,
  ) {
    super();
  }
  
  async connect(): Promise<void> {
    try {
      this.startPolling();
      this.connected = true;
    } catch (error) {
      console.error("Failed to connect to Driver Location Service:", error);
      throw new Error("Connection failed");
    }
  }
  
  async disconnect(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    await super.disconnect();
  }
  
  getMetadata(): ConnectorMetadata {
    return {
      name: "Driver Location Connector",
      type: "WebSocket Client",
      updateFrequency: "Continuous (1-5 sec intervals)"
    };
  }
  
  private startPolling(): void {
    this.pollingInterval = setInterval(async () => {
      try {
        // Get the latest driver locations from Supabase
        const { data, error } = await supabase
          .from('driver_locations')
          .select('*, drivers(*)')
          .order('timestamp', { ascending: false });
          
        if (error) {
          console.error("Error fetching driver locations:", error);
          return;
        }
        
        // Convert to events and emit
        if (data) {
          data.forEach(location => {
            const event: DriverLocationEvent = {
              source: 'driver_locations',
              timestamp: new Date(location.timestamp),
              payload: {
                driverId: location.driver_id,
                latitude: location.latitude,
                longitude: location.longitude,
                heading: location.heading,
                speed: location.speed,
                availability: location.is_available ? 'AVAILABLE' : 'BUSY',
                vehicleType: location.drivers?.vehicle_type || 'ECONOMY',
                batteryLevel: location.battery_level
              }
            };
            
            this.eventStream.next(event);
          });
        }
      } catch (error) {
        console.error("Error in driver location polling:", error);
      }
    }, this.refreshIntervalMs);
  }
}

// Data Stream Pipeline
export class DataStreamPipeline {
  private connectors: DataSourceConnector[] = [];
  private combinedStream: Observable<DataEvent>;
  private processingEngine: DataProcessingEngine;
  
  constructor() {
    // Initialize the processing engine
    this.processingEngine = new DataProcessingEngine();
    
    // Create a combined stream from all connectors
    this.combinedStream = new Observable<DataEvent>(observer => {
      const subscriptions = this.connectors.map(connector => 
        connector.getStream().subscribe(event => observer.next(event))
      );
      
      return () => {
        subscriptions.forEach(sub => sub.unsubscribe());
      };
    });
  }
  
  addConnector(connector: DataSourceConnector): void {
    this.connectors.push(connector);
  }
  
  async start(): Promise<void> {
    // Connect all data sources
    await Promise.all(this.connectors.map(connector => connector.connect()));
    
    // Start processing the combined stream
    this.processingEngine.processStream(this.combinedStream);
  }
  
  async stop(): Promise<void> {
    // Disconnect all data sources
    await Promise.all(this.connectors.map(connector => connector.disconnect()));
    
    // Stop the processing engine
    this.processingEngine.stop();
  }
}

// Data Processing Engine
export class DataProcessingEngine {
  private subscription: Subscription | null = null;
  private geolocatedRequests = new Subject<any>();
  private driverLocations = new Subject<any>();
  private weatherUpdates = new Subject<any>();
  private trafficConditions = new Subject<any>();
  
  constructor() {
    // Set up the processing pipeline
    this.setupProcessingPipeline();
  }
  
  processStream(stream: Observable<DataEvent>): void {
    this.subscription = stream.subscribe(event => {
      // Route events to appropriate processors based on their type
      switch (event.source) {
        case 'ride_requests':
          this.processRideRequest(event as RideRequestEvent);
          break;
        case 'driver_locations':
          this.processDriverLocation(event as DriverLocationEvent);
          break;
        case 'weather_updates':
          this.processWeatherUpdate(event as WeatherEvent);
          break;
        case 'traffic_conditions':
          this.processTrafficCondition(event as TrafficEvent);
          break;
        // Add more event types as needed
      }
    });
  }
  
  stop(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
  
  private processRideRequest(event: RideRequestEvent): void {
    // Convert to geolocated request
    const hexKey = latLongToHexId(
      event.payload.pickupLatitude, 
      event.payload.pickupLongitude
    );
    
    const geolocatedRequest = {
      ...event,
      hexKey,
      neighbors: getNeighboringHexes(hexKey)
    };
    
    this.geolocatedRequests.next(geolocatedRequest);
  }
  
  private processDriverLocation(event: DriverLocationEvent): void {
    // Convert to geolocated driver
    const hexKey = latLongToHexId(
      event.payload.latitude, 
      event.payload.longitude
    );
    
    const geolocatedDriver = {
      ...event,
      hexKey,
      neighbors: getNeighboringHexes(hexKey)
    };
    
    this.driverLocations.next(geolocatedDriver);
  }
  
  private processWeatherUpdate(event: WeatherEvent): void {
    // Process weather data
    const hexKey = latLongToHexId(
      event.payload.latitude, 
      event.payload.longitude
    );
    
    const geolocatedWeather = {
      ...event,
      hexKey
    };
    
    this.weatherUpdates.next(geolocatedWeather);
  }
  
  private processTrafficCondition(event: TrafficEvent): void {
    // Process traffic data
    const hexKey = latLongToHexId(
      event.payload.latitude, 
      event.payload.longitude
    );
    
    const geolocatedTraffic = {
      ...event,
      hexKey
    };
    
    this.trafficConditions.next(geolocatedTraffic);
  }
  
  private setupProcessingPipeline(): void {
    // Aggregate ride requests by hex
    const demandByHex = this.geolocatedRequests.pipe(
      bufferTime(5 * 60 * 1000), // 5-minute windows
      map(requests => {
        // Group by hex
        const hexGroups = requests.reduce((acc: Record<string, any[]>, req: any) => {
          const hexKey = req.hexKey;
          if (!acc[hexKey]) {
            acc[hexKey] = [];
          }
          acc[hexKey].push(req);
          return acc;
        }, {});
        
        // Calculate demand metrics for each hex
        return Object.entries(hexGroups).map(([hexKey, hexRequests]) => ({
          hexKey,
          count: hexRequests.length,
          timestamp: new Date(),
        }));
      }),
      mergeMap(hexDemands => hexDemands)
    );
    
    // Aggregate driver locations by hex
    const supplyByHex = this.driverLocations.pipe(
      bufferTime(5 * 60 * 1000), // 5-minute windows
      map(drivers => {
        // Group by hex
        const hexGroups = drivers.reduce((acc: Record<string, any[]>, driver: any) => {
          const hexKey = driver.hexKey;
          if (!acc[hexKey]) {
            acc[hexKey] = [];
          }
          acc[hexKey].push(driver);
          return acc;
        }, {});
        
        // Calculate supply metrics for each hex
        return Object.entries(hexGroups).map(([hexKey, hexDrivers]) => ({
          hexKey,
          count: hexDrivers.length,
          availableCount: hexDrivers.filter((d: any) => d.payload.availability === 'AVAILABLE').length,
          timestamp: new Date(),
        }));
      }),
      mergeMap(hexSupplies => hexSupplies)
    );
    
    // Join demand and supply to calculate surge
    // This is a simplified version - in a real system, you'd use a more sophisticated join
    
    demandByHex.subscribe(demand => {
      demandSupplyMap.set(`demand_${demand.hexKey}`, demand);
      this.calculateSurge(demand.hexKey);
    });
    
    supplyByHex.subscribe(supply => {
      demandSupplyMap.set(`supply_${supply.hexKey}`, supply);
      this.calculateSurge(supply.hexKey);
    });
    
    // Weather and traffic would be incorporated similarly
    this.weatherUpdates.subscribe(weather => {
      demandSupplyMap.set(`weather_${weather.hexKey}`, weather);
      this.calculateSurge(weather.hexKey);
    });
    
    this.trafficConditions.subscribe(traffic => {
      demandSupplyMap.set(`traffic_${traffic.hexKey}`, traffic);
      this.calculateSurge(traffic.hexKey);
    });
  }
  
  private calculateSurge(hexKey: string): void {
    const demand = demandSupplyMap.get(`demand_${hexKey}`);
    const supply = demandSupplyMap.get(`supply_${hexKey}`);
    const weather = demandSupplyMap.get(`weather_${hexKey}`);
    const traffic = demandSupplyMap.get(`traffic_${hexKey}`);
    
    // Only calculate if we have both demand and supply
    if (demand && supply) {
      // Basic surge calculation
      let surgeMultiplier = 1.0;
      
      // Demand/supply ratio
      const demandSupplyRatio = supply.availableCount > 0 
        ? demand.count / supply.availableCount 
        : demand.count > 0 ? 3.0 : 1.0; // If no drivers but demand, high surge
      
      surgeMultiplier *= Math.min(1 + (demandSupplyRatio * 0.5), 3.0);
      
      // Weather factor
      if (weather && weather.payload.precipitation > 0.5) {
        surgeMultiplier *= 1.2; // Increase surge in rainy conditions
      }
      
      // Traffic factor
      if (traffic && traffic.payload.congestionLevel > 0.7) {
        surgeMultiplier *= 1.1; // Increase surge in heavy traffic
      }
      
      // Cap the surge multiplier
      surgeMultiplier = Math.min(Math.max(surgeMultiplier, 1.0), 3.0);
      
      // Create surge prediction
      const surgePrediction = {
        hexKey,
        latitude: demand.latitude || 0,
        longitude: demand.longitude || 0,
        timestamp: new Date(),
        surgeMultiplier,
        demandLevel: demand.count,
        supplyLevel: supply.availableCount,
        factors: [
          { name: 'demand_supply_ratio', contribution: demandSupplyRatio * 0.5 },
          weather ? { name: 'weather', contribution: weather.payload.precipitation > 0.5 ? 0.2 : 0 } : null,
          traffic ? { name: 'traffic', contribution: traffic.payload.congestionLevel > 0.7 ? 0.1 : 0 } : null,
        ].filter(Boolean)
      };
      
      // Store the prediction in Supabase
      this.storeSurgePrediction(surgePrediction);
    }
  }
  
  private async storeSurgePrediction(prediction: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('surge_predictions')
        .insert({
          latitude: prediction.latitude,
          longitude: prediction.longitude,
          hex_id: prediction.hexKey,
          surge_multiplier: prediction.surgeMultiplier,
          demand_level: prediction.demandLevel,
          supply_level: prediction.supplyLevel,
          factors: prediction.factors,
          predicted_at: new Date().toISOString(),
          valid_until: new Date(Date.now() + 15 * 60 * 1000).toISOString() // Valid for 15 minutes
        });
        
      if (error) {
        console.error("Error storing surge prediction:", error);
      }
    } catch (error) {
      console.error("Error in storeSurgePrediction:", error);
    }
  }
}

// Factory to create the data pipeline
export const createDataPipeline = async (): Promise<DataStreamPipeline> => {
  const pipeline = new DataStreamPipeline();
  
  // Add connectors
  pipeline.addConnector(new RideRequestConnector());
  pipeline.addConnector(new DriverLocationConnector());
  
  // Add more connectors as needed
  // pipeline.addConnector(new WeatherConnector());
  // pipeline.addConnector(new TrafficConnector());
  
  return pipeline;
}; 