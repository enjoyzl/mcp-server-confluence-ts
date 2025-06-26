import dotenv from 'dotenv';
import { z } from 'zod';
import { Logger } from '../utils/logger.js';
import { AppConfig, ServerConfig, CommentConfig, CommentApiStrategy } from '../types/config.types.js';

// 加载环境变量
dotenv.config();

const logger = Logger.getInstance();

// 服务器配置模式
const serverSchema = z.object({
  port: z.number().int().positive().default(3000),
  env: z.enum(['development', 'production']).default('development'),
  timeout: z.number().int().positive().default(10000)
});

// 评论配置模式
const commentSchema = z.object({
  apiStrategy: z.enum(['tinymce', 'standard', 'auto']).default('standard'),
  enableFallback: z.boolean().default(true),
  timeout: z.number().int().positive().default(15000)
});

// 应用配置模式
const configSchema = z.object({
  baseUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
  accessToken: z.string().optional(),
  timeout: z.number().int().positive().optional(),
  rejectUnauthorized: z.boolean().optional(),
  server: serverSchema,
  comment: commentSchema
});

/**
 * 配置服务类
 * 负责加载和管理应用配置
 */
export class ConfigService {
  private static _instance: ConfigService;
  private readonly _config: AppConfig;

  private constructor() {
    this._config = this.createConfig();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService._instance) {
      ConfigService._instance = new ConfigService();
    }
    return ConfigService._instance;
  }

  /**
   * 获取完整的应用配置
   */
  public getConfig(): AppConfig {
    return this._config;
  }

  /**
   * 获取服务器配置
   */
  public getServerConfig(): ServerConfig {
    return this._config.server;
  }

  /**
   * 获取评论配置
   */
  public getCommentConfig(): CommentConfig {
    return this._config.comment;
  }

  /**
   * 创建配置实例
   */
  private createConfig(): AppConfig {
    try {
      const config = configSchema.parse({
        baseUrl: process.env.CONFLUENCE_URL,
        username: process.env.CONFLUENCE_USERNAME,
        password: process.env.CONFLUENCE_PASSWORD,
        accessToken: process.env.CONFLUENCE_ACCESS_TOKEN,
        timeout: process.env.TIMEOUT ? parseInt(process.env.TIMEOUT) : undefined,
        rejectUnauthorized: process.env.REJECT_UNAUTHORIZED !== 'false',
        server: {
          port: parseInt(process.env.PORT || '3000'),
          env: process.env.NODE_ENV as 'development' | 'production' || 'development',
          timeout: parseInt(process.env.SERVER_TIMEOUT || '10000')
        },
        comment: {
          apiStrategy: process.env.COMMENT_API_STRATEGY || 'standard',
          enableFallback: process.env.COMMENT_ENABLE_FALLBACK !== 'false',
          timeout: parseInt(process.env.COMMENT_TIMEOUT || '15000')
        }
      });

      // 验证认证信息
      if (!config.accessToken && (!config.username || !config.password)) {
        throw new Error('Either CONFLUENCE_ACCESS_TOKEN or both CONFLUENCE_USERNAME and CONFLUENCE_PASSWORD must be provided');
      }

      // 转换字符串策略为枚举
      const convertedConfig: AppConfig = {
        ...config,
        comment: {
          ...config.comment,
          apiStrategy: config.comment.apiStrategy as CommentApiStrategy
        }
      };

      logger.debug('Configuration loaded successfully');
      return convertedConfig;
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Configuration validation failed:', error.errors);
        throw new Error('Invalid configuration: ' + error.errors.map(e => e.message).join(', '));
      }
      throw error;
    }
  }
}

// 导出配置服务实例
export const configService = ConfigService.getInstance(); 