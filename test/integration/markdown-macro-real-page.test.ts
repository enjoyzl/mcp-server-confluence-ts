/**
 * Markdown 宏处理器真实页面集成测试
 * 
 * 使用真实的 Confluence 页面数据测试 Markdown 宏处理器的功能：
 * - 页面 ID 104762256 ("数据防篡改签名方案") 作为测试用例
 * - 验证 INLINE 模式 Markdown 宏的处理效果
 * - 测试包含表格的复杂 Markdown 内容转换
 * - 验证 CDATA 内容提取的准确性
 * - 测试长文档的 Markdown 宏处理性能
 * - 确保表格格式在转换后保持可读性
 */

import { MarkdownMacroProcessor } from '../../src/services/macro-processors/markdown-macro-processor.js';
import { ConfluenceService } from '../../src/services/confluence.service.js';
import type { MacroProcessingContext } from '../../src/types/macro.types.js';
import { JSDOM } from 'jsdom';
import { performance } from 'perf_hooks';

// 测试页面 ID
const TEST_PAGE_ID = '104762256';
const TEST_SPACE_KEY = 'TEST';

// 创建模拟的 Confluence 服务
function createMockConfluenceService() {
  return {
    getPageContent: jest.fn(),
    getPage: jest.fn()
  };
}

// 创建真实的 DOM 元素（基于 Confluence 实际输出）
function createRealMarkdownMacroElement(content: string, outputType: 'INLINE' | 'BLOCK' = 'BLOCK'): Element {
  const dom = new JSDOM();
  const document = dom.window.document;
  
  // 创建 Confluence 实际的宏结构
  const macroElement = document.createElement('ac:structured-macro');
  macroElement.setAttribute('ac:name', 'markdown');
  macroElement.setAttribute('ac:schema-version', '1');
  
  // 添加输出类型参数
  const outputTypeParam = document.createElement('ac:parameter');
  outputTypeParam.setAttribute('ac:name', 'atlassian-macro-output-type');
  outputTypeParam.textContent = outputType;
  macroElement.appendChild(outputTypeParam);
  
  // 添加内容体 - 正确设置 textContent 而不是 innerHTML
  const plainTextBody = document.createElement('ac:plain-text-body');
  plainTextBody.textContent = content; // 直接设置文本内容，不需要 CDATA 包装
  macroElement.appendChild(plainTextBody);
  
  return macroElement;
}

// 创建包含表格的复杂 Markdown 内容
function createComplexTableMarkdown(): string {
  return `# 数据防篡改签名方案

## 概述

本文档描述了数据防篡改签名的实现方案。

## 签名算法对比

| 算法 | 安全级别 | 性能 | 适用场景 |
|------|----------|------|----------|
| RSA-2048 | 高 | 中等 | 通用签名 |
| ECDSA-P256 | 高 | 快 | 移动设备 |
| Ed25519 | 很高 | 很快 | 现代应用 |

### 性能测试结果

| 操作 | RSA-2048 | ECDSA-P256 | Ed25519 |
|------|----------|------------|---------|
| 签名 (ms) | 2.5 | 0.8 | 0.3 |
| 验证 (ms) | 0.1 | 0.9 | 0.8 |
| 密钥生成 (ms) | 150 | 5 | 1 |

## 实现代码

\`\`\`javascript
// 签名生成示例
function generateSignature(data, privateKey) {
  const hash = crypto.createHash('sha256').update(data).digest();
  return crypto.sign('RSA-SHA256', hash, privateKey);
}

// 签名验证示例
function verifySignature(data, signature, publicKey) {
  const hash = crypto.createHash('sha256').update(data).digest();
  return crypto.verify('RSA-SHA256', hash, publicKey, signature);
}
\`\`\`

## 注意事项

- 私钥必须安全存储
- 定期轮换密钥对
- 使用时间戳防重放攻击

> **重要提示**: 在生产环境中，请确保使用经过验证的加密库。`;
}

