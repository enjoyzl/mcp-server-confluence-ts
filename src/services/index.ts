// 基础服务和接口
export { BaseService, CommentConfig, CacheItem, SearchOptions, RetryOptions } from './base.service.js';

// 功能服务
export { SpaceService, SearchService, PageService, CommentService, InlineCommentService } from './features/feature-services.js';

// 主服务
export { ConfluenceService } from './confluence.service.js';

// 客户端
export { ConfluenceClient, ConfluenceClientConfig } from './confluence-client.js'; 