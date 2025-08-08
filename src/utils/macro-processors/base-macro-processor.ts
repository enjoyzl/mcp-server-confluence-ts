/**
 * 基础宏处理器抽象类
 * 
 * 定义了所有宏处理器的通用接口和基础功能，包括：
 * - 宏参数提取
 * - 错误处理和回退机制
 * - 日志记录
 * - 宏参数注释化保留
 */

import type {
  MacroInfo,
  MacroParameters,
  MacroProcessingContext,
  MacroProcessingError,
  FallbackInfo
} from '../../types/macro.types.js';
import {
  MacroFallbackStrategy,
  MacroErrorType
} from '../../types/macro.types.js';
import { Logger } from '../logger.js';

/**
 * 基础宏处理器抽象类
 * 所有具体的宏处理器都应该继承此类
 */
export abstract class BaseMacroProcessor {
  protected readonly logger = Logger.getInstance();
  
  /**
   * 宏类型标识符
   * 每个具体的处理器必须定义自己支持的宏类型
   */
  public abstract readonly macroType: string;
  
  /**
   * 处理器优先级
   * 数字越小优先级越高，默认为100
   */
  public readonly priority: number = 100;
  
  /**
   * 处理器是否启用
   * 默认启用，可以通过配置禁用
   */
  public readonly enabled: boolean = true;
  
  /**
   * 检查是否可以处理指定的宏元素
   * 
   * @param macroElement - 宏的DOM元素
   * @returns 如果可以处理返回true，否则返回false
   */
  public abstract canProcess(macroElement: Element): boolean;
  
  /**
   * 处理宏元素，将其转换为Markdown格式
   * 
   * @param macroElement - 宏的DOM元素
   * @param context - 宏处理上下文
   * @returns 处理后的Markdown内容
   */
  public abstract process(macroElement: Element, context: MacroProcessingContext): Promise<string>;
  
  /**
   * 提取宏参数
   * 从宏元素中提取所有参数，支持多种参数格式
   * 
   * @param element - 宏的DOM元素
   * @returns 提取的宏参数对象
   */
  protected extractMacroParameters(element: Element): MacroParameters {
    const parameters: MacroParameters = {};
    
    try {
      // 1. 从ac:parameter元素中提取参数
      const paramElements = element.querySelectorAll('ac\\:parameter');
      paramElements.forEach(paramElement => {
        const name = paramElement.getAttribute('ac:name');
        if (name) {
          const value = paramElement.textContent?.trim() || '';
          parameters[name] = this.parseParameterValue(value);
        }
      });
      
      // 2. 从data-*属性中提取参数
      Array.from(element.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) {
          const paramName = attr.name.substring(5); // 移除'data-'前缀
          parameters[paramName] = this.parseParameterValue(attr.value);
        }
      });
      
      // 3. 从class属性中提取特殊参数
      const classNames = element.className.split(' ');
      classNames.forEach(className => {
        if (className.startsWith('macro-')) {
          const paramName = className.substring(6); // 移除'macro-'前缀
          parameters[paramName] = true;
        }
      });
      
      // 4. 提取常见的Confluence宏参数
      const macroName = element.getAttribute('ac:name');
      if (macroName) {
        parameters.macroName = macroName;
      }
      
      const schemaVersion = element.getAttribute('ac:schema-version');
      if (schemaVersion) {
        parameters.schemaVersion = schemaVersion;
      }
      
