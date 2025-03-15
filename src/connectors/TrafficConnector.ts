import { Subject, Observable } from 'rxjs';
import axios, { AxiosInstance } from 'axios';
import { DataSourceConnector, DataEvent, ConnectorMetadata } from './DataSourceConnector';
import { TrafficData, GeoLocation } from '../schemas/DataModels';
import config from '../config';
import * as GeospatialUtils from '../utils/GeospatialUtils';
import { EventEmitter } from 'events';
import { BaseConnector } from './Connector';
import { Logger } from '../utils/Logger';

/**
 * Road segment interface for traffic data
 */
interface RoadSegment {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  name: string;
  type: 'HIGHWAY' | 'MAJOR' | 'MINOR' | 'RESIDENTIAL';
  congestionLevel: number;
  averageSpeed: number;
  incidents: string[];
  isClosed: boolean;
}

/**
 * Connector for the Traffic API service
 */
export class TrafficConnector implements DataSourceConnector {
  private apiClient: AxiosInstance;
  private eventStream: Subject<DataEvent>;
  private connected: boolean = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private roadSegments: RoadSegment[] = [];

  /**
   * Create a new Traffic API connector
   * @param apiUrl The Traffic API URL
   * @param apiKey The Traffic API key
   * @param refreshIntervalMs The refresh interval in milliseconds
   */
  constructor(
    private readonly apiUrl: string = config.dataSources.traffic.apiUrl,
    private readonly apiKey: string = config.dataSources.traffic.apiKey,
    private readonly refreshIntervalMs: number = config.dataSources.traffic.refreshIntervalMs || 30000, // 30 seconds
  ) {
    this.apiClient = axios.create({
      baseURL: apiUrl,
      timeout: 10000,
      headers: {
        'X-API-Key': apiKey,
      },
    });
    this.eventStream = new Subject<DataEvent>();

    // Initialize with mock road segments (in a real implementation, these would be fetched from the API)
    this.initializeMockRoadSegments();
  }

  /**
   * Connect to the Traffic API service
   */
  async connect(): Promise<void> {
    try {
      // Test the API connection
      await this.fetchTrafficData();
      
      // Start polling for traffic data
      this.startPolling();
      this.connected = true;
      console.log('Connected to Traffic API service');
    } catch (error) {
      console.error('Failed to connect to Traffic API service:', error);
      throw new Error('Connection failed');
    }
  }

  /**
   * Disconnect from the Traffic API service
   */
  async disconnect(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.connected = false;
    console.log('Disconnected from Traffic API service');
  }

  /**
   * Check if connected to the Traffic API service
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the stream of traffic data events
   */
  getStream(): Observable<DataEvent> {
    return this.eventStream.asObservable();
  }

  /**
   * Get metadata about this connector
   */
  getMetadata(): ConnectorMetadata {
    return {
      name: 'Traffic API Service',
      type: 'REST API',
      description: 'Connects to the Traffic API service for real-time traffic data',
      updateFrequency: `${this.refreshIntervalMs / 1000} seconds`,
      lastConnected: this.connected ? new Date() : undefined,
      status: this.connected ? 'connected' : 'disconnected',
    };
  }

  /**
   * Start polling for traffic data
   * @private
   */
  private startPolling(): void {
    // Immediately fetch data
    this.fetchTrafficData();

    // Set up polling interval
    this.pollingInterval = setInterval(() => {
      this.fetchTrafficData();
    }, this.refreshIntervalMs);
  }

  /**
   * Fetch traffic data for all road segments
   * @private
   */
  private async fetchTrafficData(): Promise<void> {
    try {
      // In a real implementation, this would call the actual Traffic API
      // For now, we'll generate mock data for each road segment
      for (const segment of this.roadSegments) {
        const trafficData = this.getMockTrafficData(segment);
        
        // Calculate the midpoint of the road segment
        const midLat = (segment.startLat + segment.endLat) / 2;
        const midLng = (segment.startLng + segment.endLng) / 2;
        
        // Calculate H3 index for the midpoint
        const h3Index = GeospatialUtils.GeospatialUtils.latLngToH3(midLat, midLng);
        
        // Create a data event
        const event: DataEvent = {
          source: 'traffic-api',
          timestamp: new Date(),
          payload: {
            ...trafficData,
            h3Index,
          },
        };
        
        // Emit the event
        this.eventStream.next(event);
      }
    } catch (error) {
      console.error('Error fetching traffic data:', error);
    }
  }

