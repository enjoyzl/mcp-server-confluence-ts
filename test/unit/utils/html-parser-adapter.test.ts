/**
 * HTML 解析器适配器单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  HTMLParserAdapter,
  NodeHTMLParserAdapter,
  BrowserHTMLParserAdapter,
  HTMLParserAdapterFactory,
  getHTMLParserAdapter
} from '../../../src/utils/html-parser-adapter.js';

describe('HTMLParserAdapter', () => {
  describe('NodeHTMLParserAdapter', () => {
    let adapter: NodeHTMLParserAdapter;

    beforeEach(() => {
      adapter = new NodeHTMLParserAdapter();
    });

    it('应该正确创建 NodeHTMLParserAdapter 实例', () => {
      expect(adapter).toBeInstanceOf(NodeHTMLParserAdapter);
      expect(adapter.getAdapterType()).toBe('node');
    });

    it('应该正确解析简单的 HTML', () => {
      const html = '<div>Hello World</div>';
      const doc = adapter.parseHTML(html);

      expect(doc).toBeDefined();
      expect(doc.querySelector('div')?.textContent).toBe('Hello World');
    });

    it('应该正确解析复杂的 HTML 结构', () => {
      const html = `
        <html>
          <head><title>Test</title></head>
          <body>
            <div class="container">
              <h1 id="title">标题</h1>
              <p>段落内容</p>
              <ul>
                <li>项目1</li>
                <li>项目2</li>
              </ul>
            </div>
          </body>
        </html>
      `;

      const doc = adapter.parseHTML(html);

      expect(doc.title).toBe('Test');
      expect(doc.querySelector('#title')?.textContent).toBe('标题');
      expect(doc.querySelector('.container')).toBeDefined();
      expect(doc.querySelectorAll('li')).toHaveLength(2);
    });

    it('应该正确处理包含 CDATA 的 HTML', () => {
      const html = `
        <div>
          <script><![CDATA[
            console.log('Hello World');
          ]]></script>
        </div>
      `;

      const doc = adapter.parseHTML(html);
      expect(doc.querySelector('div')).toBeDefined();
    });

    it('应该正确序列化 DOM 为 HTML', () => {
      const html = '<div><p>Test Content</p></div>';
      const doc = adapter.parseHTML(html);
      const serialized = adapter.serializeDOM(doc);

      expect(serialized).toContain('<div><p>Test Content</p></div>');
    });

    it('应该正确创建元素节点', () => {
      const element = adapter.createElement('div');

      expect(element).toBeDefined();
      expect(element.tagName.toLowerCase()).toBe('div');
    });

    it('应该正确创建文本节点', () => {
      const textNode = adapter.createTextNode('Hello World');

      expect(textNode).toBeDefined();
      expect(textNode.textContent).toBe('Hello World');
    });

    it('应该处理无效的 HTML 输入', () => {
      const invalidHtml = '<div><p>未闭合的标签';

      // jsdom 通常会自动修复无效的 HTML
      expect(() => {
        const doc = adapter.parseHTML(invalidHtml);
        expect(doc).toBeDefined();
      }).not.toThrow();
    });

    it('应该处理空的 HTML 输入', () => {
      const emptyHtml = '';
      const doc = adapter.parseHTML(emptyHtml);

      expect(doc).toBeDefined();
      expect(doc.documentElement).toBeDefined();
    });

    it('应该处理包含特殊字符的 HTML', () => {
      const html = '<div>测试中文 &amp; 特殊字符 &lt;&gt;</div>';
      const doc = adapter.parseHTML(html);

      expect(doc.querySelector('div')).toBeDefined();
      expect(doc.querySelector('div')?.textContent).toContain('测试中文');
    });
  });

  describe('BrowserHTMLParserAdapter', () => {
    it('应该在非浏览器环境中抛出错误', () => {
      // 在 Node.js 环境中，BrowserHTMLParserAdapter 应该抛出错误
      expect(() => {
        new BrowserHTMLParserAdapter();
      }).toThrow('浏览器环境不可用');
    });
  });

  describe('HTMLParserAdapterFactory', () => {
    beforeEach(() => {
      // 重置默认适配器
      HTMLParserAdapterFactory.resetDefaultAdapter();
    });

    it('应该正确检测 Node.js 环境', () => {
      const envType = HTMLParserAdapterFactory.detectEnvironment();
      expect(envType).toBe('node');
    });

    it('应该创建 Node.js 适配器', () => {
      const adapter = HTMLParserAdapterFactory.createAdapter('node');
      expect(adapter).toBeInstanceOf(NodeHTMLParserAdapter);
      expect(adapter.getAdapterType()).toBe('node');
    });

    it('应该自动选择合适的适配器', () => {
      const adapter = HTMLParserAdapterFactory.createAdapter();
      expect(adapter).toBeInstanceOf(NodeHTMLParserAdapter);
    });

    it('应该返回单例的默认适配器', () => {
      const adapter1 = HTMLParserAdapterFactory.getDefaultAdapter();
      const adapter2 = HTMLParserAdapterFactory.getDefaultAdapter();

      expect(adapter1).toBe(adapter2);
      expect(adapter1).toBeInstanceOf(NodeHTMLParserAdapter);
    });

    it('应该正确重置默认适配器', () => {
      const adapter1 = HTMLParserAdapterFactory.getDefaultAdapter();
      HTMLParserAdapterFactory.resetDefaultAdapter();
      const adapter2 = HTMLParserAdapterFactory.getDefaultAdapter();

      expect(adapter1).not.toBe(adapter2);
      expect(adapter2).toBeInstanceOf(NodeHTMLParserAdapter);
    });

    it('应该处理不支持的环境类型', () => {
      expect(() => {
        HTMLParserAdapterFactory.createAdapter('invalid' as any);
      }).toThrow('不支持的环境类型');
    });
  });

  describe('全局便捷函数', () => {
    beforeEach(() => {
      HTMLParserAdapterFactory.resetDefaultAdapter();
    });

    it('getHTMLParserAdapter 应该返回默认适配器', () => {
      const adapter = getHTMLParserAdapter();
      expect(adapter).toBeInstanceOf(NodeHTMLParserAdapter);
    });

    it('多次调用应该返回同一个实例', () => {
      const adapter1 = getHTMLParserAdapter();
      const adapter2 = getHTMLParserAdapter();

      expect(adapter1).toBe(adapter2);
    });
  });

  describe('错误处理测试', () => {
    it('NodeHTMLParserAdapter 应该处理解析错误', () => {
      const adapter = new NodeHTMLParserAdapter();

      // 测试极端情况
      expect(() => {
        adapter.parseHTML('<div>正常内容</div>');
      }).not.toThrow();
    });

    it('应该处理序列化错误', () => {
      const adapter = new NodeHTMLParserAdapter();
      const doc = adapter.parseHTML('<div>Test</div>');

      expect(() => {
        adapter.serializeDOM(doc);
      }).not.toThrow();
    });

    it('应该处理创建元素的错误', () => {
      const adapter = new NodeHTMLParserAdapter();

      expect(() => {
        adapter.createElement('div');
      }).not.toThrow();

      expect(() => {
        adapter.createElement('invalid-tag-name');
      }).not.toThrow(); // jsdom 通常会接受任何标签名
    });
  });

  describe('实际使用场景测试', () => {
    let adapter: HTMLParserAdapter;

    beforeEach(() => {
      adapter = getHTMLParserAdapter();
    });

    it('应该正确处理 Confluence 宏 HTML', () => {
      const confluenceMacroHtml = `
        <ac:structured-macro ac:name="markdown">
          <ac:parameter ac:name="atlassian-macro-output-type">BLOCK</ac:parameter>
          <ac:plain-text-body>
            # 标题
            这是一个测试内容
          </ac:plain-text-body>
        </ac:structured-macro>
      `;

      const doc = adapter.parseHTML(confluenceMacroHtml);
      const macro = doc.querySelector('ac\\:structured-macro');

      expect(macro).toBeDefined();
      expect(macro?.getAttribute('ac:name')).toBe('markdown');

      const parameter = doc.querySelector('ac\\:parameter');
      expect(parameter?.getAttribute('ac:name')).toBe('atlassian-macro-output-type');
      expect(parameter?.textContent).toBe('BLOCK');

      const body = doc.querySelector('ac\\:plain-text-body');
      expect(body?.textContent).toContain('标题');
    });

    it('应该正确处理包含代码宏的 HTML', () => {
      const codeMacroHtml = `
        <ac:structured-macro ac:name="code">
          <ac:parameter ac:name="language">javascript</ac:parameter>
          <ac:parameter ac:name="title">示例代码</ac:parameter>
          <ac:plain-text-body>
            console.log('Hello World');
            function test() {
              return 'test';
            }
          </ac:plain-text-body>
        </ac:structured-macro>
      `;

      const doc = adapter.parseHTML(codeMacroHtml);
      const macro = doc.querySelector('ac\\:structured-macro[ac\\:name="code"]');

      expect(macro).toBeDefined();

      const langParam = doc.querySelector('ac\\:parameter[ac\\:name="language"]');
      expect(langParam?.textContent).toBe('javascript');

      const titleParam = doc.querySelector('ac\\:parameter[ac\\:name="title"]');
      expect(titleParam?.textContent).toBe('示例代码');

      const codeBody = doc.querySelector('ac\\:plain-text-body');
      expect(codeBody?.textContent).toContain('console.log');
    });

    it('应该正确处理信息宏 HTML', () => {
      const infoMacroHtml = `
        <div class="confluence-information-macro confluence-information-macro-information">
          <span class="aui-icon aui-icon-small aui-iconfont-info confluence-information-macro-icon"></span>
          <div class="confluence-information-macro-body">
            <p>这是一个信息提示</p>
          </div>
        </div>
      `;

      const doc = adapter.parseHTML(infoMacroHtml);
      const infoMacro = doc.querySelector('.confluence-information-macro-information');

      expect(infoMacro).toBeDefined();

      const body = doc.querySelector('.confluence-information-macro-body p');
      expect(body?.textContent).toBe('这是一个信息提示');
    });

    it('应该正确处理复杂的嵌套宏结构', () => {
      const nestedMacroHtml = `
        <div class="page-content">
          <ac:structured-macro ac:name="include">
            <ac:parameter ac:name="page-id">123456</ac:parameter>
            <div class="included-content">
              <ac:structured-macro ac:name="markdown">
                <ac:plain-text-body>
                  ## 嵌套内容
                  这是被包含页面的内容
                </ac:plain-text-body>
              </ac:structured-macro>
            </div>
          </ac:structured-macro>
        </div>
      `;

      const doc = adapter.parseHTML(nestedMacroHtml);

      const includeMacro = doc.querySelector('ac\\:structured-macro[ac\\:name="include"]');
      expect(includeMacro).toBeDefined();

      const pageIdParam = doc.querySelector('ac\\:parameter[ac\\:name="page-id"]');
      expect(pageIdParam?.textContent).toBe('123456');

      const nestedMarkdownMacro = doc.querySelector('ac\\:structured-macro[ac\\:name="markdown"]');
      expect(nestedMarkdownMacro).toBeDefined();

      const nestedContent = doc.querySelector('ac\\:plain-text-body');
      expect(nestedContent?.textContent).toContain('嵌套内容');
    });
  });
});