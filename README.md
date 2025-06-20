# MCP Confluence 服务

这是一个基于 MCP (Model Context Protocol) 的 Confluence API 服务实现。该服务提供了与 Confluence 进行交互的能力，支持获取空间信息、页面内容、搜索等功能。

## 目录
- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [开发指南](#开发指南)
- [API使用](#api使用)
- [性能优化](#性能优化)
- [调试指南](#调试指南)
- [错误处理](#错误处理)

## 功能特性

- 支持多种认证方式
  - Access Token 认证（推荐）
  - 用户名密码认证
- 支持基本的 Confluence API 操作
  - **统一页面管理**
    - 创建、更新、删除页面
    - 获取页面信息和内容
    - 通过 Pretty URL 获取页面
  - **统一评论管理**
    - 普通评论：创建、更新、删除、回复
    - 行内评论：创建、更新、删除、回复
    - 获取页面评论和搜索评论
  - **内容搜索和空间管理**
    - 全文搜索内容
    - 获取空间信息
- 内置性能优化
  - HTTP 连接复用
  - 响应压缩
  - 请求超时控制
- 完善的错误处理和日志记录
  - 结构化日志输出
  - 请求耗时统计
  - 详细的错误信息

## 快速开始

### 环境要求

- Node.js >= 14.0.0
- TypeScript >= 4.0.0

### 安装

```bash
# 安装依赖
npm install
```

### 构建

```bash
# 清理并构建项目
npm run build:clean
```

### 启动服务

```bash
# 启动服务
npm start
```

## 配置说明

### 认证配置

服务支持两种认证方式，你可以选择其中一种：

#### 1. Access Token 认证（推荐）

在 `.env` 文件中配置：

```env
CONFLUENCE_URL=https://your-confluence-url
CONFLUENCE_ACCESS_TOKEN=your-access-token
```

#### 2. 用户名密码认证

在 `.env` 文件中配置：

```env
CONFLUENCE_URL=https://your-confluence-url
CONFLUENCE_USERNAME=your-username
CONFLUENCE_PASSWORD=your-password
```

### 其他配置项

```env
# 服务器配置
PORT=3000
NODE_ENV=development
TIMEOUT=10000
REJECT_UNAUTHORIZED=true
```

### Cursor IDE 配置

#### Windows 配置

1. 使用 Smithery（推荐）
在 `%USERPROFILE%\.cursor\mcp.json` 中添加：

```json
{
  "mcpServers": {
    "mcp-server-confluence-ts": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "@smithery/cli@latest",
        "run",
        "@enjoyzl/mcp-server-confluence-ts",
        "--config",
        "{\"confluenceUrl\":\"your-confluence-url\",\"confluenceUsername\":\"your-username\",\"confluencePassword\":\"your-password\"}"
      ]
    }
  }
}
```

2. 本地服务方式
在 `%USERPROFILE%\.cursor\mcp.json` 中添加：

```json
{
  "mcpServers": {
    "mcp-server-confluence-ts": {
      "command": "cmd",
      "args": [
        "/k",
        "cd",
        "/d",
        "D:\\workspace\\code\\mcp\\mcp-server-confluence-ts",
        "&",
        "node",
        "dist/index.js"
      ]
    }
  }
}
```

> **Windows 配置说明：**
> - `/k`: 执行命令后保持命令窗口，便于查看日志
> - `/d`: 切换到指定驱动器
> - 使用 `&` 连接多个命令
> - 路径使用双反斜杠 `\\` 转义
> - 环境变量可以在项目的 `.env` 文件中配置

#### Mac/Linux 配置

1. 使用 Smithery（推荐）
在 `~/.cursor/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "mcp-server-confluence-ts": {
      "command": "bash",
      "args": [
        "-c",
        "npx -y @smithery/cli@latest run @enjoyzl/mcp-server-confluence-ts --config '{\"confluenceUrl\":\"your-confluence-url\",\"confluenceUsername\":\"your-username\",\"confluencePassword\":\"your-password\"}'"
      ]
    }
  }
}
```

2. 本地服务方式
在 `~/.cursor/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "mcp-server-confluence-ts": {
      "command": "node",
      "args": ["/Users/your-username/workspace/code/mcp/mcp-server-confluence-ts/dist/index.js"],
      "env": {
        "CONFLUENCE_URL": "your-confluence-url",
        "CONFLUENCE_USERNAME": "youraccount",
        "CONFLUENCE_PASSWORD": "yourpwd",
      }
    }
  }
}
```

> **Mac/Linux 配置说明：**
> - `-c`: 执行命令字符串
> - 使用 `&&` 连接多个命令
> - 路径使用正斜杠 `/`
> - 环境变量可以在项目的 `.env` 文件中配置
> - Mac 用户主目录通常在 `/Users/your-username/`
> - Linux 用户主目录通常在 `/home/your-username/`

### 开发模式

```bash
# 监听文件变化并自动编译
npm run dev

# 监听文件变化并自动重启服务
npm run dev:start
```

### 构建命令

```bash
# 仅构建项目
npm run build

# 清理构建目录
npm run clean

# 清理并重新构建
npm run build:clean
```

### 调试工具

```bash
# 基本调试模式
npm run inspector

# 开发调试模式（带详细日志）
npm run inspector:dev
```

## API使用

### 基础API

1. 获取空间信息
```typescript
const space = await confluenceService.getSpace('SPACE_KEY');
```

2. 获取页面信息
```typescript
const page = await confluenceService.getPage('PAGE_ID');
```

3. 通过 Pretty URL 获取页面
```typescript
const page = await confluenceService.getPageByPrettyUrl('SPACE_KEY', 'PAGE_TITLE');
```

4. 创建页面
```typescript
const newPage = await confluenceService.createPage({
  spaceKey: 'SPACE_KEY',
  title: 'Page Title',
  content: 'Page Content',
  parentId: 'PARENT_PAGE_ID', // 可选
  representation: 'storage' // 可选，默认为 'storage'
});
```

5. 更新页面
```typescript
const updatedPage = await confluenceService.updatePage({
  id: 'PAGE_ID',
  title: 'Updated Title', // 可选
  content: 'Updated Content', // 可选
  version: 2, // 页面版本号
  representation: 'storage' // 可选，默认为 'storage'
});
```

6. 搜索内容
```typescript
const results = await confluenceService.searchContent('search query');
```

7. 获取页面详细内容
```typescript
const content = await confluenceService.getPageContent('PAGE_ID');
```

### 评论管理API

8. 获取页面评论
```typescript
// 获取页面所有评论
const comments = await confluenceService.getPageComments('PAGE_ID');

// 分页获取评论
const comments = await confluenceService.getPageComments('PAGE_ID', { 
  start: 0, 
  limit: 10 
});
```

9. 获取评论详情
```typescript
const comment = await confluenceService.getComment('COMMENT_ID');
```

10. 创建评论
```typescript
// 创建普通评论
const comment = await confluenceService.createComment({
  pageId: 'PAGE_ID',
  content: '这是一条评论',
  representation: 'storage' // 可选，默认为 'storage'
});

// 回复评论
const reply = await confluenceService.createComment({
  pageId: 'PAGE_ID',
  content: '这是一条回复',
  parentCommentId: 'PARENT_COMMENT_ID' // 父评论ID
});
```

11. 更新评论
```typescript
const updatedComment = await confluenceService.updateComment({
  id: 'COMMENT_ID',
  content: '更新后的评论内容',
  version: 2, // 评论版本号
  representation: 'storage' // 可选，默认为 'storage'
});
```

12. 删除评论
```typescript
await confluenceService.deleteComment('COMMENT_ID');
```

13. 搜索评论
```typescript
// 搜索所有评论
const searchResults = await confluenceService.searchComments('关键词');

// 在特定空间中搜索评论
const searchResults = await confluenceService.searchComments('关键词', {
  spaceKey: 'SPACE_KEY',
  start: 0,
  limit: 25
});
```

### 行内评论API

14. 创建行内评论
```typescript
// 基本用法：对页面中的特定文本创建行内评论
const inlineComment = await confluenceService.createInlineComment(
  'PAGE_ID',
  '这里需要注意性能优化',
  'QueryHoldingsService.setHoldingData()' // 选中的文本
);

// 完整用法：指定匹配位置
const inlineComment = await confluenceService.createInlineComment(
  'PAGE_ID',
  '这里需要注意性能优化',
  'QueryHoldingsService.setHoldingData()', // 选中的文本
  2,                                        // 匹配索引（当页面有多个相同文本时）
  3,                                        // 匹配总数
  '[[\"QueryHoldingsService.setHoldingData()\",\"123:1:0:0\",0,37]]', // 序列化高亮信息
  '0'                                       // 父评论ID（0表示顶级评论）
);
```

15. 更新行内评论
```typescript
const updatedInlineComment = await confluenceService.updateInlineComment({
  commentId: 'INLINE_COMMENT_ID',
  content: '更新后的行内评论内容'
  // version 参数可选，系统会自动从现有评论中获取
});
```

16. 删除行内评论
```typescript
await confluenceService.deleteInlineComment('INLINE_COMMENT_ID');
```

## 安全建议

1. 优先使用 Access Token 认证方式，这样更安全
2. 定期轮换 Access Token
3. 不要在代码中硬编码认证信息
4. 确保 `.env` 文件已添加到 `.gitignore` 中
5. 在生产环境中使用环境变量或安全的配置管理系统
6. 如果同时配置了两种认证方式，系统会优先使用 Access Token

## 注意事项

1. Access Token 和用户名密码认证方式只能选择其中一种
2. 如果同时配置了两种认证方式，系统会优先使用 Access Token
3. 确保配置的 URL 是正确的 Confluence API 地址
4. 在生产环境中建议使用 HTTPS

## 性能优化

1. 连接优化
   - 启用 HTTP Keep-Alive
   - 限制最大并发连接数
   - 控制空闲连接数

2. 请求优化
   - 响应压缩
   - 超时控制
   - 重定向限制

3. 错误处理
   - 自动重试机制
   - 详细的错误信息
   - 请求耗时统计

## 调试指南

### 日志输出

服务使用结构化日志输出，包含以下信息：

```json
{
  "jsonrpc": "2.0",
  "method": "log",
  "params": {
    "level": "info",
    "message": "请求信息",
    "timestamp": "2024-04-16T12:00:44.000Z"
  }
}
```

## 错误处理

错误响应格式：
```typescript
interface ErrorResponse {
  message: string;
  statusCode?: number;
  error?: any;
  config?: {
    url?: string;
    method?: string;
    params?: any;
  };
}
```

## 工具列表

### 页面管理（已合并）
- `managePages` - 统一页面管理（创建、更新、删除、获取）
- `getPageByPrettyUrl` - 通过Pretty URL获取页面（特殊用途）
- `searchContent` - 搜索内容
- `getSpace` - 获取空间信息

### 评论管理（已合并）
- `manageComments` - 统一评论管理（创建、更新、删除、回复）
- `getPageComments` - 获取页面评论
- `getComment` - 获取单个评论  
- `searchComments` - 搜索评论

## 文档

- [MCP Inspector 调试参数指南](docs/DEBUG-PARAMETER-GUIDE.md) ⭐️ **新增**
- [页面管理功能使用指南](docs/pages-management-example.md)
- [评论功能使用指南](docs/comments-merged-example.md)
- [搜索功能故障排除](docs/SEARCH-TROUBLESHOOTING.md)
- [行内评论示例](docs/inline-comments-example.md)
- [Confluence 7.4 兼容性](docs/CONFLUENCE-7.4-COMPATIBILITY.md)
- [故障排除](docs/CONFLUENCE-7.4-TROUBLESHOOTING.md)

## 贡献

欢迎提交 Issue 和 Pull Request。

## 许可证

[MIT License](LICENSE) 