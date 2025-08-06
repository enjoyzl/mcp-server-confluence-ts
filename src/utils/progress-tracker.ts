import { ExportProgress, ExportPhase } from '../types/export.types.js';
import { Logger } from './logger.js';

/**
 * 导出进度跟踪器
 */
export class ProgressTracker {
  private readonly logger = Logger.getInstance();
  private currentProgress: ExportProgress;
  private startTime: number;
  private callbacks: ((progress: ExportProgress) => void)[] = [];

  constructor(totalPages: number) {
    this.startTime = Date.now();
    this.currentProgress = {
      phase: ExportPhase.INITIALIZING,
      currentPageIndex: 0,
      totalPages,
      message: '初始化导出...',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 添加进度回调
   */
  onProgress(callback: (progress: ExportProgress) => void): void {
    this.callbacks.push(callback);
  }

  /**
   * 更新当前阶段
   */
  setPhase(phase: ExportPhase, message?: string): void {
    this.currentProgress.phase = phase;
    if (message) {
      this.currentProgress.message = message;
    }
    this.notifyProgress();
  }

  /**
   * 开始处理页面
   */
  startPage(pageId: string, pageTitle: string): void {
    if (this.currentProgress.currentPageIndex !== undefined) {
      this.currentProgress.currentPageIndex++;
    } else {
      this.currentProgress.currentPageIndex = 1;
    }
    this.currentProgress.currentPage = pageTitle;
    this.currentProgress.phase = ExportPhase.FETCHING_PAGES;
    this.currentProgress.message = `正在处理页面: ${pageTitle} (${this.currentProgress.currentPageIndex}/${this.currentProgress.totalPages})`;
    this.currentProgress.timestamp = new Date().toISOString();
    
    this.logger.info(this.currentProgress.message);
    this.notifyProgress();
  }

  /**
   * 开始转换内容
   */
  startConversion(pageTitle: string): void {
    this.currentProgress.phase = ExportPhase.CONVERTING_CONTENT;
    this.currentProgress.message = `正在转换内容: ${pageTitle}`;
    this.currentProgress.timestamp = new Date().toISOString();
    
    this.logger.debug(this.currentProgress.message);
    this.notifyProgress();
  }

  /**
   * 开始写入文件
   */
  startWriting(fileName: string): void {
    this.currentProgress.phase = ExportPhase.WRITING_FILES;
    this.currentProgress.message = `正在写入文件: ${fileName}`;
    this.currentProgress.timestamp = new Date().toISOString();
    
    this.logger.debug(this.currentProgress.message);
    this.notifyProgress();
  }

  /**
   * 完成页面处理
   */
  completePage(pageTitle: string): void {
    this.currentProgress.message = `页面处理完成: ${pageTitle}`;
    this.currentProgress.timestamp = new Date().toISOString();
    this.logger.debug(this.currentProgress.message);
    this.notifyProgress();
  }

  /**
   * 完成所有导出
   */
  complete(successCount: number, errorCount: number): void {
    this.currentProgress.phase = ExportPhase.COMPLETED;
    this.currentProgress.message = `导出完成: 成功 ${successCount} 个，失败 ${errorCount} 个`;
    this.currentProgress.timestamp = new Date().toISOString();
    
    const duration = Date.now() - this.startTime;
    this.logger.info(`${this.currentProgress.message}，耗时 ${duration}ms`);
    this.notifyProgress();
  }

  /**
   * 报告错误
   */
  reportError(pageTitle: string, error: string): void {
    this.currentProgress.phase = ExportPhase.ERROR;
    this.currentProgress.message = `处理页面出错: ${pageTitle} - ${error}`;
    this.currentProgress.timestamp = new Date().toISOString();
    
    this.logger.error(this.currentProgress.message);
    this.notifyProgress();
  }

  /**
   * 获取当前进度
   */
  getCurrentProgress(): ExportProgress {
    return { ...this.currentProgress };
  }

  /**
   * 获取进度百分比
   */
  getProgressPercentage(): number {
    if (this.currentProgress.totalPages === 0) return 0;
    const currentIndex = this.currentProgress.currentPageIndex || 0;
    return Math.round((currentIndex / this.currentProgress.totalPages) * 100);
  }

  /**
   * 获取预估剩余时间（毫秒）
   */
  getEstimatedTimeRemaining(): number {
    const currentIndex = this.currentProgress.currentPageIndex || 0;
    if (currentIndex === 0) return 0;
    
    const elapsed = Date.now() - this.startTime;
    const avgTimePerPage = elapsed / currentIndex;
    const remainingPages = this.currentProgress.totalPages - currentIndex;
    
    return Math.round(avgTimePerPage * remainingPages);
  }

  /**
   * 通知所有回调
   */
  private notifyProgress(): void {
    this.callbacks.forEach(callback => {
      try {
        callback(this.getCurrentProgress());
      } catch (error) {
        this.logger.error('进度回调执行失败:', error);
      }
    });
  }

  /**
   * 生成进度报告
   */
  generateProgressReport(): string {
    const progress = this.getCurrentProgress();
    const percentage = this.getProgressPercentage();
    const estimatedTime = this.getEstimatedTimeRemaining();
    
    const lines = [
      `进度: ${progress.currentPageIndex}/${progress.totalPages} (${percentage}%)`,
      `当前阶段: ${this.getPhaseDisplayName(progress.phase)}`,
      `当前页面: ${progress.currentPage || '无'}`,
      `状态: ${progress.message}`
    ];

    if (estimatedTime > 0) {
      lines.push(`预估剩余时间: ${Math.round(estimatedTime / 1000)}秒`);
    }

    return lines.join('\n');
  }

  /**
   * 获取阶段显示名称
   */
  private getPhaseDisplayName(phase: ExportPhase): string {
    switch (phase) {
      case ExportPhase.INITIALIZING:
        return '初始化';
      case ExportPhase.FETCHING_PAGES:
        return '获取页面';
      case ExportPhase.CONVERTING_CONTENT:
        return '转换内容';
      case ExportPhase.WRITING_FILES:
        return '写入文件';
      case ExportPhase.COMPLETED:
        return '已完成';
      case ExportPhase.ERROR:
        return '错误';
      default:
        return '未知';
    }
  }
}