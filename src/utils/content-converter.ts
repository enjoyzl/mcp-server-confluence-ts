import TurndownService from 'turndown'
import { ConfluencePage } from '../types/confluence.types.js';
import { HeadingStructure, ChapterSection, FileMetadata } from '../types/export.types.js';
import { Logger } from './logger.js';

/**
 * 内容转换工具类
 * 处理HTML到Markdown的转换、章节拆分等功能
 */
export class ContentConverter {
    private static readonly logger = Logger.getInstance();
    private static turndownService: TurndownService;

    /**
     * 初始化Turndown服务
     */
    private static initializeTurndownService(): TurndownService {
        if (!this.turndownService) {
            this.turndownService = new TurndownService({
                headingStyle: 'atx',          // 使用 # 风格的标题
                bulletListMarker: '-',        // 使用 - 作为列表标记
                codeBlockStyle: 'fenced',     // 使用围栏式代码块
                fence: '```',                 // 代码块围栏
                emDelimiter: '*',             // 斜体分隔符
                strongDelimiter: '**',        // 粗体分隔符
                linkStyle: 'inlined',         // 内联链接样式
                linkReferenceStyle: 'full'    // 完整引用样式
            });

            // 添加自定义规则处理Confluence特有的元素
            this.addConfluenceRules(this.turndownService);
        }
        return this.turndownService;
    }

    /**
     * 添加Confluence特有的转换规则
     */
    private static addConfluenceRules(turndown: TurndownService): void {
        // 处理Confluence的结构化宏 - 这是关键的修复
        turndown.addRule('confluenceStructuredMacro', {
            filter: (node: HTMLElement) => {
                const isStructuredMacro = node.nodeName === 'AC:STRUCTURED-MACRO' || 
                                        (node.nodeName === 'DIV' && node.getAttribute && !!node.getAttribute('data-macro-name'));
                
                if (isStructuredMacro) {
                    this.logger.debug('发现结构化宏', {
                        nodeName: node.nodeName,
                        macroName: node.getAttribute('ac:name') || node.getAttribute('data-macro-name') || 'unknown',
                        innerHTML: node.innerHTML?.substring(0, 200)
                    });
                }
                
                return isStructuredMacro;
            },
            replacement: (content, node) => {
                const element = node as Element;
                const macroName = element.getAttribute('ac:name') || element.getAttribute('data-macro-name') || 'unknown';
                
                this.logger.info('处理结构化宏', {
                    macroName,
                    hasContent: !!content,
                    contentLength: content?.length || 0,
                    contentPreview: content?.substring(0, 100)
                });
                
                // 特别处理Markdown宏
                if (macroName === 'markdown') {
                    return this.processMarkdownMacro(element, content);
                }
                
                // 对于其他宏，保留内容或添加注释
                if (content && content.trim()) {
                    return content;
                } else {
                    return `<!-- ${macroName} 宏 -->`;
                }
            }
        });

        // 处理Confluence的代码宏
        turndown.addRule('confluenceCodeMacro', {
            filter: (node) => {
                return !!(node.nodeName === 'DIV' &&
                    node.classList &&
                    node.classList.contains('code'));
            },
            replacement: (content, node) => {
                const language = (node as Element).getAttribute('data-language') || '';
                return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
            }
        });

        // 处理Confluence的信息宏
        turndown.addRule('confluenceInfoMacro', {
            filter: (node) => {
                return !!(node.nodeName === 'DIV' &&
                    node.classList &&
                    (node.classList.contains('confluence-information-macro') ||
                        node.classList.contains('aui-message')));
            },
            replacement: (content, node) => {
                const type = this.getInfoMacroType(node as Element);
                return `\n> **${type}**: ${content}\n`;
            }
        });

        // 处理Confluence的表格
        turndown.addRule('confluenceTable', {
            filter: 'table',
            replacement: (content) => {
                // 保持原有的表格转换，但添加一些Confluence特有的处理
                return content;
            }
        });

        // 处理Confluence的附件链接
        turndown.addRule('confluenceAttachment', {
            filter: (node) => {
                return !!(node.nodeName === 'A' &&
                    (node as Element).getAttribute('href')?.includes('/download/attachments/'));
            },
            replacement: (content, node) => {
                const href = (node as Element).getAttribute('href') || '';
                return `[${content}](${href})`;
            }
        });
    }

