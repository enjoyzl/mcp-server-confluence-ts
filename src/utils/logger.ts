import { LogLevel, LogMessage } from '../types/logger.types.js';

/**
 * 日志服务接口
 */
export interface ILoggerService {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  setLogLevel(level: LogLevel): void;
  getLogLevel(): LogLevel;
  demonstrateStreams(): void;
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
 * 日志级别权重映射
 */
const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3
};

/**
 * 日志服务实现类
 */
class LoggerImpl implements ILoggerService {
  private static instance: LoggerImpl;
  private static instanceCount: number = 0;
  private currentLogLevel: LogLevel;
  private readonly instanceId: string;

  private constructor() {
    LoggerImpl.instanceCount++;
    this.instanceId = Math.random().toString(36).substring(2, 8);
    
    // 从环境变量读取日志级别，默认为INFO
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();
    this.currentLogLevel = this.parseLogLevel(envLogLevel) || LogLevel.INFO;
    
    // 如果是开发环境或设置了DEBUG环境变量，则启用DEBUG级别
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      this.currentLogLevel = LogLevel.DEBUG;
    }
    
    // 输出初始化信息，不受级别限制
    this.outputLog("info", `Logger[${this.instanceId}] initialized with level: ${this.currentLogLevel} (total instances: ${LoggerImpl.instanceCount})`);
  }

  public static getInstance(): LoggerImpl {
    if (!LoggerImpl.instance) {
      LoggerImpl.instance = new LoggerImpl();
    } else {
      // 输出重复调用信息
      process.stderr.write(`{"jsonrpc":"2.0","method":"log","params":{"level":"debug","message":"[SINGLETON] Logger.getInstance() called, returning existing instance [${LoggerImpl.instance.instanceId}]","timestamp":"${new Date().toISOString()}"}}\n`);
    }
    return LoggerImpl.instance;
  }

  /**
   * 解析日志级别字符串
   */
  private parseLogLevel(level?: string): LogLevel | null {
    if (!level) return null;
    
    switch (level) {
      case 'DEBUG': return LogLevel.DEBUG;
      case 'INFO': return LogLevel.INFO;
      case 'WARN': return LogLevel.WARN;
      case 'ERROR': return LogLevel.ERROR;
      default: return null;
    }
  }

  /**
   * 检查是否应该输出指定级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_WEIGHTS[level] >= LOG_LEVEL_WEIGHTS[this.currentLogLevel];
  }

  /**
   * 设置日志级别
   */
  public setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
    this.outputLog("info", `Logger[${this.instanceId}] level changed to: ${level}`);
  }

  /**
   * 获取当前日志级别
   */
  public getLogLevel(): LogLevel {
    return this.currentLogLevel;
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
        message: `[${this.instanceId}] ${message}`,
        args: args.length > 0 ? args : undefined,
        timestamp: new Date().toISOString()
      }
    };
    return JSON.stringify(logMessage);
  }

  /**
   * 统一输出日志到stderr和console，确保MCP客户端能够捕获且方便开发调试
   */
  private outputLog(level: "debug" | "info" | "warn" | "error", message: string, args: any[] = []): void {
    const logString = this.createLogMessage(level, message, args);
    
    // 输出到stderr，供MCP客户端捕获
    process.stderr.write(logString + '\n');
    
    // 同时输出到console，保持JSON格式便于调试
    switch (level) {
      case "debug":
        console.debug(logString);
        break;
      case "info":
        console.info(logString);
        break;
      case "warn":
        console.warn(logString);
        break;
      case "error":
        console.error(logString);
        break;
    }
  }

  public debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.outputLog("debug", message, args);
    }
  }

  public info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.outputLog("info", message, args);
    }
  }

  public warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.outputLog("warn", message, args);
    }
  }

  public error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.outputLog("error", message, args);
    }
  }

  /**
   * 演示stdout和stderr的区别
   */
  public demonstrateStreams(): void {
    // 输出到stdout（会污染MCP协议，不推荐）
    process.stdout.write("This goes to STDOUT - may interfere with MCP protocol\n");
    
    // 输出到stderr（MCP Logs会显示这个）
    process.stderr.write("This goes to STDERR - will appear in MCP Logs\n");
    
    // Console方法的默认行为
    console.log("console.log → stdout");     // 输出到stdout
    console.error("console.error → stderr"); // 输出到stderr
    console.info("console.info → stdout");   // 输出到stdout
    console.debug("console.debug → stderr"); // 输出到stderr
  }
}

// 导出单例实例
export const Logger = LoggerImpl; 