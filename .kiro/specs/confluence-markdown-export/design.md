# 设计文档

## 概述

Confluence Markdown 导出功能将作为现有 MCP Confluence 服务的扩展，添加新的工具来支持将 Confluence 页面内容导出为 Markdown 文件到当前工作空间。该功能将利用现有的服务架构，添加新的导出服务和相关工具类。

## 架构

### 整体架构
```
src/
├── services/
│   ├── features/
│   │   ├── export.service.ts          # 新增：导出服务
│   │   └── ...                        # 现有服务
│   └── confluence.service.ts          # 扩展：添加导出方法
├── utils/
│   ├── file-system.ts                 # 新增：文件系统工具
│   ├── content-converter.ts           # 新增：内容转换工具
│   ├── markdown.ts                    # 扩展：添加HTML到Markdown转换
│   └── ...                           # 现有工具
├── types/
│   ├── export.types.ts                # 新增：导出相关类型定义
│   └── ...                           # 现有类型
└── index.ts                          # 扩展：添加新的MCP工具
```

### 服务层设计
- **ExportService**: 核心导出逻辑，处理页面获取、内容转换、文件写入
- **FileSystemUtils**: 文件系统操作工具，处理目录创建、文件命名、路径处理
- **ContentConverter**: 内容转换工具，处理HTML到Markdown的转换、章节拆分
- **MarkdownUtils**: 扩展现有工具，添加HTML到Markdown的反向转换

## 组件和接口

### 1. 导出服务 (ExportService)

```typescript
export class ExportService {
  // 导出单个页面
  async exportPage(options: ExportPageOptions): Promise<ExportResult>
  
  // 导出页面层次结构
  async exportPageHierarchy(options: ExportHierarchyOptions): Promise<ExportResult>
  
  // 按章节拆分导出
  async exportPageWithSplitting(options: ExportSplitOptions): Promise<ExportResult>
}
```

### 2. 文件系统工具 (FileSystemUtils)

```typescript
export class FileSystemUtils {
  // 创建安全的文件名
  static sanitizeFileName(name: string): string
  
  // 创建目录结构
  static ensureDirectory(path: string): Promise<void>
  
  // 检查文件是否存在并处理冲突
  static handleFileConflict(filePath: string, strategy: ConflictStrategy): Promise<string>
  
  // 写入文件
  static writeFile(filePath: string, content: string): Promise<void>
}
```

### 3. 内容转换器 (ContentConverter)

```typescript
export class ContentConverter {
  // HTML转Markdown
  static htmlToMarkdown(html: string): string
  
  // 分析标题结构
  static analyzeHeadingStructure(content: string): HeadingStructure[]
  
  // 按章节拆分内容
  static splitByChapters(content: string, splitLevel: number): ChapterSection[]
  
  // 处理内部链接
  static processInternalLinks(content: string, baseUrl: string): string
  
  // 生成YAML frontmatter
  static generateFrontmatter(page: ConfluencePage): string
}
```

## 数据模型

### 导出选项接口

```typescript
// 基础导出选项
export interface BaseExportOptions {
  outputDir?: string;           // 输出目录，默认 "confluence-export"
  overwrite?: boolean;          // 是否覆盖现有文件
  includeMetadata?: boolean;    // 是否包含元数据
  preserveAttachments?: boolean; // 是否保留附件信息
}

// 单页面导出选项
export interface ExportPageOptions extends BaseExportOptions {
  pageId?: string;              // 页面ID
  spaceKey?: string;            // 空间Key
  title?: string;               // 页面标题
  splitByChapters?: boolean;    // 是否按章节拆分
  splitLevel?: 1 | 2 | 3;      // 拆分级别 (H1, H2, H3)
}

// 层次结构导出选项
export interface ExportHierarchyOptions extends BaseExportOptions {
  pageId: string;               // 根页面ID
  maxDepth?: number;            // 最大递归深度
  includeChildren?: boolean;    // 是否包含子页面
}

// 导出结果
export interface ExportResult {
  success: boolean;
  exportedFiles: ExportedFile[];
  errors: ExportError[];
  summary: ExportSummary;
}

export interface ExportedFile {
  originalPageId: string;
  originalTitle: string;
  filePath: string;
  fileSize: number;
  chapterIndex?: number;        // 如果是拆分的章节
}

export interface ExportError {
  pageId: string;
  pageTitle: string;
  error: string;
  details?: any;
}

export interface ExportSummary {
  totalPages: number;
  successfulExports: number;
  failedExports: number;
  totalFiles: number;
  totalSize: number;
  duration: number;
}
```

