# MCP Confluence TypeScript 服务开发规则

## 项目概述

### 项目名称
MCP Confluence 服务 (MCP Server Confluence TypeScript)

### 业务描述
MCP Confluence 服务是一个基于 MCP (Model Context Protocol) 的 TypeScript 实现，提供与 Confluence 进行交互的能力。该服务支持页面管理、评论管理、搜索功能和 Markdown 导出等核心功能，旨在为 AI 系统提供高效的 Confluence 集成能力。

## 技术栈

### 技术栈分析原则
在涉及具体技术组件、版本信息或依赖关系时，请先分析项目根目录的 `package.json` 和 `tsconfig.json` 文件以获取准确的版本信息和配置详情。

### 主要技术领域
项目基于以下技术栈构建：

- **运行环境**: Node.js >= 14.0.0，ES2020 模块系统
- **开发语言**: TypeScript >= 5.3.3，强类型编程
- **核心框架**: @modelcontextprotocol/sdk MCP协议实现
- **HTTP客户端**: Axios HTTP请求库
- **参数验证**: Zod 类型验证和模式验证
- **HTML处理**: JSDOM DOM解析和操作
- **内容转换**: Marked Markdown解析器 + Turndown HTML转Markdown
- **环境配置**: dotenv 环境变量管理
- **测试框架**: Jest + ts-jest TypeScript测试环境
- **构建工具**: TypeScript编译器 + Rimraf清理工具
- **调试工具**: @modelcontextprotocol/inspector MCP调试器

### 版本获取方式
具体的版本信息和依赖配置请参考：
- package.json中的`dependencies`和`devDependencies`节点
- tsconfig.json中的编译选项配置
- jest.config.js中的测试配置

## 项目结构

### 整体架构
项目采用 TypeScript 单体架构，遵循分层架构和模块化设计模式。

### 目录结构

#### src/ - 源代码目录
- **职责**: 项目核心源代码
- **内容**: 服务层、类型定义、工具类等
- **特点**: 基于 ES2020 模块系统

#### src/services/ - 服务层
- **职责**: 业务逻辑和外部API集成
- **内容**: Confluence API 服务、配置服务、宏处理器等
- **依赖**: 类型定义、工具类
- **特点**: 单一职责，模块化设计

#### src/types/ - 类型定义
- **职责**: TypeScript 类型定义和接口
- **内容**: 配置类型、Confluence API类型、导出类型等
- **特点**: 严格的类型检查，提供智能提示

#### src/utils/ - 工具类
- **职责**: 通用工具函数和辅助类
- **内容**: 日志记录、内容转换、性能优化等
- **特点**: 纯函数设计，高复用性

#### test/ - 测试目录
- **职责**: 单元测试和集成测试
- **内容**: Jest 测试用例、测试配置
- **依赖**: Jest, ts-jest
- **特点**: 完整的测试覆盖

### 代码分层规约

#### 分层访问规则
- **utils层**: 被所有其他层使用，不依赖任何业务层
- **types层**: 提供类型定义，被所有层引用
- **services层**: 业务逻辑处理，可调用utils和外部API
- **index.ts**: MCP工具注册和服务启动，调用services层
- **跨层调用**: 禁止循环依赖和逆向依赖

### 异步处理规约
1. **异步边界**: 所有外部API调用必须使用async/await
2. **错误处理**: 统一使用try-catch处理异步异常
3. **并发控制**: 批量操作需要控制并发数量
4. **超时处理**: 所有外部请求必须设置合理超时时间

### 模块命名规范

#### 整体目录结构
项目采用扁平化模块架构，每个模块有清晰的职责边界：

```
src/
├── services/                # 服务层
│   ├── features/            # 功能特性服务
│   │   ├── page.service.ts         # 页面管理服务
│   │   ├── comment-basic.service.ts # 基础评论服务
│   │   ├── comment-inline.service.ts # 行内评论服务
│   │   ├── search.service.ts        # 搜索服务
│   │   ├── space.service.ts         # 空间服务
│   │   ├── export.service.ts        # 导出服务
│   │   └── feature-services.ts     # 服务统一导出
│   ├── macro-processors/    # 宏处理器
│   │   ├── base-macro-processor.ts  # 基础宏处理器
│   │   ├── markdown-macro-processor.ts # Markdown宏处理器
│   │   ├── macro-registry.ts        # 宏注册器
│   │   └── index.ts                 # 宏处理器导出
│   ├── base.service.ts      # 基础服务类
│   ├── config.service.ts    # 配置服务
│   ├── confluence-client.ts # Confluence客户端
│   ├── confluence.service.ts # Confluence主服务
│   ├── macro-config.service.ts # 宏配置服务
│   └── index.ts            # 服务层统一导出
├── types/                  # 类型定义
│   ├── config.types.ts     # 配置相关类型
│   ├── confluence.types.ts # Confluence API类型
│   ├── export.types.ts     # 导出功能类型
│   ├── logger.types.ts     # 日志相关类型
│   └── macro.types.ts      # 宏相关类型
├── utils/                  # 工具类
│   ├── content-converter.ts    # 内容转换工具
│   ├── export-error.ts         # 导出错误处理
│   ├── file-system.ts          # 文件系统工具
│   ├── html-parser-adapter.ts  # HTML解析适配器
│   ├── logger.ts               # 日志工具
│   ├── markdown.ts             # Markdown工具
│   ├── performance-optimizer.ts # 性能优化工具
│   └── progress-tracker.ts     # 进度跟踪工具
└── index.ts                # 应用入口点
```

#### 模块命名规则
1. **功能隔离**: 按功能领域划分模块，如page、comment、search等
2. **类型安全**: 所有模块使用.ts扩展名，启用严格类型检查
3. **导入规范**: 使用相对路径导入，统一.js扩展名（ESM兼容）
4. **服务分层**: features下按业务功能分组，macro-processors按技术功能分组
5. **工具独立**: utils目录存放无业务依赖的纯工具函数
6. **类型集中**: types目录按功能域分组类型定义

### 文件命名约定

#### TypeScript 文件命名
- **服务类**: `*.service.ts` - 业务逻辑服务
- **类型定义**: `*.types.ts` - TypeScript类型和接口
- **工具类**: `*.ts` - 纯工具函数，采用kebab-case命名
- **配置文件**: `*.config.ts` - 配置相关文件
- **测试文件**: `*.test.ts` - Jest测试文件

#### 导入导出规范
- **统一导出**: 每个目录提供index.ts作为统一导出入口
- **命名导出**: 优先使用命名导出，避免默认导出
- **类型导入**: 类型导入使用`import type`语法
- **ESM兼容**: 所有导入路径使用.js扩展名（编译后的文件）

---