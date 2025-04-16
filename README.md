# MCP Server for Confluence Integration

这是一个基于 Model Context Protocol (MCP) 的 Confluence 集成服务器，用于在 Cursor IDE 中提供 Confluence 内容访问功能。

## 功能特点

- 支持访问 Confluence 空间、页面和内容
- 提供搜索功能
- 支持内容预览
- 基于 MCP 协议的标准实现

## 系统要求

- Node.js 18+
- TypeScript 5.3+
- Confluence 实例（自托管或云版本）

## 安装

1. 克隆仓库并进入项目目录

2. 安装依赖：
```bash
npm install
```

3. 配置环境变量：
```bash
cp .env.example .env
# 编辑 .env 文件，填写您的 Confluence 配置
```

## 配置

在 `.env` 文件中配置以下环境变量：

```env
# Confluence 服务器地址
CONFLUENCE_URL=your-confluence-url

# Confluence 登录凭据（使用用户名密码方式，非 Token）
CONFLUENCE_USERNAME=your-username
CONFLUENCE_PASSWORD=your-password
```

配置说明：
- CONFLUENCE_URL: Confluence 服务器地址
- CONFLUENCE_USERNAME: Confluence 用户名
- CONFLUENCE_PASSWORD: Confluence 账号密码（使用明文密码，而不是 API Token）

## 使用方法

### 开发模式

```bash
npm run dev
```

### 生产模式

1. 构建项目：
```bash
npm run build
```

2. 运行服务器：
```bash
npm start
```

### Docker 部署

1. 构建镜像：
```bash
docker build -t mcp-server-confluence-ts .
```

2. 运行容器：
```bash
docker run -d --name mcp-server \
  -e CONFLUENCE_URL=your-confluence-url \
  -e CONFLUENCE_USERNAME=your-username \
  -e CONFLUENCE_PASSWORD=your-password \
  mcp-server-confluence-ts
```

## API 文档

### 可用工具

1. `getSpace(spaceKey: string)`
   - 获取指定空间的信息

2. `searchContent(query: string, spaceKey?: string)`
   - 搜索内容
   - 可选参数：spaceKey（限制搜索范围）

3. `getPageContent(pageId: string)`
   - 获取指定页面的内容

### 可用资源

- `confluence://{spaceKey}`
  - 访问指定空间的内容

## 开发指南

### 项目结构

```
src/
  ├── index.ts          # 主入口文件
  ├── config.ts         # 配置管理
  ├── confluence-client.ts  # Confluence API 客户端
  └── cursor-integration.ts # Cursor IDE 集成
```

### 添加新功能

1. 在 `confluence-client.ts` 中添加新的 API 方法
2. 在 `index.ts` 中注册新的工具或资源
3. 更新 README.md 文档

## MCP 服务配置说明

### 配置信息
- 服务名称：`mcp-server-confluence-ts`
- 执行命令：`node dist/index.js`

### 使用方法
服务将在项目目录下启动 Node.js 应用：
```bash
node dist/index.js
```

## 开发环境要求

- Node.js
- NPM/NPX
- Windows 操作系统（配置使用了 Windows 命令行语法）

## 注意事项

1. 确保有相应的 Confluence API 访问权限
2. 确保工作目录路径正确存在
3. 运行前请确认所需依赖已正确安装
4. 所有敏感信息请在 .env 文件中配置
5. 不要在代码或配置文件中硬编码敏感信息

## 许可证

MIT 

## Cursor 配置示例

在 Cursor IDE 中，需要在 `~/.cursor/mcp.json` 中添加以下配置：

```json
{
  "mcpServers": {
    "mcp-server-confluence-ts": {
      "command": "cmd",
      "args": [
        "/k",
        "cd",
        "/d",
        "${workspaceRoot}",
        "&",
        "node",
        "dist/index.js"
      ]
    }
  }
}
```

配置说明：
- `command`: 使用 Windows 命令行
- `args`: 命令行参数
  - `/k`: 执行命令后保持窗口
  - `cd /d ${workspaceRoot}`: 切换到项目根目录
  - `node dist/index.js`: 启动 Confluence MCP 服务

注意：请将 `${workspaceRoot}` 替换为您的实际项目路径。 