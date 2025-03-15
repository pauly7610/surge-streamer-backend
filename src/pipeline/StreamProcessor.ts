import { Subject, Observable, Subscription } from 'rxjs';
import { filter, map, buffer, debounceTime, mergeMap } from 'rxjs/operators';
import { DataEvent } from '../connectors/DataSourceConnector';
import { KafkaService } from '../utils/KafkaService';
import config from '../config';

/**
 * Stream processor options
 */
export interface StreamProcessorOptions {
  batchSize?: number;
  batchIntervalMs?: number;
  enableKafka?: boolean;
  kafkaTopic?: string;
}

/**
 * Stream processor stage function
 */
export type ProcessorStage<T, R> = (data: T) => Promise<R>;

/**
 * Stream processor for handling data streams
 */
export class StreamProcessor<InputType = any, OutputType = any> {
  private inputStream: Subject<DataEvent>;
  private outputStream: Subject<DataEvent>;
  private subscription: Subscription | null = null;
  private processingStages: ProcessorStage<any, any>[] = [];
  private kafkaService: KafkaService | null = null;
  private isRunning: boolean = false;
  private processingErrors: Error[] = [];
  private processedCount: number = 0;
  private errorCount: number = 0;
  private startTime: number = 0;

  /**
   * Create a new stream processor
   * @param name The name of the processor
   * @param options The processor options
   */
  constructor(
    private readonly name: string,
    private readonly options: StreamProcessorOptions = {}
  ) {
    this.inputStream = new Subject<DataEvent>();
    this.outputStream = new Subject<DataEvent>();

    // Set default options
    this.options.batchSize = this.options.batchSize || config.pipeline.maxBatchSize;
    this.options.batchIntervalMs = this.options.batchIntervalMs || config.pipeline.intervalMs;

    // Initialize Kafka if enabled
    if (this.options.enableKafka && this.options.kafkaTopic) {
      this.initializeKafka();
    }
  }

  /**
   * Add a processing stage to the pipeline
   * @param stage The processing stage function
   * @returns The stream processor instance for chaining
   */
  addStage<T, R>(stage: ProcessorStage<T, R>): StreamProcessor<InputType, R> {
    this.processingStages.push(stage);
    return this as unknown as StreamProcessor<InputType, R>;
  }

  /**
   * Get the input stream
   * @returns The input stream
   */
  getInputStream(): Subject<DataEvent> {
    return this.inputStream;
  }

  /**
   * Get the output stream
   * @returns The output stream
   */
  getOutputStream(): Observable<DataEvent> {
    return this.outputStream.asObservable();
  }

  /**
   * Start the stream processor
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.startTime = Date.now();
    this.isRunning = true;
    this.processedCount = 0;
    this.errorCount = 0;
    this.processingErrors = [];

    // Create the processing pipeline
    const pipeline = this.inputStream.pipe(
      // Buffer events based on batch size or interval
      buffer(
        this.inputStream.pipe(
          debounceTime(this.options.batchIntervalMs!)
        )
      ),
      // Process each batch
      mergeMap(async (events) => {
        if (events.length === 0) {
          return [];
        }

        try {
          // Apply each processing stage to the events
          let processedData = events;
          
          for (const stage of this.processingStages) {
            // Process each event in the batch
            const results = await Promise.all(
              processedData.map(async (event) => {
                try {
                  const result = await stage(event.payload);
                  return {
                    ...event,
                    payload: result,
                    metadata: {
                      ...event.metadata,
                      processedBy: this.name,
                      processingTime: Date.now()
                    }
                  };
                } catch (error) {
                  this.errorCount++;
                  this.processingErrors.push(error as Error);
                  console.error(`Error processing event in ${this.name}:`, error);
                  return null;
                }
              })
            );

            // Filter out null results (errors)
            processedData = results.filter(Boolean) as DataEvent[];
          }

          this.processedCount += processedData.length;
          return processedData;
        } catch (error) {
          this.errorCount++;
          this.processingErrors.push(error as Error);
          console.error(`Error processing batch in ${this.name}:`, error);
          return [];
        }
      }),
      // Flatten the batches back into individual events
      mergeMap((events) => events)
    );

    // Subscribe to the pipeline and emit processed events
    this.subscription = pipeline.subscribe({
      next: (event) => {
        this.outputStream.next(event);

        // Send to Kafka if enabled
        if (this.kafkaService && this.options.kafkaTopic) {
          this.sendToKafka(event);
        }
      },
      error: (error) => {
        this.errorCount++;
        this.processingErrors.push(error);
        console.error(`Error in ${this.name} pipeline:`, error);
      }
    });

    console.log(`Started stream processor: ${this.name}`);
  }

  /**
   * Stop the stream processor
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }

    this.isRunning = false;
    console.log(`Stopped stream processor: ${this.name}`);
  }

  /**
   * Process a single event
   * @param event The event to process
   */
  async processEvent(event: DataEvent): Promise<void> {
    this.inputStream.next(event);
  }

  /**
   * Process a batch of events
   * @param events The events to process
   */
  async processBatch(events: DataEvent[]): Promise<void> {
    for (const event of events) {
      this.inputStream.next(event);
    }
  }

  /**
   * Get the processor metrics
   * @returns The processor metrics
   */
  getMetrics(): {
    name: string;
    isRunning: boolean;
    processedCount: number;
    errorCount: number;
    uptime: number;
    throughput: number;
    errorRate: number;
    lastErrors: string[];
  } {
    const uptime = this.isRunning ? Date.now() - this.startTime : 0;
    const uptimeSeconds = uptime / 1000;
    const throughput = uptimeSeconds > 0 ? this.processedCount / uptimeSeconds : 0;
    const errorRate = this.processedCount > 0 ? this.errorCount / this.processedCount : 0;

    return {
      name: this.name,
      isRunning: this.isRunning,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      uptime,
      throughput,
      errorRate,
      lastErrors: this.processingErrors.slice(-5).map(e => e.message)
    };
  }

  /**
   * Initialize Kafka
   * @private
   */
  private async initializeKafka(): Promise<void> {
    try {
      this.kafkaService = new KafkaService();
      await this.kafkaService.connect();
      
      if (this.options.kafkaTopic) {
        await this.kafkaService.createTopic(this.options.kafkaTopic);
      }
    } catch (error) {
      console.error(`Error initializing Kafka for ${this.name}:`, error);
      this.kafkaService = null;
    }
  }

  /**
   * Send an event to Kafka
   * @param event The event to send
   * @private
   */
  private async sendToKafka(event: DataEvent): Promise<void> {
    if (!this.kafkaService || !this.options.kafkaTopic) {
      return;
    }

    try {
      await this.kafkaService.sendMessage(
        this.options.kafkaTopic,
        {
          source: event.source,
          timestamp: event.timestamp.toISOString(),
          payload: event.payload,
          metadata: event.metadata
        }
      );
    } catch (error) {
      console.error(`Error sending event to Kafka topic ${this.options.kafkaTopic}:`, error);
    }
  }
} 