# Confluence 宏处理功能设计文档

## 概述

本设计文档描述了如何修复 Confluence 导出服务中的宏处理问题，并实现完整的宏处理功能。主要问题是宏处理器在 Node.js 环境中尝试使用浏览器特定的 DOM API，导致处理失败。同时，我们需要扩展系统以支持各种 Confluence 宏的智能转换。

## 架构

### 整体架构
```
src/
├── services/
│   └── features/
│       ├── export.service.ts          # 现有：集成宏处理
│       └── macro-processor.service.ts # 新增：宏处理服务
├── utils/
│   ├── content-converter.ts           # 扩展：集成宏处理器
│   ├── macro-processors/              # 新增：宏处理器目录
│   │   ├── base-macro-processor.ts    # 基础宏处理器
│   │   ├── code-macro-processor.ts    # 代码宏处理器
│   │   ├── info-macro-processor.ts    # 信息宏处理器
│   │   ├── table-macro-processor.ts   # 表格宏处理器
│   │   ├── chart-macro-processor.ts   # 图表宏处理器
│   │   ├── include-macro-processor.ts # 包含宏处理器
│   │   ├── markdown-macro-processor.ts # Markdown宏处理器
│   │   └── custom-macro-processor.ts  # 自定义宏处理器
│   ├── macro-registry.ts              # 新增：宏注册器
│   ├── macro-config.ts                # 新增：宏配置管理
│   └── html-parser-adapter.ts         # 新增：HTML解析器适配器
├── types/
│   ├── macro.types.ts                 # 新增：宏相关类型定义
│   └── export.types.ts                # 扩展：添加宏处理选项
└── config/
    └── macro-config.json              # 新增：宏处理配置文件
```

### 核心组件

#### 1. HTML 解析器适配器

```typescript
interface HTMLParserAdapter {
  parseHTML(html: string): Document;
  serializeDOM(dom: Document): string;
  createElement(tagName: string): Element;
  createTextNode(text: string): Text;
}

class NodeHTMLParserAdapter implements HTMLParserAdapter {
  // 使用 jsdom 实现
}

class BrowserHTMLParserAdapter implements HTMLParserAdapter {
  // 使用浏览器原生 API 实现
}
```

#### 2. 宏处理服务 (MacroProcessorService)

```typescript
export class MacroProcessorService {
  private htmlParser: HTMLParserAdapter;
  
  constructor(config: MacroProcessorConfig) {
    this.htmlParser = this.createHTMLParser();
  }
  
  // 处理页面中的所有宏
  async processPageMacros(html: string, options: MacroProcessingOptions): Promise<string>
  
  // 识别页面中的宏类型
  identifyMacros(html: string): MacroInfo[]
  
  // 注册自定义宏处理器
  registerMacroProcessor(macroType: string, processor: BaseMacroProcessor): void
  
  // 获取宏处理统计
  getProcessingStats(): MacroProcessingStats
  
  private createHTMLParser(): HTMLParserAdapter {
    // 根据环境选择合适的解析器
  }
}
```

#### 3. 宏注册器 (MacroRegistry)

```typescript
export class MacroRegistry {
  // 注册宏处理器
  static register(macroType: string, processor: BaseMacroProcessor): void
  
  // 获取宏处理器
  static getProcessor(macroType: string): BaseMacroProcessor | null
  
  // 获取所有已注册的宏类型
  static getRegisteredMacroTypes(): string[]
  
  // 检查宏是否支持
  static isSupported(macroType: string): boolean
}
```

#### 4. 基础宏处理器 (BaseMacroProcessor)

```typescript
export abstract class BaseMacroProcessor {
  // 宏类型标识
  abstract readonly macroType: string
  
  // 检查是否可以处理该宏
  abstract canProcess(macroElement: Element): boolean
  
  // 处理宏元素
  abstract process(macroElement: Element, context: MacroProcessingContext): Promise<string>
  
  // 获取宏参数
  protected extractMacroParameters(element: Element): MacroParameters
  
  // 生成错误回退内容
  protected generateFallbackContent(element: Element, error: Error): string
}
```

## 组件和接口

### 数据模型

