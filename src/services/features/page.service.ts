import { 
  ConfluencePage, 
  CreatePageRequest, 
  UpdatePageRequest
} from '../../types/confluence.types.js';
import { BaseService } from '../base.service.js';
import { SearchService } from './search.service.js';

/**
 * 页面服务类
 * 负责页面的CRUD操作
 */
export class PageService extends BaseService {
  private searchService: SearchService;

  constructor(config: any) {
    super(config);
    this.searchService = new SearchService(config);
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
        const searchResult = await this.searchService.searchContent(`type = page AND space = "${spaceKey}" AND title = "${title}"`);
        
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
} 