import axios, { AxiosInstance } from 'axios';
import { Subject, Observable } from 'rxjs';
import { DataSourceConnector, DataEvent, ConnectorMetadata } from './DataSourceConnector';
import config from '../config';

/**
 * Ride request data interface
 */
export interface RideRequest {
  requestId: string;
  userId: string;
  timestamp: string;
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
}

/**
 * Connector for the Ride Request API
 */
export class RideRequestConnector implements DataSourceConnector {
  private apiClient: AxiosInstance;
  private eventStream: Subject<DataEvent>;
  private connected: boolean = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastTimestamp: string | null = null;

  constructor(
    private readonly apiUrl: string = config.dataSources.rideRequest.apiUrl,
    private readonly clientId: string = config.dataSources.rideRequest.clientId,
    private readonly clientSecret: string = config.dataSources.rideRequest.clientSecret,
    private readonly refreshIntervalMs: number = config.dataSources.rideRequest.refreshIntervalMs || 1000,
  ) {
    this.apiClient = axios.create({
      baseURL: apiUrl,
      timeout: 5000,
    });
    this.eventStream = new Subject<DataEvent>();
  }

  /**
   * Connect to the Ride Request API
   */
  async connect(): Promise<void> {
    try {
      const token = await this.authenticate();
      this.apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      this.startPolling();
      this.connected = true;
      console.log('Connected to Ride Request API');
    } catch (error) {
      console.error("Failed to connect to Ride Request API:", error);
      throw new Error("Connection failed");
    }
  }

  /**
   * Disconnect from the Ride Request API
   */
  async disconnect(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.connected = false;
    console.log('Disconnected from Ride Request API');
  }

  /**
   * Check if connected to the Ride Request API
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the stream of ride request events
   */
  getStream(): Observable<DataEvent> {
    return this.eventStream.asObservable();
  }

  /**
   * Get metadata about this connector
   */
  getMetadata(): ConnectorMetadata {
    return {
      name: 'Ride Request API',
      type: 'REST API',
      description: 'Connects to the Ride Request API to fetch real-time ride requests',
      updateFrequency: `Every ${this.refreshIntervalMs}ms`,
      lastConnected: this.connected ? new Date() : undefined,
      status: this.connected ? 'connected' : 'disconnected',
    };
  }

  /**
   * Authenticate with the Ride Request API
   * @private
   */
  private async authenticate(): Promise<string> {
    try {
      // In a real implementation, this would perform OAuth 2.0 authentication
      // For now, we'll simulate a successful authentication
      return 'simulated-jwt-token';
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Start polling the Ride Request API
   * @private
   */
  private startPolling(): void {
    this.pollingInterval = setInterval(async () => {
      try {
        await this.fetchRideRequests();
      } catch (error) {
        console.error('Error fetching ride requests:', error);
      }
    }, this.refreshIntervalMs);
  }

  /**
   * Fetch ride requests from the API
   * @private
   */
  private async fetchRideRequests(): Promise<void> {
    try {
      // In a real implementation, this would call the actual API
      // For now, we'll generate mock data
      const params: any = {};
      if (this.lastTimestamp) {
        params.since = this.lastTimestamp;
      }

      // Simulate API response with mock data
      const mockRequests = this.generateMockRideRequests();
      
      if (mockRequests.length > 0) {
        // Update last timestamp for next poll
        this.lastTimestamp = mockRequests[mockRequests.length - 1].timestamp;
        
        // Emit each ride request as a data event
        mockRequests.forEach(request => {
          const event: DataEvent = {
            source: 'ride-request-api',
            timestamp: new Date(request.timestamp),
            payload: request,
          };
          this.eventStream.next(event);
        });
      }
    } catch (error) {
      console.error('Error fetching ride requests:', error);
      throw error;
    }
  }

  /**
   * Generate mock ride request data for testing
   * @private
   */
  private generateMockRideRequests(): RideRequest[] {
    // Only generate data ~20% of the time to simulate sporadic requests
    if (Math.random() > 0.2) {
      return [];
    }

    const count = Math.floor(Math.random() * 3) + 1; // 1-3 requests
    const requests: RideRequest[] = [];

    for (let i = 0; i < count; i++) {
      // Generate random coordinates in San Francisco area
      const sfLatBase = 37.75;
      const sfLngBase = -122.45;
      const latVariance = (Math.random() - 0.5) * 0.1;
      const lngVariance = (Math.random() - 0.5) * 0.1;

      const pickupLat = sfLatBase + latVariance;
      const pickupLng = sfLngBase + lngVariance;
      
      // Generate dropoff 1-5km away
      const dropoffLatVariance = (Math.random() - 0.5) * 0.05;
      const dropoffLngVariance = (Math.random() - 0.5) * 0.05;
      
      const dropoffLat = pickupLat + dropoffLatVariance;
      const dropoffLng = pickupLng + dropoffLngVariance;

      // Calculate estimated distance (rough approximation)
      const distance = Math.sqrt(
        Math.pow(dropoffLat - pickupLat, 2) + 
        Math.pow(dropoffLng - pickupLng, 2)
      ) * 111; // ~111km per degree

      const request: RideRequest = {
        requestId: `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: `user-${Math.floor(Math.random() * 10000)}`,
        timestamp: new Date().toISOString(),
        pickupLatitude: pickupLat,
        pickupLongitude: pickupLng,
        dropoffLatitude: dropoffLat,
        dropoffLongitude: dropoffLng,
        estimatedDistance: distance,
        estimatedDuration: Math.floor(distance * 2 * 60), // ~30km/h -> seconds
        rideType: ['ECONOMY', 'COMFORT', 'PREMIUM'][Math.floor(Math.random() * 3)] as any,
        status: 'CREATED',
        deviceType: ['iOS', 'Android'][Math.floor(Math.random() * 2)],
        appVersion: '1.0.' + Math.floor(Math.random() * 10),
      };

      requests.push(request);
    }

    return requests;
  }
} 