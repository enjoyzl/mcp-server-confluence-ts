# Confluence MCP 服务重构说明

## 重构目标

原有的 `ConfluenceService` 类过于庞大（1670行代码），包含了所有功能，不易维护和扩展。本次重构按功能模块拆分服务类，提高代码的可维护性和可扩展性。

## 重构架构

### 1. 服务分层设计

```
BaseService (基础服务)
├── CoreService (核心服务: 空间、搜索)
├── PageService (页面服务: 页面CRUD)
├── CommentService (评论服务: 普通评论CRUD)
├── InlineCommentService (行内评论服务: 行内评论CRUD)
└── ConfluenceService (主服务: 组合所有服务)
```

### 2. 文件结构

```
src/services/
├── base.service.ts              # 基础服务抽象类
├── confluence-client.ts         # HTTP客户端
├── confluence.service.ts        # 重构后的主服务（组合所有功能服务）
├── index.ts                     # 服务导出索引
└── features/                    # 功能服务目录
    ├── index.ts                 # 功能服务导出索引
    ├── space.service.ts         # 空间管理服务
    ├── search.service.ts        # 内容搜索服务
    ├── page.service.ts          # 页面管理服务（CRUD）
    ├── comment-basic.service.ts # 基础评论管理服务（CRUD）
    └── comment-inline.service.ts # 行内评论服务（CRUD）
```

## 服务职责划分

### BaseService (基础服务)
**文件**: `base.service.ts`
**职责**: 提供所有服务的通用功能
- 缓存管理
- 重试机制
- 错误处理
- 健康检查
- 配置管理

### SpaceService (空间服务)
**文件**: `space.service.ts`
**职责**: Confluence 空间管理
- `getSpace()` - 获取空间信息

### SearchService (搜索服务)
**文件**: `search.service.ts`
**职责**: Confluence 内容搜索
- `searchContent()` - 搜索内容（支持CQL和文本搜索）

### PageService (页面服务)
**文件**: `page.service.ts`
**职责**: 页面的完整生命周期管理
- `getPage()` - 获取页面
- `getPageByPrettyUrl()` - 通过Pretty URL获取页面
- `getPageContent()` - 获取页面详细内容
- `getPages()` - 批量获取页面
- `createPage()` - 创建页面
- `updatePage()` - 更新页面
- `deletePage()` - 删除页面

### CommentService (基础评论服务)
**文件**: `comment-basic.service.ts`
**职责**: 普通评论的完整生命周期管理
- `getPageComments()` - 获取页面评论
- `getComment()` - 获取评论详情
- `searchComments()` - 搜索评论
- `createComment()` - 创建评论（支持多种API策略）
- `updateComment()` - 更新评论
- `deleteComment()` - 删除评论
- `replyComment()` - 回复评论

### InlineCommentService (行内评论服务)
**文件**: `comment-inline.service.ts`
**职责**: 行内评论的完整生命周期管理
- `createInlineComment()` - 创建行内评论
- `updateInlineComment()` - 更新行内评论
- `deleteInlineComment()` - 删除行内评论
- `replyInlineComment()` - 回复行内评论

### ConfluenceService (主服务)
**文件**: `confluence.service.ts`
**职责**: 组合所有子服务，提供统一接口
- 委托模式：将请求转发给对应的子服务
- 提供完整的向后兼容性
- 统一的缓存清理

## 重构优势

### 1. 代码组织更清晰
- **单一职责**: 每个服务类只负责特定功能
- **模块化**: 功能相关的代码集中在一起
- **易于理解**: 开发者可以快速定位相关代码

### 2. 可维护性提升
- **小文件**: 每个文件都较小（200-400行），易于阅读和修改
- **职责明确**: 修改某个功能时只需关注对应的服务类
- **测试友好**: 可以针对每个服务类编写独立的单元测试

### 3. 可扩展性增强
- **新功能**: 可以轻松添加新的服务类（如AttachmentService）
- **功能增强**: 在不影响其他功能的情况下增强特定服务
- **插拔式**: 可以独立使用某个子服务

