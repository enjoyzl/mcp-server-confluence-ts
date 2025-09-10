# Confluence MCP 服务使用示例

## 重构后的服务架构

经过重构，原来的单一巨大服务类（1670行）被拆分为多个职责明确的小服务类：

- **BaseService** (176行): 基础功能（缓存、重试、错误处理）
- **CoreService** (124行): 空间和搜索功能  
- **PageService** (200行): 页面管理功能
- **CommentService** (549行): 普通评论功能
- **InlineCommentService** (472行): 行内评论功能
- **ConfluenceService** (237行): 主服务（组合所有子服务）

## 使用方式

### 1. 使用重构后的主服务（推荐）

```typescript
import { ConfluenceService } from './services/confluence.service.refactored.js';

// 创建服务实例
const confluenceService = new ConfluenceService({
  baseUrl: 'https://your-confluence.com',
  username: 'username',
  password: 'password',
  commentConfig: {
    apiStrategy: 'standard',
    enableFallback: true,
    timeout: 15000
  }
});

// 使用方式与原服务完全相同
const space = await confluenceService.getSpace('SPACE_KEY');
const page = await confluenceService.getPage('pageId');
const comments = await confluenceService.getPageComments('pageId');
```

### 2. 使用独立的子服务

如果只需要特定功能，可以直接使用对应的子服务：

#### 只需要页面功能
```typescript
import { PageService } from './services/page.service.js';

const pageService = new PageService(config);

// 页面操作
const page = await pageService.getPage('pageId');
const newPage = await pageService.createPage({
  spaceKey: 'SPACE',
  title: '新页面',
  content: '<p>页面内容</p>'
});
```

#### 只需要评论功能
```typescript
import { CommentService } from './services/comment.service.js';

const commentService = new CommentService(config);

// 评论操作
const comments = await commentService.getPageComments('pageId');
const newComment = await commentService.createComment(
  'pageId', 
  '这是一条评论'
);
```

#### 只需要搜索功能
```typescript
import { CoreService } from './services/core.service.js';

const coreService = new CoreService(config);

// 搜索操作
const searchResult = await coreService.searchContent('关键词');
const space = await coreService.getSpace('SPACE_KEY');
```

### 3. 组合使用多个服务

```typescript
import { PageService, CommentService } from './services/index.js';

const pageService = new PageService(config);
const commentService = new CommentService(config);

// 获取页面和评论
const [page, comments] = await Promise.all([
  pageService.getPage('pageId'),
  commentService.getPageComments('pageId')
]);

console.log(`页面"${page.title}"有${comments.size}条评论`);
```

## 实际使用案例

### 案例1：页面内容管理

```typescript
import { PageService } from './services/page.service.js';

class PageManager {
  private pageService: PageService;

  constructor(config: any) {
    this.pageService = new PageService(config);
  }

  async createDocument(spaceKey: string, title: string, content: string) {
    try {
      const page = await this.pageService.createPage({
        spaceKey,
        title,
        content: `<div class="wiki-content">${content}</div>`,
        representation: 'storage'
      });
      
      console.log(`文档创建成功: ${page.title} (ID: ${page.id})`);
      return page;
    } catch (error) {
      console.error('文档创建失败:', error.message);
      throw error;
    }
  }

  async updateDocument(pageId: string, newContent: string) {
    try {
      const page = await this.pageService.updatePage({
        id: pageId,
        content: `<div class="wiki-content">${newContent}</div>`
      });
      
      console.log(`文档更新成功: ${page.title}`);
      return page;
    } catch (error) {
      console.error('文档更新失败:', error.message);
      throw error;
    }
  }
}
```

### 案例2：评论管理系统

```typescript
import { CommentService } from './services/comment.service.js';

class CommentManager {
  private commentService: CommentService;

  constructor(config: any) {
    this.commentService = new CommentService(config);
  }

  async addComment(pageId: string, content: string) {
    try {
      const comment = await this.commentService.createComment(
        pageId, 
        content
      );
      
      console.log(`评论添加成功: ${comment.id}`);
      return comment;
    } catch (error) {
      console.error('评论添加失败:', error.message);
      throw error;
    }
  }

  async replyToComment(pageId: string, parentCommentId: string, content: string) {
    try {
      const reply = await this.commentService.replyComment({
        pageId,
        parentCommentId,
        content
      });
      
      console.log(`回复成功: ${reply.id}`);
      return reply;
    } catch (error) {
      console.error('回复失败:', error.message);
      throw error;
    }
  }

  async moderateComment(commentId: string, newContent: string) {
    try {
      const comment = await this.commentService.updateComment({
        id: commentId,
        content: newContent
      });
      
      console.log(`评论审核完成: ${comment.id}`);
      return comment;
    } catch (error) {
      console.error('评论审核失败:', error.message);
      throw error;
    }
  }
}
```

