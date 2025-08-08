/**
 * Confluence 宏处理相关的类型定义
 * 
 * 本文件定义了宏处理功能所需的所有核心接口、枚举和类型
 * 包括宏信息、处理上下文、错误处理、回退策略等
 */

import type { ExportPageOptions } from './export.types.js';

/**
 * 宏回退策略枚举
 * 定义当宏处理失败时的处理策略
 */
export enum MacroFallbackStrategy {
  /** 保留原始HTML格式 */
  PRESERVE_HTML = 'preserve_html',
  /** 转换为纯文本 */
  CONVERT_TO_TEXT = 'convert_to_text',
  /** 添加注释说明 */
  ADD_COMMENT = 'add_comment',
  /** 跳过处理 */
  SKIP = 'skip'
}

/**
 * 宏错误类型枚举
 * 定义宏处理过程中可能出现的错误类型
 */
export enum MacroErrorType {
  /** 不支持的宏类型 */
  UNSUPPORTED_MACRO = 'UNSUPPORTED_MACRO',
  /** 处理失败 */
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  /** 处理超时 */
  TIMEOUT = 'TIMEOUT',
  /** 递归包含检测到循环引用 */
  RECURSIVE_INCLUDE = 'RECURSIVE_INCLUDE',
  /** 缺少必需参数 */
  MISSING_PARAMETERS = 'MISSING_PARAMETERS',
  /** 外部依赖错误 */
  EXTERNAL_DEPENDENCY = 'EXTERNAL_DEPENDENCY',
  /** DOM解析错误 */
  DOM_PARSING_ERROR = 'DOM_PARSING_ERROR',
  /** HTML序列化错误 */
  HTML_SERIALIZATION_ERROR = 'HTML_SERIALIZATION_ERROR'
}

/**
 * 宏在文档中的位置信息
 */
export interface MacroPosition {
  /** 在文档中的起始位置 */
  start: number;
  /** 在文档中的结束位置 */
  end: number;
  /** 所在行号 */
  line?: number;
  /** 所在列号 */
  column?: number;
}

/**
 * 宏参数接口
 * 定义宏的参数结构，支持各种数据类型
 */
export interface MacroParameters {
  /** 动态参数，支持字符串、数字、布尔值 */
  [key: string]: string | number | boolean | undefined;

  /** Confluence宏的输出类型参数 */
  'atlassian-macro-output-type'?: 'INLINE' | 'BLOCK';

  /** 常见的宏参数 */
  title?: string;
  language?: string;
  linenumbers?: boolean | string;
  collapse?: boolean | string;
  theme?: string;
  firstline?: number | string;
}

/**
 * 宏信息接口
 * 包含宏的完整信息和元数据
 */
export interface MacroInfo {
  /** 宏类型标识符 */
  type: string;

  /** 宏的DOM元素 */
  element: Element;

  /** 宏参数 */
  parameters: MacroParameters;

  /** 宏的原始内容 */
  content?: string;

  /** CDATA包装的内容 */
  cdataContent?: string;

  /** 宏在文档中的位置 */
  position: MacroPosition;

  /** 是否支持处理 */
  supported: boolean;

  /** 处理优先级（数字越小优先级越高） */
  priority: number;

  /** 宏的嵌套深度 */
  nestingLevel?: number;

  /** 父宏信息（如果是嵌套宏） */
  parentMacro?: MacroInfo;
}

/**
 * 宏处理上下文接口
 * 提供宏处理过程中需要的上下文信息
 */
export interface MacroProcessingContext {
  /** 当前页面ID */
  pageId: string;

  /** 空间Key */
  spaceKey: string;

  /** Confluence基础URL */
  baseUrl: string;

  /** 导出选项 */
  exportOptions: ExportPageOptions;

  /** Confluence服务实例（用于获取引用内容） */
  confluenceService?: any;

  /** 当前递归深度 */
  recursionDepth?: number;

  /** 已处理页面集合（防止循环引用） */
  processedPages?: Set<string>;

  /** 处理开始时间 */
  startTime?: number;

  /** 用户ID（用于权限检查） */
  userId?: string;

  /** 处理会话ID（用于日志追踪） */
  sessionId?: string;
}

/**
 * 宏处理选项接口
 * 配置宏处理的行为和策略
 */