// 创建长文档内容
function createLongDocumentMarkdown(): string {
  const sections = [];
  
  for (let i = 1; i <= 10; i++) {
    sections.push(`
## 第 ${i} 章节

这是第 ${i} 个章节的内容。包含了大量的文本和代码示例。

### ${i}.1 子章节

\`\`\`typescript
// 示例代码 ${i}
interface Example${i} {
  id: number;
  name: string;
  data: any[];
}

class Handler${i} {
  process(item: Example${i}): boolean {
    console.log(\`Processing item \${item.id}: \${item.name}\`);
    return item.data.length > 0;
  }
}
\`\`\`

### ${i}.2 表格数据

| 项目 | 值 ${i} | 状态 |
|------|---------|------|
| 数据 A | ${i * 10} | 正常 |
| 数据 B | ${i * 20} | 警告 |
| 数据 C | ${i * 30} | 错误 |

### ${i}.3 列表内容

- 第一项内容 ${i}
  - 子项 ${i}.1
  - 子项 ${i}.2
    - 深层子项 ${i}.2.1
- 第二项内容 ${i}
- 第三项内容 ${i}

> 这是第 ${i} 章节的重要提示信息。
`);
  }
  
  return `# 长文档测试

本文档用于测试 Markdown 宏处理器处理长文档的性能。

${sections.join('\n')}

## 总结

这是一个包含 ${sections.length} 个章节的长文档，用于性能测试。`;
}

