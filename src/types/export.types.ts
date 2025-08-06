// 导出相关的类型定义

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

// 批量导出选项
export interface BatchExportOptions extends BaseExportOptions {
  pageIds: string[];            // 页面ID数组
  concurrency?: number;         // 并发处理数量
}

// 导出结果
export interface ExportResult {
  success: boolean;
  exportedFiles: ExportedFile[];
  errors: ExportError[];
  summary: ExportSummary;
}

// 导出的文件信息
export interface ExportedFile {
  originalPageId: string;
  originalTitle: string;
  filePath: string;
  fileSize: number;
  chapterIndex?: number;        // 如果是拆分的章节
  chapterTitle?: string;        // 章节标题
}

// 导出错误信息
export interface ExportError {
  pageId: string;
  pageTitle: string;
  error: string;
  details?: any;
  type: ExportErrorType;
}

// 导出摘要
export interface ExportSummary {
  totalPages: number;
  successfulExports: number;
  failedExports: number;
  totalFiles: number;
  totalSize: number;
  duration: number;
  startTime: string;
  endTime: string;
}

// 错误类型枚举
export enum ExportErrorType {
  PAGE_NOT_FOUND = 'PAGE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CONVERSION_FAILED = 'CONVERSION_FAILED',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS'
}

// 标题结构
export interface HeadingStructure {
  level: number;                // 标题级别 (1-6)
  text: string;                 // 标题文本
  id?: string;                  // 标题ID
  startIndex: number;           // 在原文中的起始位置
  endIndex?: number;            // 在原文中的结束位置
}

// 章节信息
export interface ChapterSection {
  title: string;                // 章节标题
  content: string;              // 章节内容
  level: number;                // 章节级别
  index: number;                // 章节索引
  fileName: string;             // 建议的文件名
  headingStructure?: HeadingStructure; // 对应的标题结构
}

// 文件冲突处理策略
export enum ConflictStrategy {
  OVERWRITE = 'overwrite',      // 覆盖现有文件
  RENAME = 'rename',            // 重命名新文件
  SKIP = 'skip'                 // 跳过导出
}

// 文件元数据
export interface FileMetadata {
  originalPageId: string;
  originalTitle: string;
  originalUrl: string;
  spaceKey: string;
  spaceName: string;
  author: string;
  createdDate: string;
  modifiedDate: string;
  version: number;
  exportDate: string;
  attachments?: AttachmentInfo[];
}

// 附件信息
export interface AttachmentInfo {
  id: string;
  title: string;
  mediaType: string;
  fileSize: number;
  downloadUrl: string;
}

// 导出进度信息
export interface ExportProgress {
  phase: ExportPhase;
  currentPage?: string;
  currentPageIndex?: number;
  totalPages: number;
  message: string;
  timestamp: string;
}

// 导出阶段枚举
export enum ExportPhase {
  INITIALIZING = 'initializing',
  FETCHING_PAGES = 'fetching_pages',
  CONVERTING_CONTENT = 'converting_content',
  WRITING_FILES = 'writing_files',
  COMPLETED = 'completed',
  ERROR = 'error'
}

// 性能统计信息
export interface PerformanceStats {
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  memoryDelta: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  duration: number;
  startTime: number;
  endTime: number;
}