export interface MacroProcessingOptions {
  /** 启用的处理器列表 */
  enabledProcessors?: string[];

  /** 禁用的处理器列表 */
  disabledProcessors?: string[];

  /** 回退策略 */
  fallbackStrategy: MacroFallbackStrategy;

  /** 最大递归深度 */
  maxRecursionDepth?: number;

  /** 处理超时时间（毫秒） */
  timeout?: number;

  /** 是否启用并发处理 */
  enableConcurrency?: boolean;

  /** 并发处理的最大数量 */
  maxConcurrency?: number;

  /** 是否保留未知宏 */
  preserveUnknownMacros?: boolean;

  /** 是否启用缓存 */
  enableCache?: boolean;

  /** 缓存过期时间（毫秒） */
  cacheExpiration?: number;

  /** 是否启用详细日志 */
  enableVerboseLogging?: boolean;

  /** 自定义宏处理器映射 */
  customProcessors?: Record<string, string>;
}

/**
 * 回退信息接口
 * 记录使用回退策略的详细信息
 */
export interface FallbackInfo {
  /** 宏类型 */
  macroType: string;

  /** 原始错误信息 */
  originalError: string;

  /** 使用的回退策略 */
  fallbackStrategy: MacroFallbackStrategy;

  /** 回退后的内容 */
  fallbackContent: string;

  /** 回退发生的时间戳 */
  timestamp: number;

  /** 宏的位置信息 */
  position?: MacroPosition;
}

/**
 * 宏类型统计信息接口
 */
export interface MacroTypeStats {
  /** 该类型宏的总数量 */
  count: number;

  /** 成功处理的数量 */
  successCount: number;

  /** 失败处理的数量 */
  failureCount: number;

  /** 平均处理时间（毫秒） */
  avgProcessingTime: number;

  /** 最大处理时间（毫秒） */
  maxProcessingTime: number;

  /** 最小处理时间（毫秒） */
  minProcessingTime: number;

  /** 使用的回退策略次数 */
  fallbackCount: number;
}

/**
 * 宏处理统计信息接口
 */
export interface MacroProcessingStats {
  /** 总宏数量 */
  totalMacros: number;

  /** 已处理宏数量 */
  processedMacros: number;

  /** 失败宏数量 */
  failedMacros: number;

  /** 跳过的宏数量 */
  skippedMacros: number;

  /** 各宏类型的统计信息 */
  macroTypeStats: Map<string, MacroTypeStats>;

  /** 总处理时间（毫秒） */
  processingTime: number;

  /** 并发处理数量 */
  concurrentProcesses?: number;

  /** 缓存命中次数 */
  cacheHits?: number;

  /** 缓存未命中次数 */
  cacheMisses?: number;

  /** 内存使用峰值（字节） */
  peakMemoryUsage?: number;
}

/**
 * 宏处理错误接口
 */
export interface MacroProcessingError {
  /** 错误类型 */
  type: MacroErrorType;

  /** 宏类型 */
  macroType: string;

  /** 错误消息 */
  message: string;

  /** 错误详情 */
  details?: any;

  /** 错误发生的时间戳 */
  timestamp: number;

  /** 宏的位置信息 */
  position?: MacroPosition;

  /** 错误堆栈 */
  stack?: string;

  /** 是否可恢复 */
  recoverable: boolean;
}

/**
 * 宏处理结果接口
 * 包含处理结果和相关统计信息
 */
export interface MacroProcessingResult {
  /** 处理是否成功 */
  success: boolean;

  /** 处理后的内容 */
  processedContent: string;

  /** 处理统计信息 */
  stats: MacroProcessingStats;

  /** 处理过程中的错误 */
  errors: MacroProcessingError[];

  /** 警告信息 */
  warnings: string[];

  /** 使用的回退策略信息 */
  fallbacksUsed: FallbackInfo[];

  /** 处理开始时间 */
  startTime: number;

  /** 处理结束时间 */
  endTime: number;

  /** 处理的页面ID */
  pageId: string;

  /** 原始内容的哈希值（用于缓存） */
  contentHash?: string;
}

/**
 * 递归深度控制配置
 */
export interface RecursionControl {
  /** 最大递归深度 */
  maxDepth: number;

  /** 当前递归深度 */
  currentDepth: number;

  /** 递归路径（用于检测循环） */
  recursionPath: string[];

