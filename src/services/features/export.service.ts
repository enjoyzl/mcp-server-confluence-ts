import { BaseService } from '../base.service.js';
import { ConfluencePage } from '../../types/confluence.types.js';
import {
  ExportPageOptions,
  ExportHierarchyOptions,
  BatchExportOptions,
  ExportResult,
  ExportErrorType,
  ExportPhase,
  ConflictStrategy
} from '../../types/export.types.js';
import { ContentConverter } from '../../utils/content-converter.js';
import { FileSystemUtils } from '../../utils/file-system.js';
import { Logger } from '../../utils/logger.js';
import { ExportError as ExportErrorClass } from '../../utils/export-error.js';
import { ProgressTracker } from '../../utils/progress-tracker.js';
import { PerformanceOptimizer } from '../../utils/performance-optimizer.js';
import * as path from 'path';

/**
 * 导出服务类
 * 处理Confluence页面到Markdown文件的导出功能
 */
export class ExportService extends BaseService {
  private readonly defaultOutputDir = 'confluence-export';

  /**
   * 导出单个页面
   * @param options 导出选项
   * @returns 导出结果
   */
  async exportPage(options: ExportPageOptions): Promise<ExportResult> {
    const startTime = Date.now();
    const exportStartTime = new Date().toISOString();
    
    // 创建进度跟踪器
    const progressTracker = new ProgressTracker(1);
    
    this.logger.info('开始导出单个页面', options);
    
    const result: ExportResult = {
      success: false,
      exportedFiles: [],
      errors: [],
      summary: {
        totalPages: 1,
        successfulExports: 0,
        failedExports: 0,
        totalFiles: 0,
        totalSize: 0,
        duration: 0,
        startTime: exportStartTime,
        endTime: ''
      }
    };

    try {
      // 验证参数
      progressTracker.setPhase(ExportPhase.INITIALIZING, '验证导出参数...');
      this.validateExportPageOptions(options);
      
      // 获取页面信息
      progressTracker.setPhase(ExportPhase.FETCHING_PAGES, '获取页面信息...');
      const page = await this.getPageForExport(options);
      progressTracker.startPage(page.id, page.title);
      
      // 导出页面
      if (options.splitByChapters) {
        await this.exportPageWithSplitting(page, options, result, progressTracker);
      } else {
        await this.exportSinglePage(page, options, result, progressTracker);
      }
      
      result.success = result.errors.length === 0;
      result.summary.successfulExports = result.success ? 1 : 0;
      result.summary.failedExports = result.success ? 0 : 1;
      
      progressTracker.complete(result.summary.successfulExports, result.summary.failedExports);
      
    } catch (error) {
      this.logger.error('导出页面失败:', error);
      
      // 使用专用错误类
      let exportError: ExportErrorClass;
      if (error instanceof ExportErrorClass) {
        exportError = error;
      } else if (error instanceof Error) {
        if (error.message.includes('未找到')) {
          exportError = ExportErrorClass.pageNotFound(options.pageId || 'unknown');
        } else if (error.message.includes('权限') || error.message.includes('403')) {
          exportError = ExportErrorClass.permissionDenied(options.pageId || 'unknown', 'Unknown');
        } else {
          exportError = ExportErrorClass.networkError(options.pageId || 'unknown', 'Unknown', error);
        }
      } else {
        exportError = ExportErrorClass.networkError(options.pageId || 'unknown', 'Unknown', error);
      }
      
      result.errors.push(exportError.toExportErrorFormat());
      result.summary.failedExports = 1;
      
      progressTracker.reportError('Unknown', exportError.message);
    }

    // 完成导出统计
    const endTime = Date.now();
    result.summary.duration = endTime - startTime;
    result.summary.endTime = new Date().toISOString();
    result.summary.totalFiles = result.exportedFiles.length;
    result.summary.totalSize = result.exportedFiles.reduce((sum, file) => sum + file.fileSize, 0);
    
    this.logger.info('页面导出完成', result.summary);
    return result;
  }

