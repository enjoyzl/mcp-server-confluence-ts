import { ConfluenceConfig } from './confluence.types.js';

// 评论API实现策略
export enum CommentApiStrategy {
  /** 使用TinyMCE端点 (功能更丰富，模拟浏览器行为) */
  TINYMCE = 'tinymce',
  /** 使用标准REST API (兼容性好，适合Confluence 7.4+) */
  STANDARD = 'standard',
  /** 自动选择 (优先TinyMCE，失败时回退到标准API) */
  AUTO = 'auto'
}

// 评论配置
export interface CommentConfig {
  /** 评论API实现策略 */
  apiStrategy: CommentApiStrategy;
  /** 是否启用回退机制 */
  enableFallback: boolean;
  /** 请求超时时间 (毫秒) */
  timeout: number;
}

// 服务器配置
export interface ServerConfig {
  port: number;
  env: 'development' | 'production';
  timeout: number;
}

// 应用配置（扩展自 ConfluenceConfig）
export interface AppConfig extends ConfluenceConfig {
  server: ServerConfig;
  comment: CommentConfig;
}

// 环境配置（用于 .env 文件）
export interface EnvConfig {
  confluence: {
    url: string;
    username?: string;
    password?: string;
    accessToken?: string;
  };
  server: {
    port: number;
    env: 'development' | 'production';
    timeout: number;
  };
  comment: {
    apiStrategy: string;
    enableFallback: boolean;
    timeout: number;
  };
} 