    /**
     * 处理Markdown宏的特殊逻辑
     */
    private static processMarkdownMacro(element: Element, content: string): string {
        try {
            this.logger.info('处理Markdown宏', {
                hasContent: !!content,
                contentLength: content?.length || 0,
                elementHTML: element.outerHTML?.substring(0, 300)
            });

            // 首先尝试从原始HTML中直接提取CDATA内容
            const outerHTML = element.outerHTML || '';
            const cdataMatch = outerHTML.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
            if (cdataMatch && cdataMatch[1]) {
                const cdataContent = cdataMatch[1];
                this.logger.info('从原始HTML的CDATA中提取内容', {
                    contentLength: cdataContent.length,
                    contentPreview: cdataContent.substring(0, 200)
                });
                
                // 检查是否为INLINE模式
                const outputType = element.querySelector('ac\\:parameter[ac\\:name="atlassian-macro-output-type"]')?.textContent;
                if (outputType === 'INLINE') {
                    // 内联模式：将换行符替换为空格
                    return cdataContent.replace(/\n/g, ' ').trim();
                } else {
                    // 块模式：保持原始格式
                    return cdataContent;
                }
            }

            // 查找ac:plain-text-body元素
            const plainTextBody = element.querySelector('ac\\:plain-text-body');
            if (plainTextBody) {
                const cdataContent = plainTextBody.textContent || '';
                this.logger.info('从ac:plain-text-body提取内容', {
                    contentLength: cdataContent.length,
                    contentPreview: cdataContent.substring(0, 200)
                });
                
                if (cdataContent.trim()) {
                    // 检查是否为INLINE模式
                    const outputType = element.querySelector('ac\\:parameter[ac\\:name="atlassian-macro-output-type"]')?.textContent;
                    if (outputType === 'INLINE') {
                        // 内联模式：将换行符替换为空格
                        return cdataContent.replace(/\n/g, ' ').trim();
                    } else {
                        // 块模式：保持原始格式
                        return cdataContent;
                    }
                }
            }

            // 查找ac:rich-text-body元素
            const richTextBody = element.querySelector('ac\\:rich-text-body');
            if (richTextBody) {
                const richContent = richTextBody.innerHTML || richTextBody.textContent || '';
                this.logger.info('从ac:rich-text-body提取内容', {
                    contentLength: richContent.length,
                    contentPreview: richContent.substring(0, 200)
                });
                return richContent;
            }

            // 如果有传入的content，但不是"INLINE"字符串，使用它
            if (content && content.trim() && content.trim() !== 'INLINE') {
                this.logger.info('使用传入的content', {
                    contentLength: content.length,
                    contentPreview: content.substring(0, 200)
                });
                return content;
            }

            // 最后尝试从元素的textContent获取
            const textContent = element.textContent || '';
            if (textContent.trim() && textContent.trim() !== 'INLINE') {
                this.logger.info('使用元素textContent', {
                    contentLength: textContent.length,
                    contentPreview: textContent.substring(0, 200)
                });
                return textContent;
            }

            this.logger.warn('Markdown宏没有找到任何内容');
            return '<!-- Markdown宏内容为空 -->';

        } catch (error) {
            this.logger.error('处理Markdown宏失败:', error);
            return `<!-- Markdown宏处理失败: ${error instanceof Error ? error.message : String(error)} -->`;
        }
    }

