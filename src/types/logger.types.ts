/**
 * 日志级别枚举
 */
export enum LogLevel {
  INFO = 'info',
  ERROR = 'error',
  DEBUG = 'debug',
  WARN = 'warn'
}

/**
 * 日志参数接口
 */
export interface LogParams {
  level: LogLevel;
  message: string;
  args?: any[];
  timestamp: string;
}

/**
 * 日志消息接口
 * 遵循 JSON-RPC 2.0 规范
 */
export interface LogMessage {
  jsonrpc: '2.0';
  method: 'log';
  params: LogParams;
  id: number;
} 