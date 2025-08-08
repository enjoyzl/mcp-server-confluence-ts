# 项目结构和组织

## 根目录结构
```
├── src/                    # 源代码目录
├── dist/                   # 编译输出目录
├── docs/                   # 项目文档
├── node_modules/           # 依赖包
├── .kiro/                  # Kiro IDE 配置
├── .env                    # 环境变量配置
├── package.json            # 项目配置和依赖
├── tsconfig.json           # TypeScript 配置
├── jest.config.cjs         # Jest 测试配置
└── README.md               # 项目说明文档
```

## 源代码结构 (src/)

### 核心目录
- **`src/index.ts`**: MCP 服务器入口点，定义所有工具和处理逻辑
- **`src/config/`**: 配置管理模块
- **`src/services/`**: 业务服务层
- **`src/types/`**: TypeScript 类型定义
- **`src/utils/`**: 工具函数和共享组件
- **`src/test/`**: 测试文件

### 配置模块 (src/config/)
```
config/
├── config.service.ts       # 配置服务主类
```

### 服务层 (src/services/)
```
services/
├── base.service.ts         # 基础服务类
├── confluence-client.ts    # HTTP 客户端封装
├── confluence.service.ts   # 主服务类（组合所有子服务）
├── index.ts               # 服务导出
└── features/              # 功能特定服务
    ├── comment-basic.service.ts    # 普通评论服务
    ├── comment-inline.service.ts   # 行内评论服务
    ├── export.service.ts           # 导出功能服务
    ├── page.service.ts             # 页面管理服务
    ├── search.service.ts           # 搜索服务
    └── space.service.ts            # 空间管理服务
```

### 类型定义 (src/types/)
```
types/
├── config.types.ts         # 配置相关类型
├── confluence.types.ts     # Confluence API 类型
├── export.types.ts         # 导出功能类型
├── logger.types.ts         # 日志相关类型
└── macro.types.ts          # 宏处理类型
```

### 工具模块 (src/utils/)
```
utils/
├── macro-processors/       # 宏处理器
│   ├── base-macro-processor.ts  # 基础宏处理器
│   └── [各种具体宏处理器]
├── content-converter.ts    # 内容转换工具
├── file-system.ts         # 文件系统操作
├── logger.ts              # 日志工具
├── markdown.ts            # Markdown 处理
└── [其他工具文件]
```

### 测试结构 (src/test/)
```
test/
├── integration/           # 集成测试
├── macro-processors/      # 宏处理器测试
├── utils/                # 工具函数测试
├── basic.test.ts         # 基础功能测试
└── [其他测试文件]
```

## 架构模式

### 分层架构
1. **入口层** (`index.ts`): MCP 工具定义和请求路由
2. **服务层** (`services/`): 业务逻辑和 API 调用
3. **工具层** (`utils/`): 共享工具和辅助功能
4. **类型层** (`types/`): 类型定义和接口

### 模块化设计
- **功能分离**: 每个功能模块独立，便于维护和测试
- **依赖注入**: 通过构造函数注入依赖，提高可测试性
- **接口抽象**: 使用 TypeScript 接口定义契约

### 配置管理
- **环境驱动**: 基于环境变量的配置系统
- **类型安全**: 使用 Zod 进行配置验证
- **分层配置**: 支持开发、测试、生产环境的不同配置

## 命名约定

### 文件命名
- **服务类**: `*.service.ts`
- **类型定义**: `*.types.ts`
- **配置文件**: `*.config.ts`
- **测试文件**: `*.test.ts` 或 `*.spec.ts`
- **工具函数**: 使用 kebab-case

### 代码约定
- **类名**: PascalCase (如 `ConfluenceService`)
- **函数/变量**: camelCase (如 `getUserInfo`)
- **常量**: UPPER_SNAKE_CASE (如 `DEFAULT_TIMEOUT`)
- **接口**: PascalCase，通常以 I 开头或描述性名称

## 导入/导出规范
- 使用 ES modules (`import`/`export`)
- 相对路径导入使用 `.js` 扩展名（TypeScript 编译要求）
- 统一通过 `index.ts` 文件导出模块公共接口
- 类型导入使用 `import type` 语法