  /**
   * 验证导出页面选项
   */
  private validateExportPageOptions(options: ExportPageOptions): void {
    if (!options.pageId && !(options.spaceKey && options.title)) {
      throw new Error('必须提供 pageId 或者 spaceKey + title');
    }
  }

  /**
   * 获取要导出的页面
   */
  private async getPageForExport(options: ExportPageOptions): Promise<ConfluencePage> {
    if (options.pageId) {
      const response = await this.client.get(`/rest/api/content/${options.pageId}`, {
        params: {
          expand: 'body.storage,version,space'
        }
      });
      return response.data;
    } else if (options.spaceKey && options.title) {
      // 通过空间和标题搜索页面
      const response = await this.client.get('/rest/api/content', {
        params: {
          spaceKey: options.spaceKey,
          title: options.title,
          expand: 'body.storage,version,space',
          limit: 1
        }
      });
      
      if (!response.data.results || response.data.results.length === 0) {
        throw new Error(`在空间 ${options.spaceKey} 中未找到标题为 "${options.title}" 的页面`);
      }
      
      return response.data.results[0];
    } else {
      throw new Error('无效的页面标识参数');
    }
  }

  /**
   * 导出单个页面（不拆分）
   */
  private async exportSinglePage(
    page: ConfluencePage, 
    options: ExportPageOptions, 
    result: ExportResult,
    progressTracker?: ProgressTracker
  ): Promise<void> {
    try {
      // 获取页面内容
      progressTracker?.startConversion(page.title);
      const htmlContent = page.body?.storage?.value || '';
      
      // 转换为Markdown
      const markdownContent = ContentConverter.htmlToMarkdown(htmlContent);
      
      // 生成文件内容
      let fileContent = markdownContent;
      if (options.includeMetadata !== false) {
        const frontmatter = ContentConverter.generateFrontmatter(page);
        fileContent = frontmatter + markdownContent;
      }
      
      // 优化Markdown内容
      fileContent = ContentConverter.optimizeMarkdown(fileContent);
      
      // 确定输出路径
      const outputDir = options.outputDir || this.defaultOutputDir;
      const fileName = FileSystemUtils.sanitizeFileName(page.title) + '.md';
      const filePath = FileSystemUtils.createWorkspacePath(path.join(outputDir, fileName));
      
      // 处理文件冲突
      const finalFilePath = await FileSystemUtils.handleFileConflict(
        filePath, 
        options.overwrite ? ConflictStrategy.OVERWRITE : ConflictStrategy.RENAME
      );
      
      // 写入文件
      progressTracker?.startWriting(path.basename(finalFilePath));
      await FileSystemUtils.writeFile(finalFilePath, fileContent);
      
      // 记录导出的文件
      const fileSize = await FileSystemUtils.getFileSize(finalFilePath);
      result.exportedFiles.push({
        originalPageId: page.id,
        originalTitle: page.title,
        filePath: finalFilePath,
        fileSize
      });
      
      progressTracker?.completePage(page.title);
      this.logger.info(`页面导出成功: ${page.title} -> ${finalFilePath}`);
      
    } catch (error) {
      this.logger.error(`导出页面失败: ${page.title}`, error);
      progressTracker?.reportError(page.title, error instanceof Error ? error.message : String(error));
      
      // 使用专用错误类
      const exportError = error instanceof Error && error.message.includes('权限') 
        ? ExportErrorClass.permissionDenied(page.id, page.title)
        : ExportErrorClass.fileWriteError(page.id, page.title, 'unknown', error);
      
      result.errors.push(exportError.toExportErrorFormat());
    }
  }