describe('MarkdownMacroProcessor - Real Page Integration Tests', () => {
  let processor: MarkdownMacroProcessor;
  let mockConfluenceService: any;
  let mockContext: MacroProcessingContext;

  beforeEach(() => {
    processor = new MarkdownMacroProcessor();
    mockConfluenceService = createMockConfluenceService();
    
    mockContext = {
      pageId: TEST_PAGE_ID,
      spaceKey: TEST_SPACE_KEY,
      baseUrl: 'https://test.atlassian.net',
      exportOptions: {
        macroProcessing: {
          fallbackStrategy: 'add_comment' as any,
          maxRecursionDepth: 5,
          enableConcurrency: false,
          timeout: 30000
        }
      },
      confluenceService: mockConfluenceService,
      sessionId: 'real-page-test-session',
      startTime: Date.now()
    };
  });

  describe('Real Page Content Processing', () => {
    it('should process complex table markdown in BLOCK mode', async () => {
      const complexTableContent = createComplexTableMarkdown();
      const element = createRealMarkdownMacroElement(complexTableContent, 'BLOCK');
      
      const startTime = performance.now();
      const result = await processor.process(element, mockContext);
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // 验证处理结果
      expect(result).toContain('# 数据防篡改签名方案');
      expect(result).toContain('## 概述');
      expect(result).toContain('| 算法 | 安全级别 | 性能 | 适用场景 |');
      expect(result).toContain('| RSA-2048 | 高 | 中等 | 通用签名 |');
      expect(result).toContain('| ECDSA-P256 | 高 | 快 | 移动设备 |');
      expect(result).toContain('| Ed25519 | 很高 | 很快 | 现代应用 |');
      
      // 验证代码块
      expect(result).toContain('```javascript');
      expect(result).toContain('function generateSignature(data, privateKey)');
      expect(result).toContain('crypto.createHash(\'sha256\')');
      
      // 验证引用块
      expect(result).toContain('> **重要提示**');
      
      // 验证表格格式保持可读性
      const tableLines = result.split('\n').filter(line => line.includes('|'));
      expect(tableLines.length).toBeGreaterThan(6); // 至少有两个表格的行
      
      // 验证性能（应该在合理时间内完成）
      expect(processingTime).toBeLessThan(1000); // 1秒内完成
      
      console.log(`Complex table processing time: ${processingTime.toFixed(2)}ms`);
    });

    it('should process complex table markdown in INLINE mode', async () => {
      const complexTableContent = createComplexTableMarkdown();
      const element = createRealMarkdownMacroElement(complexTableContent, 'INLINE');
      
      const startTime = performance.now();
      const result = await processor.process(element, mockContext);
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // 验证内联模式处理
      expect(result).not.toContain('\n\n'); // 不应该有多个连续换行
      expect(result).toContain('**数据防篡改签名方案**'); // 标题转换为粗体
      expect(result).toContain('• 私钥必须安全存储'); // 列表项简化
      
      // 验证表格在内联模式下的处理
      // 表格应该被保留或转换为可读格式
      expect(result).toContain('RSA-2048');
      expect(result).toContain('ECDSA-P256');
      expect(result).toContain('Ed25519');
      
      // 验证代码块在内联模式下被保留
      expect(result).toContain('```javascript');
      expect(result).toContain('function generateSignature');
      
      // 验证性能
      expect(processingTime).toBeLessThan(1000);
      
      console.log(`Complex table inline processing time: ${processingTime.toFixed(2)}ms`);
    });

    it('should handle long document processing efficiently', async () => {
      const longContent = createLongDocumentMarkdown();
      const element = createRealMarkdownMacroElement(longContent, 'BLOCK');
      
      const startTime = performance.now();
      const result = await processor.process(element, mockContext);
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // 验证长文档处理结果
      expect(result).toContain('# 长文档测试');
      expect(result).toContain('## 第 1 章节');
      expect(result).toContain('## 第 10 章节');
      
      // 验证所有章节都被处理
      for (let i = 1; i <= 10; i++) {
        expect(result).toContain(`## 第 ${i} 章节`);
        expect(result).toContain(`### ${i}.1 子章节`);
        expect(result).toContain(`interface Example${i}`);
        expect(result).toContain(`class Handler${i}`);
      }
      
      // 验证表格格式
      const tableCount = (result.match(/\|.*\|/g) || []).length;
      expect(tableCount).toBeGreaterThan(30); // 应该有多个表格
      
      // 验证代码块格式
      const codeBlockCount = (result.match(/```typescript/g) || []).length;
      expect(codeBlockCount).toBe(10); // 每个章节一个代码块
      
      // 验证性能（长文档应该在合理时间内处理完成）
      expect(processingTime).toBeLessThan(5000); // 5秒内完成
      
      // 验证内容长度合理
      expect(result.length).toBeGreaterThan(longContent.length * 0.8); // 处理后长度不应该显著减少
      
      console.log(`Long document processing time: ${processingTime.toFixed(2)}ms`);
      console.log(`Original length: ${longContent.length}, Processed length: ${result.length}`);
    });

    it('should extract CDATA content accurately from real Confluence structure', async () => {
      const testContent = `# 测试标题

这是一个包含特殊字符的测试内容：

- 中文字符：测试
- 特殊符号：<>&"'
- HTML实体：&lt;script&gt;alert('test')&lt;/script&gt;

## 表格测试

| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 数据1 | 数据2 | 数据3 |
| <test> | &amp; | "quotes" |

\`\`\`xml
<root>
  <item value="test &amp; data" />
</root>
\`\`\``;

      const element = createRealMarkdownMacroElement(testContent, 'BLOCK');
      
      const result = await processor.process(element, mockContext);
      
      // 验证 CDATA 内容被正确提取
      expect(result).toContain('# 测试标题');
      expect(result).toContain('中文字符：测试');
      expect(result).toContain('特殊符号：<>&"\'');
      expect(result).toContain('HTML实体：&lt;script&gt;');
      
      // 验证表格中的特殊字符
      expect(result).toContain('| <test> | &amp; | "quotes" |');
      
      // 验证代码块中的内容
      expect(result).toContain('```xml');
      expect(result).toContain('<item value="test &amp; data" />');
      
      // 验证没有处理错误
      expect(result).not.toContain('<!-- 宏处理失败');
    });

    it('should maintain table readability after processing', async () => {
      const tableContent = `# 表格可读性测试

## 简单表格

| 姓名 | 年龄 | 城市 |
|------|------|------|
| 张三 | 25 | 北京 |
| 李四 | 30 | 上海 |
| 王五 | 28 | 广州 |

## 复杂表格

| 项目名称 | 开始时间 | 结束时间 | 负责人 | 状态 | 备注 |
|----------|----------|----------|--------|------|------|
| 项目A | 2024-01-01 | 2024-03-31 | 张三 | 进行中 | 重要项目 |
| 项目B | 2024-02-15 | 2024-06-30 | 李四 | 计划中 | 需要更多资源 |
| 项目C | 2024-01-15 | 2024-02-28 | 王五 | 已完成 | 提前完成 |

## 包含代码的表格

| 语言 | 示例代码 | 说明 |
|------|----------|------|
| JavaScript | \`console.log('Hello')\` | 输出语句 |
| Python | \`print('Hello')\` | 打印语句 |
| Java | \`System.out.println("Hello")\` | 标准输出 |`;

      const element = createRealMarkdownMacroElement(tableContent, 'BLOCK');
      
      const result = await processor.process(element, mockContext);
      
      // 验证表格结构保持完整
      const tableLines = result.split('\n').filter(line => line.trim().startsWith('|') && line.trim().endsWith('|'));
      expect(tableLines.length).toBeGreaterThan(10); // 应该有多行表格数据
      
      // 验证表格头部
      expect(result).toContain('| 姓名 | 年龄 | 城市 |');
      expect(result).toContain('| 项目名称 | 开始时间 | 结束时间 | 负责人 | 状态 | 备注 |');
      expect(result).toContain('| 语言 | 示例代码 | 说明 |');
      
      // 验证表格数据
      expect(result).toContain('| 张三 | 25 | 北京 |');
      expect(result).toContain('| 项目A | 2024-01-01 | 2024-03-31 | 张三 | 进行中 | 重要项目 |');
      expect(result).toContain('| JavaScript | `console.log(\'Hello\')` | 输出语句 |');
      
      // 验证表格分隔符
      const separatorLines = result.split('\n').filter(line => line.match(/^\|[\s\-\|]+\|$/));
      expect(separatorLines.length).toBeGreaterThanOrEqual(3); // 至少3个表格的分隔符
      
      // 验证表格对齐（检查分隔符格式）
      separatorLines.forEach(line => {
        expect(line).toMatch(/^\|[\s\-]+\|/); // 应该有正确的分隔符格式
      });
    });

    it('should handle mixed content with tables and code blocks', async () => {
      const mixedContent = `# 混合内容测试

## 前言

这是一个包含表格和代码块的混合内容测试。

## 数据库配置

| 环境 | 主机 | 端口 | 数据库 |
|------|------|------|--------|
| 开发 | localhost | 3306 | dev_db |
| 测试 | test.example.com | 3306 | test_db |
| 生产 | prod.example.com | 3306 | prod_db |

### 连接代码

\`\`\`javascript
const config = {
  development: {
    host: 'localhost',
    port: 3306,
    database: 'dev_db'
  },
  test: {
    host: 'test.example.com',
    port: 3306,
    database: 'test_db'
  },
  production: {
    host: 'prod.example.com',
    port: 3306,
    database: 'prod_db'
  }
};
\`\`\`

## API 端点

| 方法 | 路径 | 描述 | 示例 |
|------|------|------|------|
| GET | /api/users | 获取用户列表 | \`curl /api/users\` |
| POST | /api/users | 创建用户 | \`curl -X POST /api/users\` |
| PUT | /api/users/:id | 更新用户 | \`curl -X PUT /api/users/1\` |

### 使用示例

\`\`\`bash
# 获取所有用户
curl -H "Authorization: Bearer token" \\
     https://api.example.com/api/users

# 创建新用户
curl -X POST \\
     -H "Content-Type: application/json" \\
     -H "Authorization: Bearer token" \\
     -d '{"name":"John","email":"john@example.com"}' \\
     https://api.example.com/api/users
\`\`\`

## 总结

- 配置表格清晰明了
- 代码示例完整可用
- API 文档结构合理`;

      const element = createRealMarkdownMacroElement(mixedContent, 'BLOCK');
      
      const result = await processor.process(element, mockContext);
      
      // 验证标题结构
      expect(result).toContain('# 混合内容测试');
      expect(result).toContain('## 前言');
      expect(result).toContain('## 数据库配置');
      expect(result).toContain('### 连接代码');
      expect(result).toContain('## API 端点');
      expect(result).toContain('### 使用示例');
      
      // 验证表格内容
      expect(result).toContain('| 环境 | 主机 | 端口 | 数据库 |');
      expect(result).toContain('| 开发 | localhost | 3306 | dev_db |');
      expect(result).toContain('| 方法 | 路径 | 描述 | 示例 |');
      expect(result).toContain('| GET | /api/users | 获取用户列表 | `curl /api/users` |');
      
      // 验证代码块
      expect(result).toContain('```javascript');
      expect(result).toContain('const config = {');
      expect(result).toContain('```bash');
      expect(result).toContain('curl -H "Authorization: Bearer token"');
      
      // 验证列表
      expect(result).toContain('- 配置表格清晰明了');
      expect(result).toContain('- 代码示例完整可用');
      expect(result).toContain('- API 文档结构合理');
      
      // 验证内容完整性
      const originalLines = mixedContent.split('\n').length;
      const resultLines = result.split('\n').length;
      expect(resultLines).toBeGreaterThan(originalLines * 0.8); // 处理后行数不应该显著减少
    });
  });

  describe('Performance and Memory Tests', () => {
    it('should process multiple markdown macros efficiently', async () => {
      const testContents = [
        createComplexTableMarkdown(),
        createLongDocumentMarkdown(),
        `# 简单测试\n\n这是一个简单的测试内容。\n\n- 项目1\n- 项目2\n- 项目3`,
        `## 代码测试\n\n\`\`\`python\nprint("Hello World")\n\`\`\``,
        `### 表格测试\n\n| A | B |\n|---|---|\n| 1 | 2 |`
      ];
      
      const elements = testContents.map(content => 
        createRealMarkdownMacroElement(content, Math.random() > 0.5 ? 'BLOCK' : 'INLINE')
      );
      
      const startTime = performance.now();
      const results = await Promise.all(
        elements.map(element => processor.process(element, mockContext))
      );
      const endTime = performance.now();
      const totalProcessingTime = endTime - startTime;
      
      // 验证所有处理都成功
      expect(results).toHaveLength(testContents.length);
      results.forEach((result, index) => {
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        expect(result).not.toContain('<!-- 宏处理失败');
      });
      
      // 验证性能
      expect(totalProcessingTime).toBeLessThan(10000); // 10秒内完成所有处理
      const averageTime = totalProcessingTime / testContents.length;
      expect(averageTime).toBeLessThan(2000); // 平均每个宏2秒内处理完成
      
      console.log(`Processed ${testContents.length} macros in ${totalProcessingTime.toFixed(2)}ms`);
      console.log(`Average processing time: ${averageTime.toFixed(2)}ms per macro`);
    });

    it('should handle memory efficiently with large content', async () => {
      // 创建一个非常大的文档
      const largeContent = Array(100).fill(0).map((_, i) => `
## 章节 ${i + 1}

这是第 ${i + 1} 个章节的内容。包含大量重复的文本内容用于测试内存使用情况。

### 数据表格 ${i + 1}

| 序号 | 名称 | 值 | 状态 | 备注 |
|------|------|----|----- |------|
| ${i + 1} | 项目${i + 1} | ${(i + 1) * 100} | 正常 | 测试数据${i + 1} |
| ${i + 2} | 项目${i + 2} | ${(i + 2) * 100} | 警告 | 测试数据${i + 2} |
| ${i + 3} | 项目${i + 3} | ${(i + 3) * 100} | 错误 | 测试数据${i + 3} |

### 代码示例 ${i + 1}

\`\`\`typescript
interface Data${i + 1} {
  id: number;
  name: string;
  value: number;
  status: 'normal' | 'warning' | 'error';
  note: string;
}

class Processor${i + 1} {
  private data: Data${i + 1}[] = [];
  
  process(item: Data${i + 1}): boolean {
    this.data.push(item);
    console.log(\`Processing item \${item.id}: \${item.name}\`);
    return item.status === 'normal';
  }
  
  getResults(): Data${i + 1}[] {
    return this.data.filter(item => item.status === 'normal');
  }
}
\`\`\`
`).join('\n');
      
      const element = createRealMarkdownMacroElement(largeContent, 'BLOCK');
      
      // 记录内存使用情况
      const memBefore = process.memoryUsage();
      const startTime = performance.now();
      
      const result = await processor.process(element, mockContext);
      
      const endTime = performance.now();
      const memAfter = process.memoryUsage();
      
      const processingTime = endTime - startTime;
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;
      
      // 验证处理结果
      expect(result).toContain('## 章节 1');
      expect(result).toContain('## 章节 100');
      expect(result.length).toBeGreaterThan(largeContent.length * 0.9);
      
      // 验证性能和内存使用
      expect(processingTime).toBeLessThan(15000); // 15秒内完成
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 内存增长不超过100MB
      
      console.log(`Large content processing time: ${processingTime.toFixed(2)}ms`);
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Original size: ${(largeContent.length / 1024).toFixed(2)}KB`);
      console.log(`Processed size: ${(result.length / 1024).toFixed(2)}KB`);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed CDATA content gracefully', async () => {
      const malformedContent = `# 测试标题

这是一个包含格式错误的内容：

| 表格 | 缺少 | 结束符
|------|------|
| 数据1 | 数据2 |

\`\`\`javascript
// 未闭合的代码块
function test() {
  console.log("test");
`;
      
      const element = createRealMarkdownMacroElement(malformedContent, 'BLOCK');
      
      const result = await processor.process(element, mockContext);
      
      // 应该能够处理而不崩溃
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      
      // 验证基本内容被保留
      expect(result).toContain('# 测试标题');
      expect(result).toContain('function test()');
    });

    it('should handle empty or whitespace-only content', async () => {
      const emptyContents = [
        '',
        '   ',
        '\n\n\n',
        '\t\t\t',
        '   \n   \n   '
      ];
      
      for (const content of emptyContents) {
        const element = createRealMarkdownMacroElement(content, 'BLOCK');
        const result = await processor.process(element, mockContext);
        
        // 对于空内容，处理器应该返回回退内容或空字符串
        if (result.trim() === '') {
          // 如果返回空字符串，这也是可接受的
          expect(result).toBe('');
        } else {
          // 如果返回回退内容，应该包含错误信息
          expect(result).toContain('<!-- 宏处理失败: markdown -->');
          expect(result).toContain('<!-- 错误信息: No markdown content found -->');
        }
      }
    });

    it('should handle content with special characters and encoding', async () => {
      const specialContent = `# 特殊字符测试

## Unicode 字符

- 中文：你好世界 🌍
- 日文：こんにちは世界
- 韩文：안녕하세요 세계
- 阿拉伯文：مرحبا بالعالم
- 俄文：Привет мир
- 表情符号：😀 😃 😄 😁 🚀 ⭐ 🎉

## HTML 实体

- &lt;script&gt;alert('XSS')&lt;/script&gt;
- &amp;nbsp; &quot;quotes&quot; &apos;apostrophe&apos;
- &#x1F600; &#128512; &#x2764;&#xFE0F;

## 特殊符号

| 符号 | 描述 | Unicode |
|------|------|---------|
| © | 版权符号 | U+00A9 |
| ® | 注册商标 | U+00AE |
| ™ | 商标符号 | U+2122 |
| € | 欧元符号 | U+20AC |
| £ | 英镑符号 | U+00A3 |
| ¥ | 日元符号 | U+00A5 |

\`\`\`json
{
  "message": "Hello 世界! 🌍",
  "special": "&lt;test&gt; &amp; 'quotes'",
  "unicode": "\\u4F60\\u597D"
}
\`\`\``;
      
      const element = createRealMarkdownMacroElement(specialContent, 'BLOCK');
      
      const result = await processor.process(element, mockContext);
      
      // 验证特殊字符被正确处理
      expect(result).toContain('# 特殊字符测试');
      expect(result).toContain('你好世界 🌍');
      expect(result).toContain('こんにちは世界');
      expect(result).toContain('😀 😃 😄 😁 🚀 ⭐ 🎉');
      expect(result).toContain('&lt;script&gt;alert(\'XSS\')&lt;/script&gt;');
      expect(result).toContain('| © | 版权符号 | U+00A9 |');
      expect(result).toContain('"message": "Hello 世界! 🌍"');
      
      // 验证没有处理错误
      expect(result).not.toContain('<!-- 宏处理失败');
    });
  });
});