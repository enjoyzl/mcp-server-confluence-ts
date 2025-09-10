# Confluence 评论API使用示例

## 概述

本文档展示如何使用Confluence MCP服务器的评论功能，包括普通评论和行内评论的双API策略支持。

## API策略配置

所有评论功能（普通评论和行内评论）都支持三种API策略：

### 1. 自动模式（推荐）
```javascript
const service = new ConfluenceService({
  baseUrl: 'https://your-confluence.com',
  username: 'your-username',
  apiToken: 'your-token',
  commentConfig: {
    apiStrategy: CommentApiStrategy.AUTO,  // 默认值
    enableFallback: true,  // 启用回退机制
    timeout: 15000
  }
});
```

### 2. TinyMCE模式（使用浏览器实际端点）
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

### 3. 标准API模式
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

## 普通评论操作

### 创建普通评论
```javascript
// 使用 manageComments 工具
await manageComments({
  action: 'create',
  commentType: 'regular',  // 或省略，默认为regular
  pageId: '123456',
  content: '这是一个普通评论',
  representation: 'storage'
});
```

### 更新普通评论
```javascript
await manageComments({
  action: 'update',
  commentType: 'regular',
  commentId: 'comment-123',
  content: '更新后的评论内容',
  version: 2,
  representation: 'storage'
});
```

### 删除普通评论
```javascript
await manageComments({
  action: 'delete',
  commentType: 'regular',
  commentId: 'comment-123'
});
```

### 回复普通评论
```javascript
await manageComments({
  action: 'reply',
  commentType: 'regular',
  pageId: '123456',
  parentCommentId: 'parent-comment-123',
  content: '这是一个回复',
  watch: false
});
```

## 行内评论操作

### 创建行内评论
```javascript
await manageComments({
  action: 'create',
  commentType: 'inline',
  pageId: '123456',
  content: '这里需要修改',
  originalSelection: '选中的文本内容',
  matchIndex: 0,
  numMatches: 1,
  serializedHighlights: JSON.stringify([])
});
```

### 更新行内评论
```javascript
await manageComments({
  action: 'update',
  commentType: 'inline',
  commentId: 'inline-comment-123',
  content: '更新后的行内评论',
  version: 2
});
```

### 删除行内评论
```javascript
await manageComments({
  action: 'delete',
  commentType: 'inline',
  commentId: 'inline-comment-123'
});
```

### 回复行内评论
```javascript
await manageComments({
  action: 'reply',
  commentType: 'inline',
  commentId: 'parent-inline-comment-123',
  pageId: '123456',
  content: '我同意这个观点'
});
```

## API端点对比

### 普通评论

| 操作 | TinyMCE端点 | 标准API端点 |
|------|-------------|-------------|
| 创建 | `/plugins/editor-loader/editor.action` | `/wiki/api/v2/pages/{id}/comments` |
| 更新 | `/plugins/editor-loader/editor.action` | `/wiki/api/v2/comments/{id}` |
| 删除 | `/plugins/editor-loader/editor.action` | `/wiki/api/v2/comments/{id}` |
| 回复 | `/plugins/editor-loader/editor.action` | `/wiki/api/v2/pages/{id}/comments` |

### 行内评论

| 操作 | 自定义端点 | 标准API端点 |
|------|------------|-------------|
| 创建 | `/rest/inlinecomments/1.0/comments` | `/wiki/api/v2/inline-comments` |
| 更新 | `/rest/inlinecomments/1.0/comments/{id}` | `/wiki/api/v2/inline-comments/{id}` |
| 删除 | `/rest/inlinecomments/1.0/comments/{id}` | `/wiki/api/v2/inline-comments/{id}` |
| 回复 | `/rest/inlinecomments/1.0/comments` | `/wiki/api/v2/inline-comments` |

## 错误处理和回退机制

### 自动回退示例
```javascript
// 在AUTO模式下，系统会自动处理API失败
try {
  const result = await manageComments({
    action: 'create',
    commentType: 'regular',
    pageId: '123456',
    content: '测试评论'
  });
  console.log('评论创建成功:', result);
} catch (error) {
  // 如果两种API都失败，才会抛出错误
  console.error('评论创建失败:', error.message);
}
```

### 手动错误处理
```javascript
// 在非AUTO模式下的错误处理
try {
  const result = await manageComments({
    action: 'create',
    commentType: 'inline',
    pageId: '123456',
    content: '行内评论',
    originalSelection: '选中文本'
  });
} catch (error) {
  if (error.message.includes('权限')) {
    console.log('用户无评论权限');
  } else if (error.message.includes('404')) {
    console.log('页面不存在');
  } else if (error.message.includes('文本')) {
    console.log('无法定位选中的文本');
  } else {
    console.log('其他错误:', error.message);
  }
}
```

## 性能优化建议

### 1. 批量操作
```javascript
// 避免并发过多请求
const comments = ['评论1', '评论2', '评论3'];
for (const content of comments) {
  await manageComments({
    action: 'create',
    pageId: '123456',
    content
  });
  
  // 添加延迟
  await new Promise(resolve => setTimeout(resolve, 500));
}
```

### 2. 缓存策略
```javascript
// 获取评论时使用缓存
const comments = await getPageComments('123456', { limit: 50 });
```

### 3. 监控和日志
```javascript
const service = new ConfluenceService({
  // ... 配置
  logger: {
    debug: (msg, data) => console.log('[DEBUG]', msg, data),
    info: (msg, data) => console.log('[INFO]', msg, data),
    warn: (msg, data) => console.warn('[WARN]', msg, data),
    error: (msg, data) => console.error('[ERROR]', msg, data)
  }
});
```

## 兼容性说明

### Confluence版本支持

- **Confluence 7.4+**: 完全支持所有功能
- **Confluence 6.x-7.3**: 建议使用TinyMCE模式
- **Confluence Cloud**: 推荐使用标准API模式

### API策略选择建议

1. **生产环境**: 使用AUTO模式确保最大兼容性
2. **开发环境**: 可以使用TINYMCE模式进行调试
3. **Cloud环境**: 优先使用STANDARD模式
4. **老版本**: 使用TINYMCE模式

## 总结

双API策略的优势：
- 🔄 **自动回退** - 确保在各种环境下都能正常工作
- 🎯 **统一接口** - 通过 `manageComments` 工具管理所有评论操作
- 🛡️ **错误处理** - 详细的错误信息和重试机制
- 📊 **性能监控** - 内置日志和性能追踪
- 🔧 **灵活配置** - 支持多种API策略和配置选项

选择AUTO模式可以获得最佳的用户体验和系统稳定性。 