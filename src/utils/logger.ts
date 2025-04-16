export class Logger {
  private static instance: Logger;
  private debugMode: boolean;
  private messageId: number = 0;
  private logToConsole: boolean;

  private constructor() {
    this.debugMode = process.env.NODE_ENV === 'development';
    // 默认在服务端输出日志，在浏览器端不输出
    this.logToConsole = typeof window === 'undefined';
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  // 设置是否输出到控制台
  setLogToConsole(enable: boolean) {
    this.logToConsole = enable;
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    this.messageId++;
    const logMessage = {
      jsonrpc: "2.0",
      method: "log",
      params: {
        level,
        message,
        args: args.length > 0 ? args : undefined,
        timestamp: new Date().toISOString()
      },
      id: this.messageId
    };

    return JSON.stringify(logMessage);
  }

  private log(level: string, message: string, ...args: any[]) {
    if (!this.logToConsole) return;

    const formattedMessage = this.formatMessage(level, message, ...args);
    switch (level) {
      case 'info':
        console.log(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
      case 'debug':
        if (this.debugMode) {
          console.debug(formattedMessage);
        }
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
    }
  }

  info(message: string, ...args: any[]) {
    this.log('info', message, ...args);
  }

  error(message: string, error?: any) {
    this.log('error', message, error);
  }

  debug(message: string, ...args: any[]) {
    this.log('debug', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log('warn', message, ...args);
  }
} 