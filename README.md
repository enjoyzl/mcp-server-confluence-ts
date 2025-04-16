# MCP Server for Confluence Integration

这是一个基于 Model Context Protocol (MCP) 的 Confluence 集成服务器，用于在 Cursor IDE 中提供 Confluence 内容访问功能。

## 目录

- [功能特点](#功能特点)
- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [使用方法](#使用方法)
- [测试指南](#测试指南)
- [API 文档](#api-文档)
- [开发指南](#开发指南)
- [故障排除](#故障排除)
- [许可证](#许可证)

## 功能特点

- 支持访问 Confluence 空间、页面和内容
- 提供搜索功能
- 支持内容预览
- 基于 MCP 协议的标准实现

## 系统要求

- Node.js 18+
- TypeScript 5.3+
- Confluence 实例（自托管或云版本）
- Windows 操作系统（配置使用了 Windows 命令行语法）

## 快速开始

1. **克隆仓库并安装依赖**
```bash
git clone [repository-url]
cd mcp-server-confluence-ts
npm install
```

2. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，填写您的 Confluence 配置
```

3. **构建并运行**
```bash
npm run build
npm start
```

## 配置说明

### 环境变量配置

在 `.env` 文件中配置：

```env
# Confluence 配置
CONFLUENCE_URL=your-confluence-url
CONFLUENCE_USERNAME=your-username
CONFLUENCE_PASSWORD=your-password

# 服务器配置
PORT=3000
NODE_ENV=development
```

### Cursor IDE 配置

在 `~/.cursor/mcp.json` 中添加：

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

## 使用方法

### 开发模式
```bash
npm run dev
```

### 生产模式
```bash
npm run build
npm start
```

### Docker 部署
```bash
# 构建镜像
docker build -t mcp-server-confluence-ts .

# 运行容器
docker run -d --name mcp-server \
  -e CONFLUENCE_URL=your-confluence-url \
  -e CONFLUENCE_USERNAME=your-username \
  -e CONFLUENCE_PASSWORD=your-password \
  mcp-server-confluence-ts
```

## 测试指南

### 1. UI 模式测试（推荐）

提供可视化界面，适合开发和调试：
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```
访问 http://localhost:6274

### 2. CLI 模式测试

适合自动化测试：
```bash
# 列出工具
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/list

# 测试空间信息
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/call --tool-name getSpace --tool-arg spaceKey=TEST

# 测试页面内容
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/call --tool-name getPage --tool-arg pageId=123456
```

### 3. Smithery 方式测试

```bash
npx @smithery/cli@latest run @enjoyzl/mcp-server-confluence-ts --config "{\"confluenceUrl\":\"your-confluence-url\",\"confluenceUsername\":\"your-username\",\"confluencePassword\":\"your-password\"}"
```

## API 文档

### 可用工具

| 工具名称 | 描述 | 参数 |
|---------|------|------|
| getSpace | 获取空间信息 | spaceKey: string |
| getPage | 获取页面信息 | pageId: string |
| searchContent | 搜索内容 | query: string |
| getPageContent | 获取页面详情 | pageId: string |

### 可用资源

- `confluence://{spaceKey}` - 访问指定空间的内容

## 开发指南

### 项目结构
```
src/
  ├── index.ts            # 主入口文件
  ├── config.ts           # 配置管理
  ├── confluence-client.ts # Confluence API 客户端
  └── cursor-integration.ts # Cursor IDE 集成
```

### 开发流程

1. 在 `confluence-client.ts` 中添加新的 API 方法
2. 在 `index.ts` 中注册新的工具或资源
3. 更新文档
4. 添加测试用例

## 故障排除

### 常见问题

1. **DNS 解析问题**
   - 检查 hosts 文件配置
   - 确保网络连接正常
   - 尝试使用 IP 地址替代域名

2. **认证问题**
   - 验证用户名密码
   - 检查 Confluence 权限
   - 确认账号未被锁定

3. **网络问题**
   - 检查代理设置
   - 确认 VPN 状态
   - 验证防火墙配置

### 调试方法

1. **启用详细日志**
```bash
DEBUG=* npx @modelcontextprotocol/inspector node dist/index.js
```

2. **使用 CLI 调试模式**
```bash
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/call --tool-name getSpace --tool-arg spaceKey=TEST --debug
```

## 许可证

MIT License - 详见 LICENSE 文件 