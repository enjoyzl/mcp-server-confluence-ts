# MCP Confluence 服务

这是一个基于 MCP (Model Context Protocol) 的 Confluence API 服务实现。该服务提供了与 Confluence 进行交互的能力，支持获取空间信息、页面内容、搜索等功能。

## 功能特性

- 支持基本的 Confluence API 操作
  - 获取空间信息
  - 获取页面内容
  - 搜索内容
  - 获取页面详细信息
- 内置性能优化
  - HTTP 连接复用
  - 响应压缩
  - 请求超时控制
- 完善的错误处理和日志记录
  - 结构化日志输出
  - 请求耗时统计
  - 详细的错误信息

## 环境要求

- Node.js >= 14.0.0
- TypeScript >= 4.0.0

## 安装

```bash
npm install
```

## 配置

### 环境变量配置

在项目根目录创建 `.env` 文件，配置以下环境变量：

```env
# Confluence 配置
CONFLUENCE_URL=https://your-confluence-url
CONFLUENCE_USERNAME=your-username
CONFLUENCE_PASSWORD=your-password

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
      "command": "bash",
      "args": [
        "-c",
        "cd /Users/your-username/workspace/mcp/mcp-server-confluence-ts && node dist/index.js"
      ]
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

### 配置项说明

#### Confluence 配置
- `CONFLUENCE_URL`: Confluence 服务器地址
- `CONFLUENCE_USERNAME`: Confluence 用户名
- `CONFLUENCE_PASSWORD`: Confluence 密码
- `TIMEOUT`: 请求超时时间（毫秒）
- `REJECT_UNAUTHORIZED`: 是否验证 SSL 证书

#### 服务器配置
- `PORT`: 服务器端口
- `NODE_ENV`: 运行环境（development/production）
- `SERVER_TIMEOUT`: 服务器超时时间（毫秒）

## 使用方法

### 启动服务

```bash
npm start
```

### 使用 MCP Inspector 调试

MCP Inspector 是一个用于测试和调试 MCP 服务器的开发工具。您可以使用以下方式启动调试：

```bash
# 基本用法
npx @modelcontextprotocol/inspector node dist/index.js

# 使用环境变量
npx @modelcontextprotocol/inspector -e CONFLUENCE_URL=your-url -e CONFLUENCE_USERNAME=your-username -e CONFLUENCE_PASSWORD=your-password node dist/index.js

# 自定义端口
CLIENT_PORT=8080 SERVER_PORT=9000 npx @modelcontextprotocol/inspector node dist/index.js
```

访问 http://localhost:6274 使用可视化界面进行调试。

### 使用 Smithery 运行

本项目支持通过 Smithery 运行，配置文件 `smithery.yaml` 已包含必要的设置：

```bash
npx @smithery/cli@latest run @enjoyzl/mcp-server-confluence-ts --config '{
  "confluenceUrl": "your-confluence-url",
  "confluenceUsername": "your-username",
  "confluencePassword": "your-password"
}'
```

### API 功能

1. 获取空间信息
```typescript
const space = await confluenceService.getSpace('SPACE_KEY');
```

2. 获取页面信息
```typescript
const page = await confluenceService.getPage('PAGE_ID');
```

3. 搜索内容
```typescript
const results = await confluenceService.searchContent('search query');
```

4. 获取页面详细内容
```typescript
const content = await confluenceService.getPageContent('PAGE_ID');
```

### 高级配置

可以通过传入配置对象来自定义服务行为：

```typescript
const confluenceService = new ConfluenceService({
  baseUrl: 'https://your-confluence-url',
  username: 'your-username',
  password: 'your-password',
  timeout: 10000,
  maxRedirects: 5,
  keepAlive: true,
  maxContentLength: 10 * 1024 * 1024 // 10MB
});
```

#### 配置选项

- `baseUrl`: Confluence 服务器地址
- `username`: 用户名
- `password`: 密码
- `timeout`: 请求超时时间（毫秒）
- `maxRedirects`: 最大重定向次数（默认 5）
- `keepAlive`: 是否启用连接复用（默认 true）
- `maxContentLength`: 最大响应内容大小（默认 10MB）
- `rejectUnauthorized`: 是否验证 SSL 证书（默认 true）

## 性能优化

服务内置了多项性能优化措施：

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

### UI 模式（推荐）

使用 MCP Inspector 的可视化界面进行调试：

1. 启动调试服务器：
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

2. 在浏览器中访问 http://localhost:6274

3. 可用功能：
   - 工具测试：可视化参数输入和响应查看
   - 请求历史：查看所有请求记录
   - 实时通知：显示服务器状态变化
   - 错误可视化：直观展示错误信息

### CLI 模式

适用于自动化测试和脚本集成：

```bash
# 列出可用工具
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/list

# 测试特定工具
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/call --tool-name getSpace --tool-arg spaceKey=TEST

# 带环境变量的测试
npx @modelcontextprotocol/inspector --cli -e CONFLUENCE_URL=your-url node dist/index.js --method tools/call --tool-name getPage --tool-arg pageId=123456
```

## 日志

服务使用结构化日志输出，包含以下信息：

- 请求/响应详情
- 执行时间统计
- 错误信息
- 调试信息

日志格式示例：
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

服务会处理以下类型的错误：

- 网络错误
- 认证错误
- API 错误
- 超时错误

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

## 贡献

欢迎提交 Issue 和 Pull Request。

## 许可证

[MIT License](LICENSE) 