```typescript
// 宏信息接口
export interface MacroInfo {
  type: string;                    // 宏类型
  element: Element;                // DOM元素
  parameters: MacroParameters;     // 宏参数
  content?: string;                // 宏的原始内容
  cdataContent?: string;           // CDATA 包装的内容
  position: MacroPosition;         // 在文档中的位置
  supported: boolean;              // 是否支持处理
  priority: number;                // 处理优先级
}

// 宏参数接口
export interface MacroParameters {
  [key: string]: string | number | boolean;
  'atlassian-macro-output-type'?: 'INLINE' | 'BLOCK';
}

// 宏处理上下文
export interface MacroProcessingContext {
  pageId: string;
  spaceKey: string;
  baseUrl: string;
  exportOptions: ExportPageOptions;
  confluenceService?: any;         // 用于获取引用内容
  recursionDepth?: number;         // 当前递归深度
  processedPages?: Set<string>;    // 已处理页面集合（防止循环引用）
}

// 宏处理选项
export interface MacroProcessingOptions {
  enabledProcessors?: string[];    // 启用的处理器列表
  disabledProcessors?: string[];   // 禁用的处理器列表
  fallbackStrategy: MacroFallbackStrategy;
  maxRecursionDepth?: number;      // 最大递归深度
  timeout?: number;                // 处理超时时间
  enableConcurrency?: boolean;     // 是否启用并发处理
  preserveUnknownMacros?: boolean; // 是否保留未知宏
}

// 宏回退策略
export enum MacroFallbackStrategy {
  PRESERVE_HTML = 'preserve_html',     // 保留原始HTML
  CONVERT_TO_TEXT = 'convert_to_text', // 转换为纯文本
  ADD_COMMENT = 'add_comment',         // 添加注释说明
  SKIP = 'skip'                        // 跳过处理
}

// 处理结果增强
export interface MacroProcessingResult {
  success: boolean;
  processedContent: string;
  stats: MacroProcessingStats;
  errors: MacroProcessingError[];
  warnings: string[];
  fallbacksUsed: FallbackInfo[];   // 记录使用的回退策略
}

export interface FallbackInfo {
  macroType: string;
  originalError: string;
  fallbackStrategy: MacroFallbackStrategy;
  fallbackContent: string;
}

// 宏处理统计
export interface MacroProcessingStats {
  totalMacros: number;
  processedMacros: number;
  failedMacros: number;
  macroTypeStats: Map<string, MacroTypeStats>;
  processingTime: number;
  concurrentProcesses?: number;
}

export interface MacroTypeStats {
  count: number;
  successCount: number;
  failureCount: number;
  avgProcessingTime: number;
}
```

### 具体宏处理器设计

#### Markdown 宏处理器

```typescript
class MarkdownMacroProcessor extends BaseMacroProcessor {
  macroType = 'markdown';
  
  async process(element: Element, context: MacroProcessingContext): Promise<string> {
    // 提取 CDATA 内容
    const cdataContent = this.extractCDATAContent(element);
    const parameters = this.extractMacroParameters(element);
    
    // 处理 INLINE 参数
    const outputType = parameters['atlassian-macro-output-type'];
    
    if (outputType === 'INLINE') {
      return cdataContent.replace(/\n/g, ' ');
    }
    
    return cdataContent;
  }
  
  private extractCDATAContent(element: Element): string {
    const plainTextBody = element.querySelector('ac\\:plain-text-body');
    if (plainTextBody) {
      return plainTextBody.textContent || '';
    }
    return '';
  }
}
```

#### 代码宏处理器

```typescript
export class CodeMacroProcessor extends BaseMacroProcessor {
  readonly macroType = 'code';
  
  canProcess(element: Element): boolean {
    return element.classList.contains('code') || 
           element.classList.contains('confluence-code-macro') ||
           element.tagName === 'ac:structured-macro' && 
           element.getAttribute('ac:name') === 'code';
  }
  
  async process(element: Element, context: MacroProcessingContext): Promise<string> {
    const params = this.extractMacroParameters(element);
    const language = params.language || params['data-language'] || '';
    const title = params.title || '';
    const linenumbers = params.linenumbers === 'true';
    const collapse = params.collapse === 'true';
    
    // 提取代码内容
    const codeContent = this.extractCodeContent(element);
    
    // 构建markdown代码块
    let markdown = '';
    
    if (title) {
      markdown += `<!-- ${title} -->\n`;
    }
    
    if (collapse) {
      markdown += '<details>\n<summary>点击展开代码</summary>\n\n';
    }
    
    markdown += `\`\`\`${language}\n${codeContent}\n\`\`\``;
    
    if (linenumbers) {
      markdown += '\n<!-- 原始代码包含行号 -->';
    }
    
    if (collapse) {
      markdown += '\n\n</details>';
    }
    
    return markdown;
  }
}
```

#### 信息宏处理器

```typescript
export class InfoMacroProcessor extends BaseMacroProcessor {
  readonly macroType = 'info';
  
