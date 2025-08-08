# Confluence 宏处理系统

## 概述

宏处理系统是项目的核心功能之一，负责将 Confluence 页面中的各种宏转换为 Markdown 格式。系统采用插件化架构，支持多种宏类型的智能转换和错误恢复。

## 架构设计

### 核心组件

1. **宏配置服务** (`MacroConfigService`)
   - 管理宏处理器的配置
   - 支持启用/禁用特定处理器
   - 提供黑名单和回退策略配置

2. **宏注册表** (`MacroRegistry`)
   - 管理所有宏处理器的注册和查找
   - 支持优先级排序和动态加载
   - 提供处理器可用性检查

3. **基础宏处理器** (`BaseMacroProcessor`)
   - 所有宏处理器的抽象基类
   - 定义统一的处理接口
   - 提供通用的错误处理和参数提取

4. **HTML 解析器适配器** (`HTMLParserAdapter`)
   - 跨环境的 HTML 解析支持
   - Node.js 环境使用 jsdom
   - 浏览器环境使用原生 DOM API

### 处理流程

```
Confluence HTML → 宏识别 → 处理器选择 → 宏转换 → Markdown 输出
                     ↓
                 错误处理 → 回退策略 → 保留原始内容/添加注释
```

## 配置系统

### 配置文件结构

```json
{
  "enabledProcessors": ["markdown", "code", "info"],
  "disabledProcessors": ["deprecated-macro"],
  "blacklistedMacros": ["legacy-widget"],
  "fallbackStrategy": "preserve_html",
  "maxRecursionDepth": 5,
  "timeout": 30000,
  "enableConcurrency": true,
  "preserveUnknownMacros": true,
  "processorSettings": {
    "markdown": {
      "preserveFormatting": true,
      "convertInlineToBlock": false
    },
    "code": {
      "preserveLineNumbers": true,
      "addLanguageComment": true
    }
  },
  "debugMode": false,
  "logLevel": "info"
}
```

### 配置选项说明

- **enabledProcessors**: 启用的处理器列表（未指定则启用所有）
- **disabledProcessors**: 禁用的处理器列表
- **blacklistedMacros**: 完全忽略的宏类型
- **fallbackStrategy**: 处理失败时的回退策略
  - `preserve_html`: 保留原始 HTML
  - `convert_to_text`: 转换为纯文本
  - `add_comment`: 添加注释说明
  - `skip`: 跳过处理
- **maxRecursionDepth**: 递归处理的最大深度
- **timeout**: 单个宏处理的超时时间（毫秒）
- **enableConcurrency**: 是否启用并发处理
- **preserveUnknownMacros**: 是否保留未知宏

## 宏处理器类型

### 已实现的处理器

1. **Markdown 宏处理器**
   - 处理 `{markdown}` 宏
   - 提取 CDATA 内容
   - 支持内联和块级模式

2. **代码宏处理器**
   - 处理各种代码宏格式
   - 语言类型识别
   - 转换为 Markdown 代码块

3. **信息宏处理器**
   - 处理 info、warning、note 等信息宏
   - 转换为 Markdown 引用块
   - 添加相应的图标

### 计划中的处理器

- 表格宏处理器
- 图表宏处理器
- 页面包含宏处理器
- 自定义宏处理器

## 开发指南

### 创建新的宏处理器

1. **继承基础类**
```typescript
export class CustomMacroProcessor extends BaseMacroProcessor {
  public readonly macroType = 'custom-macro';
  
  public canProcess(macroInfo: MacroInfo): boolean {
    return macroInfo.name === this.macroType;
  }
  
  public async process(
    macroInfo: MacroInfo,
    context: MacroProcessingContext
  ): Promise<MacroProcessingResult> {
    // 实现处理逻辑
  }
}
```

2. **注册处理器**
```typescript
import { MacroRegistry } from '../services/macro-processors/macro-registry.js';

MacroRegistry.register('custom-macro', new CustomMacroProcessor(), 10);
```

### 错误处理最佳实践

1. **使用统一的错误类型**
```typescript
return {
  success: false,
  error: {
    type: MacroErrorType.PROCESSING_FAILED,
    message: '处理失败的具体原因',
    originalMacro: macroInfo
  },
  fallbackContent: this.generateFallbackContent(macroInfo, context)
};
```

2. **提供有意义的回退内容**
```typescript
protected generateFallbackContent(
  macroInfo: MacroInfo,
  context: MacroProcessingContext
): string {
  return `<!-- 无法处理宏: ${macroInfo.name} -->`;
}
```

## 测试策略

### 单元测试

- 每个宏处理器都有对应的单元测试
- 测试各种宏参数组合
- 验证错误处理和回退机制

### 集成测试

- 测试完整的宏处理流程
- 验证配置系统的正确性
- 测试并发处理的稳定性

### 测试数据

```typescript
const testMacros = [
  {
    name: 'markdown',
    parameters: { 'atlassian-macro-output-type': 'BLOCK' },
    body: '<![CDATA[# 测试标题\n\n测试内容]]>'
  }
];
```

## 性能优化

### 并发处理

- 支持多个宏的并发处理
- 可配置的并发数量限制
- 智能的资源管理

### 缓存机制

- 处理结果缓存
- 配置缓存
- 模板缓存

### 内存管理

- 及时释放 DOM 对象
- 限制递归深度
- 监控内存使用

## 调试和监控

### 日志系统

- 分级日志记录
- 详细的处理过程跟踪
- 性能指标收集

### 调试模式

```json
{
  "debugMode": true,
  "logLevel": "debug"
}
```

### 统计信息

- 处理成功率
- 平均处理时间
- 错误类型分布
- 回退策略使用情况

## 扩展性

### 插件系统

- 支持动态加载处理器
- 热插拔功能
- 版本兼容性检查

### 配置热更新

- 运行时配置更新
- 无需重启服务
- 配置验证和回滚

### API 扩展

- 提供处理器注册 API
- 支持外部插件
- 标准化的接口定义