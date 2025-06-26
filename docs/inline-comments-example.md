# Confluence 行内评论功能使用指南

## 概述

行内评论功能现在支持两种API实现方式，与普通评论功能保持一致：
- **自定义API** (`/rest/inlinecomments/1.0/`) - Confluence浏览器实际使用的端点
- **标准API** (`/wiki/api/v2/inline-comments`) - Confluence官方REST API v2

## API策略配置

### 1. 自动模式（推荐，默认）
```javascript
// 优先使用自定义API，失败时自动回退到标准API
const service = new ConfluenceService({
  baseUrl: 'https://your-confluence.com',
  username: 'your-username',
  apiToken: 'your-token',
  commentConfig: {
    apiStrategy: CommentApiStrategy.AUTO,  // 默认值
    enableFallback: true  // 启用回退机制
  }
});
```

### 2. 仅使用自定义API
```javascript
const service = new ConfluenceService({
  baseUrl: 'https://your-confluence.com',
  username: 'your-username', 
  apiToken: 'your-token',
  commentConfig: {
    apiStrategy: CommentApiStrategy.TINYMCE,
    enableFallback: false
  }
});
```

### 3. 仅使用标准API
```javascript
const service = new ConfluenceService({
  baseUrl: 'https://your-confluence.com',
  username: 'your-username',
  apiToken: 'your-token', 
  commentConfig: {
    apiStrategy: CommentApiStrategy.STANDARD,
    enableFallback: false
  }
});
```

## 使用统一的 manageComments 工具

### 1. 创建行内评论

#### 基本用法
```javascript
// 使用 manageComments 工具
await manageComments({
  action: 'create',
  commentType: 'inline',
  pageId: '123456',
  content: '这里有个问题需要注意',
  originalSelection: '选中的文本内容',
  matchIndex: 0,
  numMatches: 1
});
```

#### 高级用法（带序列化高亮）
```javascript
await manageComments({
  action: 'create', 
  commentType: 'inline',
  pageId: '123456',
  content: '建议修改这部分内容',
  originalSelection: '需要修改的文本',
  matchIndex: 0,
  numMatches: 1,
  serializedHighlights: JSON.stringify([{
    start: 0,
    end: 10,
    text: '需要修改的文本'
  }])
});
```

### 2. 更新行内评论
```javascript
await manageComments({
  action: 'update',
  commentType: 'inline', 
  commentId: 'comment-123',
  content: '更新后的评论内容',
  version: 2
});
```

### 3. 删除行内评论
```javascript
await manageComments({
  action: 'delete',
  commentType: 'inline',
  commentId: 'comment-123'
});
```

### 4. 回复行内评论
```javascript
await manageComments({
  action: 'reply',
  commentType: 'inline',
  commentId: 'parent-comment-123',
  pageId: '123456', 
  content: '我同意你的观点'
});
```

## API差异说明

### 自定义API vs 标准API

| 功能 | 自定义API端点 | 标准API端点 | 
|------|---------------|-------------|
| 创建 | `/rest/inlinecomments/1.0/comments` | `/wiki/api/v2/inline-comments` |
| 更新 | `/rest/inlinecomments/1.0/comments/{id}` | `/wiki/api/v2/inline-comments/{id}` |
| 删除 | `/rest/inlinecomments/1.0/comments/{id}` | `/wiki/api/v2/inline-comments/{id}` |
| 回复 | `/rest/inlinecomments/1.0/comments` | `/wiki/api/v2/inline-comments` |

### 请求数据格式差异

#### 创建行内评论

**自定义API格式：**
```json
{
  "originalSelection": "选中的文本",
  "body": "<p>评论内容</p>",
  "matchIndex": 0,
  "numMatches": 1,
  "serializedHighlights": "[]",
  "containerId": "pageId",
  "parentCommentId": "0"
}
```

**标准API格式：**
```json
{
  "pageId": "pageId",
  "body": {
    "representation": "storage",
    "value": "<p>评论内容</p>"
  },
  "inlineCommentProperties": {
    "textSelection": "选中的文本",
    "textSelectionMatchIndex": 0,
    "textSelectionMatchCount": 1
  }
}
```

## 最佳实践

### 1. 推荐配置
```javascript
// 生产环境推荐配置
const service = new ConfluenceService({
  baseUrl: process.env.CONFLUENCE_BASE_URL,
  username: process.env.CONFLUENCE_USERNAME,
  apiToken: process.env.CONFLUENCE_API_TOKEN,
  commentConfig: {
    apiStrategy: CommentApiStrategy.AUTO,
    enableFallback: true,
    timeout: 15000
  }
});
```

### 2. 错误处理
```javascript
try {
  const result = await manageComments({
    action: 'create',
    commentType: 'inline',
    pageId: '123456',
    content: '行内评论内容',
    originalSelection: '选中文本'
  });
  console.log('行内评论创建成功:', result);
} catch (error) {
  console.error('行内评论操作失败:', error.message);
  
  // 根据错误类型进行处理
  if (error.message.includes('权限')) {
    console.log('请检查用户权限');
  } else if (error.message.includes('网络')) {
    console.log('请检查网络连接');
  }
}
```

### 3. 批量操作
```javascript
// 批量创建多个行内评论
const comments = [
  { selection: '文本1', content: '评论1' },
  { selection: '文本2', content: '评论2' }
];

for (const comment of comments) {
  try {
    await manageComments({
      action: 'create',
      commentType: 'inline',
      pageId: '123456',
      content: comment.content,
      originalSelection: comment.selection
    });
    
    // 添加延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.error(`创建评论失败: ${comment.content}`, error);
  }
}
```

## 迁移指南

### 从独立工具迁移

如果您之前使用独立的行内评论工具：

```javascript
// 旧方式
await createInlineComment(pageId, content, selection);
await updateInlineComment({ commentId, content, version });
await deleteInlineComment(commentId);
await replyInlineComment({ commentId, pageId, content });

// 新方式（推荐）
await manageComments({ action: 'create', commentType: 'inline', pageId, content, originalSelection: selection });
await manageComments({ action: 'update', commentType: 'inline', commentId, content, version });
await manageComments({ action: 'delete', commentType: 'inline', commentId });
await manageComments({ action: 'reply', commentType: 'inline', commentId, pageId, content });
```

## 故障排除

### 常见问题

1. **权限错误**
   - 确保用户有页面评论权限
   - 检查API Token是否有效

2. **文本选择问题**
   - `originalSelection` 必须与页面内容完全匹配
   - 注意空格和换行符

3. **API兼容性**
   - 某些Confluence版本可能不支持标准API
   - 使用AUTO模式可自动处理兼容性问题

### 调试技巧

启用详细日志：
```javascript
const service = new ConfluenceService({
  // ... 其他配置
  logger: {
    debug: console.log,
    info: console.log,
    warn: console.warn,
    error: console.error
  }
});
```

## 总结

行内评论功能现在完全支持双API策略，提供了：
- 🔄 **自动回退机制** - 确保最大兼容性
- 🎯 **统一接口** - 通过 `manageComments` 工具管理所有操作
- 🛡️ **错误处理** - 详细的错误信息和重试机制
- 📖 **完整文档** - 包含迁移指南和最佳实践

选择AUTO模式可以获得最佳的兼容性和稳定性体验。 