  /** 是否启用循环检测 */
  enableCycleDetection: boolean;
}

/**
 * 循环引用检测结果
 */
export interface CycleDetectionResult {
  /** 是否检测到循环 */
  hasCycle: boolean;

  /** 循环路径 */
  cyclePath?: string[];

  /** 循环起始点 */
  cycleStart?: string;

  /** 循环长度 */
  cycleLength?: number;
}

/**
 * 宏处理器配置接口
 * 用于配置文件的主要配置结构
 */
export interface MacroProcessorConfig {
  /** 启用的处理器列表（如果未指定则启用所有） */
  enabledProcessors?: string[];

  /** 禁用的处理器列表 */
  disabledProcessors?: string[];

  /** 黑名单宏类型（完全忽略） */
  blacklistedMacros?: string[];

  /** 默认回退策略 */
  fallbackStrategy?: MacroFallbackStrategy;

  /** 最大递归深度 */
  maxRecursionDepth?: number;

  /** 处理超时时间（毫秒） */
  timeout?: number;

  /** 是否启用并发处理 */
  enableConcurrency?: boolean;

  /** 是否保留未知宏 */
  preserveUnknownMacros?: boolean;

  /** 自定义处理器配置 */
  customProcessors?: Record<string, {
    path: string;
    priority?: number;
    enabled?: boolean;
  }>;

  /** 各处理器的特定设置 */
  processorSettings?: Record<string, Record<string, any>>;

  /** 是否启用调试模式 */
  debugMode?: boolean;

  /** 日志级别 */
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

/**
 * 单个宏处理器的配置接口
 */
export interface IndividualProcessorConfig {
  /** 处理器名称 */
  name: string;

  /** 支持的宏类型列表 */
  supportedMacroTypes: string[];

  /** 处理器优先级 */
  priority: number;

  /** 是否启用 */
  enabled: boolean;

  /** 处理器特定配置 */
  config?: Record<string, any>;

  /** 依赖的其他处理器 */
  dependencies?: string[];

  /** 处理超时时间 */
  timeout?: number;
}

/**
 * 宏注册表配置
 */
export interface MacroRegistryConfig {
  /** 已注册的处理器配置 */
  processors: Record<string, MacroProcessorConfig>;

  /** 默认回退策略 */
  defaultFallbackStrategy: MacroFallbackStrategy;

  /** 全局处理选项 */
  globalOptions: MacroProcessingOptions;

  /** 黑名单宏类型 */
  blacklistedMacros: string[];

  /** 白名单宏类型 */
  whitelistedMacros?: string[];
}

/**
 * 宏处理会话信息
 */
export interface MacroProcessingSession {
  /** 会话ID */
  sessionId: string;

  /** 会话开始时间 */
  startTime: number;

  /** 处理的页面ID */
  pageId: string;

  /** 用户ID */
  userId?: string;

  /** 会话状态 */
  status: 'active' | 'completed' | 'failed' | 'cancelled';

  /** 处理进度（0-100） */
  progress: number;

  /** 当前处理的宏 */
  currentMacro?: MacroInfo;

  /** 已处理的宏数量 */
  processedCount: number;

  /** 总宏数量 */
  totalCount: number;
}

/**
 * 宏缓存条目
 */
export interface MacroCacheEntry {
  /** 缓存键 */
  key: string;

  /** 缓存的处理结果 */
  result: string;

  /** 缓存创建时间 */
  createdAt: number;

  /** 缓存过期时间 */
  expiresAt: number;

  /** 访问次数 */
  accessCount: number;

  /** 最后访问时间 */
  lastAccessedAt: number;

  /** 缓存大小（字节） */
  size: number;
}

/**
 * 宏处理性能指标
 */
export interface MacroPerformanceMetrics {
  /** 处理吞吐量（宏/秒） */
  throughput: number;

  /** 平均响应时间（毫秒） */
  averageResponseTime: number;

  /** 95百分位响应时间（毫秒） */
  p95ResponseTime: number;

  /** 99百分位响应时间（毫秒） */
  p99ResponseTime: number;

  /** 错误率（百分比） */
  errorRate: number;

  /** 缓存命中率（百分比） */
  cacheHitRate: number;

  /** 内存使用率（百分比） */
  memoryUsage: number;

  /** CPU使用率（百分比） */
  cpuUsage: number;
}