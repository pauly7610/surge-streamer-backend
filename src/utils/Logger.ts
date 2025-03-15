/**
 * Logger utility for consistent logging across the application
 */
export class Logger {
  private context: string;
  
  /**
   * Create a new logger
   * @param context The context for the logger (usually the class name)
   */
  constructor(context: string) {
    this.context = context;
  }
  
  /**
   * Log an info message
   * @param message The message to log
   * @param optionalParams Optional parameters to log
   */
  info(message: string, ...optionalParams: any[]): void {
    console.log(`[${this.getTimestamp()}] [${this.context}] [INFO] ${message}`, ...optionalParams);
  }
  
  /**
   * Log a debug message
   * @param message The message to log
   * @param optionalParams Optional parameters to log
   */
  debug(message: string, ...optionalParams: any[]): void {
    console.debug(`[${this.getTimestamp()}] [${this.context}] [DEBUG] ${message}`, ...optionalParams);
  }
  
  /**
   * Log a warning message
   * @param message The message to log
   * @param optionalParams Optional parameters to log
   */
  warn(message: string, ...optionalParams: any[]): void {
    console.warn(`[${this.getTimestamp()}] [${this.context}] [WARN] ${message}`, ...optionalParams);
  }
  
  /**
   * Log an error message
   * @param message The message to log
   * @param optionalParams Optional parameters to log
   */
  error(message: string, ...optionalParams: any[]): void {
    console.error(`[${this.getTimestamp()}] [${this.context}] [ERROR] ${message}`, ...optionalParams);
  }
  
  /**
   * Get the current timestamp
   * @returns The current timestamp in ISO format
   * @private
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }
  
  /**
   * Format a log message with timestamp and context
   * @param level The log level
   * @param message The message to log
   * @param meta Optional metadata to include
   * @returns Formatted log message
   */
  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    let formattedMessage = `[${timestamp}] [${level}] [${this.context}] ${message}`;
    
    if (meta) {
      if (meta instanceof Error) {
        formattedMessage += `\n${meta.stack || meta.message}`;
      } else if (typeof meta === 'object') {
        try {
          formattedMessage += `\n${JSON.stringify(meta, null, 2)}`;
        } catch (error) {
          formattedMessage += `\n[Object]`;
        }
      } else {
        formattedMessage += `\n${meta}`;
      }
    }
    
    return formattedMessage;
  }
  
  /**
   * Create a child logger with a sub-context
   * @param subContext The sub-context to append to the current context
   * @returns A new logger instance with the combined context
   */
  public createChildLogger(subContext: string): Logger {
    return new Logger(`${this.context}:${subContext}`);
  }
} 