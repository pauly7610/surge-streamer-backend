import { Observable } from 'rxjs';

/**
 * Metadata for a data source connector
 */
export interface ConnectorMetadata {
  name: string;
  type: string;
  description: string;
  updateFrequency: string;
  lastConnected?: Date;
  status: 'connected' | 'disconnected' | 'error';
  error?: Error;
}

/**
 * Generic data event interface
 */
export interface DataEvent {
  source: string;
  timestamp: Date;
  payload: any;
  metadata?: Record<string, any>;
}

/**
 * Interface for all data source connectors
 */
export interface DataSourceConnector {
  /**
   * Connect to the data source
   */
  connect(): Promise<void>;
  
  /**
   * Disconnect from the data source
   */
  disconnect(): Promise<void>;
  
  /**
   * Check if the connector is connected
   */
  isConnected(): boolean;
  
  /**
   * Get the data stream from this connector
   */
  getStream(): Observable<DataEvent>;
  
  /**
   * Get metadata about this connector
   */
  getMetadata(): ConnectorMetadata;
} 