### 4. 代码复用
- **基础功能**: 所有服务共享BaseService的通用功能
- **减少重复**: 避免在多个地方重复实现相同的逻辑

## 使用方式

### 使用重构后的主服务（推荐）
```typescript
import { ConfluenceService } from './services/confluence.service.js';

const service = new ConfluenceService(config);
// 使用方式与原服务完全相同
const page = await service.getPage('pageId');
```

### 使用独立的子服务
```typescript
import { SpaceService, SearchService, PageService, CommentService } from './services/features/index.js';

const spaceService = new SpaceService(config);
const searchService = new SearchService(config);
const pageService = new PageService(config);
const commentService = new CommentService(config);

const space = await spaceService.getSpace('DEV');
const searchResults = await searchService.searchContent('confluence');
const page = await pageService.getPage('pageId');
const comments = await commentService.getPageComments('pageId');
```

### 从服务索引导入
```typescript
// 导入所有服务
import { ConfluenceService, SpaceService, SearchService, PageService, CommentService } from './services/index.js';

// 或者只导入需要的服务
import { SpaceService, SearchService } from './services/index.js';
```

## 性能优化

### 1. 独立缓存
- 每个服务维护自己的缓存
- 避免不同功能之间的缓存冲突
- 支持细粒度的缓存清理

### 2. 按需加载
- 可以只加载需要的服务
- 减少内存占用
- 提高启动速度

### 3. 并发处理
- 不同服务之间可以并发执行
- 减少服务间的相互影响

## 迁移指南

### 对于现有代码
重构后的主服务 `ConfluenceService` 保持了完全的向后兼容性，现有代码无需修改：

```typescript
// 现有代码继续工作
const service = new ConfluenceService(config);
const page = await service.getPage('pageId');
const comments = await service.getPageComments('pageId');
```

### 对于新开发
建议根据功能需求选择合适的服务：

```typescript
// 只需要空间功能
import { SpaceService } from './services/index.js';

// 只需要搜索功能
import { SearchService } from './services/index.js';

// 只需要页面功能
import { PageService } from './services/index.js';

// 只需要评论功能
import { CommentService } from './services/index.js';

// 需要完整功能
import { ConfluenceService } from './services/index.js';
```

## 测试策略

### 1. 单元测试
- 每个服务类独立测试
- Mock依赖的服务
- 测试边界条件和错误处理

### 2. 集成测试
- 测试服务间的交互
- 验证主服务的委托逻辑
- 端到端功能测试

### 3. 兼容性测试
- 确保重构后的服务与原服务行为一致
- 验证所有API的向后兼容性

## 后续扩展

### 可以添加的新服务
1. **AttachmentService** - 附件管理
2. **LabelService** - 标签管理
3. **PermissionService** - 权限管理
4. **AnalyticsService** - 分析统计
5. **WebhookService** - Webhook管理

### 扩展示例
```typescript
// 新增附件服务
export class AttachmentService extends BaseService {
  public async uploadAttachment(pageId: string, file: Buffer): Promise<Attachment> {
    // 实现附件上传逻辑
  }
  
  public async getPageAttachments(pageId: string): Promise<Attachment[]> {
    // 实现获取页面附件逻辑
  }
}

// 在主服务中集成
export class ConfluenceService {
  private readonly attachmentService: AttachmentService;
  
  constructor(config: ConfluenceClientConfig) {
    // ...
    this.attachmentService = new AttachmentService(config);
  }
  
  public async uploadAttachment(pageId: string, file: Buffer): Promise<Attachment> {
    return this.attachmentService.uploadAttachment(pageId, file);
  }
}
```

## 总结

本次重构将原有的单一巨大服务类拆分为多个职责明确的小服务类，在保持完全向后兼容的同时，显著提升了代码的可维护性、可扩展性和可测试性。这为后续功能扩展和性能优化奠定了良好的基础。 