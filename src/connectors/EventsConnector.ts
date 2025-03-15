import { Subject, Observable } from 'rxjs';
import axios, { AxiosInstance } from 'axios';
import { DataSourceConnector, DataEvent, ConnectorMetadata } from './DataSourceConnector';
import { EventData, EventVenue } from '../schemas/DataModels';
import config from '../config';
import * as GeospatialUtils from '../utils/GeospatialUtils';
import { EventEmitter } from 'events';
import { BaseConnector } from './Connector';
import { Logger } from '../utils/Logger';

/**
 * Event types for city events
 */
type EventType = 'CONCERT' | 'SPORTS' | 'FESTIVAL' | 'CONFERENCE' | 'PARADE' | 'OTHER';

/**
 * Connector for the Events API service
 */
export class EventsConnector implements DataSourceConnector {
  private apiClient: AxiosInstance;
  private eventStream: Subject<DataEvent>;
  private connected: boolean = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private venues: EventVenue[] = [];

  /**
   * Create a new Events API connector
   * @param apiUrl The Events API URL
   * @param apiKey The Events API key
   * @param refreshIntervalMs The refresh interval in milliseconds
   */
  constructor(
    private readonly apiUrl: string = config.dataSources.events.apiUrl,
    private readonly apiKey: string = config.dataSources.events.apiKey,
    private readonly refreshIntervalMs: number = config.dataSources.events.refreshIntervalMs || 3600000, // 1 hour
  ) {
    this.apiClient = axios.create({
      baseURL: apiUrl,
      timeout: 10000,
      headers: {
        'X-API-Key': apiKey,
      },
    });
    this.eventStream = new Subject<DataEvent>();

    // Initialize with mock venues (in a real implementation, these would be fetched from the API)
    this.initializeMockVenues();
  }

  /**
   * Connect to the Events API service
   */
  async connect(): Promise<void> {
    try {
      // Test the API connection
      await this.fetchEvents();
      
      // Start polling for events data
      this.startPolling();
      this.connected = true;
      console.log('Connected to Events API service');
    } catch (error) {
      console.error('Failed to connect to Events API service:', error);
      throw new Error('Connection failed');
    }
  }

  /**
   * Disconnect from the Events API service
   */
  async disconnect(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.connected = false;
    console.log('Disconnected from Events API service');
  }

  /**
   * Check if connected to the Events API service
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the stream of events data
   */
  getStream(): Observable<DataEvent> {
    return this.eventStream.asObservable();
  }

  /**
   * Get metadata about this connector
   */
  getMetadata(): ConnectorMetadata {
    return {
      name: 'Events API Service',
      type: 'REST API',
      description: 'Connects to the Events API service for city-wide events data',
      updateFrequency: `${this.refreshIntervalMs / 1000 / 60} minutes`,
      lastConnected: this.connected ? new Date() : undefined,
      status: this.connected ? 'connected' : 'disconnected',
    };
  }

  /**
   * Start polling for events data
   * @private
   */
  private startPolling(): void {
    // Immediately fetch data
    this.fetchEvents();

    // Set up polling interval
    this.pollingInterval = setInterval(() => {
      this.fetchEvents();
    }, this.refreshIntervalMs);
  }

