import { EventEmitter } from 'events';
import { DataEvent } from '../schemas/DataModels';

/**
 * Base interface for all connectors
 */
export interface Connector extends EventEmitter {
  /**
   * Connect to the data source
   */
  connect(): Promise<void>;
  
  /**
   * Disconnect from the data source
   */
  disconnect(): Promise<void>;
  
  /**
   * Start processing data
   */
  start(): Promise<void>;
  
  /**
   * Stop processing data
   */
  stop(): Promise<void>;
  
  /**
   * Check if the connector is connected
   */
  isConnected(): boolean;
  
  /**
   * Get the name of the connector
   */
  getName(): string;
}

/**
 * Base class for all connectors
 */
export abstract class BaseConnector extends EventEmitter implements Connector {
  protected connected: boolean = false;
  protected name: string;
  
  /**
   * Initialize the connector
   * @param name The name of the connector
   */
  constructor(name: string) {
    super();
    this.name = name;
  }
  
  /**
   * Connect to the data source
   */
  abstract connect(): Promise<void>;
  
  /**
   * Disconnect from the data source
   */
  abstract disconnect(): Promise<void>;
  
  /**
   * Start processing data
   */
  abstract start(): Promise<void>;
  
  /**
   * Stop processing data
   */
  abstract stop(): Promise<void>;
  
  /**
   * Check if the connector is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
  
  /**
   * Get the name of the connector
   */
  getName(): string {
    return this.name;
  }
  
  /**
   * Emit a data event
   * @param event The data event to emit
   */
  protected emitData(event: DataEvent): void {
    this.emit('data', event);
  }
} 