  canProcess(element: Element): boolean {
    return element.classList.contains('confluence-information-macro') ||
           element.classList.contains('aui-message') ||
           (element.tagName === 'ac:structured-macro' && 
            ['info', 'warning', 'note', 'tip', 'error'].includes(
              element.getAttribute('ac:name') || ''
            ));
  }
  
  async process(element: Element, context: MacroProcessingContext): Promise<string> {
    const macroType = this.getInfoMacroType(element);
    const title = this.extractTitle(element);
    const content = this.extractContent(element);
    
    // 根据类型选择不同的markdown格式
    switch (macroType) {
      case 'info':
        return this.formatAsInfoBox(content, title, '💡');
      case 'warning':
        return this.formatAsInfoBox(content, title, '⚠️');
      case 'error':
        return this.formatAsInfoBox(content, title, '❌');
      case 'tip':
        return this.formatAsInfoBox(content, title, '✅');
      case 'note':
        return this.formatAsQuote(content, title);
      default:
        return this.formatAsQuote(content, title);
    }
  }
  
  private formatAsInfoBox(content: string, title?: string, icon?: string): string {
    const lines = [`> ${icon} **${title || 'Info'}**`];
    if (content) {
      lines.push('> ');
      content.split('\n').forEach(line => {
        lines.push(`> ${line}`);
      });
    }
    return lines.join('\n');
  }
}
```

#### 表格宏处理器

```typescript
export class TableMacroProcessor extends BaseMacroProcessor {
  readonly macroType = 'table';
  
  async process(element: Element, context: MacroProcessingContext): Promise<string> {
    const isComplexTable = this.hasComplexFeatures(element);
    
    if (isComplexTable) {
      // 复杂表格保留HTML格式
      return this.preserveAsHtml(element);
    } else {
      // 简单表格转换为markdown
      return this.convertToMarkdownTable(element);
    }
  }
  
  private hasComplexFeatures(element: Element): boolean {
    // 检查是否有合并单元格、排序等复杂功能
    return !!(element.querySelector('[colspan]') || 
              element.querySelector('[rowspan]') ||
              element.querySelector('.sortable'));
  }
}
```

#### 图表宏处理器

```typescript
export class ChartMacroProcessor extends BaseMacroProcessor {
  readonly macroType = 'chart';
  
  async process(element: Element, context: MacroProcessingContext): Promise<string> {
    const chartType = this.getChartType(element);
    const chartData = this.extractChartData(element);
    
    switch (chartType) {
      case 'flowchart':
        return this.convertToMermaidFlowchart(chartData);
      case 'gantt':
        return this.convertToMermaidGantt(chartData);
      case 'pie':
      case 'bar':
      case 'line':
        return this.convertToMermaidChart(chartType, chartData);
      default:
        return this.generateChartPlaceholder(chartType, element);
    }
  }
  
  private convertToMermaidFlowchart(data: any): string {
    // 尝试转换为mermaid流程图语法
    return '```mermaid\nflowchart TD\n    A[Start] --> B[End]\n```';
  }
}
```

#### 包含宏处理器

```typescript
export class IncludeMacroProcessor extends BaseMacroProcessor {
  readonly macroType = 'include';
  
  async process(element: Element, context: MacroProcessingContext): Promise<string> {
    const pageId = this.extractIncludedPageId(element);
    const spaceKey = this.extractSpaceKey(element) || context.spaceKey;
    
    // 检查递归深度
    if ((context.recursionDepth || 0) >= (context.exportOptions.macroProcessing?.maxRecursionDepth || 5)) {
      return `<!-- 包含深度超限: ${pageId} -->`;
    }
    
    // 检查循环引用
    if (context.processedPages?.has(pageId)) {
      return `<!-- 检测到循环引用: ${pageId} -->`;
    }
    
    if (!pageId) {
      return this.generateFallbackContent(element, new Error('无法获取包含页面ID'));
    }
    
    try {
      // 获取被包含页面的内容
      const includedPage = await context.confluenceService?.getPageContent(pageId);
      if (!includedPage) {
        throw new Error('无法获取被包含页面内容');
      }
      
      // 更新上下文
      const newContext = {
        ...context,
        recursionDepth: (context.recursionDepth || 0) + 1,
        processedPages: new Set([...(context.processedPages || []), pageId])
      };
      
      // 递归处理被包含页面的宏
      const processedContent = await this.processIncludedContent(
        includedPage.body.storage.value,
        newContext
      );
      
      return `\n<!-- 包含页面: ${includedPage.title} -->\n${processedContent}\n`;
      
    } catch (error) {
      return this.generateIncludeErrorContent(pageId, error);
    }
  }
}
```

## 错误处理

### 错误分类

```typescript
export enum MacroErrorType {
  UNSUPPORTED_MACRO = 'UNSUPPORTED_MACRO',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  TIMEOUT = 'TIMEOUT',
  RECURSIVE_INCLUDE = 'RECURSIVE_INCLUDE',
  MISSING_PARAMETERS = 'MISSING_PARAMETERS',
  EXTERNAL_DEPENDENCY = 'EXTERNAL_DEPENDENCY',
  DOM_PARSING_ERROR = 'DOM_PARSING_ERROR',
  HTML_SERIALIZATION_ERROR = 'HTML_SERIALIZATION_ERROR'
}

