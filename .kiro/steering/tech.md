# 技术栈和构建系统

## 核心技术栈
- **运行时**: Node.js >= 14.0.0
- **语言**: TypeScript 5.3.3
- **模块系统**: ES2020 modules (type: "module")
- **HTTP 客户端**: Axios 1.6.7
- **验证库**: Zod 3.22.4 (用于配置和参数验证)
- **MCP SDK**: @modelcontextprotocol/sdk 1.0.0

## 主要依赖
- **Markdown 处理**: marked 16.0.0, turndown 7.2.0
- **环境配置**: dotenv 16.4.5
- **Web 服务**: express 4.18.3 (用于健康检查等)

## 开发工具
- **测试框架**: Jest 29.7.0 + ts-jest
- **构建工具**: TypeScript 编译器
- **代码质量**: 内置 TypeScript 严格模式
- **调试工具**: MCP Inspector (@modelcontextprotocol/inspector)

## 常用命令

### 构建和开发
```bash
# 构建项目
npm run build

# 清理构建目录
npm run clean

# 清理并重新构建
npm run build:clean

# 开发模式 - 监听文件变化并自动编译
npm run dev

# 开发模式 - 监听文件变化并自动重启服务
npm run dev:start
```

### 测试
```bash
# 运行所有测试
npm test

# 监听模式运行测试
npm run test:watch

# 生成测试覆盖率报告
npm run test:coverage

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration
```

### 服务运行
```bash
# 启动生产服务
npm start

# MCP Inspector 调试模式
npm run inspector

# MCP Inspector 开发调试模式（带详细日志）
npm run inspector:dev
```

## 项目配置

### TypeScript 配置
- 目标: ES2020
- 模块: ES2020
- 严格模式: 启用
- 输出目录: ./dist
- 源码目录: ./src

### Jest 测试配置
- 预设: ts-jest
- 环境: node
- 超时: 30000ms
- 覆盖率收集: src/**/*.ts (排除测试文件)

### 环境变量
项目使用 .env 文件进行配置，主要变量包括：
- CONFLUENCE_URL: Confluence 服务器地址
- CONFLUENCE_ACCESS_TOKEN: 访问令牌（推荐）
- CONFLUENCE_USERNAME/PASSWORD: 用户名密码认证
- NODE_ENV: 环境模式 (development/production/test)
- PORT: 服务端口 (默认 3000)

## 架构特点
- **模块化设计**: 使用 ES modules
- **严格类型检查**: TypeScript 严格模式
- **配置驱动**: 基于环境变量的灵活配置
- **测试友好**: 完整的单元测试和集成测试支持
- **调试支持**: 内置 MCP Inspector 集成