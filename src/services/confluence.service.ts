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
  InlineComment,
  CreateInlineCommentRequest,
  UpdateInlineCommentRequest
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
      this.logger.debug('Creating comment:', { pageId, parentCommentId });

      try {
        // 优先使用TinyMCE端点（浏览器实际使用的方式）
        this.logger.debug('Attempting TinyMCE endpoint first');
        const tinyMceResult = await this.createCommentWithTinyMCE(pageId, content, parentCommentId);
        
        // TinyMCE端点返回的数据格式与标准API不同，需要转换
        return {
          id: tinyMceResult.id.toString(),
          type: 'comment',
          body: {
            storage: {
              value: tinyMceResult.html,
              representation: 'storage'
            }
          },
          version: {
            number: 1
          }
        } as ConfluenceComment;
        
      } catch (tinyMceError: any) {
        this.logger.warn('TinyMCE endpoint failed, falling back to standard API:', {
          error: tinyMceError.message,
          status: tinyMceError.response?.status
        });

        // 备用方案：使用标准REST API
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

        try {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Comment creation timeout after 30 seconds')), 30000);
          });

          const createPromise = this.client.post('/rest/api/content', data);
          
          const response = await Promise.race([createPromise, timeoutPromise]) as any;
          return response.data;
          
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
    }, {
      maxRetries: 1, // TinyMCE端点通常更可靠，减少重试
      retryDelay: 1000
    });
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
      this.logger.debug('Updating comment:', { id });

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

      const data = {
        type: 'comment',
        version: {
          number: currentVersion
        },
        body: {
          [representation]: {
            value: content,
            representation
          }
        }
      };

      this.logger.debug('更新评论数据:', { id, version: currentVersion, content: content.substring(0, 50) + '...' });

      const response = await this.client.put(`/rest/api/content/${id}`, data);
      
      // 清除缓存
      this.cache.delete(`comment:${id}`);
      
      this.logger.debug('评论更新成功:', { id, newVersion: response.data.version?.number });
      return response.data;
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
      this.logger.debug('Deleting comment:', commentId);
      await this.client.delete(`/rest/api/content/${commentId}`);
      
      // 清除缓存
      this.cache.delete(`comment:${commentId}`);
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
   * 创建行内评论
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
      this.logger.debug('Creating inline comment:', { pageId, originalSelection, matchIndex });

      // 构造请求数据，按照API格式
      const data = {
        originalSelection,
        body: `<p>${content}</p>`,
        matchIndex: matchIndex || 0,
        numMatches: numMatches || 1,
        serializedHighlights: serializedHighlights || `[["${originalSelection}","123:1:0:0",0,${originalSelection.length}]]`,
        containerId: pageId,
        parentCommentId: parentCommentId || "0",
        lastFetchTime: Date.now().toString(),
        hasDeletePermission: true,
        hasEditPermission: true,
        hasResolvePermission: true,
        resolveProperties: {
          resolved: false,
          resolvedTime: 0
        },
        deleted: false
      };

      // 使用行内评论专用API端点
      const response = await this.client.post('/rest/inlinecomments/1.0/comments', data, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json; charset=utf-8',
          'Accept-Charset': 'utf-8'
        }
      });

      this.logger.debug('Inline comment created successfully:', response.data);
      return response.data;
    }, {
      maxRetries: 2,
      retryDelay: 1000
    });
  }

  /**
   * 更新行内评论
   * 注意：由于Confluence行内评论API限制，此功能暂时不可用
   * 建议删除原评论后重新创建新评论
   */
  public async updateInlineComment(request: UpdateInlineCommentRequest): Promise<InlineComment> {
    const { commentId, content } = request;

    throw new Error('行内评论更新功能暂时不可用。由于Confluence API限制，无法真正更新行内评论，只能创建新评论，这会导致重复评论问题。建议：1）删除原评论，2）创建新的行内评论。');
  }

  /**
   * 删除行内评论
   */
  public async deleteInlineComment(commentId: string): Promise<void> {
    if (!commentId) {
      throw new Error('Comment ID is required');
    }

    return this.retryOperation(async () => {
      this.logger.debug('Deleting inline comment:', commentId);
      await this.client.delete(`/rest/inlinecomments/1.0/comments/${commentId}`);
    });
  }
} 