  /**
   * 导出页面并按章节拆分
   */
  private async exportPageWithSplitting(
    page: ConfluencePage, 
    options: ExportPageOptions, 
    result: ExportResult,
    progressTracker?: ProgressTracker
  ): Promise<void> {
    try {
      progressTracker?.startConversion(page.title);
      const htmlContent = page.body?.storage?.value || '';
      const splitLevel = options.splitLevel || 2;
      
      // 分析并拆分内容
      const chapters = ContentConverter.splitByChapters(htmlContent, splitLevel);
      
      if (chapters.length === 0) {
        this.logger.warn(`页面 "${page.title}" 没有找到合适的标题进行拆分，将导出为单个文件`);
        await this.exportSinglePage(page, options, result, progressTracker);
        return;
      }
      
      // 确定输出目录
      const outputDir = options.outputDir || this.defaultOutputDir;
      const pageDir = FileSystemUtils.sanitizeFileName(page.title);
      const fullOutputDir = FileSystemUtils.createWorkspacePath(path.join(outputDir, pageDir));
      
      // 创建页面目录
      await FileSystemUtils.ensureDirectory(fullOutputDir);
      
      // 处理章节间的链接引用
      const processedChapters = this.processChapterLinks(chapters);
      
      // 导出每个章节
      for (let i = 0; i < processedChapters.length; i++) {
        const chapter = processedChapters[i];
        
        try {
          // 生成文件内容
          let fileContent = chapter.content;
          if (options.includeMetadata !== false) {
            const frontmatter = ContentConverter.generateFrontmatter(page);
            // 添加章节信息到frontmatter
            const chapterInfo = `chapter_index: ${chapter.index}\nchapter_title: "${chapter.title.replace(/"/g, '\\"')}"\ntotal_chapters: ${chapters.length}\n`;
            fileContent = frontmatter.replace('---\n', `---\n${chapterInfo}`) + chapter.content;
          }
          
          // 添加章节导航
          if (chapters.length > 1) {
            const navigation = this.generateChapterNavigation(chapter, chapters);
            fileContent += '\n\n' + navigation;
          }
          
          // 优化内容
          fileContent = ContentConverter.optimizeMarkdown(fileContent);
          
          // 确定文件路径
          const filePath = path.join(fullOutputDir, chapter.fileName);
          const finalFilePath = await FileSystemUtils.handleFileConflict(
            filePath, 
            options.overwrite ? ConflictStrategy.OVERWRITE : ConflictStrategy.RENAME
          );
          
          // 写入文件
          await FileSystemUtils.writeFile(finalFilePath, fileContent);
          
          // 记录导出的文件
          const fileSize = await FileSystemUtils.getFileSize(finalFilePath);
          result.exportedFiles.push({
            originalPageId: page.id,
            originalTitle: page.title,
            filePath: finalFilePath,
            fileSize,
            chapterIndex: chapter.index,
            chapterTitle: chapter.title
          });
          
          this.logger.debug(`章节导出成功: ${chapter.title} -> ${finalFilePath}`);
          
        } catch (error) {
          this.logger.error(`导出章节失败: ${chapter.title}`, error);
          result.errors.push({
            pageId: page.id,
            pageTitle: `${page.title} - ${chapter.title}`,
            error: error instanceof Error ? error.message : String(error),
            details: error,
            type: ExportErrorType.FILE_WRITE_ERROR
          });
        }
      }
      
      // 生成章节索引文件
      await this.generateChapterIndex(page, chapters, fullOutputDir, options);
      
      this.logger.info(`页面拆分导出完成: ${page.title}, 生成 ${chapters.length} 个文件`);
      
    } catch (error) {
      this.logger.error(`拆分导出页面失败: ${page.title}`, error);
      result.errors.push({
        pageId: page.id,
        pageTitle: page.title,
        error: error instanceof Error ? error.message : String(error),
        details: error,
        type: ExportErrorType.CONVERSION_FAILED
      });
    }
  }

