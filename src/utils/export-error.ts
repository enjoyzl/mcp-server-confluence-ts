import { ExportErrorType } from '../types/export.types.js';

/**
 * 导出专用错误类
 */
export class ExportError extends Error {
  constructor(
    public type: ExportErrorType,
    public pageId: string,
    public pageTitle: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ExportError';
  }

  /**
   * 创建页面未找到错误
   */
  static pageNotFound(pageId: string, pageTitle: string = 'Unknown'): ExportError {
    return new ExportError(
      ExportErrorType.PAGE_NOT_FOUND,
      pageId,
      pageTitle,
      `页面未找到: ${pageId}`
    );
  }

  /**
   * 创建权限拒绝错误
   */
  static permissionDenied(pageId: string, pageTitle: string): ExportError {
    return new ExportError(
      ExportErrorType.PERMISSION_DENIED,
      pageId,
      pageTitle,
      `没有权限访问页面: ${pageTitle} (${pageId})`
    );
  }

  /**
   * 创建转换失败错误
   */
  static conversionFailed(pageId: string, pageTitle: string, details?: any): ExportError {
    return new ExportError(
      ExportErrorType.CONVERSION_FAILED,
      pageId,
      pageTitle,
      `内容转换失败: ${pageTitle}`,
      details
    );
  }

  /**
   * 创建文件写入错误
   */
  static fileWriteError(pageId: string, pageTitle: string, filePath: string, details?: any): ExportError {
    return new ExportError(
      ExportErrorType.FILE_WRITE_ERROR,
      pageId,
      pageTitle,
      `文件写入失败: ${filePath}`,
      details
    );
  }

  /**
   * 创建网络错误
   */
  static networkError(pageId: string, pageTitle: string, details?: any): ExportError {
    return new ExportError(
      ExportErrorType.NETWORK_ERROR,
      pageId,
      pageTitle,
      `网络请求失败: ${pageTitle}`,
      details
    );
  }

  /**
   * 创建参数无效错误
   */
  static invalidParameters(message: string): ExportError {
    return new ExportError(
      ExportErrorType.INVALID_PARAMETERS,
      'unknown',
      'Unknown',
      `参数无效: ${message}`
    );
  }

  /**
   * 创建目录创建错误
   */
  static directoryCreateError(pageId: string, pageTitle: string, dirPath: string, details?: any): ExportError {
    return new ExportError(
      ExportErrorType.FILE_WRITE_ERROR,
      pageId,
      pageTitle,
      `目录创建失败: ${dirPath}`,
      details
    );
  }

  /**
   * 将错误转换为导出错误格式
   */
  toExportErrorFormat() {
    return {
      pageId: this.pageId,
      pageTitle: this.pageTitle,
      error: this.message,
      details: this.details,
      type: this.type
    };
  }
}