      this.logger.debug(`Extracted parameters for ${this.macroType} macro:`, parameters);
      
    } catch (error) {
      this.logger.error(`Failed to extract macro parameters for ${this.macroType}:`, error);
    }
    
    return parameters;
  }
  
  /**
   * 解析参数值，自动转换为合适的数据类型
   * 
   * @param value - 原始参数值字符串
   * @returns 解析后的参数值
   */
  protected parseParameterValue(value: string): string | number | boolean {
    if (!value || typeof value !== 'string') {
      return value;
    }
    
    const trimmedValue = value.trim();
    
    // 布尔值
    if (trimmedValue.toLowerCase() === 'true') {
      return true;
    }
    if (trimmedValue.toLowerCase() === 'false') {
      return false;
    }
    
    // 数字
    if (/^\d+$/.test(trimmedValue)) {
      return parseInt(trimmedValue, 10);
    }
    if (/^\d*\.\d+$/.test(trimmedValue)) {
      return parseFloat(trimmedValue);
    }
    
    // 字符串
    return trimmedValue;
  }
  
  /**
   * 提取CDATA内容
   * 从宏元素中提取CDATA包装的内容
   * 
   * @param element - 宏的DOM元素
   * @returns CDATA内容，如果没有则返回空字符串
   */
  protected extractCDATAContent(element: Element): string {
    try {
      // 查找ac:plain-text-body元素
      const plainTextBody = element.querySelector('ac\\:plain-text-body');
      if (plainTextBody) {
        return plainTextBody.textContent || '';
      }
      
      // 查找ac:rich-text-body元素
      const richTextBody = element.querySelector('ac\\:rich-text-body');
      if (richTextBody) {
        return richTextBody.innerHTML || '';
      }
      
      // 直接从元素内容中提取CDATA
      const content = element.textContent || '';
      const cdataMatch = content.match(/<!\[CDATA\[(.*?)\]\]>/s);
      if (cdataMatch) {
        return cdataMatch[1];
      }
      
      return content;
      
    } catch (error) {
      this.logger.error(`Failed to extract CDATA content for ${this.macroType}:`, error);
      return '';
    }
  }
  
  /**
   * 生成回退内容
   * 当宏处理失败时，根据回退策略生成替代内容
   * 
   * @param element - 宏的DOM元素
   * @param error - 处理过程中发生的错误
   * @param strategy - 回退策略
   * @returns 回退内容
   */
  protected generateFallbackContent(
    element: Element,
    error: Error,
    strategy?: MacroFallbackStrategy
  ): string {
    const fallbackStrategy = strategy || MacroFallbackStrategy.ADD_COMMENT;
    
    this.logger.warn(`Generating fallback content for ${this.macroType} macro using strategy: ${fallbackStrategy}`, {
      error: error.message,
      macroType: this.macroType
    });
    
    switch (fallbackStrategy) {
      case MacroFallbackStrategy.PRESERVE_HTML:
        return this.preserveAsHtml(element);
        
      case MacroFallbackStrategy.CONVERT_TO_TEXT:
        return this.convertToText(element);
        
      case MacroFallbackStrategy.ADD_COMMENT:
        return this.addErrorComment(element, error);
        
      case MacroFallbackStrategy.SKIP:
        return '';
        
      default:
        return this.addErrorComment(element, error);
    }
  }
  
  /**
   * 保留原始HTML格式
   * 
   * @param element - 宏的DOM元素
   * @returns HTML字符串
   */
  protected preserveAsHtml(element: Element): string {
    try {
      return element.outerHTML;
    } catch (error) {
      this.logger.error(`Failed to preserve HTML for ${this.macroType}:`, error);
      return `<!-- 无法保留HTML格式: ${this.macroType} -->`;
    }
  }
  
  /**
   * 转换为纯文本
   * 
   * @param element - 宏的DOM元素
   * @returns 纯文本内容
   */
  protected convertToText(element: Element): string {
    try {
      const textContent = element.textContent || '';
      return textContent.trim();
    } catch (error) {
      this.logger.error(`Failed to convert to text for ${this.macroType}:`, error);
      return `[无法转换为文本: ${this.macroType}]`;
    }
  }
  
  /**
   * 添加错误注释
   * 
   * @param element - 宏的DOM元素
   * @param error - 错误信息
   * @returns 包含错误信息的注释
   */
  protected addErrorComment(element: Element, error: Error): string {
    const parameters = this.extractMacroParameters(element);
    const parameterComment = this.generateParameterComment(parameters);
    
    return [
      `<!-- 宏处理失败: ${this.macroType} -->`,
      `<!-- 错误信息: ${error.message} -->`,
      parameterComment,
      `<!-- 原始内容: ${this.convertToText(element)} -->`
    ].filter(Boolean).join('\n');
  }
  
  /**
   * 生成参数注释
   * 将宏参数转换为注释格式，便于保留原始信息
   * 
   * @param parameters - 宏参数对象
   * @returns 参数注释字符串
   */
  protected generateParameterComment(parameters: MacroParameters): string {
    if (!parameters || Object.keys(parameters).length === 0) {
      return '';
    }
    
    try {
      const paramLines = Object.entries(parameters)
        .filter(([key, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`);
      
      if (paramLines.length === 0) {
        return '';
      }
      
      return [
        '<!-- 宏参数:',
        ...paramLines,
        '-->'
      ].join('\n');
      
    } catch (error) {
      this.logger.error(`Failed to generate parameter comment for ${this.macroType}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `<!-- 无法生成参数注释: ${errorMessage} -->`;
    }
  }
  
  /**
   * 创建宏处理错误对象
   * 
   * @param type - 错误类型
   * @param message - 错误消息
   * @param element - 宏元素
   * @param details - 错误详情
   * @returns 宏处理错误对象
   */
  protected createMacroError(
    type: MacroErrorType,
    message: string,
    element: Element,
    details?: any
  ): MacroProcessingError {
    return {
      type,
      macroType: this.macroType,
      message,
      details,
      timestamp: Date.now(),
      recoverable: this.isRecoverableError(type),
      stack: new Error().stack
    };
  }
  
  /**
   * 判断错误是否可恢复
   * 
   * @param errorType - 错误类型
   * @returns 如果错误可恢复返回true
   */
  protected isRecoverableError(errorType: MacroErrorType): boolean {
    switch (errorType) {
      case MacroErrorType.TIMEOUT:
      case MacroErrorType.EXTERNAL_DEPENDENCY:
      case MacroErrorType.DOM_PARSING_ERROR:
        return true;
      case MacroErrorType.UNSUPPORTED_MACRO:
      case MacroErrorType.MISSING_PARAMETERS:
      case MacroErrorType.RECURSIVE_INCLUDE:
        return false;
      default:
        return true;
    }
  }
  
  /**
   * 验证必需参数
   * 检查宏是否包含所有必需的参数
   * 
   * @param parameters - 宏参数
   * @param requiredParams - 必需参数列表
   * @throws 如果缺少必需参数则抛出错误
   */
  protected validateRequiredParameters(parameters: MacroParameters, requiredParams: string[]): void {
    const missingParams = requiredParams.filter(param => 
      parameters[param] === undefined || parameters[param] === null || parameters[param] === ''
    );
    
    if (missingParams.length > 0) {
      throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
    }
  }
  
  /**
   * 清理和格式化内容
   * 移除多余的空白字符和格式化内容
   * 
   * @param content - 原始内容
   * @returns 清理后的内容
   */
  protected cleanContent(content: string): string {
    if (!content) {
      return '';
    }
    
    return content
      .replace(/\r\n/g, '\n')  // 统一换行符
      .replace(/\t/g, '  ')    // 将制表符转换为空格
      .trim();                 // 移除首尾空白
  }
  
  /**
   * 检查是否为内联模式
   * 根据宏参数判断是否应该以内联模式处理
   * 
   * @param parameters - 宏参数
   * @returns 如果是内联模式返回true
   */
  protected isInlineMode(parameters: MacroParameters): boolean {
    const outputType = parameters['atlassian-macro-output-type'];
    return outputType === 'INLINE';
  }
  
  /**
   * 处理内联内容
   * 将块级内容转换为适合内联显示的格式
   * 
   * @param content - 原始内容
   * @returns 内联格式的内容
   */
  protected processInlineContent(content: string): string {
    if (!content) {
      return '';
    }
    
    return content
      .replace(/\n+/g, ' ')    // 将换行符替换为空格
      .replace(/\s+/g, ' ')    // 合并多个空格
      .trim();
  }
  
  /**
   * 记录处理统计信息
   * 
   * @param startTime - 处理开始时间
   * @param success - 是否处理成功
   * @param error - 错误信息（如果有）
   */
  protected logProcessingStats(startTime: number, success: boolean, error?: Error): void {
    const processingTime = Date.now() - startTime;
    
    if (success) {
      this.logger.debug(`${this.macroType} macro processed successfully in ${processingTime}ms`);
    } else {
      this.logger.warn(`${this.macroType} macro processing failed after ${processingTime}ms`, {
        error: error?.message,
        processingTime
      });
    }
  }
  
  /**
   * 获取处理器信息
   * 返回处理器的基本信息，用于调试和监控
   * 
   * @returns 处理器信息对象
   */
  public getProcessorInfo(): {
    macroType: string;
    priority: number;
    enabled: boolean;
    className: string;
  } {
    return {
      macroType: this.macroType,
      priority: this.priority,
      enabled: this.enabled,
      className: this.constructor.name
    };
  }
}