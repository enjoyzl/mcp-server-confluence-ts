# MCP Confluence 服务

这是一个基于 MCP (Model Context Protocol) 的 Confluence API 服务实现。该服务提供了与 Confluence 进行交互的能力，支持获取空间信息、页面内容、搜索等功能。

## 目录
- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [开发指南](#开发指南)
- [MCP 工具使用指南](#mcp-工具使用指南)
- [工具概览](#工具概览)
- [性能优化](#性能优化)
- [调试指南](#调试指南)
- [错误处理](#错误处理)

## 功能特性

### 🔐 认证方式
- **Access Token 认证**（推荐）
- **用户名密码认证**
- 支持多环境配置

### 🔧 MCP 工具架构（已优化）
- **工具合并优化**: 从12个工具精简为8个（减少33%）
- **统一API设计**: 通过action参数区分操作类型
- **智能参数验证**: 根据操作自动验证必需参数
- **完整参数注释**: MCP Inspector中可查看详细说明

### 📄 页面管理功能
- **`managePages`**: 统一页面管理工具 ⭐️
  - 创建页面（支持父页面和内容格式）
  - 更新页面（增量更新支持）
  - **删除页面** ⭐️ **新增功能**
  - 获取页面基本信息
  - 获取页面详细内容
- **`getPageByPrettyUrl`**: 通过标题精确获取页面
- **`getSpace`**: 获取空间信息

### 💬 评论管理功能  
- **`manageComments`**: 统一评论管理工具 ⭐️
  - **普通评论**: 创建、更新、删除、回复
  - **行内评论**: 创建、更新、删除、回复
  - 支持评论版本控制和监视
- **`getPageComments`**: 获取页面所有评论（支持分页）
- **`getComment`**: 获取单个评论详情

### 🔍 搜索功能
- **`searchContent`**: 全文搜索内容（支持CQL语法）
- **`searchComments`**: 搜索评论内容（支持空间限定）
- **错误回退机制**: CQL语法错误时自动尝试基本搜索

### ⚡ 性能优化
- **HTTP 连接复用**: Keep-Alive支持
- **响应压缩**: 自动压缩传输
- **请求超时控制**: 可配置超时时间
- **错误重试机制**: 自动重试失败请求

### 📊 日志和监控
- **结构化日志输出**: JSON格式日志
- **请求耗时统计**: 性能监控
- **详细错误信息**: 便于调试
- **操作记录追踪**: 完整的操作日志

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

## MCP 工具使用指南

### 🚀 工具架构优化

本服务已完成工具架构优化，按功能和使用频率重新组织：

```
📁 1. 基础信息工具（最常用）
📁 2. 页面管理工具（核心功能）  
📁 3. 评论管理工具（扩展功能）
📁 4. 搜索工具（专用搜索）
```

### 🔧 MCP 工具列表

#### 1. 基础信息工具 - 最常用的查询功能

**`getSpace`** - 获取空间信息
```json
{
  "name": "getSpace",
  "arguments": {
    "spaceKey": "DEV"
  }
}
```

**`getPageByPrettyUrl`** - 根据标题精确获取页面  
```json
{
  "name": "getPageByPrettyUrl",
  "arguments": {
    "spaceKey": "DEV",
    "title": "API 开发指南"
  }
}
```

#### 2. 页面管理工具 - 核心功能

**`managePages`** - 统一页面管理 ⭐️ **合并优化**

**创建页面：**
```json
{
  "name": "managePages",
  "arguments": {
    "action": "create",
    "spaceKey": "DEV",
    "title": "新页面标题",
    "content": "<p>页面内容</p>",
    "parentId": "123456789",
    "representation": "storage"
  }
}
```

**更新页面：**
```json
{
  "name": "managePages",
  "arguments": {
    "action": "update",
    "pageId": "123456789",
    "title": "更新的标题",
    "content": "<p>更新的内容</p>",
    "version": 2,
    "representation": "storage"
  }
}
```

**删除页面：** ⭐️ **新增功能**
```json
{
  "name": "managePages",
  "arguments": {
    "action": "delete",
    "pageId": "123456789"
  }
}
```

**获取页面基本信息：**
```json
{
  "name": "managePages",
  "arguments": {
    "action": "get",
    "pageId": "123456789"
  }
}
```

**获取页面详细内容：**
```json
{
  "name": "managePages",
  "arguments": {
    "action": "getContent",
    "pageId": "123456789",
    "expand": "body.storage,version,space"
  }
}
```

#### 3. 评论管理工具 - 扩展功能

**`manageComments`** - 统一评论管理 ⭐️ **合并优化**

**创建普通评论：**
```json
{
  "name": "manageComments",
  "arguments": {
    "action": "create",
    "commentType": "regular",
    "pageId": "123456789",
    "content": "这是一条普通评论",
    "representation": "storage"
  }
}
```

**创建行内评论：**
```json
{
  "name": "manageComments",
  "arguments": {
    "action": "create",
    "commentType": "inline",
    "pageId": "123456789",
    "content": "这里需要注意性能问题",
    "originalSelection": "QueryHoldingsService.setHoldingData()",
    "matchIndex": 0,
    "numMatches": 1
  }
}
```

**更新评论：**
```json
{
  "name": "manageComments",
  "arguments": {
    "action": "update",
    "commentType": "regular",
    "commentId": "98765432",
    "content": "更新后的评论内容",
    "version": 2
  }
}
```

**删除评论：**
```json
{
  "name": "manageComments",
  "arguments": {
    "action": "delete",
    "commentType": "regular",
    "commentId": "98765432"
  }
}
```

**回复普通评论：**
```json
{
  "name": "manageComments",
  "arguments": {
    "action": "reply",
    "commentType": "regular",
    "pageId": "123456789",
    "parentCommentId": "98765432",
    "content": "这是一条回复",
    "watch": false
  }
}
```

**回复行内评论：**
```json
{
  "name": "manageComments",
  "arguments": {
    "action": "reply",
    "commentType": "inline",
    "commentId": "98765432",
    "pageId": "123456789",
    "content": "这是对行内评论的回复"
  }
}
```

**`getPageComments`** - 获取页面所有评论
```json
{
  "name": "getPageComments",
  "arguments": {
    "pageId": "123456789",
    "start": 0,
    "limit": 25
  }
}
```

**`getComment`** - 获取单个评论详情
```json
{
  "name": "getComment",
  "arguments": {
    "commentId": "98765432"
  }
}
```

#### 4. 搜索工具 - 专用搜索功能

**`searchContent`** - 搜索页面内容（支持CQL）
```json
{
  "name": "searchContent",
  "arguments": {
    "query": "API 开发"
  }
}
```

**`searchComments`** - 搜索评论内容
```json
{
  "name": "searchComments",
  "arguments": {
    "query": "性能优化",
    "spaceKey": "DEV",
    "start": 0,
    "limit": 25
  }
}
```

### 📝 参数说明

#### action 参数选项：
- **页面管理**: `create`, `update`, `delete`, `get`, `getContent`
- **评论管理**: `create`, `update`, `delete`, `reply`

#### commentType 参数选项：
- **`regular`** (默认): 普通评论
- **`inline`**: 行内评论

#### representation 参数选项：
- **`storage`** (推荐): HTML存储格式
- **`wiki`**: Wiki标记语法
- **`editor2`**: 编辑器格式  
- **`view`**: 查看格式

### 🎯 优化亮点

✅ **工具数量优化**: 从12个工具合并为8个（减少33%）  
✅ **统一API设计**: 通过action参数区分操作类型  
✅ **智能参数验证**: 根据操作类型自动验证必需参数  
✅ **完整参数注释**: MCP Inspector中可查看详细参数说明  
✅ **新增删除功能**: 支持删除页面操作  
✅ **双评论类型**: 统一管理普通评论和行内评论

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

## 工具概览

### 🎯 架构优化后的工具分组

经过架构优化，工具按使用频率和逻辑分组重新组织：

#### 📁 1. 基础信息工具（最常用）
- `getSpace` - 获取空间信息
- `getPageByPrettyUrl` - 根据标题精确获取页面

#### 📁 2. 页面管理工具（核心功能）
- `managePages` ⭐️ - 统一页面管理（create/update/delete/get/getContent）

#### 📁 3. 评论管理工具（扩展功能）
- `manageComments` ⭐️ - 统一评论管理（create/update/delete/reply，支持普通+行内评论）
- `getPageComments` - 获取页面所有评论
- `getComment` - 获取单个评论详情

#### 📁 4. 搜索工具（专用搜索）
- `searchContent` - 搜索页面内容（支持CQL语法）
- `searchComments` - 搜索评论内容

### 📊 优化成果
- **工具数量**: 从12个优化为8个（减少33%）
- **API统一**: 合并同类功能，通过action参数区分操作
- **功能增强**: 新增页面删除、完善参数注释
- **体验提升**: 按使用频率排序，提高查找效率

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