  /**
   * 导出页面层次结构
   * @param options 导出选项
   * @returns 导出结果
   */
  async exportPageHierarchy(options: ExportHierarchyOptions): Promise<ExportResult> {
    const startTime = Date.now();
    const exportStartTime = new Date().toISOString();
    
    this.logger.info('开始导出页面层次结构', options);
    
    const result: ExportResult = {
      success: false,
      exportedFiles: [],
      errors: [],
      summary: {
        totalPages: 0,
        successfulExports: 0,
        failedExports: 0,
        totalFiles: 0,
        totalSize: 0,
        duration: 0,
        startTime: exportStartTime,
        endTime: ''
      }
    };

    try {
      // 获取页面层次结构
      const pageHierarchy = await this.getPageHierarchy(options.pageId, options.maxDepth || 5);
      result.summary.totalPages = this.countPagesInHierarchy(pageHierarchy);
      
      // 导出层次结构
      await this.exportHierarchyRecursive(pageHierarchy, options, result, '');
      
      result.success = result.errors.length === 0;
      result.summary.successfulExports = result.summary.totalPages - result.summary.failedExports;
      
    } catch (error) {
      this.logger.error('导出页面层次结构失败:', error);
      result.errors.push({
        pageId: options.pageId,
        pageTitle: 'Unknown',
        error: error instanceof Error ? error.message : String(error),
        details: error,
        type: ExportErrorType.NETWORK_ERROR
      });
      result.summary.failedExports = 1;
    }

    // 完成导出统计
    const endTime = Date.now();
    result.summary.duration = endTime - startTime;
    result.summary.endTime = new Date().toISOString();
    result.summary.totalFiles = result.exportedFiles.length;
    result.summary.totalSize = result.exportedFiles.reduce((sum, file) => sum + file.fileSize, 0);
    
    this.logger.info('页面层次结构导出完成', result.summary);
    return result;
  }

  /**
   * 获取页面层次结构
   */
  private async getPageHierarchy(pageId: string, maxDepth: number, currentDepth: number = 0): Promise<any> {
    if (currentDepth >= maxDepth) {
      this.logger.debug(`达到最大深度 ${maxDepth}，停止递归获取子页面`);
      return null;
    }

    try {
      // 获取页面基本信息和子页面
      const response = await this.client.get(`/rest/api/content/${pageId}`, {
        params: {
          expand: 'body.storage,version,space,children.page'
        }
      });
      
      const page = response.data;

      // 如果有子页面，递归获取子页面的层次结构
      if (page.children && page.children.page && page.children.page.results) {
        const childrenWithHierarchy = [];
        
        for (const child of page.children.page.results) {
          try {
            const childHierarchy = await this.getPageHierarchy(child.id, maxDepth, currentDepth + 1);
            if (childHierarchy) {
              childrenWithHierarchy.push(childHierarchy);
            }
          } catch (error) {
            this.logger.warn(`获取子页面层次结构失败: ${child.id}`, error);
            // 即使子页面获取失败，也添加基本信息
            childrenWithHierarchy.push({
              ...child,
              children: { page: { results: [] } }
            });
          }
        }
        
        page.children.page.results = childrenWithHierarchy;
      }

      return page;
    } catch (error) {
      this.logger.error(`获取页面层次结构失败: ${pageId}`, error);
      throw error;
    }
  }

  /**
   * 计算层次结构中的页面数量
   */
  private countPagesInHierarchy(hierarchy: any): number {
    if (!hierarchy) return 0;
    
    let count = 1; // 当前页面
    
    // 递归计算子页面数量
    if (hierarchy.children && hierarchy.children.page && hierarchy.children.page.results) {
      for (const child of hierarchy.children.page.results) {
        count += this.countPagesInHierarchy(child);
      }
    }
    
    return count;
  }

