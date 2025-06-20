# Confluence 行内评论功能

行内评论允许用户对页面内容中的特定文本段落进行评论，这些评论会以高亮的形式显示在原文旁边。

## 功能特性

- ✅ 创建行内评论 - 对选中的文本内容添加评论
- ✅ 更新行内评论 - 修改已存在的行内评论
- ✅ 删除行内评论 - 删除不需要的行内评论
- ✅ 支持中文内容 - 完整的UTF-8编码支持
- ✅ 自动高亮定位 - 基于文本选择的智能定位

## API 端点

行内评论使用专用的API端点：
```
POST   /rest/inlinecomments/1.0/comments     - 创建行内评论
PUT    /rest/inlinecomments/1.0/comments/{id} - 更新行内评论
DELETE /rest/inlinecomments/1.0/comments/{id} - 删除行内评论
```

## 使用示例

### 1. 创建行内评论

对页面内容中的特定文本添加评论：

```typescript
// 基本用法
const comment = await confluenceService.createInlineComment(
  "98860890",                           // 页面ID
  "这里需要注意性能优化",                  // 评论内容
  "QueryHoldingsService.setHoldingData()" // 选中的原文本
);

// 完整参数用法
const comment = await confluenceService.createInlineComment(
  "98860890",                           // 页面ID
  "这里需要注意性能优化",                  // 评论内容
  "QueryHoldingsService.setHoldingData()", // 选中的原文本
  2,                                    // 匹配索引（可选）
  3,                                    // 匹配总数（可选）
  '[[\"QueryHoldingsService.setHoldingData()\",\"123:1:0:0\",0,37]]', // 序列化高亮（可选）
  "0"                                   // 父评论ID（可选，0表示顶级评论）
);
```

### 2. 更新行内评论

修改已存在的行内评论：

```typescript
const updatedComment = await confluenceService.updateInlineComment({
  commentId: "101627438",
  content: "更新后的评论内容",
  version: 1
});
```

### 3. 删除行内评论

删除不需要的行内评论：

```typescript
await confluenceService.deleteInlineComment("101627438");
```

## MCP 工具使用

### createInlineComment

```json
{
  "method": "tools/call",
  "params": {
    "name": "createInlineComment",
    "arguments": {
      "pageId": "98860890",
      "content": "注意性能优化",
      "originalSelection": "QueryHoldingsService.setHoldingData()",
      "matchIndex": 2,
      "numMatches": 3
    }
  }
}
```

### updateInlineComment

```json
{
  "method": "tools/call",
  "params": {
    "name": "updateInlineComment",
    "arguments": {
      "commentId": "101627438",
      "content": "更新后的评论内容",
      "version": 1
    }
  }
}
```

### deleteInlineComment

```json
{
  "method": "tools/call",
  "params": {
    "name": "deleteInlineComment",
    "arguments": {
      "commentId": "101627438"
    }
  }
}
```

## 参数说明

### createInlineComment 参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| pageId | string | ✅ | 页面ID |
| content | string | ✅ | 评论内容 |
| originalSelection | string | ✅ | 选中的原文本 |
| matchIndex | number | ❌ | 匹配索引，默认为0 |
| numMatches | number | ❌ | 匹配总数，默认为1 |
| serializedHighlights | string | ❌ | 序列化的高亮信息 |
| parentCommentId | string | ❌ | 父评论ID，默认为"0" |

### updateInlineComment 参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| commentId | string | ✅ | 评论ID |
| content | string | ✅ | 新的评论内容 |
| version | number | ❌ | 评论版本号（可选，会自动从现有评论获取） |

**注意**: 实际的更新API需要完整的评论对象，包括：
- 作者信息 (authorDisplayName, authorUserName, authorAvatarUrl)
- 权限信息 (hasDeletePermission, hasEditPermission, hasResolvePermission)
- 元数据 (markerRef, commentDateUrl, containerId, lastFetchTime)
- 状态信息 (resolved, deleted, active)

系统会自动从现有评论中获取这些信息并构造完整的更新请求。

### deleteInlineComment 参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| commentId | string | ✅ | 要删除的评论ID |

## 高级功能

### 1. 序列化高亮定位

`serializedHighlights` 参数用于精确定位文本在页面中的位置：

```json
"serializedHighlights": "[[\"选中文本\",\"页面位置信息\",起始位置,文本长度]]"
```

示例：
```json
"serializedHighlights": "[[\"QueryHoldingsService.setHoldingData()\",\"123:1:0:0\",0,37]]"
```

### 2. 匹配索引和数量

当页面中有多个相同文本时，可以使用 `matchIndex` 和 `numMatches` 来指定具体位置：

- `matchIndex`: 目标文本在所有匹配中的索引（从0开始）
- `numMatches`: 页面中相同文本的总数

### 3. 回复行内评论

通过设置 `parentCommentId` 可以创建对现有行内评论的回复：

```typescript
const reply = await confluenceService.createInlineComment(
  "98860890",
  "我同意这个观点",
  "QueryHoldingsService.setHoldingData()",
  undefined,
  undefined,
  undefined,
  "101627438" // 父评论ID
);
```

## 错误处理

常见错误及解决方案：

### 权限错误 (403)
```
Error: Permission denied: You do not have permission to comment on this page
```
**解决方案**: 确保用户有页面评论权限

### 页面不存在 (404)
```
Error: Page not found: The specified page does not exist
```
**解决方案**: 检查页面ID是否正确

### 文本定位失败
```
Error: Could not locate the specified text in the page
```
**解决方案**: 
- 检查 `originalSelection` 是否与页面内容完全匹配
- 确认 `matchIndex` 和 `numMatches` 参数正确
- 验证 `serializedHighlights` 格式

## 最佳实践

1. **精确文本选择**: 确保 `originalSelection` 与页面中的文本完全匹配
2. **版本管理**: 更新评论时使用正确的版本号
3. **错误重试**: 对于临时网络错误，实现重试机制
4. **批量操作**: 避免短时间内大量创建评论
5. **内容编码**: 确保中文等特殊字符正确编码

## 技术说明

### API 兼容性

- 支持 Confluence 7.4+ 版本
- 使用 `/rest/inlinecomments/1.0/` API
- 完全兼容浏览器行内评论功能

### 字符编码

- 全程UTF-8编码支持
- 正确处理中文等多字节字符
- HTTP头包含明确的字符集声明

### 性能优化

- 内置重试机制
- 智能错误处理
- 请求超时控制 