import {
  CommentSearchResult,
  ConfluenceComment,
  ConfluencePage,
  ConfluenceSpace,
  CreatePageRequest,
  InlineComment,
  ReplyCommentRequest,
  ReplyInlineCommentRequest,
  SearchResult,
  UpdateCommentRequest,
  UpdateInlineCommentRequest,
  UpdatePageRequest
} from '../types/confluence.types.js';
import {
  ExportPageOptions,
  ExportHierarchyOptions,
  BatchExportOptions,
  ExportResult
} from '../types/export.types.js';
import { CommentConfig } from './base.service.js';
import { ConfluenceClient, ConfluenceClientConfig } from './confluence-client.js';
import { CommentService } from './features/comment-basic.service.js';
import { SpaceService } from './features/space.service.js';
import { SearchService } from './features/search.service.js';
import { InlineCommentService } from './features/comment-inline.service.js';
import { PageService } from './features/page.service.js';
import { ExportService } from './features/export.service.js';

/**
 * Confluence 服务类（重构版）
 * 组合所有子服务，提供统一的接口
 */
export class ConfluenceService {
  private readonly spaceService: SpaceService;
  private readonly searchService: SearchService;
  private readonly pageService: PageService;
  private readonly commentService: CommentService;
  private readonly inlineCommentService: InlineCommentService;
  private readonly exportService: ExportService;

  constructor(config: ConfluenceClientConfig & { commentConfig?: CommentConfig }) {
    // 创建共享的HTTP客户端实例，避免重复的拦截器注册
    const sharedClient = new ConfluenceClient(config);
    
    // 修改配置，让所有子服务共享同一个客户端实例
    const serviceConfig = {
      ...config,
      sharedClient // 添加共享客户端
    };

    // 初始化所有子服务，使用共享的客户端
    this.spaceService = new SpaceService(serviceConfig);
    this.searchService = new SearchService(serviceConfig);
    this.pageService = new PageService(serviceConfig, this.searchService); // 传递共享的SearchService实例
    this.commentService = new CommentService(serviceConfig);
    this.inlineCommentService = new InlineCommentService(serviceConfig);
    this.exportService = new ExportService(serviceConfig);
  }

  // ===========================================
  // 1. 基础功能 - 委托给 SpaceService 和 SearchService
  // ===========================================

  /**
   * 获取 Confluence 空间信息
   */
  public async getSpace(spaceKey: string): Promise<ConfluenceSpace> {
    return this.spaceService.getSpace(spaceKey);
  }

  /**
   * 搜索 Confluence 内容
   */
  public async searchContent(
    query: string,
    options: { limit?: number; start?: number; spaceKey?: string; type?: string } = {}
  ): Promise<SearchResult> {
    return this.searchService.searchContent(query, options);
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<boolean> {
    return this.spaceService.healthCheck();
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.spaceService.clearCache();
    this.searchService.clearCache();
    this.pageService.clearCache();
    this.commentService.clearCache();
    this.inlineCommentService.clearCache();
    this.exportService.clearCache();
  }

  // ===========================================
  // 2. 页面管理 - 委托给 PageService
  // ===========================================

  /**
   * 获取 Confluence 页面信息
   */
  public async getPage(pageId: string): Promise<ConfluencePage> {
    return this.pageService.getPage(pageId);
  }

  /**
   * 通过 Pretty URL 格式获取页面
   */
  public async getPageByPrettyUrl(request: { spaceKey: string; title: string }): Promise<ConfluencePage> {
    return this.pageService.getPageByPrettyUrl(request);
  }

  /**
   * 批量获取页面信息
   */
  public async getPages(pageIds: string[]): Promise<ConfluencePage[]> {
    return this.pageService.getPages(pageIds);
  }

  /**
   * 获取页面详细内容
   */
  public async getPageContent(pageId: string): Promise<ConfluencePage> {
    return this.pageService.getPageContent(pageId);
  }

  /**
   * 创建 Confluence 页面
   */
  public async createPage(request: CreatePageRequest): Promise<ConfluencePage> {
    return this.pageService.createPage(request);
  }

  /**
   * 更新 Confluence 页面
   */
  public async updatePage(request: UpdatePageRequest): Promise<ConfluencePage> {
    return this.pageService.updatePage(request);
  }

  /**
   * 删除 Confluence 页面
   */
  public async deletePage(pageId: string): Promise<void> {
    return this.pageService.deletePage(pageId);
  }

  // ===========================================
  // 3. 评论管理 - 委托给 CommentService
  // ===========================================

  /**
   * 获取页面评论
   */
  public async getPageComments(
    pageId: string,
    options: { start?: number; limit?: number } = {}
  ): Promise<CommentSearchResult> {
    return this.commentService.getPageComments(pageId, options);
  }

  /**
   * 获取评论详细信息
   */
  public async getComment(commentId: string): Promise<ConfluenceComment> {
    return this.commentService.getComment(commentId);
  }

  /**
   * 搜索评论
   */
  public async searchComments(
    query: string,
    options: { start?: number; limit?: number; spaceKey?: string } = {}
  ): Promise<CommentSearchResult> {
    return this.commentService.searchComments(query, options);
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
    return this.commentService.createComment(pageId, content, representation, parentCommentId);
  }

  /**
   * 更新评论
   */
  public async updateComment(request: UpdateCommentRequest): Promise<ConfluenceComment> {
    return this.commentService.updateComment(request);
  }

  /**
   * 删除评论
   */
  public async deleteComment(commentId: string): Promise<void> {
    return this.commentService.deleteComment(commentId);
  }

  /**
   * 回复普通评论
   */
  public async replyComment(request: ReplyCommentRequest): Promise<ConfluenceComment> {
    return this.commentService.replyComment(request);
  }

  // ===========================================
  // 4. 行内评论管理 - 委托给 InlineCommentService
  // ===========================================

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
    return this.inlineCommentService.createInlineComment(
      pageId, content, originalSelection, matchIndex, numMatches, serializedHighlights, parentCommentId
    );
  }

  /**
   * 更新行内评论
   */
  public async updateInlineComment(request: UpdateInlineCommentRequest): Promise<InlineComment> {
    return this.inlineCommentService.updateInlineComment(request);
  }

  /**
   * 删除行内评论
   */
  public async deleteInlineComment(commentId: string): Promise<void> {
    return this.inlineCommentService.deleteInlineComment(commentId);
  }

  /**
   * 回复行内评论
   */
  public async replyInlineComment(request: ReplyInlineCommentRequest): Promise<InlineComment> {
    return this.inlineCommentService.replyInlineComment(request);
  }

  // ===========================================
  // 5. 导出功能 - 委托给 ExportService
  // ===========================================

  /**
   * 导出单个页面为Markdown文件
   */
  public async exportPage(options: ExportPageOptions): Promise<ExportResult> {
    return this.exportService.exportPage(options);
  }

  /**
   * 导出页面层次结构为Markdown文件
   */
  public async exportPageHierarchy(options: ExportHierarchyOptions): Promise<ExportResult> {
    return this.exportService.exportPageHierarchy(options);
  }

  /**
   * 批量导出多个页面为Markdown文件
   */
  public async batchExportPages(options: BatchExportOptions): Promise<ExportResult> {
    return this.exportService.batchExportPages(options);
  }
} 