    /**
     * 预处理Confluence宏，在DOM解析之前提取CDATA内容
     */
    private static preprocessConfluenceMacros(html: string): string {
        try {
            this.logger.info('开始预处理Confluence宏');
            
            // 处理Markdown宏的CDATA内容
            let processedHtml = html.replace(
                /<ac:structured-macro[^>]*ac:name="markdown"[^>]*>([\s\S]*?)<\/ac:structured-macro>/g,
                (match, macroContent) => {
                    this.logger.debug('发现Markdown宏，开始处理CDATA', {
                        matchLength: match.length,
                        contentPreview: macroContent.substring(0, 200)
                    });
                    
                    // 提取CDATA内容
                    const cdataMatch = macroContent.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
                    if (cdataMatch && cdataMatch[1]) {
                        const cdataContent = cdataMatch[1];
                        
                        // 检查是否为INLINE模式
                        const isInlineMode = macroContent.includes('atlassian-macro-output-type">INLINE<');
                        
                        this.logger.info('提取到CDATA内容', {
                            contentLength: cdataContent.length,
                            isInlineMode,
                            contentPreview: cdataContent.substring(0, 200)
                        });
                        
                        // 根据模式处理内容
                        let processedContent = cdataContent;
                        if (isInlineMode) {
                            // 对于长内容，即使设置为INLINE模式也使用BLOCK模式
                            if (cdataContent.length > 500) {
                                this.logger.info('长内容自动切换为BLOCK模式', {
                                    contentLength: cdataContent.length,
                                    originalMode: 'INLINE'
                                });
                                // 保持原始格式
                                processedContent = cdataContent;
                            } else {
                                // 内联模式：将换行符替换为空格
                                processedContent = cdataContent.replace(/\n/g, ' ').trim();
                            }
                        }
                        
                        // 直接将Markdown内容转换为HTML结构
                        const htmlContent = this.convertMarkdownToHtml(processedContent);
                        return htmlContent;
                    } else {
                        this.logger.warn('Markdown宏中没有找到CDATA内容');
                        return `<div class="processed-markdown-macro" data-original-type="markdown"><!-- 没有找到CDATA内容 --></div>`;
                    }
                }
            );
            
            this.logger.info('Confluence宏预处理完成', {
                originalLength: html.length,
                processedLength: processedHtml.length,
                hasChanges: html !== processedHtml
            });
            
            return processedHtml;
            
        } catch (error) {
            this.logger.error('预处理Confluence宏失败:', error);
            return html; // 返回原始HTML作为回退
        }
    }

    /**
     * 将Markdown内容转换为HTML结构
     */
    private static convertMarkdownToHtml(markdown: string): string {
        try {
            // 简单的Markdown到HTML转换
            let html = markdown;
            
            // 转换标题
            html = html.replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, title) => {
                const level = hashes.length;
                return `<h${level}>${title.trim()}</h${level}>`;
            });
            
