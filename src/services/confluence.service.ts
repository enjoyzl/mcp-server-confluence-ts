import { Logger, ILoggerService } from '../utils/logger.js';
import { 
  ConfluenceSpace, 
  ConfluencePage, 
  SearchResult,
  ErrorResponse,
  CreatePageRequest,
  UpdatePageRequest,
  ConfluenceComment,
  CommentSearchResult,
  CreateCommentRequest,
  UpdateCommentRequest,
  ReplyCommentRequest,
  InlineComment,
  CreateInlineCommentRequest,
  UpdateInlineCommentRequest,
  ReplyInlineCommentRequest
} from '../types/confluence.types.js';
import { CommentApiStrategy } from '../types/config.types.js';
import { ConfluenceClient, ConfluenceClientConfig } from './confluence-client.js';

/**
 * 评论配置接口
 */
interface CommentConfig {
  /** 评论API实现策略 */
  apiStrategy?: CommentApiStrategy;
  /** 是否启用回退机制 */
  enableFallback?: boolean;
  /** 请求超时时间 (毫秒) */
  timeout?: number;
}

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
  private readonly commentConfig: CommentConfig;

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
    
    this.logger.debug('ConfluenceService initialized with comment config:', this.commentConfig);
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
    options?: { maxRetries?: number; retryDelay?: number } | number
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
    
    // 构建 CQL 查询
    let cql = query;
    
    // 如果查询不包含 CQL 语法，则搜索文本内容
    if (!cql.includes('type') && !cql.includes('space') && !cql.includes('AND') && !cql.includes('OR')) {
      cql = `text ~ "${query.replace(/"/g, '\\"')}"`;
    }

    if (spaceKey) {
      cql = `${cql} AND space = "${spaceKey}"`;
    }
    if (type) {
      cql = `${cql} AND type = "${type}"`;
    }

    return this.retryOperation(async () => {
      this.logger.debug('Searching content:', { 
        originalQuery: query, 
        cql, 
        limit, 
        start,
        spaceKey,
        type
      });
      
      try {
      const response = await this.client.get('/rest/api/content/search', {
        params: {
          cql,
          limit,
          start,
          expand: 'space,history,version'
        }
      });
        
        this.logger.debug('Search successful:', {
          totalSize: response.data.size,
          resultsCount: response.data.results?.length || 0
        });
        
      return response.data;
      } catch (error: any) {
        this.logger.error('Search failed:', {
          originalQuery: query,
          cql,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        });
        
        // 如果是400错误且包含CQL语法错误，尝试简化查询
        if (error.response?.status === 400 && error.response?.data?.message?.includes('CQL')) {
          this.logger.warn('CQL syntax error, trying fallback search...');
          
          // 回退到基本文本搜索
          const fallbackCql = `text ~ "${query.replace(/"/g, '\\"')}"`;
          
          try {
            const fallbackResponse = await this.client.get('/rest/api/content/search', {
              params: {
                cql: fallbackCql,
                limit,
                start,
                expand: 'space,history,version'
              }
            });
            
            this.logger.debug('Fallback search successful');
            return fallbackResponse.data;
          } catch (fallbackError: any) {
            this.logger.error('Fallback search also failed:', fallbackError.response?.data);
            throw fallbackError;
          }
        }
        
        throw error;
      }
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

  /**
   * 删除 Confluence 页面
   */
  public async deletePage(pageId: string): Promise<void> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.retryOperation(async () => {
      this.logger.debug('Deleting page:', pageId);
      
      // 删除页面
      await this.client.delete(`/rest/api/content/${pageId}`);
      
      // 清除相关缓存
      this.cache.delete(`page:${pageId}`);
      this.cache.delete(`page-content:${pageId}`);
      
      this.logger.info('Page deleted successfully:', pageId);
    });
  }

  /**
   * 获取页面评论
   */
  public async getPageComments(
    pageId: string,
    options: { start?: number; limit?: number } = {}
  ): Promise<CommentSearchResult> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    const { start = 0, limit = 25 } = options;

    return this.retryOperation(async () => {
      this.logger.debug('Getting page comments:', { pageId, start, limit });
      const response = await this.client.get(`/rest/api/content/${pageId}/child/comment`, {
        params: {
          start,
          limit,
          expand: 'body.storage,version,history,container'
        }
      });
      return response.data;
    });
  }

  /**
   * 获取评论详细信息
   */
  public async getComment(commentId: string): Promise<ConfluenceComment> {
    if (!commentId) {
      throw new Error('Comment ID is required');
    }

    return this.getCachedData(
      `comment:${commentId}`,
      () => this.retryOperation(async () => {
        this.logger.debug('Getting comment:', commentId);
        const response = await this.client.get(`/rest/api/content/${commentId}`, {
          params: {
            expand: 'body.storage,version,history,container'
          }
        });
        return response.data;
      })
    );
  }

  /**
   * 获取XSRF Token
   */
  private async getXsrfToken(pageId?: string): Promise<string | null> {
    try {
      // 方法1: 尝试从登录页面获取token（不需要特定页面权限）
      let pageResponse;
      try {
        pageResponse = await this.client.get(`/login.action`, {
          timeout: 10000
        });
      } catch (loginError) {
        // 如果登录页面不可访问，尝试使用提供的页面ID
        if (pageId) {
          pageResponse = await this.client.get(`/pages/viewpage.action`, {
            params: { pageId },
            timeout: 10000
          });
        } else {
          throw loginError;
        }
      }
      
      const pageContent = pageResponse.data;
      
      // 从页面内容中提取XSRF token
      const tokenMatch = pageContent.match(/name="atl_token"\s+value="([^"]+)"/);
      if (tokenMatch) {
        this.logger.debug('XSRF token found via page content');
        return tokenMatch[1];
      }

      // 方法2: 尝试从meta标签获取
      const metaMatch = pageContent.match(/<meta\s+name="ajs-atl-token"\s+content="([^"]+)"/);
      if (metaMatch) {
        this.logger.debug('XSRF token found via meta tag');
        return metaMatch[1];
      }

      this.logger.warn('Could not find XSRF token in page content');
      return null;
    } catch (error: any) {
      this.logger.error('Failed to get XSRF token:', error.message);
      return null;
    }
  }

  // ========== 标准 REST API 实现 ==========

  /**
   * 使用标准REST API创建评论
   */
  private async createCommentWithStandardApi(
    pageId: string,
    content: string,
    representation: string = 'storage',
    parentCommentId?: string
  ): Promise<ConfluenceComment> {
    this.logger.debug('Creating comment with standard API:', { pageId, parentCommentId });

    const data = {
      type: 'comment',
      container: { id: pageId },
      body: {
        [representation]: {
          value: content,
          representation
        }
      },
      ...(parentCommentId && { ancestors: [{ id: parentCommentId }] })
    };

    const response = await this.client.post('/rest/api/content', data, {
      timeout: this.commentConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.logger.debug('Standard API comment creation succeeded:', response.data);
    return response.data;
  }

  /**
   * 使用标准REST API更新评论
   */
  private async updateCommentWithStandardApi(
    commentId: string,
    content: string,
    version: number,
    representation: string = 'storage'
  ): Promise<ConfluenceComment> {
    this.logger.debug('Updating comment with standard API:', { commentId, version });

    const data = {
      type: 'comment',
      version: { number: version },
      body: {
        [representation]: {
          value: content,
          representation
        }
      }
    };

    const response = await this.client.put(`/rest/api/content/${commentId}`, data, {
      timeout: this.commentConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.logger.debug('Standard API comment update succeeded:', response.data);
    return response.data;
  }

  /**
   * 使用标准REST API删除评论
   */
  private async deleteCommentWithStandardApi(commentId: string): Promise<void> {
    this.logger.debug('Deleting comment with standard API:', commentId);

    await this.client.delete(`/rest/api/content/${commentId}`, {
      timeout: this.commentConfig.timeout
    });

    this.logger.debug('Standard API comment deletion succeeded');
  }

  /**
   * 使用标准REST API回复评论
   */
  private async replyCommentWithStandardApi(
    pageId: string,
    parentCommentId: string,
    content: string,
    representation: string = 'storage'
  ): Promise<ConfluenceComment> {
    this.logger.debug('Replying to comment with standard API:', { pageId, parentCommentId });

    const data = {
      type: 'comment',
      container: { id: pageId },
      ancestors: [{ id: parentCommentId }],
      body: {
        [representation]: {
          value: content,
          representation
        }
      }
    };

    const response = await this.client.post('/rest/api/content', data, {
      timeout: this.commentConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.logger.debug('Standard API comment reply succeeded:', response.data);
    return response.data;
  }

  // ========== TinyMCE API 实现 ==========

  /**
   * 使用TinyMCE端点创建评论（Confluence 7.4优化版本）
   */
  private async createCommentWithTinyMCE(
    pageId: string, 
    content: string, 
    parentCommentId?: string
  ): Promise<any> {
    this.logger.debug('Creating comment with TinyMCE endpoint:', { pageId, parentCommentId });
    
    // 获取XSRF token
    const xsrfToken = await this.getXsrfToken(pageId);
    this.logger.debug('XSRF token obtained:', xsrfToken ? 'Yes' : 'No');
    
    // 生成UUID（模仿浏览器行为）
    const uuid = this.generateUUID();
    
    // 根据实际浏览器请求构造表单数据，确保UTF-8编码
    // 确保内容正确编码为UTF-8
    const htmlContent = `<p>${content}</p>`;
    
    // 使用手动构造表单数据来确保UTF-8编码
    const formParams: Record<string, string> = {
      html: htmlContent,
      watch: 'false',
      uuid: uuid,
      asyncRenderSafe: 'true',
      isInlineComment: 'false'
    };
    
    // 添加XSRF token（如果获取到）
    if (xsrfToken) {
      formParams.atl_token = xsrfToken;
    }
    
    // 如果是回复评论，添加父评论ID（尝试不同的字段名）
    if (parentCommentId) {
      formParams.parentId = parentCommentId;
      formParams.replyToComment = parentCommentId;
    }
    
    // 手动构造表单数据以确保正确的UTF-8编码
    const formDataString = Object.entries(formParams)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    const endpoint = `/rest/tinymce/1/content/${pageId}/comment`;
    const params = { actions: true };

    // 记录表单数据，但避免记录敏感的token信息
    this.logger.debug('TinyMCE form data:', {
      html: htmlContent,
      watch: 'false',
      uuid: uuid,
      hasToken: !!xsrfToken,
      parentCommentId
    });
    
    try {
      const response = await this.client.post(endpoint, formDataString, { 
        params,
        timeout: 15000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
          'Accept': 'application/json; charset=utf-8',
          'Accept-Charset': 'utf-8',
          'X-Atlassian-Token': 'no-check', // 绕过XSRF检查
          ...(xsrfToken && { 'X-XSRF-Token': xsrfToken }) // 同时提供token
        }
      });
      
      this.logger.debug('TinyMCE request succeeded:', response.data);
      return response.data;
      
    } catch (error: any) {
      this.logger.error('TinyMCE request failed:', {
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
        formData: formDataString
      });
      throw error;
    }
  }

  /**
   * 生成UUID（模仿浏览器生成的UUID格式）
   * 基于实际观察到的格式：c19dc906-70a3-330f-6222-e842fb767266
   */
  private generateUUID(): string {
    // 生成8-4-4-4-12格式的UUID，确保第3段第1位是4，第4段第1位是8/9/a/b
    const hex = '0123456789abcdef';
    let uuid = '';
    
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        uuid += '-';
      } else if (i === 14) {
        uuid += '4'; // 版本号
      } else if (i === 19) {
        uuid += hex[(Math.random() * 4 | 0) + 8]; // 8, 9, a, 或 b
      } else {
        uuid += hex[Math.random() * 16 | 0];
      }
    }
    
    return uuid;
  }

  /**
   * 创建评论
   */
  public async createComment(
    pageId: string, 
    content: string, 
    representation: string = 'storage',
    parentCommentId?: string
  ): Promise<ConfluenceComment> {
    return this.retryOperation(async () => {
      this.logger.debug('Creating comment with strategy:', { 
        pageId, 
        parentCommentId, 
        strategy: this.commentConfig.apiStrategy 
      });

      switch (this.commentConfig.apiStrategy) {
        case CommentApiStrategy.STANDARD:
          return await this.createCommentWithStandardApi(pageId, content, representation, parentCommentId);

        case CommentApiStrategy.TINYMCE:
          try {
        const tinyMceResult = await this.createCommentWithTinyMCE(pageId, content, parentCommentId);
            return this.convertTinyMceToStandardFormat(tinyMceResult);
          } catch (error: any) {
            if (this.commentConfig.enableFallback) {
              this.logger.warn('TinyMCE failed, falling back to standard API:', error.message);
              return await this.createCommentWithStandardApi(pageId, content, representation, parentCommentId);
            }
            throw error;
          }

        case CommentApiStrategy.AUTO:
        default:
          try {
            // 优先使用TinyMCE端点（浏览器实际使用的方式）
            this.logger.debug('Attempting TinyMCE endpoint first');
            const tinyMceResult = await this.createCommentWithTinyMCE(pageId, content, parentCommentId);
            return this.convertTinyMceToStandardFormat(tinyMceResult);
      } catch (tinyMceError: any) {
        this.logger.warn('TinyMCE endpoint failed, falling back to standard API:', {
          error: tinyMceError.message,
          status: tinyMceError.response?.status
        });

            try {
              return await this.createCommentWithStandardApi(pageId, content, representation, parentCommentId);
        } catch (apiError: any) {
          this.logger.error('Both comment creation methods failed:', {
            tinyMceError: tinyMceError.message,
            apiError: apiError.message
          });

          // 提供更友好的错误信息
          if (apiError.response?.status === 403 || tinyMceError.response?.status === 403) {
            throw new Error('Permission denied: You do not have permission to comment on this page');
          } else if (apiError.response?.status === 404) {
            throw new Error('Page not found: The specified page does not exist');
          } else if (apiError.message.includes('timeout')) {
            throw new Error('Comment creation timeout. The server may be busy, please try again later.');
          }

          throw new Error(`Comment creation failed: ${apiError.message || tinyMceError.message}. Please try again later or contact administrator.`);
            }
        }
      }
    }, {
      maxRetries: this.commentConfig.apiStrategy === CommentApiStrategy.STANDARD ? 2 : 1,
      retryDelay: 1000
    });
  }

  /**
   * 将TinyMCE结果转换为标准格式
   */
  private convertTinyMceToStandardFormat(tinyMceResult: any): ConfluenceComment {
    return {
      id: tinyMceResult.id.toString(),
      type: 'comment',
      status: 'current',
      title: `Comment ${tinyMceResult.id}`,
      body: {
        storage: {
          value: tinyMceResult.html,
          representation: 'storage'
        }
      },
      version: {
        number: 1,
        by: {
          username: tinyMceResult.authorUserName || 'unknown',
          displayName: tinyMceResult.authorDisplayName || 'Unknown User'
        },
        when: tinyMceResult.created || new Date().toISOString(),
        message: 'Created comment'
      },
      history: {
        latest: true,
        createdBy: {
          username: tinyMceResult.authorUserName || 'unknown',
          displayName: tinyMceResult.authorDisplayName || 'Unknown User'
        },
        createdDate: tinyMceResult.created || new Date().toISOString()
      },
      _links: {
        webui: `/display/space/pageid?focusedCommentId=${tinyMceResult.id}`,
        self: `/rest/api/content/${tinyMceResult.id}`
      }
    } as ConfluenceComment;
  }

  /**
   * 更新评论
   */
  public async updateComment(request: UpdateCommentRequest): Promise<ConfluenceComment> {
    const { id, content, version, representation = 'storage' } = request;

    if (!id || !content) {
      throw new Error('Comment ID and content are required');
    }

    return this.retryOperation(async () => {
      this.logger.debug('Updating comment with strategy:', { 
        id, 
        strategy: this.commentConfig.apiStrategy 
      });

      let currentVersion = version;
      
      // 如果没有提供版本号或版本号为0，自动获取当前版本并递增
      if (currentVersion === undefined || currentVersion === null || currentVersion === 0) {
        try {
          this.logger.debug('自动获取评论版本:', { id });
          const currentComment = await this.getComment(id);
          currentVersion = currentComment.version.number + 1;
          this.logger.debug('自动递增版本号:', { from: currentComment.version.number, to: currentVersion });
        } catch (error: any) {
          this.logger.error('获取评论版本失败:', error.message);
          throw new Error(`无法获取评论版本: ${error.message}`);
        }
      } else {
        this.logger.debug('使用用户提供的版本号:', { version: currentVersion });
      }

      // 对于更新评论，主要使用标准API，因为TinyMCE端点不支持更新
      try {
        const result = await this.updateCommentWithStandardApi(id, content, currentVersion, representation);
      
      // 清除缓存
      this.cache.delete(`comment:${id}`);
      
        this.logger.debug('评论更新成功:', { id, newVersion: result.version?.number });
        return result;
      } catch (error: any) {
        this.logger.error('Comment update failed:', {
          id,
          version: currentVersion,
          error: error.message,
          status: error.response?.status
        });

        // 提供更友好的错误信息
        if (error.response?.status === 403) {
          throw new Error('Permission denied: You do not have permission to update this comment');
        } else if (error.response?.status === 404) {
          throw new Error('Comment not found: The specified comment does not exist');
        } else if (error.response?.status === 409) {
          throw new Error('Version conflict: The comment has been modified by another user. Please refresh and try again.');
        }

        throw new Error(`Comment update failed: ${error.message}. Please try again later or contact administrator.`);
      }
    });
  }

  /**
   * 删除评论
   */
  public async deleteComment(commentId: string): Promise<void> {
    if (!commentId) {
      throw new Error('Comment ID is required');
    }

    return this.retryOperation(async () => {
      this.logger.debug('Deleting comment with strategy:', { 
        commentId, 
        strategy: this.commentConfig.apiStrategy 
      });

      try {
        // 删除评论主要使用标准API，因为更稳定
        await this.deleteCommentWithStandardApi(commentId);
      
      // 清除缓存
      this.cache.delete(`comment:${commentId}`);
        
        this.logger.debug('Comment deleted successfully:', commentId);
      } catch (error: any) {
        this.logger.error('Comment deletion failed:', {
          commentId,
          error: error.message,
          status: error.response?.status
        });

        // 提供更友好的错误信息
        if (error.response?.status === 403) {
          throw new Error('Permission denied: You do not have permission to delete this comment');
        } else if (error.response?.status === 404) {
          throw new Error('Comment not found: The specified comment does not exist or has already been deleted');
        }

        throw new Error(`Comment deletion failed: ${error.message}. Please try again later or contact administrator.`);
      }
    });
  }

  /**
   * 搜索评论
   */
  public async searchComments(
    query: string,
    options: { start?: number; limit?: number; spaceKey?: string } = {}
  ): Promise<CommentSearchResult> {
    if (!query) {
      throw new Error('Search query is required');
    }

    const { start = 0, limit = 25, spaceKey } = options;
    let cql = `type = comment AND ${query}`;

    if (spaceKey) {
      cql = `${cql} AND space = "${spaceKey}"`;
    }

    return this.retryOperation(async () => {
      this.logger.debug('Searching comments:', { cql, start, limit });
      const response = await this.client.get('/rest/api/content/search', {
        params: {
          cql,
          start,
          limit,
          expand: 'body.storage,version,history,container'
        }
      });
      return response.data;
    });
  }

  // ========== 行内评论功能 ==========

  /**
   * 创建行内评论 - 支持多种API策略
   */
  public async createInlineComment(
    pageId: string,
    content: string,
    originalSelection: string,
    matchIndex?: number,
    numMatches?: number,
    serializedHighlights?: string,
    parentCommentId?: string
  ): Promise<InlineComment> {
    if (!pageId || !content || !originalSelection) {
      throw new Error('Page ID, content and original selection are required');
    }

    return this.retryOperation(async () => {
      this.logger.debug('Creating inline comment with strategy:', { 
        pageId, 
        originalSelection, 
        matchIndex,
        strategy: this.commentConfig.apiStrategy 
      });

      switch (this.commentConfig.apiStrategy) {
        case CommentApiStrategy.STANDARD:
          return await this.createInlineCommentWithStandardApi(
            pageId, content, originalSelection, matchIndex, numMatches, parentCommentId
          );

        case CommentApiStrategy.TINYMCE:
          try {
            return await this.createInlineCommentWithCustomApi(
              pageId, content, originalSelection, matchIndex, numMatches, serializedHighlights, parentCommentId
            );
          } catch (error: any) {
            if (this.commentConfig.enableFallback) {
              this.logger.warn('Custom API failed, falling back to standard API:', error.message);
              return await this.createInlineCommentWithStandardApi(
                pageId, content, originalSelection, matchIndex, numMatches, parentCommentId
              );
            }
            throw error;
          }

        case CommentApiStrategy.AUTO:
        default:
          try {
            // 优先使用自定义端点
            return await this.createInlineCommentWithCustomApi(
              pageId, content, originalSelection, matchIndex, numMatches, serializedHighlights, parentCommentId
            );
          } catch (customError: any) {
            this.logger.warn('Custom API failed, falling back to standard API:', {
              error: customError.message,
              status: customError.response?.status
            });

            try {
              return await this.createInlineCommentWithStandardApi(
                pageId, content, originalSelection, matchIndex, numMatches, parentCommentId
              );
            } catch (apiError: any) {
              this.logger.error('Both APIs failed for inline comment creation:', {
                customError: customError.message,
                apiError: apiError.message
              });
              throw new Error(`Failed to create inline comment: ${apiError.message}`);
            }
          }
      }
    }, {
      maxRetries: 2,
      retryDelay: 1000
    });
  }

  /**
   * 使用标准API创建行内评论
   */
  private async createInlineCommentWithStandardApi(
    pageId: string,
    content: string,
    originalSelection: string,
    matchIndex?: number,
    numMatches?: number,
    parentCommentId?: string
  ): Promise<InlineComment> {
    const requestData = {
      pageId: pageId,
      parentCommentId: parentCommentId || undefined,
      body: {
        representation: 'storage',
        value: `<p>${content}</p>`
      },
      inlineCommentProperties: {
        textSelection: originalSelection,
        textSelectionMatchIndex: matchIndex || 0,
        textSelectionMatchCount: numMatches || 1
      }
    };

    const response = await this.client.post('/wiki/api/v2/inline-comments', requestData, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json; charset=utf-8'
      }
    });

    this.logger.debug('Inline comment created successfully with standard API:', response.data);
    return response.data;
  }

  /**
   * 使用自定义API创建行内评论
   */
  private async createInlineCommentWithCustomApi(
    pageId: string,
    content: string,
    originalSelection: string,
    matchIndex?: number,
    numMatches?: number,
    serializedHighlights?: string,
    parentCommentId?: string
  ): Promise<InlineComment> {
    const requestData = {
      originalSelection,
      body: `<p>${content}</p>`,
      matchIndex: matchIndex || 0,
      numMatches: numMatches || 1,
      serializedHighlights: serializedHighlights || JSON.stringify([]),
      containerId: pageId,
      parentCommentId: parentCommentId || '0',
      lastFetchTime: new Date().getTime(),
      hasDeletePermission: true,
      hasEditPermission: true,
      hasResolvePermission: true,
      resolveProperties: {},
      deleted: false
    };

    const response = await this.client.post('/rest/inlinecomments/1.0/comments', requestData, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json; charset=utf-8'
      }
    });

    this.logger.debug('Inline comment created successfully with custom API:', response.data);
    return response.data;
  }

  /**
   * 更新行内评论 - 支持多种API策略
   */
  public async updateInlineComment(request: UpdateInlineCommentRequest): Promise<InlineComment> {
    const { commentId, content, version } = request;

    if (!commentId || !content) {
      throw new Error('Comment ID and content are required');
    }

    return this.retryOperation(async () => {
      this.logger.debug('Updating inline comment with strategy:', { 
        commentId, 
        content: content.substring(0, 50) + '...',
        strategy: this.commentConfig.apiStrategy 
      });

      switch (this.commentConfig.apiStrategy) {
        case CommentApiStrategy.STANDARD:
          return await this.updateInlineCommentWithStandardApi(commentId, content, version);

        case CommentApiStrategy.TINYMCE:
          try {
            return await this.updateInlineCommentWithCustomApi(commentId, content, version);
          } catch (error: any) {
            if (this.commentConfig.enableFallback) {
              this.logger.warn('Custom API failed, falling back to standard API:', error.message);
              return await this.updateInlineCommentWithStandardApi(commentId, content, version);
            }
            throw error;
          }

        case CommentApiStrategy.AUTO:
        default:
          try {
            // 优先使用自定义端点
            return await this.updateInlineCommentWithCustomApi(commentId, content, version);
          } catch (customError: any) {
            this.logger.warn('Custom API failed, falling back to standard API:', {
              error: customError.message,
              status: customError.response?.status
            });

            try {
              return await this.updateInlineCommentWithStandardApi(commentId, content, version);
            } catch (apiError: any) {
              this.logger.error('Both APIs failed for inline comment update:', {
                customError: customError.message,
                apiError: apiError.message
              });
              throw new Error(`Failed to update inline comment: ${apiError.message}`);
            }
          }
      }
    }, {
      maxRetries: 2,
      retryDelay: 1000
    });
  }

  /**
   * 使用标准API更新行内评论
   */
  private async updateInlineCommentWithStandardApi(
    commentId: string,
    content: string,
    version?: number
  ): Promise<InlineComment> {
    const requestData = {
      version: {
        number: version || 1,
        message: `Update inline comment ${commentId}`
      },
      body: {
        representation: 'storage',
        value: `<p>${content}</p>`
      }
    };

    const response = await this.client.put(`/wiki/api/v2/inline-comments/${commentId}`, requestData, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json; charset=utf-8'
      }
    });

    this.logger.debug('Inline comment updated successfully with standard API:', response.data);
    return response.data;
  }

  /**
   * 使用自定义API更新行内评论
   */
  private async updateInlineCommentWithCustomApi(
    commentId: string,
    content: string,
    version?: number
  ): Promise<InlineComment> {
    const requestData = {
      body: `<p>${content}</p>`,
      version: version || 1
    };

    const response = await this.client.put(`/rest/inlinecomments/1.0/comments/${commentId}`, requestData, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json; charset=utf-8'
      }
    });

    this.logger.debug('Inline comment updated successfully with custom API:', response.data);
    return response.data;
  }

  /**
   * 删除行内评论 - 支持多种API策略
   */
  public async deleteInlineComment(commentId: string): Promise<void> {
    if (!commentId) {
      throw new Error('Comment ID is required');
    }

    return this.retryOperation(async () => {
      this.logger.debug('Deleting inline comment with strategy:', { 
        commentId,
        strategy: this.commentConfig.apiStrategy 
      });

      switch (this.commentConfig.apiStrategy) {
        case CommentApiStrategy.STANDARD:
          return await this.deleteInlineCommentWithStandardApi(commentId);

        case CommentApiStrategy.TINYMCE:
          try {
            return await this.deleteInlineCommentWithCustomApi(commentId);
          } catch (error: any) {
            if (this.commentConfig.enableFallback) {
              this.logger.warn('Custom API failed, falling back to standard API:', error.message);
              return await this.deleteInlineCommentWithStandardApi(commentId);
            }
            throw error;
          }

        case CommentApiStrategy.AUTO:
        default:
          try {
            // 优先使用自定义端点
            return await this.deleteInlineCommentWithCustomApi(commentId);
          } catch (customError: any) {
            this.logger.warn('Custom API failed, falling back to standard API:', {
              error: customError.message,
              status: customError.response?.status
            });

            try {
              return await this.deleteInlineCommentWithStandardApi(commentId);
            } catch (apiError: any) {
              this.logger.error('Both APIs failed for inline comment deletion:', {
                customError: customError.message,
                apiError: apiError.message
              });
              throw new Error(`Failed to delete inline comment: ${apiError.message}`);
            }
          }
      }
    }, {
      maxRetries: 2,
      retryDelay: 1000
    });
  }

  /**
   * 使用标准API删除行内评论
   */
  private async deleteInlineCommentWithStandardApi(commentId: string): Promise<void> {
    await this.client.delete(`/wiki/api/v2/inline-comments/${commentId}`);
    this.logger.debug('Inline comment deleted successfully with standard API');
  }

  /**
   * 使用自定义API删除行内评论
   */
  private async deleteInlineCommentWithCustomApi(commentId: string): Promise<void> {
    await this.client.delete(`/rest/inlinecomments/1.0/comments/${commentId}`);
    this.logger.debug('Inline comment deleted successfully with custom API');
  }

  /**
   * 回复行内评论 - 支持多种API策略
   */
  public async replyInlineComment(request: ReplyInlineCommentRequest): Promise<InlineComment> {
    const { commentId, pageId, content } = request;

    if (!commentId || !pageId || !content) {
      throw new Error('Comment ID, page ID and content are required');
    }

    return this.retryOperation(async () => {
      this.logger.debug('Replying to inline comment with strategy:', { 
        commentId, 
        pageId, 
        content: content.substring(0, 50) + '...',
        strategy: this.commentConfig.apiStrategy 
      });

      switch (this.commentConfig.apiStrategy) {
        case CommentApiStrategy.STANDARD:
          return await this.replyInlineCommentWithStandardApi(commentId, pageId, content);

        case CommentApiStrategy.TINYMCE:
          try {
            return await this.replyInlineCommentWithCustomApi(commentId, pageId, content);
          } catch (error: any) {
            if (this.commentConfig.enableFallback) {
              this.logger.warn('Custom API failed, falling back to standard API:', error.message);
              return await this.replyInlineCommentWithStandardApi(commentId, pageId, content);
            }
            throw error;
          }

        case CommentApiStrategy.AUTO:
        default:
          try {
            // 优先使用自定义端点
            return await this.replyInlineCommentWithCustomApi(commentId, pageId, content);
          } catch (customError: any) {
            this.logger.warn('Custom API failed, falling back to standard API:', {
              error: customError.message,
              status: customError.response?.status
            });

            try {
              return await this.replyInlineCommentWithStandardApi(commentId, pageId, content);
            } catch (apiError: any) {
              this.logger.error('Both APIs failed for inline comment reply:', {
                customError: customError.message,
                apiError: apiError.message
              });
              throw new Error(`Failed to reply to inline comment: ${apiError.message}`);
            }
          }
      }
    }, {
      maxRetries: 2,
      retryDelay: 1000
    });
  }

  /**
   * 使用标准API回复行内评论
   */
  private async replyInlineCommentWithStandardApi(
    commentId: string,
    pageId: string,
    content: string
  ): Promise<InlineComment> {
    const requestData = {
      pageId: pageId,
      parentCommentId: commentId,
      body: {
        representation: 'storage',
        value: `<p>${content}</p>`
      }
    };

    const response = await this.client.post('/wiki/api/v2/inline-comments', requestData, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json; charset=utf-8'
      }
    });

    this.logger.debug('Inline comment reply created successfully with standard API:', response.data);
    return response.data;
  }

  /**
   * 使用自定义API回复行内评论
   */
  private async replyInlineCommentWithCustomApi(
    commentId: string,
    pageId: string,
    content: string
  ): Promise<InlineComment> {
    const requestData = {
      body: `<p>${content}</p>`,
      containerId: pageId,
      parentCommentId: commentId
    };

    const response = await this.client.post('/rest/inlinecomments/1.0/comments', requestData, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json; charset=utf-8'
      }
    });

    this.logger.debug('Inline comment reply created successfully with custom API:', response.data);
    return response.data;
  }

  /**
   * 回复普通评论
   */
  public async replyComment(request: ReplyCommentRequest): Promise<ConfluenceComment> {
    const { pageId, parentCommentId, content, watch = false } = request;

    if (!pageId || !parentCommentId || !content) {
      throw new Error('Page ID, parent comment ID and content are required');
    }

    return this.retryOperation(async () => {
      this.logger.debug('Replying to comment with strategy:', { 
        pageId, 
        parentCommentId, 
        content: content.substring(0, 50) + '...',
        strategy: this.commentConfig.apiStrategy 
      });

      switch (this.commentConfig.apiStrategy) {
        case CommentApiStrategy.STANDARD:
          return await this.replyCommentWithStandardApi(pageId, parentCommentId, content);

        case CommentApiStrategy.TINYMCE:
          try {
            const tinyMceResult = await this.replyCommentWithTinyMCE(pageId, parentCommentId, content, watch);
            return tinyMceResult;
          } catch (error: any) {
            if (this.commentConfig.enableFallback) {
              this.logger.warn('TinyMCE reply failed, falling back to standard API:', error.message);
              return await this.replyCommentWithStandardApi(pageId, parentCommentId, content);
            }
            throw error;
          }

        case CommentApiStrategy.AUTO:
        default:
          try {
            // 优先使用TinyMCE端点
            const tinyMceResult = await this.replyCommentWithTinyMCE(pageId, parentCommentId, content, watch);
            return tinyMceResult;
          } catch (tinyMceError: any) {
            this.logger.warn('TinyMCE reply failed, falling back to standard API:', {
              error: tinyMceError.message,
              status: tinyMceError.response?.status
            });

            try {
              return await this.replyCommentWithStandardApi(pageId, parentCommentId, content);
            } catch (apiError: any) {
              this.logger.error('Both reply methods failed:', {
                tinyMceError: tinyMceError.message,
                apiError: apiError.message
              });

              // 提供更友好的错误信息
              if (apiError.response?.status === 403 || tinyMceError.response?.status === 403) {
                throw new Error('Permission denied: You do not have permission to reply to comments on this page');
              } else if (apiError.response?.status === 404 || tinyMceError.response?.status === 404) {
                throw new Error('Comment not found: The parent comment or page does not exist');
              }

              throw new Error(`Reply comment failed: ${apiError.message || tinyMceError.message}. Please try again later or contact administrator.`);
            }
          }
      }
    }, {
      maxRetries: this.commentConfig.apiStrategy === CommentApiStrategy.STANDARD ? 2 : 1,
      retryDelay: 1000
    });
  }

  /**
   * 使用TinyMCE API回复评论
   */
  private async replyCommentWithTinyMCE(
    pageId: string,
    parentCommentId: string,
    content: string,
    watch: boolean = false
  ): Promise<ConfluenceComment> {
      // 获取XSRF token
      const xsrfToken = await this.getXsrfToken(pageId);
      this.logger.debug('XSRF token obtained for reply:', xsrfToken ? 'Yes' : 'No');

      // 生成UUID（模仿浏览器行为）
      const uuid = this.generateUUID();

      // 构造HTML内容
      const htmlContent = `<p>${content}</p>`;

      // 根据用户提供的API格式构造表单数据
      const formParams: Record<string, string> = {
        html: htmlContent,
        watch: watch.toString(),
        uuid: uuid
      };

      // 添加XSRF token（如果获取到）
      if (xsrfToken) {
        formParams.atl_token = xsrfToken;
      }

      // 手动构造表单数据以确保正确的UTF-8编码
      const formDataString = Object.entries(formParams)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

      // 使用用户提供的API端点格式
      const endpoint = `/rest/tinymce/1/content/${pageId}/comments/${parentCommentId}/comment`;
      const params = { actions: true };

        const response = await this.client.post(endpoint, formDataString, {
          params,
      timeout: this.commentConfig.timeout,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
            'Accept': 'application/json; charset=utf-8',
            'Accept-Charset': 'utf-8',
            'X-Atlassian-Token': 'no-check', // 绕过XSRF检查
            ...(xsrfToken && { 'X-XSRF-Token': xsrfToken }) // 同时提供token
          }
        });

    this.logger.debug('TinyMCE reply request succeeded:', response.data);

        // TinyMCE端点返回的数据格式与标准API不同，需要转换
        return {
          id: response.data.id.toString(),
          type: 'comment',
          status: 'current',
          title: `Re: Comment ${parentCommentId}`,
          body: {
            storage: {
              value: response.data.html || htmlContent,
              representation: 'storage'
            }
          },
          version: {
            number: 1,
            by: {
              username: response.data.authorUserName || 'unknown',
              displayName: response.data.authorDisplayName || 'Unknown User'
            },
            when: response.data.created || new Date().toISOString(),
            message: 'Reply to comment'
          },
          history: {
            latest: true,
            createdBy: {
              username: response.data.authorUserName || 'unknown',
              displayName: response.data.authorDisplayName || 'Unknown User'
            },
            createdDate: response.data.created || new Date().toISOString()
          },
          container: {
            id: pageId,
            type: 'page',
            title: 'Page'
          },
          _links: {
            webui: `/display/space/pageid?focusedCommentId=${response.data.id}`,
            self: `/rest/api/content/${response.data.id}`
          }
        } as ConfluenceComment;
  }
}