import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import https from 'https';
import { Logger, ILoggerService } from '../utils/logger.js';

// 扩展 AxiosRequestConfig 类型以包含 metadata
declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    metadata?: {
      startTime: number;
    };
  }
}

export interface ConfluenceClientConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  accessToken?: string;
  timeout?: number;
  rejectUnauthorized?: boolean;
  maxRedirects?: number;
  maxContentLength?: number;
  keepAlive?: boolean;
}

/**
 * Confluence API 客户端类
 */
export class ConfluenceClient {
  private readonly axios: AxiosInstance;
  private readonly logger: ILoggerService;

  constructor(config: ConfluenceClientConfig) {
    this.logger = Logger.getInstance();
    
    let authHeader: string;
    if (config.accessToken) {
      authHeader = `Bearer ${config.accessToken}`;
    } else if (config.username && config.password) {
      authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
    } else {
      throw new Error('Either accessToken or username/password must be provided');
    }
    
    // 创建 HTTPS Agent 实例
    const httpsAgent = new https.Agent({
      rejectUnauthorized: config.rejectUnauthorized ?? true,
      keepAlive: config.keepAlive ?? true,
      keepAliveMsecs: 1000,
      maxSockets: 100,
      maxFreeSockets: 10,
      timeout: config.timeout || 10000
    });

    // 创建 Axios 实例
    this.axios = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 10000,
      maxRedirects: config.maxRedirects || 5,
      maxContentLength: config.maxContentLength || 10 * 1024 * 1024,
      httpsAgent,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json; charset=utf-8',
        'Accept-Charset': 'utf-8',
        'Connection': config.keepAlive ? 'keep-alive' : 'close'
      },
      decompress: true,
      validateStatus: (status) => status >= 200 && status < 300
    });

    // 请求拦截器
    this.axios.interceptors.request.use(
      (config) => {
        const startTime = Date.now();
        config.metadata = { startTime };
        
        this.logger.debug('Request:', {
          method: config.method,
          url: config.url,
          params: config.params,
          startTime: new Date(startTime).toISOString()
        });
        return config;
      },
      (error) => {
        this.logger.error('Request Error:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.axios.interceptors.response.use(
      (response) => {
        const startTime = response.config.metadata?.startTime;
        const duration = startTime ? Date.now() - startTime : 0;
        
        this.logger.debug('Response:', {
          status: response.status,
          statusText: response.statusText,
          duration: `${duration}ms`,
          size: response.headers['content-length'] || 0,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        const startTime = error.config?.metadata?.startTime;
        const duration = startTime ? Date.now() - startTime : 0;
        
        this.logger.error('Response Error:', {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          duration: `${duration}ms`,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axios.get<T>(url, config);
  }

  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axios.post<T>(url, data, config);
  }

  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axios.put<T>(url, data, config);
  }

  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axios.delete<T>(url, config);
  }
} 