            // 转换段落（将连续的非空行包装为段落）
            const lines = html.split('\n');
            const processedLines: string[] = [];
            let currentParagraph: string[] = [];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // 如果是空行或已经是HTML标签，结束当前段落
                if (!line || line.startsWith('<')) {
                    if (currentParagraph.length > 0) {
                        processedLines.push(`<p>${currentParagraph.join(' ')}</p>`);
                        currentParagraph = [];
                    }
                    if (line.startsWith('<')) {
                        processedLines.push(line);
                    }
                } else {
                    currentParagraph.push(line);
                }
            }
            
            // 处理最后一个段落
            if (currentParagraph.length > 0) {
                processedLines.push(`<p>${currentParagraph.join(' ')}</p>`);
            }
            
            html = processedLines.join('\n');
            
            // 转换粗体和斜体
            html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            
            // 转换代码
            html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
            
            // 转换列表
            html = html.replace(/^\*\s+(.+)$/gm, '<li>$1</li>');
            html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
            
            // 转换链接
            html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
            
            this.logger.debug('Markdown转HTML完成', {
                originalLength: markdown.length,
                htmlLength: html.length
            });
            
            return html;
            
        } catch (error) {
            this.logger.error('Markdown转HTML失败:', error);
            // 回退：将内容包装在div中
            return `<div class="markdown-content">${this.escapeHtml(markdown)}</div>`;
        }
    }

    /**
     * 转义HTML特殊字符
     */
    private static escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * 获取信息宏的类型
     */
    private static getInfoMacroType(element: Element): string {
        if (element.classList.contains('info')) return 'Info';
        if (element.classList.contains('warning')) return 'Warning';
        if (element.classList.contains('error')) return 'Error';
        if (element.classList.contains('success')) return 'Success';
        if (element.classList.contains('note')) return 'Note';
        return 'Info';
    }

    /**
     * 将HTML转换为Markdown
     * @param html HTML内容
     * @returns Markdown内容
     */
    static htmlToMarkdown(html: string): string {
        if (!html || typeof html !== 'string') {
            this.logger.warn('HTML内容为空或无效', { 
                htmlType: typeof html, 
                htmlValue: html 
            });
            return '';
        }

        try {
            this.logger.debug('开始HTML到Markdown转换', {
                htmlLength: html.length,
                containsMacros: html.includes('ac:structured-macro')
            });

            const turndown = this.initializeTurndownService();

            // 对于大文件，使用流式处理
            const isLargeContent = html.length > 1024 * 1024; // 1MB
            let markdown: string;

            if (isLargeContent) {
                this.logger.debug(`处理大文件 (${Math.round(html.length / 1024)}KB)，使用流式转换`);
                markdown = this.processLargeHtmlContent(html, turndown);
            } else {
                this.logger.debug('使用标准转换处理HTML内容');
                
                // 预处理HTML：提取并替换CDATA内容
                const preprocessedHtml = this.preprocessConfluenceMacros(html);
                this.logger.info('HTML预处理完成', {
                    originalLength: html.length,
                    preprocessedLength: preprocessedHtml.length,
                    hasChanges: html !== preprocessedHtml
                });
                
                markdown = turndown.turndown(preprocessedHtml);
            }

            this.logger.debug('Turndown转换完成', {
                originalLength: html.length,
                markdownLength: markdown.length
            });

            // 后处理：清理多余的空行
            markdown = markdown.replace(/\n{3,}/g, '\n\n');

            // 后处理：修复列表格式
            markdown = this.fixListFormatting(markdown);

            // 后处理：修复链接格式
            markdown = this.fixLinkFormatting(markdown);

            const finalMarkdown = markdown.trim();
            
            this.logger.debug('HTML到Markdown转换完成', {
                originalLength: html.length,
                finalLength: finalMarkdown.length,
                isEmpty: finalMarkdown.length === 0
            });

            return finalMarkdown;
        } catch (error) {
            this.logger.error('HTML转Markdown失败:', error);
            // 降级处理：返回HTML注释包装的原内容
            return `<!-- HTML转换失败，保留原始内容 -->\n${html}`;
        }
    }

    /**
     * 处理大型HTML内容的转换
     */
    private static processLargeHtmlContent(html: string, turndown: any): string {
        const chunkSize = 512 * 1024; // 512KB chunks
        let result = '';

        // 尝试按段落分割，如果失败则按固定大小分割
        const paragraphs = html.split(/<\/p>\s*<p[^>]*>/i);

        if (paragraphs.length > 1) {
            // 按段落处理
            for (let i = 0; i < paragraphs.length; i++) {
                let chunk = paragraphs[i];

                // 修复段落标签
                if (i > 0) chunk = '<p>' + chunk;
                if (i < paragraphs.length - 1) chunk = chunk + '</p>';

                try {
                    const chunkMarkdown = turndown.turndown(chunk);
                    result += chunkMarkdown + '\n\n';
                } catch (error) {
                    this.logger.warn(`段落 ${i + 1} 转换失败，跳过`, error);
                }
            }
        } else {
            // 按固定大小分割
            for (let i = 0; i < html.length; i += chunkSize) {
                const chunk = html.slice(i, i + chunkSize);
                try {
                    const chunkMarkdown = turndown.turndown(chunk);
                    result += chunkMarkdown;
                } catch (error) {
                    this.logger.warn(`块 ${Math.floor(i / chunkSize) + 1} 转换失败，保留原始内容`, error);
                    result += `\n<!-- 转换失败的内容块 -->\n${chunk}\n`;
                }
            }
        }

        return result;
    }

    /**
     * 修复列表格式
     */
    private static fixListFormatting(markdown: string): string {
        // 修复嵌套列表的缩进
        const lines = markdown.split('\n');
        const fixedLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 检查是否是列表项
            if (/^\s*[-*+]\s/.test(line)) {
                // 确保列表项前后有适当的空行
                if (i > 0 && fixedLines[fixedLines.length - 1].trim() !== '' &&
                    !/^\s*[-*+]\s/.test(lines[i - 1])) {
                    fixedLines.push('');
                }
                fixedLines.push(line);
            } else {
                fixedLines.push(line);
            }
        }

        return fixedLines.join('\n');
    }

    /**
     * 修复链接格式
     */
    private static fixLinkFormatting(markdown: string): string {
        // 修复Confluence内部链接
        markdown = markdown.replace(
            /\[([^\]]+)\]\(\/wiki\/spaces\/([^\/]+)\/pages\/([^\/]+)\/([^)]+)\)/g,
            '[$1](confluence://spaces/$2/pages/$3/$4)'
        );

        return markdown;
    }

    /**
     * 分析HTML内容的标题结构
     * @param html HTML内容
     * @returns 标题结构数组
     */
    static analyzeHeadingStructure(html: string): HeadingStructure[] {
        if (!html) return [];

        const headings: HeadingStructure[] = [];

        // 使用正则表达式匹配标题标签
        const headingRegex = /<h([1-6])([^>]*)>(.*?)<\/h[1-6]>/gi;
        let match;

        while ((match = headingRegex.exec(html)) !== null) {
            const level = parseInt(match[1]);
            const attributes = match[2];
            const content = match[3];

            // 提取标题文本（移除HTML标签）
            const text = content.replace(/<[^>]*>/g, '').trim();

            // 提取ID属性
            const idMatch = attributes.match(/id\s*=\s*["']([^"']+)["']/i);
            const id = idMatch ? idMatch[1] : undefined;

            headings.push({
                level,
                text,
                id,
                startIndex: match.index,
                endIndex: match.index + match[0].length
            });
        }

        this.logger.debug(`分析标题结构完成，找到 ${headings.length} 个标题`);
        return headings;
    }

    /**
     * 按章节拆分内容
     * @param html HTML内容
     * @param splitLevel 拆分级别 (1, 2, 3)
     * @returns 章节数组
     */
    static splitByChapters(html: string, splitLevel: number = 2): ChapterSection[] {
        if (!html) return [];

        const headings = this.analyzeHeadingStructure(html);
        const splitHeadings = headings.filter(h => h.level <= splitLevel);

        if (splitHeadings.length === 0) {
            this.logger.warn(`未找到H${splitLevel}及以上级别的标题，无法拆分`);
            return [];
        }

        const chapters: ChapterSection[] = [];

        for (let i = 0; i < splitHeadings.length; i++) {
            const currentHeading = splitHeadings[i];
            const nextHeading = splitHeadings[i + 1];

            // 确定章节内容的范围
            const startIndex = currentHeading.startIndex;
            const endIndex = nextHeading ? nextHeading.startIndex : html.length;

            // 提取章节HTML内容
            const chapterHtml = html.substring(startIndex, endIndex);

            // 转换为Markdown
            const chapterMarkdown = this.htmlToMarkdown(chapterHtml);

            // 生成文件名
            const fileName = this.generateChapterFileName(currentHeading.text, i + 1);

            chapters.push({
                title: currentHeading.text,
                content: chapterMarkdown,
                level: currentHeading.level,
                index: i + 1,
                fileName,
                headingStructure: currentHeading
            });
        }

        this.logger.debug(`内容拆分完成，生成 ${chapters.length} 个章节`);
        return chapters;
    }

    /**
     * 生成章节文件名
     */
    private static generateChapterFileName(title: string, index: number): string {
        // 清理标题作为文件名
        let fileName = title
            .replace(/[<>:"|?*]/g, '')
            .replace(/[/\\]/g, '-')
            .replace(/\s+/g, '_')
            .toLowerCase();

        // 限制长度
        if (fileName.length > 50) {
            fileName = fileName.substring(0, 50);
        }

        // 添加序号前缀
        return `${index.toString().padStart(2, '0')}_${fileName}.md`;
    }

    /**
     * 处理内部链接
     * @param content Markdown内容
     * @param baseUrl Confluence基础URL
     * @returns 处理后的内容
     */
    static processInternalLinks(content: string, baseUrl: string): string {
        if (!content) return '';

        // 处理相对链接，转换为绝对链接
        content = content.replace(
            /\[([^\]]+)\]\(\/wiki\/([^)]+)\)/g,
            `[$1](${baseUrl}/wiki/$2)`
        );

        // 处理页面间的引用链接
        content = content.replace(
            /\[([^\]]+)\]\(confluence:\/\/spaces\/([^\/]+)\/pages\/([^\/]+)\/([^)]+)\)/g,
            '[$1](#$4)' // 转换为锚点链接
        );

        return content;
    }

    /**
     * 生成YAML frontmatter
     * @param page Confluence页面信息
     * @param exportDate 导出日期
     * @returns YAML frontmatter字符串
     */
    static generateFrontmatter(page: ConfluencePage, exportDate?: string): string {
        const metadata: FileMetadata = {
            originalPageId: page.id,
            originalTitle: page.title,
            originalUrl: page._links.webui,
            spaceKey: page.space.key,
            spaceName: page.space.name,
            author: page.version?.by.displayName || 'Unknown',
            createdDate: page.version?.when || '',
            modifiedDate: page.version?.when || '',
            version: page.version?.number || 1,
            exportDate: exportDate || new Date().toISOString()
        };

        // 构建YAML内容
        const yamlLines = [
            '---',
            `title: "${metadata.originalTitle.replace(/"/g, '\\"')}"`,
            `confluence_page_id: "${metadata.originalPageId}"`,
            `confluence_url: "${metadata.originalUrl}"`,
            `space_key: "${metadata.spaceKey}"`,
            `space_name: "${metadata.spaceName.replace(/"/g, '\\"')}"`,
            `author: "${metadata.author.replace(/"/g, '\\"')}"`,
            `created_date: "${metadata.createdDate}"`,
            `modified_date: "${metadata.modifiedDate}"`,
            `version: ${metadata.version}`,
            `export_date: "${metadata.exportDate}"`,
            '---',
            ''
        ];

        return yamlLines.join('\n');
    }

    /**
     * 提取页面附件信息
     * @param page Confluence页面
     * @returns 附件信息数组
     */
    static extractAttachments(page: ConfluencePage): any[] {
        // 这里需要根据实际的Confluence API响应结构来实现
        // 目前返回空数组，后续可以扩展
        return [];
    }

    /**
     * 清理和优化Markdown内容
     * @param markdown 原始Markdown
     * @returns 优化后的Markdown
     */
    static optimizeMarkdown(markdown: string): string {
        if (!markdown) return '';

        let optimized = markdown;

        // 移除多余的空行
        optimized = optimized.replace(/\n{4,}/g, '\n\n\n');

        // 修复标题前后的空行
        optimized = optimized.replace(/\n(#{1,6}\s[^\n]+)\n/g, '\n\n$1\n\n');

        // 修复列表前后的空行
        optimized = optimized.replace(/\n(\s*[-*+]\s[^\n]+)/g, '\n\n$1');

        // 修复代码块前后的空行
        optimized = optimized.replace(/\n(```[^`]*```)\n/g, '\n\n$1\n\n');

        // 清理文件末尾的多余空行
        optimized = optimized.replace(/\n+$/, '\n');

        return optimized;
    }
}