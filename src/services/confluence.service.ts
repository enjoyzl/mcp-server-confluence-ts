import { Logger, ILoggerService } from '../utils/logger.js';
import { 
  ConfluenceSpace, 
  ConfluencePage, 
  SearchResult,
  ErrorResponse,
  CreatePageRequest,
  UpdatePageRequest
} from '../types/confluence.types.js';
import { ConfluenceClient, ConfluenceClientConfig } from './confluence-client.js';

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

interface SearchOptions {
  limit?: number;
  start?: number;
  spaceKey?: string;
  type?: string;
}

/**
 * Confluence 服务类
 * 负责与 Confluence API 的所有交互
 */
export class ConfluenceService {
  private readonly client: ConfluenceClient;
  private readonly logger: ILoggerService;
  private readonly cache: Map<string, CacheItem<any>>;
  private readonly cacheTTL: number = 5 * 60 * 1000; // 5分钟缓存
  private readonly maxRetries: number = 3;

  constructor(config: ConfluenceClientConfig) {
    this.logger = Logger.getInstance();
    this.cache = new Map();
    this.client = new ConfluenceClient(config);
  }

  /**
   * 获取缓存的数据或执行操作
   */
  private async getCachedData<T>(
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
  private async retryOperation<T>(
    operation: () => Promise<T>,
    retries: number = this.maxRetries
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (retries > 0 && this.isRetryableError(error)) {
        this.logger.warn(`Retrying operation, ${retries} attempts remaining`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.retryOperation(operation, retries - 1);
      }
      throw error;
    }
  }

  /**
   * 判断是否可重试的错误
   */
  private isRetryableError(error: any): boolean {
    return (
      error.response?.status >= 500 ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT'
    );
  }

  /**
   * 获取 Confluence 空间信息
   */
  public async getSpace(spaceKey: string): Promise<ConfluenceSpace> {
    if (!spaceKey) {
      throw new Error('Space key is required');
    }

    return this.getCachedData(
      `space:${spaceKey}`,
      () => this.retryOperation(async () => {
        this.logger.debug('Getting space:', spaceKey);
        const response = await this.client.get(`/rest/api/space/${spaceKey}`);
        return response.data;
      })
    );
  }

  /**
   * 获取 Confluence 页面信息
   */
  public async getPage(pageId: string): Promise<ConfluencePage> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.getCachedData(
      `page:${pageId}`,
      () => this.retryOperation(async () => {
        this.logger.debug('Getting page:', pageId);
        const response = await this.client.get(`/rest/api/content/${pageId}`, {
          params: {
            expand: 'body.storage,version,space'
          }
        });
        return response.data;
      })
    );
  }

  /**
   * 通过 Pretty URL 格式获取页面
   */
  public async getPageByPrettyUrl(request: { spaceKey: string; title: string }): Promise<ConfluencePage> {
    const { spaceKey, title } = request;
    if (!spaceKey || !title) {
      throw new Error('Space key and title are required');
    }

    const cacheKey = `page:${spaceKey}:${title}`;
    return this.getCachedData(
      cacheKey,
      () => this.retryOperation(async () => {
        this.logger.debug('Getting page by Pretty URL:', { spaceKey, title });
        const searchResult = await this.searchContent(`type = page AND space = "${spaceKey}" AND title = "${title}"`);
        
        if (!searchResult.results || searchResult.results.length === 0) {
          throw new Error(`Page not found: /display/${spaceKey}/${title}`);
        }

        const pageId = searchResult.results[0].id;
        if (!pageId) {
          throw new Error(`Invalid search result for page: /display/${spaceKey}/${title}`);
        }

        return this.getPageContent(pageId);
      })
    );
  }

  /**
   * 批量获取页面信息
   */
  public async getPages(pageIds: string[]): Promise<ConfluencePage[]> {
    if (!pageIds.length) {
      throw new Error('At least one page ID is required');
    }
    return Promise.all(pageIds.map(id => this.getPage(id)));
  }

  /**
   * 搜索 Confluence 内容
   */
  public async searchContent(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    if (!query) {
      throw new Error('Search query is required');
    }

    const { limit = 100, start = 0, spaceKey, type } = options;
    let cql = query;

    if (spaceKey) {
      cql = `${cql} AND space = "${spaceKey}"`;
    }
    if (type) {
      cql = `${cql} AND type = "${type}"`;
    }

    return this.retryOperation(async () => {
      this.logger.debug('Searching content:', { cql, limit, start });
      const response = await this.client.get('/rest/api/content/search', {
        params: {
          cql,
          limit,
          start,
          expand: 'space,history,version'
        }
      });
      return response.data;
    });
  }

  /**
   * 获取页面详细内容
   */
  public async getPageContent(pageId: string): Promise<ConfluencePage> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.getCachedData(
      `page-content:${pageId}`,
      () => this.retryOperation(async () => {
        this.logger.debug('Getting page content:', pageId);
        const response = await this.client.get(`/rest/api/content/${pageId}`, {
          params: {
            expand: 'body.storage,version,space,history,metadata.labels'
          }
        });
        return response.data;
      })
    );
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

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.cache.clear();
    this.logger.debug('Cache cleared');
  }

  /**
   * 处理 API 错误
   */
  private handleError(error: any): never {
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
   * 创建 Confluence 页面
   */
  public async createPage(request: CreatePageRequest): Promise<ConfluencePage> {
    const { spaceKey, title, content, parentId, representation = 'storage' } = request;

    if (!spaceKey || !title || !content) {
      throw new Error('Space key, title and content are required');
    }

    return this.retryOperation(async () => {
      this.logger.debug('Creating page:', { spaceKey, title });
      
      const data = {
        type: 'page',
        title,
        space: { key: spaceKey },
        body: {
          [representation]: {
            value: content,
            representation
          }
        },
        ...(parentId && { ancestors: [{ id: parentId }] })
      };

      const response = await this.client.post('/rest/api/content', data);
      return response.data;
    });
  }

  /**
   * 更新 Confluence 页面
   */
  public async updatePage(request: UpdatePageRequest): Promise<ConfluencePage> {
    const { id, title, content, version, representation = 'storage' } = request;

    if (!id) {
      throw new Error('Page ID is required');
    }

    // 获取当前页面信息
    const currentPage = await this.getPage(id);
    const currentVersion = currentPage.version?.number || 1;

    return this.retryOperation(async () => {
      this.logger.debug('Updating page:', { id, title });

      const data = {
        type: 'page',
        title: title || currentPage.title,
        version: {
          number: version || currentVersion + 1
        },
        ...(content && {
          body: {
            [representation]: {
              value: content,
              representation
            }
          }
        })
      };

      const response = await this.client.put(`/rest/api/content/${id}`, data);
      
      // 清除缓存
      this.cache.delete(`page:${id}`);
      this.cache.delete(`page-content:${id}`);
      
      return response.data;
    });
  }
} 