import { 
  ConfluenceComment,
  CommentSearchResult,
  UpdateCommentRequest,
  ReplyCommentRequest
} from '../../types/confluence.types.js';
import { CommentApiStrategy } from '../../types/config.types.js';
import { BaseService } from '../base.service.js';

/**
 * 评论服务类
 * 负责普通评论的CRUD操作
 */
export class CommentService extends BaseService {

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

              if (apiError.response?.status === 403 || tinyMceError.response?.status === 403) {
                throw new Error('Permission denied: You do not have permission to comment on this page');
              } else if (apiError.response?.status === 404) {
                throw new Error('Page not found: The specified page does not exist');
              }

              throw new Error(`Comment creation failed: ${apiError.message || tinyMceError.message}.`);
            }
          }
      }
    }, {
      maxRetries: this.commentConfig.apiStrategy === CommentApiStrategy.STANDARD ? 2 : 1,
      retryDelay: 1000
    });
  }

  // ========== 私有方法：标准API实现 ==========

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
   * 使用TinyMCE端点创建评论
   */
  private async createCommentWithTinyMCE(
    pageId: string, 
    content: string, 
    parentCommentId?: string
  ): Promise<any> {
    this.logger.debug('Creating comment with TinyMCE endpoint:', { pageId, parentCommentId });
    
    const htmlContent = `<p>${content}</p>`;
    const uuid = this.generateUUID();
    
    const formParams: Record<string, string> = {
      html: htmlContent,
      watch: 'false',
      uuid: uuid,
      asyncRenderSafe: 'true',
      isInlineComment: 'false'
    };
    
    if (parentCommentId) {
      formParams.parentId = parentCommentId;
      formParams.replyToComment = parentCommentId;
    }
    
    const formDataString = Object.entries(formParams)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    const endpoint = `/rest/tinymce/1/content/${pageId}/comment`;
    const params = { actions: true };

    const response = await this.client.post(endpoint, formDataString, { 
      params,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'Accept': 'application/json; charset=utf-8',
        'X-Atlassian-Token': 'no-check'
      }
    });
    
    this.logger.debug('TinyMCE request succeeded:', response.data);
    return response.data;
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
      this.logger.debug('Updating comment:', { id });

      let currentVersion = version;
      
      // 如果没有提供版本号，自动获取当前版本并递增
      if (currentVersion === undefined || currentVersion === null || currentVersion === 0) {
        try {
          const currentComment = await this.getComment(id);
          currentVersion = currentComment.version.number + 1;
        } catch (error: any) {
          throw new Error(`无法获取评论版本: ${error.message}`);
        }
      }

      const result = await this.updateCommentWithStandardApi(id, content, currentVersion, representation);
      
      // 清除缓存
      this.cache.delete(`comment:${id}`);
      
      return result;
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

      await this.deleteCommentWithStandardApi(commentId);
      
      // 清除缓存
      this.cache.delete(`comment:${commentId}`);
    });
  }

  /**
   * 回复评论
   */
  public async replyComment(request: ReplyCommentRequest): Promise<ConfluenceComment> {
    const { pageId, parentCommentId, content, watch = false } = request;

    if (!pageId || !parentCommentId || !content) {
      throw new Error('Page ID, parent comment ID and content are required');
    }

    return this.retryOperation(async () => {
      this.logger.debug('Replying to comment:', { pageId, parentCommentId });

      switch (this.commentConfig.apiStrategy) {
        case CommentApiStrategy.STANDARD:
          return await this.replyCommentWithStandardApi(pageId, parentCommentId, content);

        case CommentApiStrategy.TINYMCE:
          try {
            return await this.replyCommentWithTinyMCE(pageId, parentCommentId, content, watch);
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
            return await this.replyCommentWithTinyMCE(pageId, parentCommentId, content, watch);
          } catch (tinyMceError: any) {
            this.logger.warn('TinyMCE reply failed, falling back to standard API:', tinyMceError.message);
            return await this.replyCommentWithStandardApi(pageId, parentCommentId, content);
          }
      }
    });
  }

  // ========== 私有方法：标准API实现 ==========

  /**
   * 使用标准REST API更新评论
   */
  private async updateCommentWithStandardApi(
    commentId: string,
    content: string,
    version: number,
    representation: string = 'storage'
  ): Promise<ConfluenceComment> {
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

    return response.data;
  }

  /**
   * 使用标准REST API删除评论
   */
  private async deleteCommentWithStandardApi(commentId: string): Promise<void> {
    await this.client.delete(`/rest/api/content/${commentId}`, {
      timeout: this.commentConfig.timeout
    });
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

    return response.data;
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
    const htmlContent = `<p>${content}</p>`;
    const uuid = this.generateUUID();

    const formParams: Record<string, string> = {
      html: htmlContent,
      watch: watch.toString(),
      uuid: uuid
    };

    const formDataString = Object.entries(formParams)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    const endpoint = `/rest/tinymce/1/content/${pageId}/comments/${parentCommentId}/comment`;
    const params = { actions: true };

    const response = await this.client.post(endpoint, formDataString, {
      params,
      timeout: this.commentConfig.timeout,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'Accept': 'application/json; charset=utf-8',
        'X-Atlassian-Token': 'no-check'
      }
    });

    // 转换为标准格式
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

  /**
   * 生成UUID
   */
  private generateUUID(): string {
    const hex = '0123456789abcdef';
    let uuid = '';
    
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        uuid += '-';
      } else if (i === 14) {
        uuid += '4';
      } else if (i === 19) {
        uuid += hex[(Math.random() * 4 | 0) + 8];
      } else {
        uuid += hex[Math.random() * 16 | 0];
      }
    }
    
    return uuid;
  }
} 