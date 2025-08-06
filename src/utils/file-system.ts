import * as fs from 'fs/promises';
import * as path from 'path';
import { ConflictStrategy } from '../types/export.types.js';
import { Logger } from './logger.js';

/**
 * 文件系统工具类
 * 提供文件和目录操作的实用方法
 */
export class FileSystemUtils {
  private static readonly logger = Logger.getInstance();

  /**
   * 清理文件名，移除或替换不安全的字符
   * @param fileName 原始文件名
   * @returns 清理后的安全文件名
   */
  static sanitizeFileName(fileName: string): string {
    if (!fileName || typeof fileName !== 'string') {
      return 'untitled';
    }

    // 移除或替换不安全的字符
    let sanitized = fileName
      // 替换路径分隔符
      .replace(/[/\\]/g, '-')
      // 替换其他不安全字符
      .replace(/[<>:"|?*]/g, '')
      // 替换控制字符
      .replace(/[\x00-\x1f\x80-\x9f]/g, '')
      // 替换连续的空格为单个空格
      .replace(/\s+/g, ' ')
      // 移除首尾空格
      .trim()
      // 替换空格为下划线（可选）
      .replace(/\s/g, '_');

    // 处理Windows保留名称
    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];

    const nameWithoutExt = path.parse(sanitized).name.toUpperCase();
    if (reservedNames.includes(nameWithoutExt)) {
      sanitized = `_${sanitized}`;
    }

    // 限制文件名长度（Windows限制为255字符）
    const maxLength = 200; // 留一些空间给扩展名和路径
    if (sanitized.length > maxLength) {
      const ext = path.extname(sanitized);
      const nameOnly = path.parse(sanitized).name;
      sanitized = nameOnly.substring(0, maxLength - ext.length) + ext;
    }

    // 确保不以点开头或结尾
    sanitized = sanitized.replace(/^\.+|\.+$/g, '');

    // 如果清理后为空，使用默认名称
    if (!sanitized) {
      sanitized = 'untitled';
    }

    return sanitized;
  }

  /**
   * 确保目录存在，如果不存在则创建
   * @param dirPath 目录路径
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (error) {
      // 目录不存在，创建它
      try {
        await fs.mkdir(dirPath, { recursive: true });
        this.logger.debug(`创建目录: ${dirPath}`);
      } catch (createError) {
        this.logger.error(`创建目录失败: ${dirPath}`, createError);
        throw new Error(`无法创建目录 ${dirPath}: ${createError}`);
      }
    }
  }

  /**
   * 处理文件冲突
   * @param filePath 文件路径
   * @param strategy 冲突处理策略
   * @returns 最终使用的文件路径
   */
  static async handleFileConflict(
    filePath: string, 
    strategy: ConflictStrategy = ConflictStrategy.RENAME
  ): Promise<string> {
    try {
      await fs.access(filePath);
      // 文件存在，根据策略处理
      
      switch (strategy) {
        case ConflictStrategy.OVERWRITE:
          this.logger.debug(`覆盖现有文件: ${filePath}`);
          return filePath;
          
        case ConflictStrategy.SKIP:
          this.logger.debug(`跳过现有文件: ${filePath}`);
          throw new Error(`文件已存在，跳过: ${filePath}`);
          
        case ConflictStrategy.RENAME:
        default:
          return await this.generateUniqueFileName(filePath);
      }
    } catch (error) {
      // 文件不存在，可以直接使用
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return filePath;
      }
      // 其他错误，重新抛出
      throw error;
    }
  }

  /**
   * 生成唯一的文件名
   * @param originalPath 原始文件路径
   * @returns 唯一的文件路径
   */
  private static async generateUniqueFileName(originalPath: string): Promise<string> {
    const dir = path.dirname(originalPath);
    const ext = path.extname(originalPath);
    const nameWithoutExt = path.basename(originalPath, ext);
    
    let counter = 1;
    let newPath = originalPath;
    
    while (true) {
      try {
        await fs.access(newPath);
        // 文件存在，尝试下一个编号
        newPath = path.join(dir, `${nameWithoutExt}_${counter}${ext}`);
        counter++;
        
        // 防止无限循环
        if (counter > 1000) {
          throw new Error(`无法生成唯一文件名: ${originalPath}`);
        }
      } catch (error) {
        // 文件不存在，可以使用这个名称
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          this.logger.debug(`生成唯一文件名: ${originalPath} -> ${newPath}`);
          return newPath;
        }
        // 其他错误，重新抛出
        throw error;
      }
    }
  }

  /**
   * 写入文件
   * @param filePath 文件路径
   * @param content 文件内容
   * @param encoding 编码格式
   */
  static async writeFile(
    filePath: string, 
    content: string, 
    encoding: BufferEncoding = 'utf8'
  ): Promise<void> {
    try {
      // 确保目录存在
      const dir = path.dirname(filePath);
      await this.ensureDirectory(dir);
      
      // 写入文件
      await fs.writeFile(filePath, content, encoding);
      this.logger.debug(`写入文件: ${filePath} (${content.length} 字符)`);
    } catch (error) {
      this.logger.error(`写入文件失败: ${filePath}`, error);
      throw new Error(`无法写入文件 ${filePath}: ${error}`);
    }
  }

  /**
   * 读取文件
   * @param filePath 文件路径
   * @param encoding 编码格式
   * @returns 文件内容
   */
  static async readFile(
    filePath: string, 
    encoding: BufferEncoding = 'utf8'
  ): Promise<string> {
    try {
      const content = await fs.readFile(filePath, encoding);
      this.logger.debug(`读取文件: ${filePath} (${content.length} 字符)`);
      return content;
    } catch (error) {
      this.logger.error(`读取文件失败: ${filePath}`, error);
      throw new Error(`无法读取文件 ${filePath}: ${error}`);
    }
  }

  /**
   * 检查文件是否存在
   * @param filePath 文件路径
   * @returns 文件是否存在
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件大小
   * @param filePath 文件路径
   * @returns 文件大小（字节）
   */
  static async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      this.logger.error(`获取文件大小失败: ${filePath}`, error);
      return 0;
    }
  }

  /**
   * 创建相对于工作空间的路径
   * @param relativePath 相对路径
   * @returns 绝对路径
   */
  static createWorkspacePath(relativePath: string): string {
    const workspaceRoot = process.cwd();
    return path.resolve(workspaceRoot, relativePath);
  }

  /**
   * 验证路径是否在工作空间内
   * @param targetPath 目标路径
   * @returns 是否在工作空间内
   */
  static isPathInWorkspace(targetPath: string): boolean {
    const workspaceRoot = path.resolve(process.cwd());
    const resolvedTarget = path.resolve(targetPath);
    return resolvedTarget.startsWith(workspaceRoot);
  }

  /**
   * 批量创建目录结构
   * @param paths 路径数组
   */
  static async ensureDirectories(paths: string[]): Promise<void> {
    const uniquePaths = Array.from(new Set(paths));
    await Promise.all(uniquePaths.map(p => this.ensureDirectory(p)));
  }
}