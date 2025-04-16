import { LogLevel, LogMessage } from '../types/logger.types.js';

/**
 * 日志服务接口
 */
export interface ILoggerService {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * 日志消息格式
 */
interface McpLogMessage {
  jsonrpc: "2.0";
  method: "log";
  params: {
    level: "debug" | "info" | "warn" | "error";
    message: string;
    args?: any[];
    timestamp: string;
  };
}

/**
 * 日志服务实现类
 */
class LoggerImpl implements ILoggerService {
  private static instance: LoggerImpl;
  private constructor() {}

  public static getInstance(): LoggerImpl {
    if (!LoggerImpl.instance) {
      LoggerImpl.instance = new LoggerImpl();
    }
    return LoggerImpl.instance;
  }

  /**
   * 创建日志消息
   */
  private createLogMessage(level: "debug" | "info" | "warn" | "error", message: string, args: any[] = []): string {
    const logMessage: McpLogMessage = {
      jsonrpc: "2.0",
      method: "log",
      params: {
        level,
        message,
        args: args.length > 0 ? args : undefined,
        timestamp: new Date().toISOString()
      }
    };
    return JSON.stringify(logMessage);
  }

  public debug(message: string, ...args: any[]): void {
    console.debug(this.createLogMessage("debug", message, args));
  }

  public info(message: string, ...args: any[]): void {
    console.info(this.createLogMessage("info", message, args));
  }

  public warn(message: string, ...args: any[]): void {
    console.warn(this.createLogMessage("warn", message, args));
  }

  public error(message: string, ...args: any[]): void {
    console.error(this.createLogMessage("error", message, args));
  }
}

// 导出单例实例
export const Logger = LoggerImpl; 