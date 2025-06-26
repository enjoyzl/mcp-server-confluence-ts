# TinyMCE API 端点分析

## 背景

通过分析浏览器实际请求，我们发现Confluence 7.4在创建评论时使用的是TinyMCE特定的端点，而不是标准的REST API。

## 发现的端点

### 实际使用的端点
```
POST /rest/tinymce/1/content/{pageId}/comment?actions=true
```

### 响应示例
```json
{
    "id": 101627367,
    "html": "<p>well</p>",
    "asyncRenderSafe": true,
    "ownerId": 98860890,
    "parentId": 0,
    "isInlineComment": false,
    "primaryActions": [
        {
            "id": "reply-comment",
            "label": "回复",
            "url": "/pages/replycomment.action?commentId=101627367&pageId=98860890",
            "style": "action-reply-comment"
        },
        {
            "id": "edit-comment",
            "label": "编辑",
            "url": "/pages/editcomment.action?commentId=101627367&pageId=98860890",
            "style": "comment-action-edit"
        },
        {
            "id": "remove-comment",
            "label": "删除",
            "url": "/pages/removecomment.action?commentId=101627367&pageId=98860890&atl_token=eab56e1bb61177d1de6cd72cb35b8d5c1398b81c",
            "style": "comment-action-remove"
        },
        {
            "label": "大约1分钟以前",
            "tooltip": " 2025 6月 20, 11:24",
            "url": "/pages/viewpage.action?pageId=98860890&focusedCommentId=101627367#comment-101627367",
            "style": "comment-date"
        }
    ],
    "secondaryActions": [
        {
            "id": "comment-permalink",
            "label": "永久链接",
            "tooltip": "指向此评论的永久链接",
            "url": "/pages/viewpage.action?pageId=98860890&focusedCommentId=101627367#comment-101627367",
            "style": "comment-permalink"
        }
    ]
}
```

## 与标准API的差异

### 标准REST API
- 端点：`POST /rest/api/content`
- 复杂的权限验证流程
- 触发权限级联查询
- 可能导致线程卡死

### TinyMCE API
- 端点：`POST /rest/tinymce/1/content/{pageId}/comment`
- 专为编辑器优化
- 更轻量级的权限检查
- 直接返回HTML格式的内容

## 优势分析

### 为什么TinyMCE端点更适合Confluence 7.4？

1. **性能优化**：
   - 避免了复杂的权限继承查询
   - 专门针对编辑器场景优化
   - 减少数据库查询次数

2. **响应格式优化**：
   - 直接返回HTML内容
   - 包含操作按钮信息
   - 支持异步渲染

3. **兼容性更好**：
   - Confluence界面实际使用的API
   - 经过充分测试和优化
   - 与前端编辑器集成良好

## 需要确认的信息

### 确认的请求载荷格式 ✅

**实际载荷格式（application/x-www-form-urlencoded）：**

```
html=%3Cp%3Ewell%3C%2Fp%3E&watch=false&uuid=c19dc906-70a3-330f-6222-e842fb767266
```

**解码后的字段：**
```javascript
{
    "html": "<p>well</p>",           // HTML格式的评论内容
    "watch": "false",                // 是否监听页面变化
    "uuid": "c19dc906-70a3-330f-6222-e842fb767266"  // 唯一标识符
}
```

**关键发现：**
- ❌ 不是JSON格式
- ✅ 是表单数据格式（application/x-www-form-urlencoded）
- ✅ 需要包含uuid字段
- ✅ watch字段固定为false

### 测试建议

1. **查看浏览器开发者工具**：
   - 打开网络标签
   - 创建一条评论
   - 查看请求载荷（Request Payload）

2. **测试不同场景**：
   - 普通评论创建
   - 回复评论创建
   - 不同内容格式

## 实现状态

目前我们的实现包含：
- 多种载荷格式的自动尝试
- 详细的调试日志
- 标准API的备用方案
- 完整的错误处理

---

*需要用户提供实际的请求载荷数据来完善实现* 

# Confluence 行内评论双API支持技术分析

## 概述

行内评论功能现在支持两种API实现方式，与普通评论功能保持一致的双API策略：
- **自定义API** (`/rest/inlinecomments/1.0/`) - Confluence浏览器实际使用的端点
- **标准API** (`/wiki/api/v2/inline-comments`) - Confluence官方REST API v2端点

这种设计确保了最大的兼容性和稳定性，用户可以根据环境需求选择合适的API策略。

## API变更对比

### 1. 创建行内评论

#### 旧版API（自定义端点）
```javascript
POST /rest/inlinecomments/1.0/comments
{
  "originalSelection": "选中的文本",
  "body": "<p>评论内容</p>",
  "matchIndex": 0,
  "numMatches": 1,
  "serializedHighlights": "[...]",
  "containerId": "pageId",
  "parentCommentId": "0",
  "lastFetchTime": "timestamp",
  "hasDeletePermission": true,
  "hasEditPermission": true,
  "hasResolvePermission": true,
  "resolveProperties": {...},
  "deleted": false
}
```