  /**
   * Fetch events data for all venues
   * @private
   */
  private async fetchEvents(): Promise<void> {
    try {
      // In a real implementation, this would call the actual Events API
      // For now, we'll generate mock data for each venue
      
      // Get current date for reference
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Generate events for the next 7 days
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        
        // Generate 1-3 events per day across random venues
        const numEvents = Math.floor(Math.random() * 3) + 1;
        
        for (let j = 0; j < numEvents; j++) {
          // Select a random venue
          const venue = this.venues[Math.floor(Math.random() * this.venues.length)];
          
          // Generate mock event data
          const eventData = this.getMockEventData(venue, date);
          
          // Calculate H3 index for the venue location
          const h3Index = GeospatialUtils.GeospatialUtils.latLngToH3(venue.latitude, venue.longitude);
          
          // Create a data event
          const event: DataEvent = {
            source: 'events-api',
            timestamp: new Date(),
            payload: {
              ...eventData,
              h3Index,
            },
          };
          
          // Emit the event
          this.eventStream.next(event);
        }
      }
    } catch (error) {
      console.error('Error fetching events data:', error);
    }
  }

  /**
   * Get mock event data for a venue
   * @param venue Event venue
   * @param date Event date
   * @private
   */
  private getMockEventData(venue: EventVenue, date: Date): EventData {
    // Generate realistic mock event data
    
    // Determine event type based on venue type
    let eventType: EventType;
    switch (venue.type) {
      case 'STADIUM':
        eventType = Math.random() < 0.8 ? 'SPORTS' : 'CONCERT';
        break;
      case 'ARENA':
        eventType = Math.random() < 0.6 ? 'CONCERT' : 'SPORTS';
        break;
      case 'THEATER':
        eventType = 'CONCERT';
        break;
      case 'CONVENTION_CENTER':
        eventType = 'CONFERENCE';
        break;
      case 'PARK':
        eventType = Math.random() < 0.7 ? 'FESTIVAL' : 'PARADE';
        break;
      default:
        eventType = 'OTHER';
    }
    
    // Generate event name based on type
    let name = '';
    switch (eventType) {
      case 'CONCERT':
        const artists = ['Taylor Swift', 'Ed Sheeran', 'Beyoncé', 'BTS', 'The Weeknd', 'Billie Eilish', 'Adele', 'Justin Bieber', 'Lady Gaga', 'Coldplay'];
        name = `${artists[Math.floor(Math.random() * artists.length)]} Concert`;
        break;
      case 'SPORTS':
        const teams = ['Warriors', 'Giants', '49ers', 'Raiders', 'Athletics', 'Kings', 'Sharks', 'Earthquakes'];
        const opponents = ['Lakers', 'Dodgers', 'Seahawks', 'Broncos', 'Angels', 'Clippers', 'Ducks', 'Galaxy'];
        name = `${teams[Math.floor(Math.random() * teams.length)]} vs ${opponents[Math.floor(Math.random() * opponents.length)]}`;
        break;
      case 'FESTIVAL':
        const festivals = ['Music Festival', 'Food & Wine Festival', 'Film Festival', 'Arts Festival', 'Cultural Festival'];
        name = `SF ${festivals[Math.floor(Math.random() * festivals.length)]}`;
        break;
      case 'CONFERENCE':
        const conferences = ['Tech Conference', 'Medical Conference', 'Business Summit', 'Developer Conference', 'AI Summit'];
        name = `${conferences[Math.floor(Math.random() * conferences.length)]}`;
        break;
      case 'PARADE':
        const parades = ['Pride Parade', 'Chinese New Year Parade', 'St. Patrick\'s Day Parade', 'Veterans Day Parade'];
        name = `${parades[Math.floor(Math.random() * parades.length)]}`;
        break;
      default:
        name = 'Community Event';
    }
    
    // Set start and end times
    const startHour = 10 + Math.floor(Math.random() * 10); // Events between 10 AM and 7 PM
    const startTime = new Date(date);
    startTime.setHours(startHour, 0, 0, 0);
    
    const durationHours = 2 + Math.floor(Math.random() * 4); // 2-5 hours
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + durationHours);
    
    // Estimate attendance (as percentage of venue capacity)
    const attendancePercentage = 0.5 + Math.random() * 0.5; // 50-100%
    const estimatedAttendance = Math.floor(venue.capacity * attendancePercentage);
    
    // Generate a unique ID
    const id = `EVENT-${venue.id}-${date.toISOString().split('T')[0]}-${Math.floor(Math.random() * 1000)}`;
    
    // Create the event data object
    return {
      id,
      name,
      type: eventType,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      venue,
      estimatedAttendance,
      ticketsSold: Math.floor(estimatedAttendance * 0.9), // Assume 90% of attendance is from ticket sales
      isHighDemand: estimatedAttendance > venue.capacity * 0.8, // High demand if >80% capacity
      timestamp: new Date().toISOString(),
      location: {
        latitude: venue.latitude,
        longitude: venue.longitude,
      }
    };
  }

  /**
   * Initialize mock venues
   * @private
   */
  private initializeMockVenues(): void {
    // San Francisco area venues
    this.venues = [
      {
        id: 'CHASE-CENTER',
        name: 'Chase Center',
        latitude: 37.7680,
        longitude: -122.3877,
        capacity: 18064,
        type: 'ARENA',
      },
      {
        id: 'ORACLE-PARK',
        name: 'Oracle Park',
        latitude: 37.7786,
        longitude: -122.3893,
        capacity: 41915,
        type: 'STADIUM',
      },
      {
        id: 'BILL-GRAHAM',
        name: 'Bill Graham Civic Auditorium',
        latitude: 37.7785,
        longitude: -122.4177,
        capacity: 8500,
        type: 'THEATER',
      },
      {
        id: 'MOSCONE',
        name: 'Moscone Center',
        latitude: 37.7841,
        longitude: -122.4008,
        capacity: 20000,
        type: 'CONVENTION_CENTER',
      },
      {
        id: 'GOLDEN-GATE-PARK',
        name: 'Golden Gate Park',
        latitude: 37.7694,
        longitude: -122.4862,
        capacity: 100000,
        type: 'PARK',
      },
      {
        id: 'DOLORES-PARK',
        name: 'Dolores Park',
        latitude: 37.7596,
        longitude: -122.4269,
        capacity: 10000,
        type: 'PARK',
      },
      {
        id: 'WARFIELD',
        name: 'The Warfield',
        latitude: 37.7825,
        longitude: -122.4101,
        capacity: 2300,
        type: 'THEATER',
      },
      {
        id: 'FILLMORE',
        name: 'The Fillmore',
        latitude: 37.7842,
        longitude: -122.4332,
        capacity: 1150,
        type: 'THEATER',
      },
    ];
  }

  /**
   * Call the actual Events API (for real implementation)
   * @private
   */
  private async callEventsApi(): Promise<any> {
    try {
      const response = await this.apiClient.get('/events/upcoming');
      return response.data;
    } catch (error) {
      console.error('Error calling Events API:', error);
      throw error;
    }
  }

  /**
   * Process event data
   * @param event Event data
   * @returns Processed event data
   * @private
   */
  private processEventData(event: any): EventData {
    const venue = event.venue;
    
    // Get H3 index for the venue
    const h3Index = GeospatialUtils.GeospatialUtils.latLngToH3(venue.latitude, venue.longitude);
    
    // Create the processed event data
    return {
      id: event.id,
      name: event.name,
      type: event.type,
      startTime: event.startTime,
      endTime: event.endTime,
      venue: event.venue,
      estimatedAttendance: event.estimatedAttendance,
      ticketsSold: event.ticketsSold,
      isHighDemand: event.isHighDemand,
      timestamp: new Date().toISOString(),
      location: {
        latitude: venue.latitude,
        longitude: venue.longitude,
      },
      h3Index
    };
  }
} 