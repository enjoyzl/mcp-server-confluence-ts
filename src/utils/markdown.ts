import { marked } from 'marked';

/**
 * Markdown 转换工具
 * 提供 Markdown 与 HTML 之间的转换功能
 */
export class MarkdownUtils {
  
  /**
   * 将 Markdown 转换为 HTML (storage 格式)
   * @param markdown Markdown 文本
   * @returns HTML 格式的内容
   */
  static markdownToHtml(markdown: string): string {
    if (!markdown || typeof markdown !== 'string') {
      return '';
    }

    try {
      // 配置 marked 选项
      marked.setOptions({
        gfm: true, // 启用 GitHub Flavored Markdown
        breaks: true, // 将单个换行符转换为 <br>
        // 注意：headerIds 选项在 marked 8.0.0+ 版本中已移除
        // 如需要 header ID 功能，可使用 marked-gfm-heading-id 扩展
      });

      // 转换 markdown 为 HTML
      const html = marked(markdown);
      
      // 确保返回的是字符串
      return typeof html === 'string' ? html : String(html);
    } catch (error) {
      console.error('Markdown to HTML conversion failed:', error);
      // 如果转换失败，返回原始内容包装在段落标签中
      return `<p>${markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
    }
  }

  /**
   * 检测内容是否为 Markdown 格式
   * @param content 内容文本
   * @returns 是否为 Markdown 格式
   */
  static isMarkdown(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false;
    }

    // 检测常见的 Markdown 语法标记
    const markdownPatterns = [
      /^#{1,6}\s+/, // 标题 # ## ###
      /^\*\*.*\*\*/, // 粗体 **text**
      /^\*.*\*/, // 斜体 *text*
      /^\- /, // 无序列表 - item
      /^\* /, // 无序列表 * item
      /^\+ /, // 无序列表 + item
      /^\d+\. /, // 有序列表 1. item
      /^\[.*\]\(.*\)/, // 链接 [text](url)
      /^!\[.*\]\(.*\)/, // 图片 ![alt](url)
      /^```/, // 代码块 ```
      /^`.*`/, // 行内代码 `code`
      /^>/, // 引用 > text
      /^\|.*\|/, // 表格 | col | col |
      /^---/, // 分割线 ---
    ];

    const lines = content.split('\n');
    
    // 检查是否有任何行匹配 Markdown 模式
    return lines.some(line => 
      markdownPatterns.some(pattern => pattern.test(line.trim()))
    );
  }

  /**
   * 清理和验证 Markdown 内容
   * @param markdown Markdown 文本
   * @returns 清理后的 Markdown 文本
   */
  static sanitizeMarkdown(markdown: string): string {
    if (!markdown || typeof markdown !== 'string') {
      return '';
    }

    // 移除可能的脚本标签和其他不安全内容
    let cleaned = markdown
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');

    return cleaned.trim();
  }

  /**
   * 处理内容格式转换
   * @param content 原始内容
   * @param fromFormat 源格式
   * @param toFormat 目标格式
   * @returns 转换后的内容
   */
  static convertFormat(
    content: string, 
    fromFormat: 'storage' | 'wiki' | 'editor2' | 'view' | 'markdown', 
    toFormat: 'storage' | 'wiki' | 'editor2' | 'view' | 'markdown'
  ): string {
    if (!content || fromFormat === toFormat) {
      return content;
    }

    // 如果源格式是 markdown，转换为 HTML (storage)
    if (fromFormat === 'markdown') {
      return toFormat === 'storage' ? this.markdownToHtml(content) : content;
    }

    // 如果目标格式是 markdown，目前不支持反向转换
    if (toFormat === 'markdown') {
      console.warn('HTML to Markdown conversion is not supported yet');
      return content;
    }

    // 其他格式之间的转换保持原样
    return content;
  }

  /**
   * 为 Confluence 准备内容
   * @param content 原始内容
   * @param representation 表示格式
   * @returns 准备好的内容和实际使用的格式
   */
  static prepareContentForConfluence(
    content: string, 
    representation?: 'storage' | 'wiki' | 'editor2' | 'view' | 'markdown'
  ): { content: string; representation: 'storage' | 'wiki' | 'editor2' | 'view' } {
    if (!content) {
      return { content: '', representation: 'storage' };
    }

    // 如果明确指定为 markdown 或者检测到 markdown 格式
    if (representation === 'markdown' || 
        (!representation && this.isMarkdown(content))) {
      
      const sanitized = this.sanitizeMarkdown(content);
      const htmlContent = this.markdownToHtml(sanitized);
      
      return {
        content: htmlContent,
        representation: 'storage'
      };
    }

    // 其他格式直接返回，默认使用 storage
    return {
      content: content,
      representation: (representation as any) || 'storage'
    };
  }
} 