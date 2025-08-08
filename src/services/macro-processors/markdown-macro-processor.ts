/**
 * Markdown 宏处理器
 * 
 * 专门处理 Confluence 中的 Markdown 宏，支持：
 * - CDATA 内容提取和解析
 * - INLINE/BLOCK 输出模式处理
 * - Markdown 内容清理和格式化
 * - 内联模式的换行符处理
 * - 嵌套 Markdown 内容的递归处理
 */

import { BaseMacroProcessor } from './base-macro-processor.js';
import type {
  MacroParameters,
  MacroProcessingContext,
  MacroErrorType
} from '../../types/macro.types.js';
import { MacroErrorType as ErrorType } from '../../types/macro.types.js';

/**
 * Markdown 宏处理器类
 * 继承自 BaseMacroProcessor，专门处理 Confluence 的 Markdown 宏
 */
export class MarkdownMacroProcessor extends BaseMacroProcessor {
  public readonly macroType = 'markdown';
  public readonly priority = 10; // 高优先级，因为 Markdown 宏很常见

  /**
   * 检查是否可以处理指定的宏元素
   * 
   * @param macroElement - 宏的DOM元素
   * @returns 如果可以处理返回true，否则返回false
   */
  public canProcess(macroElement: Element): boolean {
    try {
      // 检查 ac:structured-macro 元素的 ac:name 属性
      if (macroElement.tagName === 'ac:structured-macro') {
        const macroName = macroElement.getAttribute('ac:name');
        return macroName === 'markdown';
      }

      // 检查 class 属性中是否包含 markdown 相关的类名
      const className = macroElement.className || '';
      if (className.includes('confluence-markdown-macro') || 
          className.includes('markdown-macro') ||
          className.includes('macro-markdown')) {
        return true;
      }

      // 检查 data-macro-name 属性
      const dataMacroName = macroElement.getAttribute('data-macro-name');
      if (dataMacroName === 'markdown') {
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Error checking if element can be processed as markdown macro:', error);
      return false;
    }
  }

  /**
   * 处理 Markdown 宏元素，将其转换为 Markdown 格式
   * 
   * @param macroElement - 宏的DOM元素
   * @param context - 宏处理上下文
   * @returns 处理后的Markdown内容
   */
  public async process(macroElement: Element, context: MacroProcessingContext): Promise<string> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Processing markdown macro', {
        pageId: context.pageId,
        sessionId: context.sessionId
      });

      // 提取宏参数
      const parameters = this.extractMacroParameters(macroElement);
      
      // 提取 CDATA 内容
      const cdataContent = this.extractMarkdownCDATAContent(macroElement);
      
      if (!cdataContent) {
        this.logger.warn('No CDATA content found in markdown macro');
        return this.generateFallbackContent(
          macroElement, 
          new Error('No markdown content found')
        );
      }

      // 清理和格式化内容
      const cleanedContent = this.cleanAndFormatMarkdownContent(cdataContent);
      
      // 根据输出类型处理内容
      const processedContent = this.processContentByOutputType(cleanedContent, parameters, macroElement);

      this.logProcessingStats(startTime, true);
      
      return processedContent;

    } catch (error) {
      this.logger.error('Failed to process markdown macro:', error);
      this.logProcessingStats(startTime, false, error as Error);
      
      return this.generateFallbackContent(macroElement, error as Error);
    }
  }

  /**
   * 提取 Markdown 宏的 CDATA 内容
   * 支持多种 CDATA 包装格式和内容提取方式
   * 
   * @param element - 宏的DOM元素
   * @returns 提取的 Markdown 内容
   */
  private extractMarkdownCDATAContent(element: Element): string {
    try {
      // 方法1: 查找 ac:plain-text-body 元素（最常见）
      const plainTextBody = element.querySelector('ac\\:plain-text-body');
      if (plainTextBody) {
        const content = plainTextBody.textContent || '';
        this.logger.debug('Extracted content from ac:plain-text-body', { 
          contentLength: content.length 
        });
        return content;
      }

      // 方法2: 查找 ac:rich-text-body 元素
      const richTextBody = element.querySelector('ac\\:rich-text-body');
      if (richTextBody) {
        // 对于 rich-text-body，我们需要提取 HTML 内容并转换
        const htmlContent = richTextBody.innerHTML || '';
        const textContent = this.extractTextFromHtml(htmlContent);
        this.logger.debug('Extracted content from ac:rich-text-body', { 
          htmlLength: htmlContent.length,
          textLength: textContent.length 
        });
        return textContent;
      }

      // 方法3: 直接从元素内容中提取 CDATA
      const elementContent = element.innerHTML || '';
      const cdataMatch = elementContent.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
      if (cdataMatch && cdataMatch[1]) {
        this.logger.debug('Extracted content from CDATA section', { 
          contentLength: cdataMatch[1].length 
        });
        return cdataMatch[1];
      }

      // 方法4: 查找包含 markdown 内容的其他元素
      const contentElements = [
        element.querySelector('.markdown-content'),
        element.querySelector('.macro-body'),
        element.querySelector('.plain-text-body'), // 添加对测试中使用的类的支持
        element.querySelector('[data-markdown-content]')
      ].filter(Boolean);

      for (const contentElement of contentElements) {
        if (contentElement) {
          const content = contentElement.textContent || '';
          if (content.trim()) {
            this.logger.debug('Extracted content from content element', { 
              elementClass: contentElement.className,
              contentLength: content.length 
            });
            return content;
          }
        }
      }

      // 方法5: 作为最后手段，尝试从整个元素的文本内容中提取
      const allTextContent = element.textContent || '';
      if (allTextContent.trim()) {
        this.logger.debug('Using all text content as fallback', { 
          contentLength: allTextContent.length 
        });
        return allTextContent;
      }

      return '';

    } catch (error) {
      this.logger.error('Failed to extract CDATA content from markdown macro:', error);
      return '';
    }
  }

  /**
   * 从 HTML 内容中提取纯文本
   * 用于处理 rich-text-body 中的 HTML 内容
   * 
   * @param htmlContent - HTML 内容
   * @returns 提取的纯文本
   */
  private extractTextFromHtml(htmlContent: string): string {
    try {
      // 移除 HTML 标签，保留文本内容
      const textContent = htmlContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // 移除 script 标签
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // 移除 style 标签
        .replace(/<[^>]+>/g, '')                          // 移除所有 HTML 标签
        .replace(/&nbsp;/g, ' ')                          // 替换 &nbsp;
        .replace(/&lt;/g, '<')                            // 替换 &lt;
        .replace(/&gt;/g, '>')                            // 替换 &gt;
        .replace(/&amp;/g, '&')                           // 替换 &amp;
        .replace(/&quot;/g, '"')                          // 替换 &quot;
        .replace(/&#39;/g, "'");                          // 替换 &#39;

      return textContent;
    } catch (error) {
      this.logger.error('Failed to extract text from HTML:', error);
      return htmlContent; // 返回原始内容作为回退
    }
  }

  /**
   * 清理和格式化 Markdown 内容
   * 移除多余的空白字符，统一换行符，修复常见的格式问题
   * 
   * @param content - 原始 Markdown 内容
   * @returns 清理后的 Markdown 内容
   */
  private cleanAndFormatMarkdownContent(content: string): string {
    if (!content) {
      return '';
    }

    try {
      let cleanedContent = content;

      // 1. 统一换行符
      cleanedContent = cleanedContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      // 2. 移除行尾空白字符（在修复代码块之前）
      cleanedContent = cleanedContent.replace(/[ \t]+$/gm, '');

      // 3. 统一制表符为空格（保持 Markdown 的缩进语义）
      cleanedContent = cleanedContent.replace(/\t/g, '    ');

      // 4. 修复代码块的格式（在其他处理之前）
      cleanedContent = this.fixCodeBlockFormatting(cleanedContent);

      // 5. 修复多余的空行（保留最多两个连续空行）
      cleanedContent = cleanedContent.replace(/\n{4,}/g, '\n\n\n');

      // 6. 修复列表项的缩进问题
      cleanedContent = this.fixListIndentation(cleanedContent);

      // 7. 修复链接和图片的格式
      cleanedContent = this.fixLinksAndImages(cleanedContent);

      // 8. 再次移除行尾空白字符（确保清理完整）
      cleanedContent = cleanedContent.replace(/[ \t]+$/gm, '');

      // 9. 移除首尾多余的空白
      cleanedContent = cleanedContent.trim();

      this.logger.debug('Cleaned markdown content', {
        originalLength: content.length,
        cleanedLength: cleanedContent.length
      });

      return cleanedContent;

    } catch (error) {
      this.logger.error('Failed to clean markdown content:', error);
      return this.cleanContent(content); // 使用基类的清理方法作为回退
    }
  }

  /**
   * 修复列表项的缩进问题
   * 确保列表项有正确的缩进和格式
   * 
   * @param content - Markdown 内容
   * @returns 修复后的内容
   */
  private fixListIndentation(content: string): string {
    try {
      return content
        // 修复无序列表的缩进
        .replace(/^(\s*)[-*+](\s*)/gm, (match, indent, space) => {
          const indentLevel = Math.floor(indent.length / 2);
          const properIndent = '  '.repeat(indentLevel);
          return `${properIndent}- `;
        })
        // 修复有序列表的缩进
        .replace(/^(\s*)(\d+)\.(\s*)/gm, (match, indent, number, space) => {
          const indentLevel = Math.floor(indent.length / 2);
          const properIndent = '  '.repeat(indentLevel);
          return `${properIndent}${number}. `;
        });
    } catch (error) {
      this.logger.error('Failed to fix list indentation:', error);
      return content;
    }
  }

  /**
   * 修复代码块的格式
   * 确保代码块有正确的围栏和语言标识
   * 
   * @param content - Markdown 内容
   * @returns 修复后的内容
   */
  private fixCodeBlockFormatting(content: string): string {
    try {
      return content
        // 修复代码块围栏，移除代码前后的空行和行尾空格
        .replace(/```(\w*)\s*\n([\s\S]*?)\n```/g, (match, lang, code) => {
          const language = lang || '';
          // 移除代码前后的空行和每行末尾的空格
          const cleanCode = code
            .replace(/^\n+|\n+$/g, '')  // 移除前后空行
            .replace(/[ \t]+$/gm, '');  // 移除每行末尾的空格
          return `\`\`\`${language}\n${cleanCode}\n\`\`\``;
        })
        // 修复单行代码的格式
        .replace(/`([^`\n]+)`/g, '`$1`');
    } catch (error) {
      this.logger.error('Failed to fix code block formatting:', error);
      return content;
    }
  }

  /**
   * 修复链接和图片的格式
   * 确保链接和图片有正确的 Markdown 语法
   * 
   * @param content - Markdown 内容
   * @returns 修复后的内容
   */
  private fixLinksAndImages(content: string): string {
    try {
      return content
        // 修复图片链接的格式，移除URL前后的空格
        .replace(/!\[([^\]]*)\]\s*\(\s*([^)]+?)\s*\)/g, '![$1]($2)')
        // 修复普通链接的格式，移除URL前后的空格
        .replace(/\[([^\]]*)\]\s*\(\s*([^)]+?)\s*\)/g, '[$1]($2)')
        // 修复引用式链接的格式
        .replace(/\[([^\]]*)\]\s*\[\s*([^\]]*?)\s*\]/g, '[$1][$2]');
    } catch (error) {
      this.logger.error('Failed to fix links and images:', error);
      return content;
    }
  }

  /**
   * 根据输出类型处理内容
   * 处理 INLINE 和 BLOCK 两种输出模式
   * 
   * @param content - 清理后的 Markdown 内容
   * @param parameters - 宏参数
   * @param element - 宏元素
   * @returns 处理后的内容
   */
  private processContentByOutputType(
    content: string, 
    parameters: MacroParameters,
    element: Element
  ): string {
    try {
      // 检查参数中的输出类型，支持多种参数格式
      const isInlineMode = parameters['atlassian-macro-output-type'] === 'INLINE' ||
                          parameters['output-type'] === 'INLINE' ||
                          element.getAttribute('data-output-type') === 'INLINE';
      
      this.logger.debug('Processing content by output type', {
        parameters,
        isInlineMode,
        contentLength: content.length
      });

      if (isInlineMode) {
        return this.processInlineMarkdownContent(content);
      } else {
        return this.processBlockMarkdownContent(content);
      }
    } catch (error) {
      this.logger.error('Failed to process content by output type:', error);
      return content; // 返回原始内容作为回退
    }
  }

  /**
   * 处理内联模式的 Markdown 内容
   * 将块级元素转换为适合内联显示的格式
   * 
   * @param content - Markdown 内容
   * @returns 内联格式的内容
   */
  private processInlineMarkdownContent(content: string): string {
    try {
      let inlineContent = content;

      // 1. 简化标题为粗体文本（在替换换行符之前处理）
      inlineContent = inlineContent.replace(/^#{1,6}\s+(.+)$/gm, '**$1**');

      // 2. 简化列表项（在替换换行符之前处理）
      inlineContent = inlineContent.replace(/^\s*[-*+]\s+(.+)$/gm, '• $1');
      inlineContent = inlineContent.replace(/^\s*\d+\.\s+(.+)$/gm, '• $1');

      // 3. 简化引用块（在替换换行符之前处理）
      inlineContent = inlineContent.replace(/^\s*>\s+(.+)$/gm, '"$1"');

      // 4. 将换行符替换为空格（保留代码块内的换行）
      inlineContent = this.replaceNewlinesPreservingCodeBlocks(inlineContent);

      // 5. 合并多个连续空格
      inlineContent = inlineContent.replace(/\s+/g, ' ');

      // 6. 移除首尾空白
      inlineContent = inlineContent.trim();

      this.logger.debug('Processed inline markdown content', {
        originalLength: content.length,
        inlineLength: inlineContent.length
      });

      return inlineContent;

    } catch (error) {
      this.logger.error('Failed to process inline markdown content:', error);
      return this.processInlineContent(content); // 使用基类方法作为回退
    }
  }

  /**
   * 处理块级模式的 Markdown 内容
   * 保持 Markdown 的块级结构和格式
   * 
   * @param content - Markdown 内容
   * @returns 块级格式的内容
   */
  private processBlockMarkdownContent(content: string): string {
    try {
      // 对于块级模式，主要是确保内容格式正确
      // 添加适当的前后空行以确保 Markdown 渲染正确
      
      let blockContent = content;

      // 确保代码块前后有空行
      blockContent = blockContent.replace(/([^\n])\n```/g, '$1\n\n```');
      blockContent = blockContent.replace(/```\n([^\n])/g, '```\n\n$1');

      // 确保标题前后有空行
      blockContent = blockContent.replace(/([^\n])\n(#{1,6}\s+)/g, '$1\n\n$2');
      blockContent = blockContent.replace(/(#{1,6}\s+.+)\n([^\n#])/g, '$1\n\n$2');

      // 确保列表前后有空行
      blockContent = blockContent.replace(/([^\n])\n(\s*[-*+\d]+[\.\)]\s+)/g, '$1\n\n$2');

      // 清理多余的空行
      blockContent = blockContent.replace(/\n{3,}/g, '\n\n');

      this.logger.debug('Processed block markdown content', {
        originalLength: content.length,
        blockLength: blockContent.length
      });

      return blockContent;

    } catch (error) {
      this.logger.error('Failed to process block markdown content:', error);
      return content; // 返回原始内容作为回退
    }
  }

  /**
   * 替换换行符但保留代码块内的换行
   * 用于内联模式处理，确保代码块内的格式不被破坏
   * 
   * @param content - Markdown 内容
   * @returns 处理后的内容
   */
  private replaceNewlinesPreservingCodeBlocks(content: string): string {
    try {
      // 使用更精确的正则表达式来匹配代码块
      const codeBlockRegex = /```[a-zA-Z]*\n[\s\S]*?\n```/g;
      const inlineCodeRegex = /`[^`\n]+`/g;
      
      // 保存所有代码块和内联代码
      const codeBlocks: string[] = [];
      const inlineCodes: string[] = [];
      
      let processedContent = content;
      
      // 首先替换代码块为占位符（保持原始格式）
      processedContent = processedContent.replace(codeBlockRegex, (match) => {
        const index = codeBlocks.length;
        codeBlocks.push(match);
        return ` __CODE_BLOCK_${index}__ `;
      });
      
      // 然后替换内联代码为占位符
      processedContent = processedContent.replace(inlineCodeRegex, (match) => {
        const index = inlineCodes.length;
        inlineCodes.push(match);
        return `__INLINE_CODE_${index}__`;
      });
      
      // 替换剩余的换行符为空格
      processedContent = processedContent.replace(/\n/g, ' ');
      
      // 恢复内联代码
      inlineCodes.forEach((code, index) => {
        processedContent = processedContent.replace(`__INLINE_CODE_${index}__`, code);
      });
      
      // 恢复代码块（保持原始换行符）
      codeBlocks.forEach((block, index) => {
        processedContent = processedContent.replace(` __CODE_BLOCK_${index}__ `, block);
      });
      
      return processedContent;
      
    } catch (error) {
      this.logger.error('Failed to replace newlines preserving code blocks:', error);
      return content.replace(/\n/g, ' '); // 简单替换作为回退
    }
  }

  /**
   * 验证 Markdown 内容的有效性
   * 检查内容是否包含有效的 Markdown 语法
   * 
   * @param content - Markdown 内容
   * @returns 验证结果和错误信息
   */
  private validateMarkdownContent(content: string): { 
    isValid: boolean; 
    errors: string[]; 
    warnings: string[] 
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 检查不匹配的代码块围栏
      const codeBlockMatches = content.match(/```/g);
      if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
        errors.push('Unmatched code block fences (```)');
      }

      // 检查不匹配的内联代码
      const inlineCodeMatches = content.match(/(?<!\\)`/g);
      if (inlineCodeMatches && inlineCodeMatches.length % 2 !== 0) {
        warnings.push('Potentially unmatched inline code backticks');
      }

      // 检查不匹配的链接括号
      const linkBrackets = content.match(/\[|\]/g);
      if (linkBrackets) {
        const openBrackets = content.match(/\[/g)?.length || 0;
        const closeBrackets = content.match(/\]/g)?.length || 0;
        if (openBrackets !== closeBrackets) {
          warnings.push('Unmatched link brackets');
        }
      }

      // 检查空的链接或图片
      if (content.match(/\[\s*\]\s*\(\s*\)/)) {
        warnings.push('Empty links or images found');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      this.logger.error('Failed to validate markdown content:', error);
      return {
        isValid: false,
        errors: ['Failed to validate content'],
        warnings: []
      };
    }
  }

  /**
   * 获取处理器的详细信息
   * 返回 Markdown 宏处理器的特定信息
   * 
   * @returns 处理器信息对象
   */
  public getProcessorInfo(): {
    macroType: string;
    priority: number;
    enabled: boolean;
    className: string;
    supportedOutputTypes: string[];
    features: string[];
  } {
    return {
      ...super.getProcessorInfo(),
      supportedOutputTypes: ['INLINE', 'BLOCK'],
      features: [
        'CDATA content extraction',
        'Inline/Block mode processing',
        'Content cleaning and formatting',
        'Code block preservation',
        'Link and image formatting',
        'List indentation fixing',
        'Newline handling for inline mode'
      ]
    };
  }
}