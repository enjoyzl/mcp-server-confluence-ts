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