### 章节结构模型

```typescript
export interface HeadingStructure {
  level: number;                // 标题级别 (1-6)
  text: string;                 // 标题文本
  id?: string;                  // 标题ID
  startIndex: number;           // 在原文中的起始位置
  endIndex?: number;            // 在原文中的结束位置
}

export interface ChapterSection {
  title: string;                // 章节标题
  content: string;              // 章节内容
  level: number;                // 章节级别
  index: number;                // 章节索引
  fileName: string;             // 建议的文件名
}
```

## 错误处理

### 错误类型定义

```typescript
export enum ExportErrorType {
  PAGE_NOT_FOUND = 'PAGE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CONVERSION_FAILED = 'CONVERSION_FAILED',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS'
}

export class ExportError extends Error {
  constructor(
    public type: ExportErrorType,
    public pageId: string,
    public pageTitle: string,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}
```

### 错误处理策略

1. **网络错误**: 重试机制，最多3次重试
2. **权限错误**: 记录错误，跳过该页面，继续处理其他页面
3. **转换错误**: 降级处理，保存原始HTML内容
4. **文件系统错误**: 提供替代路径或文件名

## 测试策略

### 单元测试
- **ContentConverter**: 测试HTML到Markdown转换的准确性
- **FileSystemUtils**: 测试文件名清理、目录创建、冲突处理
- **ExportService**: 测试各种导出场景的逻辑

### 集成测试
- **完整导出流程**: 从Confluence获取页面到生成Markdown文件
- **层次结构导出**: 测试多层级页面的导出
- **章节拆分**: 测试不同标题结构的拆分效果

### 边界测试
- **大文件处理**: 测试大型页面的导出性能
- **特殊字符**: 测试包含特殊字符的页面标题和内容
- **网络异常**: 测试网络中断时的错误处理

## 实现细节

### HTML到Markdown转换

使用 `turndown` 库进行HTML到Markdown的转换，配置规则：

```typescript
const turndownService = new TurndownService({
  headingStyle: 'atx',          // 使用 # 风格的标题
  bulletListMarker: '-',        // 使用 - 作为列表标记
  codeBlockStyle: 'fenced',     // 使用围栏式代码块
  fence: '```',                 // 代码块围栏
  emDelimiter: '*',             // 斜体分隔符
  strongDelimiter: '**',        // 粗体分隔符
});
```

### 文件命名策略

1. **基础清理**: 移除或替换文件系统不支持的字符
2. **长度限制**: 限制文件名长度，避免路径过长
3. **冲突处理**: 添加数字后缀处理重名文件
4. **编码处理**: 确保跨平台兼容性

### 章节拆分算法

1. **标题检测**: 使用正则表达式识别HTML标题标签
2. **层级分析**: 构建标题的层次结构
3. **内容分割**: 根据指定级别的标题分割内容
4. **链接处理**: 更新章节间的内部链接引用

### 元数据处理

生成YAML frontmatter包含：
- 原始页面信息（ID、标题、URL）
- 导出信息（时间、版本）
- 空间信息
- 作者信息
- 附件列表

### 性能优化

1. **并发控制**: 限制同时处理的页面数量
2. **缓存机制**: 缓存已获取的页面内容
3. **流式处理**: 对大文件使用流式写入
4. **进度反馈**: 提供实时的导出进度信息

## MCP工具集成

### 新增MCP工具

```typescript
// 导出单个页面
server.tool("exportPage", "导出Confluence页面为Markdown文件", ...)

// 导出页面层次结构  
server.tool("exportPageHierarchy", "导出Confluence页面层次结构为Markdown文件", ...)

// 批量导出
server.tool("batchExportPages", "批量导出多个Confluence页面", ...)
```

### 参数验证

使用Zod进行严格的参数验证，确保输入参数的正确性和安全性。

### 响应格式

统一的响应格式，包含：
- 导出结果摘要
- 成功导出的文件列表
- 错误信息（如果有）
- 性能统计信息

这个设计充分利用了现有的架构模式，通过添加新的服务层组件来实现导出功能，同时保持了代码的模块化和可维护性。