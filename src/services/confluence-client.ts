import axios, { AxiosInstance, AxiosError } from 'axios';
import { Logger } from '../utils/logger.js';
import { 
  ConfluenceConfig, 
  ConfluenceSpace, 
  ConfluencePage, 
  SearchResult,
  ErrorResponse 
} from '../types/index.js';
import https from 'https';

const DEFAULT_TIMEOUT = 10000; // 默认超时时间（毫秒）
const DEFAULT_MAX_SOCKETS = 10; // 默认最大 socket 连接数
const DEFAULT_KEEP_ALIVE_MS = 60000; // 默认 keep-alive 时间（毫秒）
const DEFAULT_MAX_REDIRECTS = 5; // 默认最大重定向次数
const DEFAULT_MAX_BODY_LENGTH = 50 * 1024 * 1024; // 默认最大响应体大小（50MB）
const DEFAULT_MAX_CONTENT_LENGTH = 50 * 1024 * 1024; // 默认最大内容长度（50MB）

export class ConfluenceClient {
  private client: AxiosInstance;
  private logger: Logger;

  constructor(config: ConfluenceConfig) {
    this.logger = Logger.getInstance();
    
    // 验证必需的配置参数
    if (!config.baseUrl) {
      throw new Error('Confluence baseUrl is required');
    }
    if (!config.username) {
      throw new Error('Confluence username is required');
    }
    if (!config.password) {
      throw new Error('Confluence password is required');
    }
    
    // 确保 baseURL 使用 HTTPS 并移除尾随斜杠
    let baseURL = config.baseUrl.replace(/\/$/, '');
    if (!baseURL.startsWith('https://')) {
      baseURL = baseURL.replace('http://', 'https://');
    }
    
    const timeout = config.timeout || DEFAULT_TIMEOUT;
    
    this.logger.debug('Creating Confluence client with config:', {
      baseURL,
      username: config.username,
      timeout
    });

    // 创建 Basic Auth 头
    const authString = Buffer.from(`${config.username}:${config.password}`).toString('base64');

    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json;charset=utf-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Authorization': `Basic ${authString}`,
        'X-Atlassian-Token': 'no-check'
      },
      validateStatus: (status) => {
        return status >= 200 && status < 300;
      },
      // 禁用代理
      proxy: false,
      // 允许跨域
      withCredentials: true,
      // 限制重定向次数
      maxRedirects: DEFAULT_MAX_REDIRECTS,
      // 限制响应体大小
      maxBodyLength: DEFAULT_MAX_BODY_LENGTH,
      maxContentLength: DEFAULT_MAX_CONTENT_LENGTH,
      // 配置 HTTPS
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.rejectUnauthorized !== false, // 默认启用 SSL 验证
        keepAlive: true,
        keepAliveMsecs: DEFAULT_KEEP_ALIVE_MS,
        maxSockets: DEFAULT_MAX_SOCKETS
      })
    });

    // 添加请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        // 添加时间戳防止缓存
        if (config.params) {
          config.params._t = new Date().getTime();
        } else {
          config.params = { _t: new Date().getTime() };
        }

        // 定义日志配置类型
        interface SanitizedConfig {
          method: string | undefined;
          url: string | undefined;
          params: any;
          headers: {
            [key: string]: string | number | boolean | null | undefined;
          };
          auth?: {
            username: string;
            password: string;
          };
        }

        // 创建用于日志的配置副本，移除敏感信息
        const sanitizedConfig: SanitizedConfig = {
          method: config.method,
          url: config.url,
          params: config.params,
          headers: {
            ...config.headers as Record<string, string | number | boolean | null | undefined>,
            Authorization: '***HIDDEN***'
          }
        };

        // 如果存在认证信息，隐藏它
        if (config.auth) {
          sanitizedConfig.auth = {
            username: config.auth.username,
            password: '***HIDDEN***'
          };
        }

        this.logger.debug('Making request:', sanitizedConfig);
        return config;
      },
      (error) => {
        this.logger.error('Request error:', this.sanitizeError(error));
        return Promise.reject(error);
      }
    );

    // 添加响应拦截器
    this.client.interceptors.response.use(
      response => {
        // 创建用于日志的响应副本，移除敏感信息
        const sanitizedResponse = {
          status: response.status,
          statusText: response.statusText,
          headers: {
            ...response.headers,
            authorization: '***HIDDEN***'
          },
          data: response.data
        };

        this.logger.debug('Received response:', sanitizedResponse);
        return response;
      },
      (error: AxiosError) => this.handleError(error)
    );
  }

  private sanitizeError(error: any): any {
    if (!error) return error;
    
    const sanitized = { ...error };
    
    // 清理配置中的敏感信息
    if (sanitized.config) {
      sanitized.config = {
        ...sanitized.config,
        headers: {
          ...sanitized.config.headers,
          Authorization: '***HIDDEN***'
        }
      };
      
      if (sanitized.config.auth) {
        sanitized.config.auth = {
          username: sanitized.config.auth.username,
          password: '***HIDDEN***'
        };
      }
    }
    
    return sanitized;
  }

  private handleError(error: AxiosError): never {
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

    this.logger.error('Confluence API Error:', this.sanitizeError(response));
    throw response;
  }

  async getSpace(spaceKey: string): Promise<ConfluenceSpace> {
    this.logger.debug('Getting space:', spaceKey);
    const response = await this.client.get(`/rest/api/space/${spaceKey}`);
    return response.data;
  }

  async getPage(pageId: string): Promise<ConfluencePage> {
    this.logger.debug('Getting page:', pageId);
    const response = await this.client.get(`/rest/api/content/${pageId}`, {
      params: {
        expand: 'body.storage,version,space'
      }
    });
    return response.data;
  }

  async searchContent(query: string): Promise<SearchResult> {
    this.logger.debug('Searching content:', query);
    const response = await this.client.get('/rest/api/content/search', {
      params: {
        cql: query,
        limit: 100,
        expand: 'space,history,version'
      }
    });
    return response.data;
  }

  async getPageContent(pageId: string): Promise<ConfluencePage> {
    this.logger.debug('Getting page content:', pageId);
    const response = await this.client.get(`/rest/api/content/${pageId}`, {
      params: {
        expand: 'body.storage,version,space,history,metadata.labels'
      }
    });
    return response.data;
  }
} 