/**
 * MarkdownMacroProcessor 单元测试
 * 
 * 测试 Markdown 宏处理器的各种功能：
 * - CDATA 内容提取
 * - INLINE/BLOCK 模式处理
 * - 内容清理和格式化
 * - 错误处理和回退机制
 */

import { MarkdownMacroProcessor } from '../../../src/services/macro-processors/markdown-macro-processor.js';
import type { MacroProcessingContext } from '../../../src/types/macro.types.js';
import { JSDOM } from 'jsdom';

// 创建模拟的 DOM 元素辅助函数
function createMockElement(tagName: string, attributes: Record<string, string> = {}, textContent: string = ''): Element {
  const dom = new JSDOM();
  const element = dom.window.document.createElement(tagName);
  
  // 设置属性
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  
  // 设置文本内容
  if (textContent) {
    element.textContent = textContent;
  }
  
  return element;
}

// 创建包含子元素的模拟元素
function createMockElementWithChildren(tagName: string, attributes: Record<string, string> = {}, children: Array<{tagName: string, attributes?: Record<string, string>, textContent?: string}> = []): Element {
  const dom = new JSDOM();
  const element = dom.window.document.createElement(tagName);
  
  // 设置属性
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  
  // 添加子元素
  children.forEach(child => {
    const childElement = dom.window.document.createElement(child.tagName);
    if (child.attributes) {
      Object.entries(child.attributes).forEach(([key, value]) => {
        childElement.setAttribute(key, value);
      });
    }
    if (child.textContent) {
      childElement.textContent = child.textContent;
    }
    element.appendChild(childElement);
  });
  
  return element;
}

