import { ConfluenceConfig } from './confluence.types.js';

// 服务器配置
export interface ServerConfig {
  port: number;
  env: 'development' | 'production';
  timeout: number;
}

// 应用配置（扩展自 ConfluenceConfig）
export interface AppConfig extends ConfluenceConfig {
  server: ServerConfig;
}

// 环境配置（用于 .env 文件）
export interface EnvConfig {
  confluence: {
    url: string;
    username: string;
    password: string;
  };
  server: {
    port: number;
    env: 'development' | 'production';
    timeout: number;
  };
} 