  /**
   * 递归导出层次结构
   */
  private async exportHierarchyRecursive(
    page: any, 
    options: ExportHierarchyOptions, 
    result: ExportResult, 
    currentPath: string
  ): Promise<void> {
    // 导出当前页面
    const pageOptions: ExportPageOptions = {
      pageId: page.id,
      outputDir: path.join(options.outputDir || this.defaultOutputDir, currentPath),
      includeMetadata: options.includeMetadata,
      preserveAttachments: options.preserveAttachments,
      overwrite: options.overwrite
    };
    
    const pageResult = await this.exportPage(pageOptions);
    
    // 合并结果
    result.exportedFiles.push(...pageResult.exportedFiles);
    result.errors.push(...pageResult.errors);
    
    if (pageResult.errors.length > 0) {
      result.summary.failedExports++;
    }
    
    // 处理子页面
    if (options.includeChildren !== false && page.children && page.children.page && page.children.page.results) {
      const children = page.children.page.results;
      const pageDirName = FileSystemUtils.sanitizeFileName(page.title);
      const childPath = path.join(currentPath, pageDirName);
      
      for (const child of children) {
        // 子页面已经在getPageHierarchy中获取了完整信息，直接递归导出
        await this.exportHierarchyRecursive(child, options, result, childPath);
      }
    }
  }

  /**
   * 批量导出页面
   * @param options 批量导出选项
   * @returns 导出结果
   */
  async batchExportPages(options: BatchExportOptions): Promise<ExportResult> {
    const startTime = Date.now();
    const exportStartTime = new Date().toISOString();
    const resourceMonitor = PerformanceOptimizer.createResourceMonitor();
    
    this.logger.info('开始批量导出页面', { pageCount: options.pageIds.length });
    PerformanceOptimizer.logMemoryUsage('批量导出开始');
    
    const result: ExportResult = {
      success: false,
      exportedFiles: [],
      errors: [],
      summary: {
        totalPages: options.pageIds.length,
        successfulExports: 0,
        failedExports: 0,
        totalFiles: 0,
        totalSize: 0,
        duration: 0,
        startTime: exportStartTime,
        endTime: ''
      }
    };

    const concurrency = Math.min(options.concurrency || 3, 5); // 限制最大并发数
    
    try {
      // 使用性能优化器的并发控制
      const exportResults = await PerformanceOptimizer.concurrentMap(
        options.pageIds,
        async (pageId: string, index: number) => {
          this.logger.debug(`处理页面 ${index + 1}/${options.pageIds.length}: ${pageId}`);
          
          // 使用重试机制
          return await PerformanceOptimizer.retry(
            () => this.exportSinglePageById(pageId, options),
            2, // 最多重试2次
            1000 // 1秒延迟
          );
        },
        concurrency
      );

      // 处理结果
      exportResults.forEach((pageResult, index) => {
        if (pageResult && pageResult.exportedFiles) {
          result.exportedFiles.push(...pageResult.exportedFiles);
          result.errors.push(...pageResult.errors);
          
          if (pageResult.errors.length === 0) {
            result.summary.successfulExports++;
          } else {
            result.summary.failedExports++;
          }
        } else {
          result.summary.failedExports++;
          result.errors.push({
            pageId: options.pageIds[index],
            pageTitle: 'Unknown',
            error: 'Export failed with unknown error',
            details: null,
            type: ExportErrorType.NETWORK_ERROR
          });
        }
      });

    } catch (error) {
      this.logger.error('批量导出过程中发生错误:', error);
      result.errors.push({
        pageId: 'batch',
        pageTitle: 'Batch Export',
        error: error instanceof Error ? error.message : String(error),
        details: error,
        type: ExportErrorType.NETWORK_ERROR
      });
    }

    result.success = result.summary.failedExports === 0;
    
    // 完成导出统计
    const endTime = Date.now();
    result.summary.duration = endTime - startTime;
    result.summary.endTime = new Date().toISOString();
    result.summary.totalFiles = result.exportedFiles.length;
    result.summary.totalSize = result.exportedFiles.reduce((sum, file) => sum + file.fileSize, 0);
    
    // 记录性能统计
    const stats = resourceMonitor.getStats();
    this.logger.info('批量导出完成', {
      ...result.summary,
      memoryDelta: `${Math.round(stats.memoryDelta.heapUsed / 1024 / 1024)}MB`,
      avgTimePerPage: Math.round(result.summary.duration / result.summary.totalPages)
    });
    
    PerformanceOptimizer.logMemoryUsage('批量导出结束');
    
    return result;
  }

