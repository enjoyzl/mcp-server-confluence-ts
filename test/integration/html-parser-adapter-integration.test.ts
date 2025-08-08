/**
 * HTML 解析器适配器集成测试
 * 测试适配器在实际宏处理场景中的表现
 */

import { describe, it, expect } from '@jest/globals';
import { getHTMLParserAdapter } from '../../src/utils/html-parser-adapter.js';

describe('HTML 解析器适配器集成测试', () => {
  const adapter = getHTMLParserAdapter();

  it('应该能够处理真实的 Confluence 页面 HTML 结构', () => {
    const realConfluenceHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>测试页面</title>
        </head>
        <body>
          <div class="wiki-content">
            <h1>页面标题</h1>
            <p>这是一个包含宏的页面</p>
            
            <ac:structured-macro ac:name="markdown">
              <ac:parameter ac:name="atlassian-macro-output-type">BLOCK</ac:parameter>
              <ac:plain-text-body>
                ## Markdown 内容
                这是 **粗体** 和 *斜体* 文本
                
                - 列表项 1
                - 列表项 2
              </ac:plain-text-body>
            </ac:structured-macro>
            
            <ac:structured-macro ac:name="code">
              <ac:parameter ac:name="language">typescript</ac:parameter>
              <ac:parameter ac:name="title">TypeScript 示例</ac:parameter>
              <ac:plain-text-body>
                interface User {
                  id: number;
                  name: string;
                }
                
                function getUser(id: number): User {
                  return { id, name: 'Test User' };
                }
              </ac:plain-text-body>
            </ac:structured-macro>
            
            <div class="confluence-information-macro confluence-information-macro-warning">
              <span class="aui-icon aui-icon-small aui-iconfont-warning confluence-information-macro-icon"></span>
              <div class="confluence-information-macro-body">
                <p>这是一个警告信息</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const doc = adapter.parseHTML(realConfluenceHtml);

    // 验证基本结构
    expect(doc.title).toBe('测试页面');
    expect(doc.querySelector('h1')?.textContent).toBe('页面标题');

    // 验证 Markdown 宏
    const markdownMacro = doc.querySelector('ac\\:structured-macro[ac\\:name="markdown"]');
    expect(markdownMacro).toBeDefined();
    expect(markdownMacro?.querySelector('ac\\:parameter')?.textContent).toBe('BLOCK');
    expect(markdownMacro?.querySelector('ac\\:plain-text-body')?.textContent).toContain('Markdown 内容');

    // 验证代码宏
    const codeMacro = doc.querySelector('ac\\:structured-macro[ac\\:name="code"]');
    expect(codeMacro).toBeDefined();
    expect(codeMacro?.querySelector('ac\\:parameter[ac\\:name="language"]')?.textContent).toBe('typescript');
    expect(codeMacro?.querySelector('ac\\:parameter[ac\\:name="title"]')?.textContent).toBe('TypeScript 示例');
    expect(codeMacro?.querySelector('ac\\:plain-text-body')?.textContent).toContain('interface User');

    // 验证信息宏
    const warningMacro = doc.querySelector('.confluence-information-macro-warning');
    expect(warningMacro).toBeDefined();
    expect(warningMacro?.querySelector('.confluence-information-macro-body p')?.textContent).toBe('这是一个警告信息');
  });

  it('应该能够正确序列化修改后的 DOM', () => {
    const originalHtml = `
      <div class="content">
        <ac:structured-macro ac:name="test">
          <ac:parameter ac:name="param1">value1</ac:parameter>
          <ac:plain-text-body>原始内容</ac:plain-text-body>
        </ac:structured-macro>
      </div>
    `;

    const doc = adapter.parseHTML(originalHtml);

    // 修改 DOM
    const macro = doc.querySelector('ac\\:structured-macro');
    if (macro) {
      macro.setAttribute('ac:name', 'modified-test');
    }

    const body = doc.querySelector('ac\\:plain-text-body');
    if (body) {
      body.textContent = '修改后的内容';
    }

    // 序列化并验证
    const serializedHtml = adapter.serializeDOM(doc);

    expect(serializedHtml).toContain('ac:name="modified-test"');
    expect(serializedHtml).toContain('修改后的内容');
    expect(serializedHtml).not.toContain('原始内容');
  });

  it('应该能够处理包含特殊字符和编码的内容', () => {
    const htmlWithSpecialChars = `
      <div>
        <p>包含特殊字符: &lt;&gt;&amp;&quot;&#39;</p>
        <p>中文内容: 测试中文字符</p>
        <p>Unicode: 🚀 ✅ ❌</p>
        <ac:structured-macro ac:name="test">
          <ac:plain-text-body>
            特殊字符测试: &lt;script&gt;alert('test')&lt;/script&gt;
            中文测试: 这是中文内容
            符号测试: @#$%^&*()
          </ac:plain-text-body>
        </ac:structured-macro>
      </div>
    `;

    const doc = adapter.parseHTML(htmlWithSpecialChars);

    // 验证特殊字符正确解析
    const paragraphs = doc.querySelectorAll('p');
    expect(paragraphs[0]?.textContent).toContain('<>&"\'');
    expect(paragraphs[1]?.textContent).toContain('测试中文字符');
    expect(paragraphs[2]?.textContent).toContain('🚀');

    // 验证宏内容正确解析
    const macroBody = doc.querySelector('ac\\:plain-text-body');
    expect(macroBody?.textContent).toContain('<script>');
    expect(macroBody?.textContent).toContain('这是中文内容');
    expect(macroBody?.textContent).toContain('@#$%^&*()');
  });

  it('应该能够处理大型复杂的 HTML 文档', () => {
    // 生成一个包含多个宏的大型文档
    let largeHtml = '<div class="wiki-content">';

    for (let i = 0; i < 50; i++) {
      largeHtml += `
        <h2>章节 ${i + 1}</h2>
        <p>这是第 ${i + 1} 个章节的内容</p>
        
        <ac:structured-macro ac:name="markdown">
          <ac:parameter ac:name="atlassian-macro-output-type">BLOCK</ac:parameter>
          <ac:plain-text-body>
            ### 子标题 ${i + 1}
            这是第 ${i + 1} 个 Markdown 宏的内容
          </ac:plain-text-body>
        </ac:structured-macro>
        
        <ac:structured-macro ac:name="code">
          <ac:parameter ac:name="language">javascript</ac:parameter>
          <ac:plain-text-body>
            console.log('这是第 ${i + 1} 个代码块');
            function test${i + 1}() {
              return ${i + 1};
            }
          </ac:plain-text-body>
        </ac:structured-macro>
      `;
    }

    largeHtml += '</div>';

    // 测试解析性能和正确性
    const startTime = Date.now();
    const doc = adapter.parseHTML(largeHtml);
    const parseTime = Date.now() - startTime;

    // 验证解析结果
    expect(doc.querySelectorAll('h2')).toHaveLength(50);
    expect(doc.querySelectorAll('ac\\:structured-macro[ac\\:name="markdown"]')).toHaveLength(50);
    expect(doc.querySelectorAll('ac\\:structured-macro[ac\\:name="code"]')).toHaveLength(50);

    // 验证内容正确性
    const firstMarkdown = doc.querySelector('ac\\:structured-macro[ac\\:name="markdown"] ac\\:plain-text-body');
    expect(firstMarkdown?.textContent).toContain('子标题 1');

    const lastCodeMacro = doc.querySelectorAll('ac\\:structured-macro[ac\\:name="code"] ac\\:plain-text-body')[49];
    expect(lastCodeMacro?.textContent).toContain('test50');

    // 验证性能（解析时间应该在合理范围内）
    expect(parseTime).toBeLessThan(5000); // 5秒内完成解析

    console.log(`大型文档解析耗时: ${parseTime}ms`);
  });

  it('应该能够处理错误的 HTML 并进行修复', () => {
    const malformedHtml = `
      <div class="content">
        <p>未闭合的段落
        <ac:structured-macro ac:name="test">
          <ac:parameter ac:name="param1">value1
          <ac:plain-text-body>
            内容没有正确闭合
        </ac:structured-macro>
        <div>另一个未闭合的div
      </div>
    `;

    // jsdom 应该能够自动修复大部分 HTML 错误
    expect(() => {
      const doc = adapter.parseHTML(malformedHtml);

      // 验证基本结构仍然可以访问
      expect(doc.querySelector('.content')).toBeDefined();
      expect(doc.querySelector('ac\\:structured-macro')).toBeDefined();
      expect(doc.querySelector('ac\\:parameter')).toBeDefined();

    }).not.toThrow();
  });

  it('应该能够处理空白和格式化的 HTML', () => {
    const formattedHtml = `
      <div class="wiki-content">
        
        <ac:structured-macro ac:name="markdown">
          
          <ac:parameter ac:name="atlassian-macro-output-type">
            BLOCK
          </ac:parameter>
          
          <ac:plain-text-body>
            
            # 标题
            
            段落内容
            
          </ac:plain-text-body>
          
        </ac:structured-macro>
        
      </div>
    `;

    const doc = adapter.parseHTML(formattedHtml);

    // 验证空白字符不影响元素识别
    expect(doc.querySelector('ac\\:structured-macro')).toBeDefined();
    expect(doc.querySelector('ac\\:parameter')?.textContent?.trim()).toBe('BLOCK');
    expect(doc.querySelector('ac\\:plain-text-body')?.textContent).toContain('标题');
  });
});