  /**
   * Get mock traffic data for a road segment
   * @param segment Road segment
   * @private
   */
  private getMockTrafficData(segment: RoadSegment): TrafficData {
    // Generate realistic mock traffic data
    
    // Base congestion level depends on road type
    let baseCongestion = 0;
    switch (segment.type) {
      case 'HIGHWAY':
        baseCongestion = 0.4;
        break;
      case 'MAJOR':
        baseCongestion = 0.5;
        break;
      case 'MINOR':
        baseCongestion = 0.3;
        break;
      case 'RESIDENTIAL':
        baseCongestion = 0.2;
        break;
    }
    
    // Add time-based variation (rush hour effect)
    const hour = new Date().getHours();
    let timeMultiplier = 1;
    
    // Morning rush hour (7-9 AM)
    if (hour >= 7 && hour <= 9) {
      timeMultiplier = 1.5;
    }
    // Evening rush hour (4-7 PM)
    else if (hour >= 16 && hour <= 19) {
      timeMultiplier = 1.7;
    }
    // Late night (11 PM - 5 AM)
    else if (hour >= 23 || hour <= 5) {
      timeMultiplier = 0.5;
    }
    
    // Add some randomness
    const randomFactor = 0.8 + Math.random() * 0.4; // 0.8-1.2
    
    // Calculate final congestion level (0-1 scale)
    const congestionLevel = Math.min(1, baseCongestion * timeMultiplier * randomFactor);
    
    // Average speed depends on congestion and road type
    let baseSpeed = 0;
    switch (segment.type) {
      case 'HIGHWAY':
        baseSpeed = 100; // km/h
        break;
      case 'MAJOR':
        baseSpeed = 60; // km/h
        break;
      case 'MINOR':
        baseSpeed = 40; // km/h
        break;
      case 'RESIDENTIAL':
        baseSpeed = 30; // km/h
        break;
    }
    
    // Speed decreases with congestion
    const averageSpeed = baseSpeed * (1 - congestionLevel * 0.8);
    
    // Randomly determine if there's an incident
    const hasIncident = Math.random() < 0.05; // 5% chance
    
    let incidentType = undefined;
    let incidentSeverity = undefined;
    
    if (hasIncident) {
      // Determine incident type
      const incidentRandom = Math.random();
      if (incidentRandom < 0.4) {
        incidentType = 'ACCIDENT';
      } else if (incidentRandom < 0.7) {
        incidentType = 'CONSTRUCTION';
      } else if (incidentRandom < 0.9) {
        incidentType = 'CLOSURE';
      } else {
        incidentType = 'OTHER';
      }
      
      // Determine incident severity
      const severityRandom = Math.random();
      if (severityRandom < 0.5) {
        incidentSeverity = 'LOW';
      } else if (severityRandom < 0.8) {
        incidentSeverity = 'MEDIUM';
      } else {
        incidentSeverity = 'HIGH';
      }
    }
    
    // Calculate midpoint of the road segment
    const midLat = (segment.startLat + segment.endLat) / 2;
    const midLng = (segment.startLng + segment.endLng) / 2;
    
    return {
      timestamp: new Date().toISOString(),
      location: {
        latitude: midLat,
        longitude: midLng,
      },
      congestionLevel,
      averageSpeed,
      incidentCount: hasIncident ? 1 : 0,
      roadClosures: incidentType === 'CLOSURE',
    };
  }