  /**
   * 根据ID导出单个页面
   */
  private async exportSinglePageById(pageId: string, options: BatchExportOptions): Promise<ExportResult> {
    const pageOptions: ExportPageOptions = {
      pageId,
      outputDir: options.outputDir,
      includeMetadata: options.includeMetadata,
      preserveAttachments: options.preserveAttachments,
      overwrite: options.overwrite
    };
    
    return await this.exportPage(pageOptions);
  }

  /**
   * 处理章节间的链接引用
   */
  private processChapterLinks(chapters: any[]): any[] {
    // 创建章节标题到文件名的映射
    const titleToFileMap = new Map<string, string>();
    chapters.forEach(chapter => {
      titleToFileMap.set(chapter.title.toLowerCase(), chapter.fileName);
    });

    // 处理每个章节的内容，更新内部链接
    return chapters.map(chapter => {
      let processedContent = chapter.content;
      
      // 查找并替换章节间的引用链接
      chapters.forEach(targetChapter => {
        if (targetChapter.index !== chapter.index) {
          // 替换对其他章节的引用
          const linkPattern = new RegExp(`\\[([^\\]]+)\\]\\(#${targetChapter.title.toLowerCase().replace(/\s+/g, '-')}\\)`, 'gi');
          processedContent = processedContent.replace(linkPattern, `[$1](./${targetChapter.fileName})`);
        }
      });
      
      return {
        ...chapter,
        content: processedContent
      };
    });
  }

  /**
   * 生成章节导航
   */
  private generateChapterNavigation(currentChapter: any, allChapters: any[]): string {
    const navigation = ['---', '', '## 章节导航', ''];
    
    // 添加上一章和下一章链接
    const currentIndex = currentChapter.index;
    
    if (currentIndex > 1) {
      const prevChapter = allChapters.find(c => c.index === currentIndex - 1);
      if (prevChapter) {
        navigation.push(`← [上一章: ${prevChapter.title}](./${prevChapter.fileName})`);
      }
    }
    
    if (currentIndex < allChapters.length) {
      const nextChapter = allChapters.find(c => c.index === currentIndex + 1);
      if (nextChapter) {
        navigation.push(`[下一章: ${nextChapter.title}](./${nextChapter.fileName}) →`);
      }
    }
    
    // 添加目录链接
    navigation.push('', '[返回目录](./README.md)');
    
    return navigation.join('\n');
  }

  /**
   * 生成章节索引文件
   */
  private async generateChapterIndex(
    page: ConfluencePage, 
    chapters: any[], 
    outputDir: string, 
    options: ExportPageOptions
  ): Promise<void> {
    try {
      const indexContent = [
        `# ${page.title}`,
        '',
        `> 原始页面: [${page.title}](${page._links.webui})`,
        `> 导出时间: ${new Date().toISOString()}`,
        `> 章节数量: ${chapters.length}`,
        '',
        '## 目录',
        ''
      ];

      // 添加章节列表
      chapters.forEach(chapter => {
        indexContent.push(`${chapter.index}. [${chapter.title}](./${chapter.fileName})`);
      });

      // 添加元数据
      if (options.includeMetadata !== false) {
        indexContent.push('', '---', '');
        const frontmatter = ContentConverter.generateFrontmatter(page);
        indexContent.push(frontmatter);
      }

      const indexFilePath = path.join(outputDir, 'README.md');
      const finalIndexPath = await FileSystemUtils.handleFileConflict(
        indexFilePath,
        options.overwrite ? ConflictStrategy.OVERWRITE : ConflictStrategy.RENAME
      );

      await FileSystemUtils.writeFile(finalIndexPath, indexContent.join('\n'));
      
      this.logger.debug(`章节索引文件生成成功: ${finalIndexPath}`);
    } catch (error) {
      this.logger.error('生成章节索引文件失败:', error);
      // 不抛出错误，因为这不是关键功能
    }
  }
}