#### 新版API（标准端点）
```javascript
POST /wiki/api/v2/inline-comments
{
  "pageId": "页面ID",
  "parentCommentId": "父评论ID（可选）",
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

### 2. 更新行内评论

#### 旧版API
- **不支持更新功能**
- 抛出错误提示无法更新

#### 新版API（标准端点）
```javascript
PUT /wiki/api/v2/inline-comments/{commentId}
{
  "version": {
    "number": 2,
    "message": "更新说明"
  },
  "body": {
    "representation": "storage",
    "value": "<p>新的评论内容</p>"
  }
}
```

### 3. 删除行内评论

#### 旧版API（自定义端点）
```javascript
DELETE /rest/inlinecomments/1.0/comments/{commentId}
```

#### 新版API（标准端点）
```javascript
DELETE /wiki/api/v2/inline-comments/{commentId}
```

### 4. 回复行内评论

#### 旧版API（自定义端点）
```javascript
POST /rest/inlinecomments/1.0/comments/{commentId}/replies?containerId={pageId}
{
  "body": "<p>回复内容</p>",
  "commentId": "commentId",
  "hasDeletePermission": true,
  "hasEditPermission": true
}
```

#### 新版API（标准端点）
```javascript
POST /wiki/api/v2/inline-comments
{
  "pageId": "页面ID",
  "parentCommentId": "要回复的评论ID",
  "body": {
    "representation": "storage",
    "value": "<p>回复内容</p>"
  }
}
```

## 主要改进

### 1. 标准化
- **API规范**: 使用Confluence官方REST API v2标准
- **数据格式**: 统一的JSON数据结构
- **错误处理**: 标准化的HTTP状态码和错误响应

### 2. 功能增强
- **更新支持**: 新版API正式支持行内评论更新功能
- **版本控制**: 支持版本号管理，避免并发冲突
- **扩展性**: 更好的扩展和维护性

### 3. 兼容性
- **向后兼容**: 通过统一的 `manageComments` 工具保持接口不变
- **错误回退**: 保留错误处理和重试机制
- **参数映射**: 自动将旧参数映射到新API格式

## 使用示例

### 创建行内评论
```javascript
await confluenceService.createInlineComment(
  'pageId123',
  '这是一个行内评论',
  '选中的文本',
  0,  // matchIndex
  1,  // numMatches
  undefined,  // serializedHighlights
  undefined   // parentCommentId
);
```

### 更新行内评论（新功能）
```javascript
await confluenceService.updateInlineComment({
  commentId: 'comment123',
  content: '更新后的评论内容',
  version: 2
});
```

### 回复行内评论
```javascript
await confluenceService.replyInlineComment({
  commentId: 'comment123',
  pageId: 'pageId123',
  content: '这是一个回复'
});
```

## 错误处理改进

### 标准HTTP状态码
- `200 OK`: 成功操作
- `201 Created`: 成功创建
- `400 Bad Request`: 请求参数错误
- `401 Unauthorized`: 认证失败
- `403 Forbidden`: 权限不足
- `404 Not Found`: 资源不存在
- `409 Conflict`: 版本冲突

### 重试机制
- 网络错误自动重试
- 可配置重试次数和延迟
- 指数退避算法

## 配置选项

### 超时设置
```javascript
const confluence = new ConfluenceService({
  baseUrl: 'https://your-confluence.com',
  auth: { username: 'user', password: 'pass' },
  timeout: 15000  // 15秒超时
});
```

### 日志记录
- 详细的调试日志
- 操作成功/失败记录
- 性能监控信息

## 迁移指南

### 对于现有用户
1. **无需修改代码**: 通过 `manageComments` 工具保持兼容
2. **自动映射**: 参数自动转换为标准API格式
3. **功能增强**: 现在支持更新行内评论

### 新功能使用
```javascript
// 使用统一工具创建行内评论
await manageComments({
  action: 'create',
  commentType: 'inline',
  pageId: 'pageId123',
  content: '行内评论内容',
  originalSelection: '选中文本'
});

// 更新行内评论（新功能）
await manageComments({
  action: 'update',
  commentType: 'inline',
  commentId: 'comment123',
  content: '更新内容',
  version: 2
});
```

## 注意事项

1. **API版本**: 确保Confluence实例支持REST API v2
2. **权限要求**: 需要相应的评论创建/编辑权限
3. **版本管理**: 更新操作需要正确的版本号
4. **文本选择**: 行内评论需要准确的文本选择信息

## 技术细节

### 请求头设置
```javascript
headers: {
  'Content-Type': 'application/json; charset=utf-8',
  'Accept': 'application/json; charset=utf-8'
}
```

### 响应格式
标准API返回完整的评论对象，包含：
- 评论ID和状态
- 版本信息
- 内容和元数据
- 行内评论特有属性

## 测试建议

1. **功能测试**: 验证所有CRUD操作
2. **边界测试**: 测试参数验证和错误处理
3. **性能测试**: 确保响应时间符合预期
4. **兼容性测试**: 在不同Confluence版本测试

## 总结

通过使用Confluence标准REST API v2，我们实现了：
- ✅ 完全符合官方API规范
- ✅ 支持所有行内评论操作（包括更新）
- ✅ 更好的错误处理和重试机制
- ✅ 向后兼容性保证
- ✅ 更强的可维护性和扩展性

这次更新确保了我们的行内评论功能与Confluence官方标准完全一致，为用户提供更稳定、更完整的行内评论体验。 