describe('MarkdownMacroProcessor', () => {
  let processor: MarkdownMacroProcessor;
  let mockContext: MacroProcessingContext;

  beforeEach(() => {
    processor = new MarkdownMacroProcessor();
    mockContext = {
      pageId: 'test-page-123',
      spaceKey: 'TEST',
      baseUrl: 'https://test.atlassian.net',
      exportOptions: {
        macroProcessing: {
          fallbackStrategy: 'add_comment' as any,
          maxRecursionDepth: 5
        }
      },
      sessionId: 'test-session-123'
    };
  });

  describe('canProcess', () => {
    it('should identify elements with confluence-markdown-macro class', () => {
      const element = createMockElement('div', { 'class': 'confluence-markdown-macro' });
      expect(processor.canProcess(element)).toBe(true);
    });

    it('should identify elements with markdown-macro class', () => {
      const element = createMockElement('div', { 'class': 'markdown-macro' });
      expect(processor.canProcess(element)).toBe(true);
    });

    it('should identify elements with macro-markdown class', () => {
      const element = createMockElement('div', { 'class': 'macro-markdown' });
      expect(processor.canProcess(element)).toBe(true);
    });

    it('should identify elements with data-macro-name attribute', () => {
      const element = createMockElement('div', { 'data-macro-name': 'markdown' });
      expect(processor.canProcess(element)).toBe(true);
    });

    it('should not identify non-markdown elements', () => {
      const element = createMockElement('div', { 'class': 'code-macro' });
      expect(processor.canProcess(element)).toBe(false);
    });
  });

  describe('CDATA content extraction', () => {
    it('should extract content from plain text body element', async () => {
      const markdownContent = '# Test Header\n\nThis is a test paragraph.';
      const element = createMockElementWithChildren('div', 
        { 'class': 'confluence-markdown-macro' },
        [{ tagName: 'div', attributes: { 'class': 'plain-text-body' }, textContent: markdownContent }]
      );
      
      const result = await processor.process(element, mockContext);
      expect(result).toContain('# Test Header');
      expect(result).toContain('This is a test paragraph.');
    });

    it('should extract content from element with textContent', async () => {
      const markdownContent = '## Subtitle\n\n- Item 1\n- Item 2';
      const element = createMockElement('div', 
        { 'class': 'confluence-markdown-macro' }, 
        markdownContent
      );
      
      const result = await processor.process(element, mockContext);
      expect(result).toContain('## Subtitle');
      expect(result).toContain('- Item 1');
      expect(result).toContain('- Item 2');
    });

    it('should handle empty content gracefully', async () => {
      const element = createMockElement('div', { 'class': 'confluence-markdown-macro' });
      
      const result = await processor.process(element, mockContext);
      expect(result).toContain('<!-- 宏处理失败: markdown -->');
      expect(result).toContain('<!-- 错误信息: No markdown content found -->');
    });
  });

  describe('output type processing', () => {
    it('should process INLINE mode correctly', async () => {
      const markdownContent = '# Header\n\nThis is a paragraph with\nmultiple lines.\n\n- List item 1\n- List item 2';
      const element = createMockElementWithChildren('div', 
        { 'class': 'confluence-markdown-macro', 'data-output-type': 'INLINE' },
        [{ tagName: 'div', attributes: { 'class': 'macro-body' }, textContent: markdownContent }]
      );
      
      const result = await processor.process(element, mockContext);
      
      // 内联模式应该将换行符替换为空格
      expect(result).not.toContain('\n');
      expect(result).toContain('**Header**'); // 标题应该转换为粗体
      expect(result).toContain('• List item 1'); // 列表项应该简化
      expect(result).toContain('• List item 2');
    });

    it('should process BLOCK mode correctly', async () => {
      const markdownContent = '# Header\n\nThis is a paragraph.\n\n```javascript\nconsole.log("test");\n```';
      const element = createMockElementWithChildren('div', 
        { 'class': 'confluence-markdown-macro', 'data-output-type': 'BLOCK' },
        [{ tagName: 'div', attributes: { 'class': 'macro-body' }, textContent: markdownContent }]
      );
      
      const result = await processor.process(element, mockContext);
      
      // 块级模式应该保持原始格式
      expect(result).toContain('# Header');
      expect(result).toContain('```javascript');
      expect(result).toContain('console.log("test");');
      expect(result).toContain('```');
    });

    it('should default to BLOCK mode when no output type specified', async () => {
      const markdownContent = '## Subtitle\n\nContent here.';
      const element = createMockElement('div', 
        { 'class': 'confluence-markdown-macro' }, 
        markdownContent
      );
      
      const result = await processor.process(element, mockContext);
      
      // 应该保持块级格式
      expect(result).toContain('## Subtitle');
      expect(result).toContain('\n');
    });
  });

  describe('content cleaning and formatting', () => {
    it('should normalize line endings', async () => {
      const markdownContent = '# Header\r\n\r\nParagraph with\r\nWindows line endings.';
      const element = createMockElement('div', 
        { 'class': 'confluence-markdown-macro' }, 
        markdownContent
      );
      
      const result = await processor.process(element, mockContext);
      
      // 应该统一为 \n
      expect(result).not.toContain('\r\n');
      expect(result).not.toContain('\r');
    });

    it('should fix list indentation', async () => {
      const markdownContent = '- Item 1\n    - Nested item\n        - Deep nested\n- Item 2';
      const element = createMockElement('div', 
        { 'class': 'confluence-markdown-macro' }, 
        markdownContent
      );
      
      const result = await processor.process(element, mockContext);
      
      // 应该修复缩进
      expect(result).toContain('- Item 1');
      expect(result).toContain('  - Nested item');
      expect(result).toContain('    - Deep nested');
      expect(result).toContain('- Item 2');
    });

    it('should fix code block formatting', async () => {
      const markdownContent = '```javascript\n\n\nconsole.log("test");\n\n\n```';
      const element = createMockElement('div', 
        { 'class': 'confluence-markdown-macro' }, 
        markdownContent
      );
      
      const result = await processor.process(element, mockContext);
      
      // 应该移除代码块前后的多余空行
      expect(result).toContain('```javascript\nconsole.log("test");\n```');
      expect(result).not.toContain('\n\n\nconsole.log');
    });

    it('should fix links and images formatting', async () => {
      const markdownContent = '[Link Text]  (  https://example.com  )\n![Alt Text]  (  image.png  )';
      const element = createMockElement('div', 
        { 'class': 'confluence-markdown-macro' }, 
        markdownContent
      );
      
      const result = await processor.process(element, mockContext);
      
      // 应该修复链接和图片的格式
      expect(result).toContain('[Link Text](https://example.com)');
      expect(result).toContain('![Alt Text](image.png)');
    });

    it('should remove excessive blank lines', async () => {
      const markdownContent = '# Header\n\n\n\n\nParagraph\n\n\n\n\n## Subtitle';
      const element = createMockElement('div', 
        { 'class': 'confluence-markdown-macro' }, 
        markdownContent
      );
      
      const result = await processor.process(element, mockContext);
      
      // 应该限制连续空行数量
      expect(result).not.toContain('\n\n\n\n');
      expect(result).toContain('# Header');
      expect(result).toContain('Paragraph');
      expect(result).toContain('## Subtitle');
    });
  });

  describe('inline mode newline handling', () => {
    it('should preserve code blocks when replacing newlines', async () => {
      const markdownContent = 'Text before\n\n```javascript\nfunction test() {\n  return "hello";\n}\n```\n\nText after';
      const element = createMockElementWithChildren('div', 
        { 'class': 'confluence-markdown-macro', 'data-output-type': 'INLINE' },
        [{ tagName: 'div', attributes: { 'class': 'macro-body' }, textContent: markdownContent }]
      );
      
      const result = await processor.process(element, mockContext);
      
      // 代码块内的换行应该被保留
      expect(result).toContain('```javascript\nfunction test() {\n  return "hello";\n}\n```');
      // 代码块外的换行应该被替换为空格
      expect(result).toContain('Text before ```javascript');
      expect(result).toContain('``` Text after');
    });

    it('should preserve inline code when replacing newlines', async () => {
      const markdownContent = 'Use `console.log()` function\nto print output\nto console.';
      const element = createMockElementWithChildren('div', 
        { 'class': 'confluence-markdown-macro', 'data-output-type': 'INLINE' },
        [{ tagName: 'div', attributes: { 'class': 'macro-body' }, textContent: markdownContent }]
      );
      
      const result = await processor.process(element, mockContext);
      
      // 内联代码应该被保留
      expect(result).toContain('`console.log()`');
      // 其他换行应该被替换为空格
      expect(result).toContain('Use `console.log()` function to print output to console.');
    });
  });

  describe('error handling', () => {
    it('should handle DOM parsing errors gracefully', async () => {
      const element = createMockElement('div', { 'class': 'confluence-markdown-macro' });
      
      const result = await processor.process(element, mockContext);
      
      expect(result).toContain('<!-- 宏处理失败: markdown -->');
      expect(result).toContain('<!-- 错误信息: No markdown content found -->');
    });

    it('should provide fallback content for processing errors', async () => {
      // 创建一个会导致处理错误的元素
      const element = createMockElement('div', { 'class': 'confluence-markdown-macro' }, 'Invalid content without CDATA');
      
      // 修改元素使其在处理时抛出错误
      Object.defineProperty(element, 'textContent', {
        get: () => { throw new Error('Simulated DOM error'); }
      });
      
      const result = await processor.process(element, mockContext);
      
      expect(result).toContain('<!-- 宏处理失败: markdown -->');
      expect(result).toContain('<!-- 错误信息:');
    });
  });

  describe('processor information', () => {
    it('should return correct processor info', () => {
      const info = processor.getProcessorInfo();
      
      expect(info.macroType).toBe('markdown');
      expect(info.priority).toBe(10);
      expect(info.enabled).toBe(true);
      expect(info.className).toBe('MarkdownMacroProcessor');
      expect(info.supportedOutputTypes).toEqual(['INLINE', 'BLOCK']);
      expect(info.features).toContain('CDATA content extraction');
      expect(info.features).toContain('Inline/Block mode processing');
    });
  });

  describe('parameter extraction', () => {
    it('should extract data attributes as parameters', async () => {
      const element = createMockElementWithChildren('div', 
        { 'class': 'confluence-markdown-macro', 'data-output-type': 'BLOCK' },
        [{ tagName: 'div', attributes: { 'class': 'macro-body' }, textContent: '# Test Header' }]
      );
      
      // 这个测试主要验证参数提取功能，即使内容可能不完全正确
      const result = await processor.process(element, mockContext);
      
      // 应该能够处理而不出错
      expect(typeof result).toBe('string');
      expect(result).toContain('# Test Header');
    });

    it('should handle elements without specific parameters', async () => {
      const element = createMockElement('div', 
        { 'class': 'confluence-markdown-macro' }, 
        '## Simple Content'
      );
      
      const result = await processor.process(element, mockContext);
      
      // 应该能够处理而不出错
      expect(typeof result).toBe('string');
      expect(result).toContain('## Simple Content');
    });
  });
});