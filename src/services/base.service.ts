import { Logger, ILoggerService } from '../utils/logger.js';
import { ErrorResponse } from '../types/confluence.types.js';
import { CommentApiStrategy } from '../types/config.types.js';
import { ConfluenceClient, ConfluenceClientConfig } from './confluence-client.js';

/**
 * 评论配置接口
 */
export interface CommentConfig {
  /** 评论API实现策略 */
  apiStrategy?: CommentApiStrategy;
  /** 是否启用回退机制 */
  enableFallback?: boolean;
  /** 请求超时时间 (毫秒) */
  timeout?: number;
}

/**
 * 缓存项接口
 */
export interface CacheItem<T> {
  data: T;
  timestamp: number;
}

/**
 * 搜索选项接口
 */
export interface SearchOptions {
  limit?: number;
  start?: number;
  spaceKey?: string;
  type?: string;
}

/**
 * 重试选项接口
 */
export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * 基础服务类
 * 提供通用功能：缓存、重试、错误处理等
 */
export abstract class BaseService {
  protected readonly client: ConfluenceClient;
  protected readonly logger: ILoggerService;
  protected readonly cache: Map<string, CacheItem<any>>;
  protected readonly cacheTTL: number = 5 * 60 * 1000; // 5分钟缓存
  protected readonly maxRetries: number = 3;
  protected readonly commentConfig: CommentConfig;

  constructor(config: ConfluenceClientConfig & { commentConfig?: CommentConfig }) {
    this.logger = Logger.getInstance();
    this.cache = new Map();
    this.client = new ConfluenceClient(config);
    
    // 评论配置默认值
    this.commentConfig = {
      apiStrategy: CommentApiStrategy.STANDARD,
      enableFallback: true,
      timeout: 15000,
      ...config.commentConfig
    };
    
    this.logger.debug(`${this.constructor.name} initialized with comment config:`, this.commentConfig);
  }

  /**
   * 获取缓存的数据或执行操作
   */
  protected async getCachedData<T>(
    key: string,
    operation: () => Promise<T>,
    ttl: number = this.cacheTTL
  ): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      this.logger.debug('Cache hit for key:', key);
      return cached.data;
    }

    const data = await operation();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * 重试操作
   */
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    options?: RetryOptions | number
  ): Promise<T> {
    // 向后兼容：如果options是数字，则视为maxRetries
    let maxRetries: number;
    let retryDelay: number;
    
    if (typeof options === 'number') {
      maxRetries = options;
      retryDelay = 1000;
    } else {
      maxRetries = options?.maxRetries ?? this.maxRetries;
      retryDelay = options?.retryDelay ?? 1000;
    }
    
    try {
      return await operation();
    } catch (error: any) {
      if (maxRetries > 0 && this.isRetryableError(error)) {
        this.logger.warn(`Retrying operation, ${maxRetries} attempts remaining`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.retryOperation(operation, { maxRetries: maxRetries - 1, retryDelay });
      }
      throw error;
    }
  }

  /**
   * 判断是否可重试的错误
   */
  protected isRetryableError(error: any): boolean {
    return (
      error.response?.status >= 500 ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT'
    );
  }

  /**
   * 处理 API 错误
   */
  protected handleError(error: any): never {
    const response: ErrorResponse = {
      statusCode: error.response?.status || 500,
      message: error.message,
      error: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        params: error.config?.params,
        headers: {
          ...error.response?.headers,
          Authorization: '***HIDDEN***'
        }
      }
    };

    this.logger.error('Confluence API Error:', response);
    throw response;
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.cache.clear();
    this.logger.debug('Cache cleared');
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/rest/api/space');
      return true;
    } catch (error) {
      this.logger.error('Confluence health check failed:', error);
      return false;
    }
  }
} 