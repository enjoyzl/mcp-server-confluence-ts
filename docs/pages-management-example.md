# 页面管理功能使用指南

## 概述

为了简化页面管理工具的使用，我们将原本分散的页面相关工具合并为一个统一的 `managePages` 工具。该工具支持页面的创建、更新、删除、获取等所有基本操作。

## 工具列表

### 主要工具

1. **managePages** - 统一的页面管理工具
2. **getPageByPrettyUrl** - 通过Pretty URL获取页面（特殊用途）
3. **searchContent** - 搜索内容
4. **getSpace** - 获取空间信息

## managePages 工具详细说明

### 参数说明

#### 必需参数
- `action`: 操作类型，可选值：
  - `create` - 创建页面
  - `update` - 更新页面
  - `delete` - 删除页面
  - `get` - 获取页面基本信息
  - `getContent` - 获取页面详细内容

#### 通用参数
- `pageId`: 页面ID（字符串）
- `spaceKey`: 空间Key（字符串）
- `title`: 页面标题（字符串）
- `content`: 页面内容（字符串）

#### 创建/更新页面专用参数
- `parentId`: 父页面ID（字符串，可选）
- `representation`: 内容表示格式，可选值：`storage`、`wiki`、`editor2`、`view`
- `version`: 版本号（数字，用于更新）

#### 获取页面专用参数
- `expand`: 扩展参数（字符串，可选）

## 使用示例

### 1. 创建页面

```json
{
  "action": "create",
  "spaceKey": "DEV",
  "title": "新功能设计文档",
  "content": "<h1>新功能设计</h1><p>这是一个新功能的设计文档。</p>",
  "representation": "storage"
}
```

### 2. 在特定父页面下创建子页面

```json
{
  "action": "create",
  "spaceKey": "DEV",
  "title": "API接口文档",
  "content": "<h1>API接口</h1><p>详细的API接口说明。</p>",
  "parentId": "123456",
  "representation": "storage"
}
```

### 3. 更新页面

```json
{
  "action": "update",
  "pageId": "789012",
  "title": "更新后的标题",
  "content": "<h1>更新内容</h1><p>这是更新后的页面内容。</p>",
  "version": 2
}
```

### 4. 仅更新页面内容（保持标题不变）

```json
{
  "action": "update",
  "pageId": "789012",
  "content": "<h1>新内容</h1><p>只更新内容，标题保持不变。</p>"
}
```

### 5. 删除页面

```json
{
  "action": "delete",
  "pageId": "789012"
}
```

### 6. 获取页面基本信息

```json
{
  "action": "get",
  "pageId": "789012"
}
```

### 7. 获取页面详细内容

```json
{
  "action": "getContent",
  "pageId": "789012"
}
```

## 错误处理

工具会自动验证必需的参数，并返回相应的错误信息：

- 缺少必需参数时会抛出具体的错误说明
- 不支持的操作类型会返回错误
- API调用失败会返回详细的错误信息
- 权限不足会返回相应的权限错误

## 迁移指南

### 从旧工具迁移到新工具

| 旧工具名称 | 新工具调用方式 |
|------------|----------------|
| `createPage` | `managePages` with `action: "create"` |
| `updatePage` | `managePages` with `action: "update"` |
| `getPage` | `managePages` with `action: "get"` |
| `getPageContent` | `managePages` with `action: "getContent"` |
| **新增** `deletePage` | `managePages` with `action: "delete"` |

### 保留的独立工具

这些工具因为有特殊用途或不同的参数结构，所以保持独立：

- `getPageByPrettyUrl` - 通过空间Key和标题获取页面
- `searchContent` - 内容搜索
- `getSpace` - 获取空间信息

## 页面内容格式

### Storage 格式（推荐）

```html
<h1>标题</h1>
<p>这是一个段落。</p>
<ul>
  <li>列表项1</li>
  <li>列表项2</li>
</ul>
```

### Wiki 格式

```
h1. 标题

这是一个段落。

* 列表项1
* 列表项2
```

## 最佳实践

### 1. 页面创建
- 始终指定 `spaceKey`、`title` 和 `content`
- 使用 `storage` 格式以获得最佳兼容性
- 考虑设置 `parentId` 来组织页面层次结构

### 2. 页面更新
- 总是传递正确的 `version` 参数以避免并发冲突
- 如果只更新内容，可以省略 `title` 参数
- 使用与原始页面相同的 `representation` 格式

### 3. 页面删除
- **注意**: 删除操作不可逆，请谨慎使用
- 删除父页面会影响其子页面
- 确保有足够的权限进行删除操作

### 4. 权限检查
确保执行操作的用户具有以下权限：
- 创建页面：空间的"添加页面"权限
- 更新页面：页面的"编辑"权限
- 删除页面：页面的"删除"权限
- 查看页面：页面的"查看"权限

## 错误代码说明

| 错误代码 | 说明 | 解决方案 |
|----------|------|----------|
| 400 | 请求参数错误 | 检查必需参数是否齐全 |
| 401 | 认证失败 | 检查Token或用户名密码 |
| 403 | 权限不足 | 确保用户有相应权限 |
| 404 | 页面或空间不存在 | 检查pageId或spaceKey |
| 409 | 版本冲突 | 获取最新版本号后重试 |

## 合并优势

1. **简化API**: 从多个页面工具减少到1个主要工具
2. **统一操作**: 通过 `action` 参数统一区分不同功能
3. **新增功能**: 增加了页面删除功能
4. **更好维护**: 集中的逻辑更容易维护和扩展
5. **向后兼容**: 保留了特殊用途的独立工具

## 注意事项

1. 删除页面操作是永久性的，无法撤销
2. 更新页面时建议总是传递版本号以避免冲突
3. 某些操作需要特定的权限，请确保用户有足够的权限
4. 建议在生产环境使用前先在测试环境验证功能 