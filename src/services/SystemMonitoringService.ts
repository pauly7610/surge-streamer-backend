import { PubSub } from 'graphql-subscriptions';
import { PipelineManager } from '../pipeline/PipelineManager';
import { Logger } from '../utils/Logger';
import config from '../config';

/**
 * Interface for connector status
 */
interface ConnectorStatus {
  name: string;
  status: string;
  lastUpdated: string;
  message: string | null;
}

/**
 * Interface for system health
 */
interface SystemHealth {
  status: string;
  uptime: number;
  connectorStatus: ConnectorStatus[];
  lastUpdated: string;
}

/**
 * Service for monitoring system health
 */
export class SystemMonitoringService {
  private logger: Logger;
  private pipelineManager: PipelineManager;
  private pubsub: PubSub;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime: number;
  private isMonitoring: boolean = false;

  /**
   * Initialize the system monitoring service
   * @param pipelineManager Pipeline manager
   * @param pubsub PubSub instance for publishing updates
   */
  constructor(pipelineManager: PipelineManager, pubsub?: PubSub) {
    this.logger = new Logger('SystemMonitoringService');
    this.pipelineManager = pipelineManager;
    this.pubsub = pubsub || new PubSub();
    this.startTime = Date.now();
  }

  /**
   * Start monitoring the system
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      this.logger.warn('System monitoring is already active');
      return;
    }

    this.logger.info('Starting system monitoring');
    this.isMonitoring = true;

    // Immediately get system health
    this.checkSystemHealth();

    // Set up monitoring interval
    this.monitoringInterval = setInterval(() => {
      this.checkSystemHealth();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop monitoring the system
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      this.logger.warn('System monitoring is not active');
      return;
    }

    this.logger.info('Stopping system monitoring');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
  }

  /**
   * Check system health and publish updates
   */
  private async checkSystemHealth(): Promise<void> {
    try {
      const health = await this.getSystemHealth();
      
      // Publish system health update
      this.pubsub.publish('SYSTEM_HEALTH_UPDATED', {
        systemHealthUpdated: health
      });
    } catch (error) {
      this.logger.error('Failed to check system health:', error);
    }
  }

  /**
   * Get current system health
   * @returns System health information
   */
  async getSystemHealth(): Promise<SystemHealth> {
    // Get pipeline status
    const isPipelineActive = this.pipelineManager.isActive();
    
    // Get connector status
    const connectorStatus = await this.getConnectorStatus();
    
    // Calculate uptime in seconds
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    
    // Determine overall status
    const status = this.determineOverallStatus(connectorStatus, isPipelineActive);
    
    return {
      status,
      uptime,
      connectorStatus,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get status of all connectors
   * @returns Array of connector status
   * @private
   */
  private async getConnectorStatus(): Promise<ConnectorStatus[]> {
    const connectors = this.pipelineManager.getConnectors();
    
    return connectors.map(connector => ({
      name: connector.constructor.name,
      status: connector.isConnected() ? 'CONNECTED' : 'DISCONNECTED',
      lastUpdated: new Date().toISOString(),
      message: null
    }));
  }

  /**
   * Determine overall system status based on connector status and pipeline status
   * @param connectorStatus Status of all connectors
   * @param isPipelineActive Whether the pipeline is active
   * @returns Overall system status
   * @private
   */
  private determineOverallStatus(connectorStatus: ConnectorStatus[], isPipelineActive: boolean): string {
    // If pipeline is not active, system is in STANDBY mode
    if (!isPipelineActive) {
      return 'STANDBY';
    }
    
    // If any connector is disconnected, system is in WARNING mode
    const hasDisconnectedConnector = connectorStatus.some(
      connector => connector.status === 'DISCONNECTED'
    );
    
    if (hasDisconnectedConnector) {
      return 'WARNING';
    }
    
    // Otherwise, system is HEALTHY
    return 'HEALTHY';
  }
} 