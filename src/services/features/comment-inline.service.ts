import { CommentApiStrategy } from '../../types/config.types.js';
import {
  InlineComment,
  ReplyInlineCommentRequest,
  UpdateInlineCommentRequest
} from '../../types/confluence.types.js';
import { BaseService } from '../base.service.js';
import { MarkdownUtils } from '../../utils/markdown.js';

/**
 * 行内评论服务类
 * 负责行内评论的CRUD操作
 */
export class InlineCommentService extends BaseService {

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

    // 行内评论通常是简短文本，不进行自动 markdown 处理
    const finalContent = content;

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
            pageId, finalContent, originalSelection, matchIndex, numMatches, parentCommentId
          );

        case CommentApiStrategy.TINYMCE:
          try {
            return await this.createInlineCommentWithCustomApi(
              pageId, finalContent, originalSelection, matchIndex, numMatches, serializedHighlights, parentCommentId
            );
          } catch (error: any) {
            if (this.commentConfig.enableFallback) {
              this.logger.warn('Custom API failed, falling back to standard API:', error.message);
              return await this.createInlineCommentWithStandardApi(
                pageId, finalContent, originalSelection, matchIndex, numMatches, parentCommentId
              );
            }
            throw error;
          }

        case CommentApiStrategy.AUTO:
        default:
          try {
            return await this.createInlineCommentWithCustomApi(
              pageId, finalContent, originalSelection, matchIndex, numMatches, serializedHighlights, parentCommentId
            );
          } catch (customError: any) {
            this.logger.warn('Custom API failed, falling back to standard API:', {
              error: customError.message,
              status: customError.response?.status
            });

            try {
              return await this.createInlineCommentWithStandardApi(
                pageId, finalContent, originalSelection, matchIndex, numMatches, parentCommentId
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
   * 更新行内评论
   */
  public async updateInlineComment(request: UpdateInlineCommentRequest): Promise<InlineComment> {
    const { commentId, content, version } = request;

    if (!commentId || !content) {
      throw new Error('Comment ID and content are required');
    }

    // 行内评论通常是简短文本，不进行自动 markdown 处理
    const finalContent = content;

    return this.retryOperation(async () => {
      this.logger.debug('Updating inline comment with strategy:', { 
        commentId, 
        content: content.substring(0, 50) + '...',
        strategy: this.commentConfig.apiStrategy 
      });

      switch (this.commentConfig.apiStrategy) {
        case CommentApiStrategy.STANDARD:
          return await this.updateInlineCommentWithStandardApi(commentId, finalContent, version);

        case CommentApiStrategy.TINYMCE:
          try {
            return await this.updateInlineCommentWithCustomApi(commentId, finalContent, version);
          } catch (error: any) {
            if (this.commentConfig.enableFallback) {
              this.logger.warn('Custom API failed, falling back to standard API:', error.message);
              return await this.updateInlineCommentWithStandardApi(commentId, finalContent, version);
            }
            throw error;
          }

        case CommentApiStrategy.AUTO:
        default:
          try {
            return await this.updateInlineCommentWithCustomApi(commentId, finalContent, version);
          } catch (customError: any) {
            this.logger.warn('Custom API failed, falling back to standard API:', {
              error: customError.message,
              status: customError.response?.status
            });

            try {
              return await this.updateInlineCommentWithStandardApi(commentId, finalContent, version);
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
   * 删除行内评论
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
   * 回复行内评论
   */
  public async replyInlineComment(request: ReplyInlineCommentRequest): Promise<InlineComment> {
    const { commentId, pageId, content } = request;

    if (!commentId || !pageId || !content) {
      throw new Error('Comment ID, page ID and content are required');
    }

    // 行内评论通常是简短文本，不进行自动 markdown 处理
    const finalContent = content;

    return this.retryOperation(async () => {
      this.logger.debug('Replying to inline comment with strategy:', { 
        commentId, 
        pageId, 
        content: finalContent.substring(0, 50) + '...',
        strategy: this.commentConfig.apiStrategy 
      });

      switch (this.commentConfig.apiStrategy) {
        case CommentApiStrategy.STANDARD:
          return await this.replyInlineCommentWithStandardApi(commentId, pageId, finalContent);

        case CommentApiStrategy.TINYMCE:
          try {
            return await this.replyInlineCommentWithCustomApi(commentId, pageId, finalContent);
          } catch (error: any) {
            if (this.commentConfig.enableFallback) {
              this.logger.warn('Custom API failed, falling back to standard API:', error.message);
              return await this.replyInlineCommentWithStandardApi(commentId, pageId, finalContent);
            }
            throw error;
          }

        case CommentApiStrategy.AUTO:
        default:
          try {
            return await this.replyInlineCommentWithCustomApi(commentId, pageId, finalContent);
          } catch (customError: any) {
            this.logger.warn('Custom API failed, falling back to standard API:', {
              error: customError.message,
              status: customError.response?.status
            });

            try {
              return await this.replyInlineCommentWithStandardApi(commentId, pageId, finalContent);
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

  // ========== 私有方法：API实现 ==========

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
} 