export class MacroProcessingError extends Error {
  constructor(
    public type: MacroErrorType,
    public macroType: string,
    public element: Element,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}
```

### 错误恢复机制

```typescript
class MacroErrorRecovery {
  static async recoverFromParsingError(html: string): Promise<string> {
    // 尝试清理 HTML
    // 移除问题标签
    // 返回可解析的 HTML
  }
  
  static generateFallbackContent(
    macro: MacroInfo, 
    error: MacroProcessingError,
    strategy: MacroFallbackStrategy
  ): string {
    switch (strategy) {
      case MacroFallbackStrategy.PRESERVE_HTML:
        return macro.element.outerHTML;
      case MacroFallbackStrategy.CONVERT_TO_TEXT:
        return macro.element.textContent || '';
      case MacroFallbackStrategy.ADD_COMMENT:
        return `<!-- 宏处理失败: ${macro.type} - ${error.message} -->`;
      case MacroFallbackStrategy.SKIP:
        return '';
      default:
        return macro.element.outerHTML;
    }
  }
}
```

## 测试策略

### 单元测试

1. **HTML 解析器适配器测试**
   - 测试不同环境下的 HTML 解析
   - 测试 DOM 序列化
   - 测试错误处理

2. **各宏处理器测试**
   - 测试每种宏的识别和转换准确性
   - 测试 CDATA 内容提取
   - 测试各种参数处理

3. **错误处理测试**
   - 测试各种错误场景
   - 测试回退策略
   - 测试错误恢复机制

### 集成测试

1. **端到端导出测试**
   - 测试包含各种宏的页面导出
   - 测试宏处理启用/禁用场景
   - 测试并发处理

2. **性能测试**
   - 测试大量宏的处理性能
   - 测试内存使用情况
   - 测试并发处理性能

### 测试数据

```typescript
const testCases = [
  {
    name: 'Markdown宏-INLINE模式',
    html: `<ac:structured-macro ac:name="markdown">
      <ac:parameter ac:name="atlassian-macro-output-type">INLINE</ac:parameter>
      <ac:plain-text-body><![CDATA[# 标题\n内容]]></ac:plain-text-body>
    </ac:structured-macro>`,
    expected: '# 标题 内容'
  },
  {
    name: 'Markdown宏-BLOCK模式',
    html: `<ac:structured-macro ac:name="markdown">
      <ac:parameter ac:name="atlassian-macro-output-type">BLOCK</ac:parameter>
      <ac:plain-text-body><![CDATA[## 子标题\n段落内容]]></ac:plain-text-body>
    </ac:structured-macro>`,
    expected: '## 子标题\n段落内容'
  },
  {
    name: '代码宏-带标题和语言',
    html: `<ac:structured-macro ac:name="code">
      <ac:parameter ac:name="language">javascript</ac:parameter>
      <ac:parameter ac:name="title">示例代码</ac:parameter>
      <ac:plain-text-body><![CDATA[console.log('Hello World');]]></ac:plain-text-body>
    </ac:structured-macro>`,
    expected: '<!-- 示例代码 -->\n```javascript\nconsole.log(\'Hello World\');\n```'
  }
];
```

## 实现计划

### 阶段 1：基础设施修复
- 实现 HTML 解析器适配器
- 修复 DOM 解析和序列化问题
- 添加环境检测逻辑

### 阶段 2：核心宏处理器
- 实现 Markdown 宏处理器
- 实现代码宏处理器
- 实现信息宏处理器

### 阶段 3：高级宏处理器
- 实现表格宏处理器
- 实现图表宏处理器
- 实现包含宏处理器

### 阶段 4：错误处理增强
- 实现完整的错误处理机制
- 添加回退策略
- 增强日志记录

### 阶段 5：性能优化和测试
- 优化并发处理逻辑
- 添加缓存机制
- 编写全面的测试用例

这个设计充分考虑了现有架构的扩展性，通过模块化的宏处理器设计和环境适配器，既解决了现有的技术问题，又提供了完整的宏处理功能。