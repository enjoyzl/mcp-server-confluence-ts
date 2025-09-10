# 评论管理功能使用指南

## 🚀 概述

经过架构优化，评论管理功能已完全重构为统一的工具体系，支持普通评论和行内评论的所有操作。

### 🎯 架构优化亮点
- **工具合并**: 8个分散工具合并为4个统一工具（减少50%）
- **双评论支持**: 统一管理普通评论和行内评论 ⭐️
- **智能切换**: 通过commentType参数自动切换评论类型
- **完整功能**: 支持创建、更新、删除、回复所有操作

## 📁 工具分组架构

### 3. 评论管理工具（扩展功能）
- **manageComments** ⭐️ - 统一评论管理（create/update/delete/reply）
- **getPageComments** - 获取页面所有评论（支持分页）
- **getComment** - 获取单个评论详情
- **searchComments** - 搜索评论内容

## manageComments 工具详细说明

### 参数说明

#### 必需参数
- `action`: 操作类型，可选值：
  - `create` - 创建评论
  - `update` - 更新评论
  - `delete` - 删除评论
  - `reply` - 回复评论

#### 可选参数
- `commentType`: 评论类型，默认为 `regular`
  - `regular` - 普通评论（默认值）
  - `inline` - 行内评论

#### 通用参数
- `pageId`: 页面ID（字符串）
- `commentId`: 评论ID（字符串）
- `content`: 评论内容（字符串）

#### 普通评论专用参数
- `representation`: 内容表示格式，可选值：`storage`、`wiki`、`editor2`、`view`
- `parentCommentId`: 父评论ID（用于创建子评论）
- `version`: 版本号（用于更新）
- `watch`: 是否监视（布尔值，默认false）

#### 行内评论专用参数
- `originalSelection`: 原始选中文本（必需）
- `matchIndex`: 匹配索引（数字，默认0）
- `numMatches`: 匹配数量（数字，默认1）
- `serializedHighlights`: 序列化高亮信息（字符串）

## 使用示例

### 1. 创建普通评论

```json
{
  "action": "create",
  "commentType": "regular",
  "pageId": "123456",
  "content": "这是一个普通评论",
  "representation": "storage"
}
```

### 2. 创建行内评论

```json
{
  "action": "create",
  "commentType": "inline",
  "pageId": "123456",
  "content": "这是对选中文本的行内评论",
  "originalSelection": "选中的文本内容"
}
```

### 3. 更新普通评论

```json
{
  "action": "update",
  "commentType": "regular",
  "commentId": "789012",
  "content": "更新后的评论内容",
  "version": 2
}
```

### 4. 更新行内评论

```json
{
  "action": "update",
  "commentType": "inline",
  "commentId": "789012",
  "content": "更新后的行内评论内容"
}
```

### 5. 删除评论

```json
{
  "action": "delete",
  "commentType": "regular",
  "commentId": "789012"
}
```

或者删除行内评论：

```json
{
  "action": "delete",
  "commentType": "inline",
  "commentId": "789012"
}
```

### 6. 回复普通评论

```json
{
  "action": "reply",
  "commentType": "regular",
  "pageId": "123456",
  "parentCommentId": "789012",
  "content": "这是对评论的回复",
  "watch": true
}
```

### 7. 回复行内评论

```json
{
  "action": "reply",
  "commentType": "inline",
  "commentId": "789012",
  "pageId": "123456",
  "content": "这是对行内评论的回复"
}
```

## 错误处理

工具会自动验证必需的参数，并返回相应的错误信息：

- 缺少必需参数时会抛出具体的错误说明
- 不支持的操作类型会返回错误
- API调用失败会返回详细的错误信息

## 迁移指南

### 从旧工具迁移到新工具

| 旧工具名称 | 新工具调用方式 |
|------------|----------------|
| `createComment` | `manageComments` with `action: "create", commentType: "regular"` |
| `createInlineComment` | `manageComments` with `action: "create", commentType: "inline"` |
| `updateComment` | `manageComments` with `action: "update", commentType: "regular"` |
| `updateInlineComment` | `manageComments` with `action: "update", commentType: "inline"` |
| `deleteComment` | `manageComments` with `action: "delete", commentType: "regular"` |
| `deleteInlineComment` | `manageComments` with `action: "delete", commentType: "inline"` |
| `replyComment` | `manageComments` with `action: "reply", commentType: "regular"` |
| `replyInlineComment` | `manageComments` with `action: "reply", commentType: "inline"` |

## 优势

1. **简化API**: 减少了工具数量，从8个评论相关工具减少到4个
2. **统一参数**: 通过 `commentType` 参数统一区分普通评论和行内评论
3. **更好的维护性**: 集中的逻辑更容易维护和扩展
4. **向后兼容**: 保留了所有原有功能，只是调用方式有所变化
5. **清晰的错误处理**: 统一的错误处理和参数验证

## 注意事项

1. 行内评论的更新功能由于Confluence API限制，可能无法正常工作
2. 某些操作需要特定的权限，请确保用户有足够的权限
3. 建议在生产环境使用前先在测试环境验证功能 