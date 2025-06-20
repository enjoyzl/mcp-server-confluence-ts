# Confluence 评论功能使用示例

本文档演示如何使用 MCP Confluence 服务器的评论功能。

## 前提条件

确保你已经正确配置了 Confluence MCP 服务器，并且有相应的权限访问 Confluence 页面和评论。

## 基础使用示例

### 1. 获取页面评论

```typescript
// 获取页面的所有评论
const comments = await confluenceService.getPageComments('123456789');

// 分页获取评论（推荐用于评论较多的页面）
const comments = await confluenceService.getPageComments('123456789', {
  start: 0,
  limit: 10
});

console.log(`页面共有 ${comments.totalSize} 条评论`);
console.log(`当前返回 ${comments.size} 条评论`);
```

### 2. 获取单个评论详情

```typescript
const comment = await confluenceService.getComment('987654321');
console.log(`评论作者: ${comment.version.by.displayName}`);
console.log(`评论时间: ${comment.version.when}`);
console.log(`评论内容: ${comment.body.storage.value}`);
```

### 3. 创建新评论

```typescript
// 创建普通评论
const newComment = await confluenceService.createComment({
  pageId: '123456789',
  content: '<p>这是一条新评论</p>',
  representation: 'storage'
});

console.log(`评论创建成功，ID: ${newComment.id}`);
```

### 4. 回复评论

```typescript
// 回复已有评论
const reply = await confluenceService.createComment({
  pageId: '123456789',
  content: '<p>这是对上面评论的回复</p>',
  parentCommentId: '987654321' // 父评论的ID
});

console.log(`回复创建成功，ID: ${reply.id}`);
```

### 5. 更新评论

```typescript
// 获取当前评论信息（需要版本号）
const currentComment = await confluenceService.getComment('987654321');

// 更新评论内容
const updatedComment = await confluenceService.updateComment({
  id: '987654321',
  content: '<p>这是更新后的评论内容</p>',
  version: currentComment.version.number + 1
});

console.log('评论更新成功');
```

### 6. 删除评论

```typescript
await confluenceService.deleteComment('987654321');
console.log('评论删除成功');
```

### 7. 搜索评论

```typescript
// 搜索包含特定关键词的评论
const searchResults = await confluenceService.searchComments('重要');

// 在特定空间中搜索评论
const spaceComments = await confluenceService.searchComments('关键词', {
  spaceKey: 'MYSPACE',
  start: 0,
  limit: 20
});

console.log(`找到 ${searchResults.totalSize} 条相关评论`);
```

## 高级使用场景

### 批量处理评论

```typescript
async function processPageComments(pageId: string) {
  let start = 0;
  const limit = 50;
  let hasMore = true;

  while (hasMore) {
    const comments = await confluenceService.getPageComments(pageId, { start, limit });
    
    for (const comment of comments.results) {
      // 处理每条评论
      console.log(`处理评论: ${comment.id}`);
      // 这里可以添加你的业务逻辑
    }

    start += limit;
    hasMore = comments.results.length === limit;
  }
}
```

### 评论内容格式化

```typescript
// 使用不同的内容格式
const markdownComment = await confluenceService.createComment({
  pageId: '123456789',
  content: '这是 **粗体** 和 *斜体* 文本',
  representation: 'wiki' // 使用 wiki 格式
});

const htmlComment = await confluenceService.createComment({
  pageId: '123456789',
  content: '<p>这是 <strong>HTML</strong> 格式的评论</p>',
  representation: 'storage' // 使用 storage 格式（推荐）
});
```

### 错误处理

```typescript
try {
  const comment = await confluenceService.createComment({
    pageId: 'invalid-page-id',
    content: '测试评论'
  });
} catch (error) {
  if (error.statusCode === 404) {
    console.log('页面不存在');
  } else if (error.statusCode === 403) {
    console.log('没有权限访问该页面');
  } else {
    console.log('创建评论失败:', error.message);
  }
}
```

## 注意事项

1. **权限要求**: 确保你的账户有权限查看和操作目标页面的评论
2. **版本控制**: 更新评论时必须提供正确的版本号
3. **内容格式**: 推荐使用 'storage' 格式，它支持完整的 Confluence 内容格式
4. **API 限制**: 注意 Confluence API 的速率限制，避免过于频繁的请求
5. **缓存机制**: 服务器内置了缓存机制，重复获取相同评论时会使用缓存

## 常见问题

**Q: 为什么无法删除评论？**
A: 只有评论作者或有管理员权限的用户才能删除评论。

**Q: 如何获取评论的回复？**
A: Confluence API 会在评论列表中包含所有层级的评论，通过 `ancestors` 字段可以识别回复关系。

**Q: 评论内容支持哪些格式？**
A: 支持 storage（HTML）、wiki、editor2 和 view 格式，推荐使用 storage 格式。 