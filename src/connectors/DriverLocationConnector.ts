import { Subject, Observable } from 'rxjs';
import { DataSourceConnector, DataEvent, ConnectorMetadata } from './DataSourceConnector';
import config from '../config';
import WebSocket from 'ws';

/**
 * Driver location data interface
 */
export interface DriverLocation {
  driverId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  availability: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  vehicleType: 'ECONOMY' | 'COMFORT' | 'PREMIUM';
  batteryLevel?: number;
}

/**
 * Connector for the Driver Location WebSocket service
 */
export class DriverLocationConnector implements DataSourceConnector {
  private eventStream: Subject<DataEvent>;
  private connected: boolean = false;
  private ws: WebSocket | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private mockInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly wsUrl: string = config.dataSources.driverLocation.wsUrl,
    private readonly jwtSecret: string = config.dataSources.driverLocation.jwtSecret,
    private readonly reconnectIntervalMs: number = 5000,
    private readonly heartbeatIntervalMs: number = 30000,
    private readonly mockIntervalMs: number = config.dataSources.driverLocation.refreshIntervalMs || 1000,
  ) {
    this.eventStream = new Subject<DataEvent>();
  }

  /**
   * Connect to the Driver Location WebSocket service
   */
  async connect(): Promise<void> {
    try {
      // In a real implementation, this would connect to a WebSocket
      // For now, we'll simulate with mock data
      this.startMockDataGeneration();
      this.connected = true;
      console.log('Connected to Driver Location service');
    } catch (error) {
      console.error('Failed to connect to Driver Location service:', error);
      throw new Error('Connection failed');
    }
  }

  /**
   * Disconnect from the Driver Location WebSocket service
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.mockInterval) {
      clearInterval(this.mockInterval);
      this.mockInterval = null;
    }

    this.connected = false;
    console.log('Disconnected from Driver Location service');
  }

  /**
   * Check if connected to the Driver Location WebSocket service
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the stream of driver location events
   */
  getStream(): Observable<DataEvent> {
    return this.eventStream.asObservable();
  }

  /**
   * Get metadata about this connector
   */
  getMetadata(): ConnectorMetadata {
    return {
      name: 'Driver Location Service',
      type: 'WebSocket',
      description: 'Connects to the Driver Location WebSocket service for real-time driver locations',
      updateFrequency: 'Continuous (1-5 sec intervals)',
      lastConnected: this.connected ? new Date() : undefined,
      status: this.connected ? 'connected' : 'disconnected',
    };
  }

  /**
   * Start generating mock driver location data
   * @private
   */
  private startMockDataGeneration(): void {
    // Generate a fixed set of driver IDs
    const driverIds = Array.from({ length: 50 }, (_, i) => `driver-${i + 1}`);
    
    // Store last known positions for each driver
    const driverPositions = new Map<string, { lat: number; lng: number }>();
    
    // Initialize random positions in San Francisco area
    driverIds.forEach(id => {
      const sfLatBase = 37.75;
      const sfLngBase = -122.45;
      const latVariance = (Math.random() - 0.5) * 0.1;
      const lngVariance = (Math.random() - 0.5) * 0.1;
      
      driverPositions.set(id, {
        lat: sfLatBase + latVariance,
        lng: sfLngBase + lngVariance,
      });
    });
    
    this.mockInterval = setInterval(() => {
      // Select a random subset of drivers to update (30% of drivers)
      const driversToUpdate = driverIds.filter(() => Math.random() < 0.3);
      
      driversToUpdate.forEach(driverId => {
        const position = driverPositions.get(driverId);
        if (!position) return;
        
        // Update position slightly (simulate movement)
        const latDelta = (Math.random() - 0.5) * 0.001; // Small movement
        const lngDelta = (Math.random() - 0.5) * 0.001;
        
        const newLat = position.lat + latDelta;
        const newLng = position.lng + lngDelta;
        
        // Update stored position
        driverPositions.set(driverId, { lat: newLat, lng: newLng });
        
        // Calculate heading (0-359 degrees)
        const heading = Math.floor(Math.random() * 360);
        
        // Calculate speed (0-60 km/h)
        const speed = Math.random() * 60;
        
        // Determine availability (mostly available)
        const availabilityRandom = Math.random();
        let availability: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
        
        if (availabilityRandom < 0.7) {
          availability = 'AVAILABLE';
        } else if (availabilityRandom < 0.95) {
          availability = 'BUSY';
        } else {
          availability = 'OFFLINE';
        }
        
        // Create driver location object
        const driverLocation: DriverLocation = {
          driverId,
          timestamp: new Date().toISOString(),
          latitude: newLat,
          longitude: newLng,
          heading,
          speed,
          availability,
          vehicleType: ['ECONOMY', 'COMFORT', 'PREMIUM'][Math.floor(Math.random() * 3)] as any,
          batteryLevel: Math.random() * 100, // 0-100%
        };
        
        // Emit as data event
        const event: DataEvent = {
          source: 'driver-location-service',
          timestamp: new Date(driverLocation.timestamp),
          payload: driverLocation,
        };
        
        this.eventStream.next(event);
      });
    }, this.mockIntervalMs);
  }

  /**
   * Establish a WebSocket connection
   * @private
   */
  private establishWebSocketConnection(): void {
    // In a real implementation, this would establish a WebSocket connection
    // For now, we'll just simulate it
    console.log('Establishing WebSocket connection to:', this.wsUrl);
  }

  /**
   * Send a heartbeat to keep the connection alive
   * @private
   */
  private sendHeartbeat(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'heartbeat' }));
    }
  }

  /**
   * Handle WebSocket messages
   * @private
   */
  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'driver_location') {
        const driverLocation = data.payload as DriverLocation;
        
        const dataEvent: DataEvent = {
          source: 'driver-location-service',
          timestamp: new Date(driverLocation.timestamp),
          payload: driverLocation,
        };
        
        this.eventStream.next(dataEvent);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }
} 