  /**
   * Initialize mock road segments
   * @private
   */
  private initializeMockRoadSegments(): void {
    // San Francisco area road segments
    this.roadSegments = [
      {
        id: 'SF-HWY-101',
        startLat: 37.7749,
        startLng: -122.4194,
        endLat: 37.8049,
        endLng: -122.4394,
        name: 'US-101',
        type: 'HIGHWAY',
        congestionLevel: 0.5,
        averageSpeed: 80,
        incidents: [],
        isClosed: false,
      },
      {
        id: 'SF-MKT-ST',
        startLat: 37.7749,
        startLng: -122.4194,
        endLat: 37.7749,
        endLng: -122.4294,
        name: 'Market Street',
        type: 'MAJOR',
        congestionLevel: 0.6,
        averageSpeed: 50,
        incidents: [],
        isClosed: false,
      },
      {
        id: 'SF-MISS-ST',
        startLat: 37.7849,
        startLng: -122.4094,
        endLat: 37.7649,
        endLng: -122.4094,
        name: 'Mission Street',
        type: 'MAJOR',
        congestionLevel: 0.4,
        averageSpeed: 60,
        incidents: [],
        isClosed: false,
      },
      {
        id: 'SF-VN-AVE',
        startLat: 37.7649,
        startLng: -122.4294,
        endLat: 37.7649,
        endLng: -122.4194,
        name: 'Van Ness Avenue',
        type: 'MAJOR',
        congestionLevel: 0.5,
        averageSpeed: 70,
        incidents: [],
        isClosed: false,
      },
      {
        id: 'SF-HAIGHT-ST',
        startLat: 37.7699,
        startLng: -122.4394,
        endLat: 37.7699,
        endLng: -122.4294,
        name: 'Haight Street',
        type: 'MINOR',
        congestionLevel: 0.3,
        averageSpeed: 40,
        incidents: [],
        isClosed: false,
      },
      {
        id: 'SF-FOLSOM-ST',
        startLat: 37.7849,
        startLng: -122.3994,
        endLat: 37.7849,
        endLng: -122.4094,
        name: 'Folsom Street',
        type: 'MINOR',
        congestionLevel: 0.2,
        averageSpeed: 30,
        incidents: [],
        isClosed: false,
      },
      {
        id: 'SF-CLAY-ST',
        startLat: 37.7949,
        startLng: -122.4094,
        endLat: 37.7949,
        endLng: -122.4194,
        name: 'Clay Street',
        type: 'RESIDENTIAL',
        congestionLevel: 0.1,
        averageSpeed: 20,
        incidents: [],
        isClosed: false,
      },
      {
        id: 'SF-PINE-ST',
        startLat: 37.7899,
        startLng: -122.4194,
        endLat: 37.7899,
        endLng: -122.4094,
        name: 'Pine Street',
        type: 'RESIDENTIAL',
        congestionLevel: 0.1,
        averageSpeed: 20,
        incidents: [],
        isClosed: false,
      },
    ];
  }

  /**
   * Call the actual Traffic API (for real implementation)
   * @private
   */
  private async callTrafficApi(): Promise<any> {
    try {
      const response = await this.apiClient.get('/traffic/flow');
      return response.data;
    } catch (error) {
      console.error('Error calling Traffic API:', error);
      throw error;
    }
  }

  /**
   * Process traffic data for a road segment
   * @param segment Road segment
   * @returns Traffic data
   * @private
   */
  private processRoadSegment(segment: RoadSegment): TrafficData {
    // Calculate midpoint of the segment
    const midLat = (segment.startLat + segment.endLat) / 2;
    const midLng = (segment.startLng + segment.endLng) / 2;
    
    // Get H3 index for the midpoint
    const h3Index = GeospatialUtils.GeospatialUtils.latLngToH3(midLat, midLng);
    
    // Create traffic data
    const trafficData: TrafficData = {
      timestamp: new Date().toISOString(),
      location: {
        latitude: midLat,
        longitude: midLng
      },
      congestionLevel: segment.congestionLevel,
      averageSpeed: segment.averageSpeed,
      incidentCount: segment.incidents.length,
      roadClosures: segment.isClosed,
      h3Index
    };
    
    return trafficData;
  }
} 