### 案例3：内容搜索和分析

```typescript
import { CoreService } from './services/core.service.js';

class ContentAnalyzer {
  private coreService: CoreService;

  constructor(config: any) {
    this.coreService = new CoreService(config);
  }

  async searchAndAnalyze(keyword: string, spaceKey?: string) {
    try {
      const results = await this.coreService.searchContent(keyword, {
        spaceKey,
        limit: 100
      });

      const analysis = {
        totalResults: results.size,
        pages: results.results?.filter(r => r.type === 'page').length || 0,
        comments: results.results?.filter(r => r.type === 'comment').length || 0,
        spaces: [...new Set(results.results?.map(r => r.space?.key))].length
      };

      console.log('搜索分析结果:', analysis);
      return analysis;
    } catch (error) {
      console.error('搜索分析失败:', error.message);
      throw error;
    }
  }

  async getSpaceOverview(spaceKey: string) {
    try {
      const space = await this.coreService.getSpace(spaceKey);
      const pages = await this.coreService.searchContent('', {
        spaceKey,
        type: 'page'
      });

      const overview = {
        spaceName: space.name,
        spaceKey: space.key,
        description: space.description?.plain?.value || '无描述',
        totalPages: pages.size
      };

      console.log('空间概览:', overview);
      return overview;
    } catch (error) {
      console.error('获取空间概览失败:', error.message);
      throw error;
    }
  }
}
```

## 配置和策略

### 评论API策略配置

```typescript
// 标准API策略（推荐，稳定）
const standardConfig = {
  baseUrl: 'https://confluence.com',
  username: 'user',
  password: 'pass',
  commentConfig: {
    apiStrategy: 'standard',
    enableFallback: false,
    timeout: 10000
  }
};

// TinyMCE策略（功能丰富）
const tinyMceConfig = {
  baseUrl: 'https://confluence.com',
  username: 'user',
  password: 'pass',
  commentConfig: {
    apiStrategy: 'tinymce',
    enableFallback: true,
    timeout: 15000
  }
};

// 自动策略（智能选择）
const autoConfig = {
  baseUrl: 'https://confluence.com',
  username: 'user',
  password: 'pass',
  commentConfig: {
    apiStrategy: 'auto',
    enableFallback: true,
    timeout: 15000
  }
};
```

## 性能优化建议

### 1. 选择合适的服务
```typescript
// ❌ 不推荐：为了一个搜索功能加载整个服务
import { ConfluenceService } from './services/confluence.service.refactored.js';
const service = new ConfluenceService(config);
const results = await service.searchContent('keyword');

// ✅ 推荐：只加载需要的服务
import { CoreService } from './services/core.service.js';
const coreService = new CoreService(config);
const results = await coreService.searchContent('keyword');
```

### 2. 利用缓存机制
```typescript
import { PageService } from './services/page.service.js';

const pageService = new PageService(config);

// 第一次调用会从API获取
const page1 = await pageService.getPage('pageId');

// 第二次调用会从缓存获取（5分钟内）
const page2 = await pageService.getPage('pageId');

// 手动清除缓存
pageService.clearCache();
```

### 3. 并发处理
```typescript
import { PageService, CommentService } from './services/index.js';

const pageService = new PageService(config);
const commentService = new CommentService(config);

// 并发获取页面和评论
const [page, comments] = await Promise.all([
  pageService.getPage('pageId'),
  commentService.getPageComments('pageId')
]);
```

## 错误处理

### 统一错误处理
```typescript
import { CommentService } from './services/comment.service.js';

const commentService = new CommentService(config);

try {
  const comment = await commentService.createComment('pageId', 'content');
} catch (error) {
  if (error.message.includes('Permission denied')) {
    console.log('权限不足，请检查用户权限');
  } else if (error.message.includes('Page not found')) {
    console.log('页面不存在，请检查页面ID');
  } else {
    console.log('未知错误:', error.message);
  }
}
```

### 重试机制
```typescript
// 服务内置重试机制，会自动重试失败的请求
// 可以通过BaseService配置重试参数
```

## 总结

重构后的服务架构提供了：

1. **更好的可维护性** - 每个服务职责单一，代码清晰
2. **更高的可扩展性** - 可以轻松添加新的服务类
3. **更优的性能** - 按需加载，独立缓存
4. **完全的兼容性** - 现有代码无需修改
5. **灵活的使用方式** - 可以选择使用整个服务或单个子服务 