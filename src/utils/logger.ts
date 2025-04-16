export class Logger {
  private static instance: Logger;
  private debugMode: boolean;
  private messageId: number = 0;

  private constructor() {
    this.debugMode = process.env.NODE_ENV === 'development';
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    this.messageId++;
    return JSON.stringify({
      jsonrpc: "2.0",
      method: "log",
      params: {
        level,
        message,
        args: args.length > 0 ? args : undefined,
        timestamp: new Date().toISOString()
      },
      id: this.messageId
    });
  }

  info(message: string, ...args: any[]) {
    console.log(this.formatMessage('info', message, ...args));
  }

  error(message: string, error?: any) {
    console.error(this.formatMessage('error', message, error));
  }

  debug(message: string, ...args: any[]) {
    if (this.debugMode) {
      console.debug(this.formatMessage('debug', message, ...args));
    }
  }

  warn(message: string, ...args: any[]) {
    console.warn(this.formatMessage('warn', message, ...args));
  }
} 