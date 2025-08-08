/**
 * 真实页面 104762256 ("数据防篡改签名方案") 测试
 * 
 * 这个测试文件专门用于测试页面 ID 104762256 的 Markdown 宏处理
 * 验证真实 Confluence 页面数据的处理效果
 */

import { MarkdownMacroProcessor } from '../../src/services/macro-processors/markdown-macro-processor.js';
import type { MacroProcessingContext } from '../../src/types/macro.types.js';
import { JSDOM } from 'jsdom';
import { performance } from 'perf_hooks';

// 真实页面 ID
const REAL_PAGE_ID = '104762256';
const REAL_SPACE_KEY = 'TECH';

// 模拟真实页面的 Markdown 宏内容（基于实际页面结构）
const REAL_PAGE_MARKDOWN_CONTENT = `# 数据防篡改签名方案

## 概述

本文档描述了数据防篡改签名的实现方案，确保数据在传输和存储过程中的完整性和真实性。

## 签名算法对比

### 主要算法性能对比

| 算法 | 密钥长度 | 签名长度 | 安全级别 | 性能 | 适用场景 |
|------|----------|----------|----------|------|----------|
| RSA-2048 | 2048 bits | 256 bytes | 高 | 中等 | 通用签名验证 |
| RSA-3072 | 3072 bits | 384 bytes | 很高 | 较慢 | 高安全要求 |
| ECDSA-P256 | 256 bits | 64 bytes | 高 | 快 | 移动设备、IoT |
| ECDSA-P384 | 384 bits | 96 bytes | 很高 | 快 | 企业级应用 |
| Ed25519 | 256 bits | 64 bytes | 很高 | 很快 | 现代应用推荐 |
| Ed448 | 448 bits | 114 bytes | 极高 | 快 | 未来安全标准 |

### 性能测试结果

在标准测试环境下（Intel i7-10700K, 16GB RAM）的性能数据：

| 操作 | RSA-2048 | RSA-3072 | ECDSA-P256 | ECDSA-P384 | Ed25519 | Ed448 |
|------|----------|----------|------------|------------|---------|-------|
| 密钥生成 (ms) | 150 | 450 | 5 | 12 | 1 | 3 |
| 签名 (ms) | 2.5 | 8.1 | 0.8 | 1.2 | 0.3 | 0.8 |
| 验证 (ms) | 0.1 | 0.2 | 0.9 | 1.8 | 0.8 | 1.5 |
| 吞吐量 (ops/sec) | 400 | 120 | 1250 | 556 | 3333 | 1250 |

## 实现方案

### 1. 基础签名实现

\`\`\`javascript
const crypto = require('crypto');

/**
 * 数据签名类
 * 支持多种签名算法
 */
class DataSigner {
  constructor(algorithm = 'RSA-SHA256') {
    this.algorithm = algorithm;
    this.keyPair = null;
  }

  /**
   * 生成密钥对
   */
  async generateKeyPair() {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      }, (err, publicKey, privateKey) => {
        if (err) reject(err);
        else {
          this.keyPair = { publicKey, privateKey };
          resolve({ publicKey, privateKey });
        }
      });
    });
  }

  /**
   * 对数据进行签名
   * @param {string|Buffer} data - 要签名的数据
   * @returns {string} Base64编码的签名
   */
  sign(data) {
    if (!this.keyPair) {
      throw new Error('Key pair not generated');
    }

    const hash = crypto.createHash('sha256').update(data).digest();
    const signature = crypto.sign(this.algorithm, hash, this.keyPair.privateKey);
    return signature.toString('base64');
  }

  /**
   * 验证签名
   * @param {string|Buffer} data - 原始数据
   * @param {string} signature - Base64编码的签名
   * @returns {boolean} 验证结果
   */
  verify(data, signature) {
    if (!this.keyPair) {
      throw new Error('Key pair not generated');
    }

    const hash = crypto.createHash('sha256').update(data).digest();
    const signatureBuffer = Buffer.from(signature, 'base64');
    return crypto.verify(this.algorithm, hash, this.keyPair.publicKey, signatureBuffer);
  }
}
\`\`\`

### 2. ECDSA 实现

\`\`\`javascript
/**
 * ECDSA 签名实现
 * 使用椭圆曲线数字签名算法
 */
class ECDSASigner {
  constructor(curve = 'prime256v1') {
    this.curve = curve;
    this.keyPair = null;
  }

  async generateKeyPair() {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair('ec', {
        namedCurve: this.curve,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      }, (err, publicKey, privateKey) => {
        if (err) reject(err);
        else {
          this.keyPair = { publicKey, privateKey };
          resolve({ publicKey, privateKey });
        }
      });
    });
  }

  sign(data) {
    if (!this.keyPair) {
      throw new Error('Key pair not generated');
    }

    const signature = crypto.sign('sha256', data, this.keyPair.privateKey);
    return signature.toString('base64');
  }

  verify(data, signature) {
    if (!this.keyPair) {
      throw new Error('Key pair not generated');
    }

    const signatureBuffer = Buffer.from(signature, 'base64');
    return crypto.verify('sha256', data, this.keyPair.publicKey, signatureBuffer);
  }
}
\`\`\`

### 3. 批量签名处理

\`\`\`javascript
/**
 * 批量数据签名处理器
 * 支持并发处理大量数据
 */
class BatchSigner {
  constructor(signer, options = {}) {
    this.signer = signer;
    this.concurrency = options.concurrency || 10;
    this.batchSize = options.batchSize || 100;
  }

  /**
   * 批量签名数据
   * @param {Array} dataList - 数据列表
   * @returns {Promise<Array>} 签名结果列表
   */
  async signBatch(dataList) {
    const results = [];
    const batches = this.createBatches(dataList, this.batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(async (data, index) => {
        try {
          const signature = this.signer.sign(data);
          return {
            index: results.length + index,
            data,
            signature,
            timestamp: Date.now(),
            success: true
          };
        } catch (error) {
          return {
            index: results.length + index,
            data,
            error: error.message,
            timestamp: Date.now(),
            success: false
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }
}
\`\`\`

## 安全注意事项

### 密钥管理

1. **私钥保护**
   - 私钥必须安全存储，建议使用硬件安全模块 (HSM)
   - 实施严格的访问控制和审计日志
   - 定期轮换密钥对

2. **密钥分发**
   - 使用安全的密钥分发协议
   - 验证公钥的真实性和完整性
   - 建立密钥撤销机制

### 实施建议

> **重要提示**: 在生产环境中，请确保使用经过验证的加密库，如 OpenSSL、Bouncy Castle 等。

> **性能优化**: 对于高并发场景，建议使用 ECDSA 或 Ed25519 算法以获得更好的性能。

> **兼容性考虑**: 选择算法时需要考虑目标系统的兼容性要求。

### 测试验证

\`\`\`bash
# 性能测试脚本
#!/bin/bash

echo "开始签名性能测试..."

# RSA-2048 测试
node -e "
const signer = new DataSigner('RSA-SHA256');
signer.generateKeyPair().then(() => {
  const start = Date.now();
  for (let i = 0; i < 1000; i++) {
    signer.sign('test data ' + i);
  }
  const end = Date.now();
  console.log('RSA-2048: ' + (end - start) + 'ms for 1000 signatures');
});
"

# ECDSA 测试
node -e "
const signer = new ECDSASigner('prime256v1');
signer.generateKeyPair().then(() => {
  const start = Date.now();
  for (let i = 0; i < 1000; i++) {
    signer.sign('test data ' + i);
  }
  const end = Date.now();
  console.log('ECDSA-P256: ' + (end - start) + 'ms for 1000 signatures');
});
"
\`\`\`

## 总结

本方案提供了完整的数据防篡改签名解决方案，包括：

- 多种签名算法的实现和对比
- 详细的性能测试数据
- 批量处理能力
- 安全最佳实践指导

选择合适的签名算法需要综合考虑安全性、性能和兼容性要求。对于新项目，推荐使用 Ed25519 算法；对于需要兼容性的场景，可以选择 ECDSA-P256 或 RSA-2048。`;

// 创建真实的 Confluence 宏元素
function createRealConfluenceMarkdownMacro(content: string, outputType: 'INLINE' | 'BLOCK' = 'BLOCK'): Element {
  const dom = new JSDOM();
  const document = dom.window.document;

  // 创建符合 Confluence 实际结构的宏元素
  const macroElement = document.createElement('ac:structured-macro');
  macroElement.setAttribute('ac:name', 'markdown');
  macroElement.setAttribute('ac:schema-version', '1');
  macroElement.setAttribute('ac:macro-id', 'real-page-macro-' + Date.now());

  // 添加输出类型参数
  const outputTypeParam = document.createElement('ac:parameter');
  outputTypeParam.setAttribute('ac:name', 'atlassian-macro-output-type');
  outputTypeParam.textContent = outputType;
  macroElement.appendChild(outputTypeParam);

  // 添加内容体
  const plainTextBody = document.createElement('ac:plain-text-body');
  plainTextBody.textContent = content;
  macroElement.appendChild(plainTextBody);

  return macroElement;
}

describe('Real Page 104762256 - Markdown Macro Processing', () => {
  let processor: MarkdownMacroProcessor;
  let mockContext: MacroProcessingContext;

  beforeEach(() => {
    processor = new MarkdownMacroProcessor();

    mockContext = {
      pageId: REAL_PAGE_ID,
      spaceKey: REAL_SPACE_KEY,
      baseUrl: 'https://company.atlassian.net',
      exportOptions: {
        macroProcessing: {
          fallbackStrategy: 'add_comment' as any,
          maxRecursionDepth: 5,
          enableConcurrency: true,
          timeout: 30000
        }
      },
      sessionId: 'real-page-104762256-session',
      startTime: Date.now()
    };
  });

  describe('Real Page Content Processing', () => {
    it('should process the real page markdown content in BLOCK mode', async () => {
      const element = createRealConfluenceMarkdownMacro(REAL_PAGE_MARKDOWN_CONTENT, 'BLOCK');

      const startTime = performance.now();
      const result = await processor.process(element, mockContext);
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // 验证基本结构
      expect(result).toContain('# 数据防篡改签名方案');
      expect(result).toContain('## 概述');
      expect(result).toContain('## 签名算法对比');
      expect(result).toContain('## 实现方案');
      expect(result).toContain('## 安全注意事项');
      expect(result).toContain('## 总结');

      // 验证表格内容
      expect(result).toContain('| 算法 | 密钥长度 | 签名长度 | 安全级别 | 性能 | 适用场景 |');
      expect(result).toContain('| RSA-2048 | 2048 bits | 256 bytes | 高 | 中等 | 通用签名验证 |');
      expect(result).toContain('| ECDSA-P256 | 256 bits | 64 bytes | 高 | 快 | 移动设备、IoT |');
      expect(result).toContain('| Ed25519 | 256 bits | 64 bytes | 很高 | 很快 | 现代应用推荐 |');

      // 验证性能表格
      expect(result).toContain('| 操作 | RSA-2048 | RSA-3072 | ECDSA-P256 | ECDSA-P384 | Ed25519 | Ed448 |');
      expect(result).toContain('| 密钥生成 (ms) | 150 | 450 | 5 | 12 | 1 | 3 |');
      expect(result).toContain('| 签名 (ms) | 2.5 | 8.1 | 0.8 | 1.2 | 0.3 | 0.8 |');

      // 验证代码块
      expect(result).toContain('```javascript');
      expect(result).toContain('class DataSigner {');
      expect(result).toContain('generateKeyPair()');
      expect(result).toContain('sign(data)');
      expect(result).toContain('verify(data, signature)');

      // 验证 ECDSA 实现
      expect(result).toContain('class ECDSASigner {');
      expect(result).toContain('namedCurve: this.curve');

      // 验证批量处理代码
      expect(result).toContain('class BatchSigner {');
      expect(result).toContain('signBatch(dataList)');

      // 验证 Bash 脚本
      expect(result).toContain('```bash');
      expect(result).toContain('#!/bin/bash');
      expect(result).toContain('echo "开始签名性能测试..."');

      // 验证引用块
      expect(result).toContain('> **重要提示**');
      expect(result).toContain('> **性能优化**');
      expect(result).toContain('> **兼容性考虑**');

      // 验证性能
      expect(processingTime).toBeLessThan(100); // 应该在100ms内完成

      console.log(`Real page processing time: ${processingTime.toFixed(2)}ms`);
      console.log(`Content length: ${REAL_PAGE_MARKDOWN_CONTENT.length} -> ${result.length}`);
    });

    it('should process the real page markdown content in INLINE mode', async () => {
      const element = createRealConfluenceMarkdownMacro(REAL_PAGE_MARKDOWN_CONTENT, 'INLINE');

      const startTime = performance.now();
      const result = await processor.process(element, mockContext);
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // 验证内联模式特征
      expect(result).not.toContain('\n\n'); // 不应该有多个连续换行
      expect(result).toContain('**数据防篡改签名方案**'); // 标题转换为粗体

      // 验证表格内容在内联模式下仍然可读
      expect(result).toContain('RSA-2048');
      expect(result).toContain('ECDSA-P256');
      expect(result).toContain('Ed25519');

      // 验证代码块在内联模式下被保留
      expect(result).toContain('```javascript');
      expect(result).toContain('class DataSigner');
      expect(result).toContain('```bash');

      // 验证列表项简化
      expect(result).toContain('• 私钥必须安全存储');
      expect(result).toContain('• 使用安全的密钥分发协议');

      // 验证性能
      expect(processingTime).toBeLessThan(50); // 内联模式应该更快

      console.log(`Real page inline processing time: ${processingTime.toFixed(2)}ms`);
    });

    it('should maintain table structure and readability', async () => {
      const element = createRealConfluenceMarkdownMacro(REAL_PAGE_MARKDOWN_CONTENT, 'BLOCK');

      const result = await processor.process(element, mockContext);

      // 提取所有表格行
      const tableLines = result.split('\n').filter(line =>
        line.trim().startsWith('|') && line.trim().endsWith('|')
      );

      // 验证表格数量（应该有两个主要表格）
      expect(tableLines.length).toBeGreaterThan(10); // 至少10行表格数据

      // 验证第一个表格（算法对比）
      const algorithmTableLines = tableLines.filter(line =>
        line.includes('RSA-2048') || line.includes('ECDSA-P256') || line.includes('Ed25519')
      );
      expect(algorithmTableLines.length).toBeGreaterThanOrEqual(3); // 至少3行算法数据

      // 验证第二个表格（性能数据）
      const performanceTableLines = tableLines.filter(line =>
        line.includes('密钥生成') || line.includes('签名') || line.includes('验证') || line.includes('吞吐量')
      );
      expect(performanceTableLines.length).toBeGreaterThanOrEqual(4); // 至少4行性能数据

      // 验证表格格式正确性
      tableLines.forEach(line => {
        expect(line.trim()).toMatch(/^\|.*\|$/); // 每行都应该以 | 开始和结束
      });

      // 验证表格分隔符
      const separatorLines = result.split('\n').filter(line =>
        line.match(/^\|[\s\-\|]+\|$/)
      );
      expect(separatorLines.length).toBeGreaterThanOrEqual(2); // 至少2个表格分隔符
    });

    it('should handle complex code blocks correctly', async () => {
      const element = createRealConfluenceMarkdownMacro(REAL_PAGE_MARKDOWN_CONTENT, 'BLOCK');

      const result = await processor.process(element, mockContext);

      // 验证 JavaScript 代码块
      const jsCodeBlocks = result.match(/```javascript[\s\S]*?```/g);
      expect(jsCodeBlocks).toBeTruthy();
      expect(jsCodeBlocks!.length).toBeGreaterThanOrEqual(3); // 至少3个JS代码块

      // 验证 Bash 代码块
      const bashCodeBlocks = result.match(/```bash[\s\S]*?```/g);
      expect(bashCodeBlocks).toBeTruthy();
      expect(bashCodeBlocks!.length).toBeGreaterThanOrEqual(1); // 至少1个Bash代码块

      // 验证代码块内容完整性
      jsCodeBlocks!.forEach(block => {
        expect(block).toContain('class'); // 应该包含类定义
        expect(block).not.toContain('\n\n\n'); // 不应该有多余的空行
      });

      // 验证特定代码内容
      expect(result).toContain('crypto.generateKeyPair(\'rsa\'');
      expect(result).toContain('crypto.sign(this.algorithm');
      expect(result).toContain('crypto.verify(this.algorithm');
      expect(result).toContain('namedCurve: this.curve');
      expect(result).toContain('Promise.all(batchPromises)');
    });

    it('should preserve Chinese characters and special symbols', async () => {
      const element = createRealConfluenceMarkdownMacro(REAL_PAGE_MARKDOWN_CONTENT, 'BLOCK');

      const result = await processor.process(element, mockContext);

      // 验证中文内容
      expect(result).toContain('数据防篡改签名方案');
      expect(result).toContain('概述');
      expect(result).toContain('签名算法对比');
      expect(result).toContain('实现方案');
      expect(result).toContain('安全注意事项');
      expect(result).toContain('密钥管理');
      expect(result).toContain('私钥保护');
      expect(result).toContain('密钥分发');
      expect(result).toContain('实施建议');
      expect(result).toContain('测试验证');
      expect(result).toContain('总结');

      // 验证技术术语
      expect(result).toContain('硬件安全模块');
      expect(result).toContain('访问控制');
      expect(result).toContain('审计日志');
      expect(result).toContain('密钥撤销机制');
      expect(result).toContain('高并发场景');
      expect(result).toContain('兼容性要求');

      // 验证特殊符号和单位
      expect(result).toContain('bits');
      expect(result).toContain('bytes');
      expect(result).toContain('ms');
      expect(result).toContain('ops/sec');
      expect(result).toContain('GB RAM');
    });
  });

  describe('Performance Analysis', () => {
    it('should process large real content efficiently', async () => {
      const element = createRealConfluenceMarkdownMacro(REAL_PAGE_MARKDOWN_CONTENT, 'BLOCK');

      // 多次运行以获得平均性能数据
      const runs = 10;
      const times: number[] = [];

      for (let i = 0; i < runs; i++) {
        const startTime = performance.now();
        await processor.process(element, mockContext);
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      // 验证性能指标
      expect(avgTime).toBeLessThan(50); // 平均处理时间应该小于50ms
      expect(maxTime).toBeLessThan(100); // 最大处理时间应该小于100ms
      expect(minTime).toBeGreaterThan(0); // 最小时间应该大于0

      console.log(`Performance analysis (${runs} runs):`);
      console.log(`  Average: ${avgTime.toFixed(2)}ms`);
      console.log(`  Min: ${minTime.toFixed(2)}ms`);
      console.log(`  Max: ${maxTime.toFixed(2)}ms`);
      console.log(`  Content size: ${REAL_PAGE_MARKDOWN_CONTENT.length} characters`);
    });

    it('should handle memory efficiently with real content', async () => {
      const element = createRealConfluenceMarkdownMacro(REAL_PAGE_MARKDOWN_CONTENT, 'BLOCK');

      // 记录内存使用情况
      const memBefore = process.memoryUsage();

      // 处理多次以测试内存泄漏
      const iterations = 50;
      for (let i = 0; i < iterations; i++) {
        await processor.process(element, mockContext);
      }

      const memAfter = process.memoryUsage();
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;

      // 验证内存使用合理
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 内存增长不超过10MB

      console.log(`Memory usage after ${iterations} iterations:`);
      console.log(`  Heap increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Per iteration: ${(memoryIncrease / iterations / 1024).toFixed(2)}KB`);
    });
  });

  describe('Content Quality Verification', () => {
    it('should maintain content completeness and accuracy', async () => {
      const element = createRealConfluenceMarkdownMacro(REAL_PAGE_MARKDOWN_CONTENT, 'BLOCK');

      const result = await processor.process(element, mockContext);

      // 验证内容完整性（处理后的内容长度不应该显著减少）
      const originalLength = REAL_PAGE_MARKDOWN_CONTENT.length;
      const processedLength = result.length;
      const retentionRate = processedLength / originalLength;

      expect(retentionRate).toBeGreaterThan(0.95); // 至少保留95%的内容

      // 验证关键内容没有丢失
      const keyTerms = [
        'DataSigner', 'ECDSASigner', 'BatchSigner',
        'generateKeyPair', 'sign', 'verify',
        'RSA-2048', 'ECDSA-P256', 'Ed25519',
        'crypto.generateKeyPair', 'crypto.sign', 'crypto.verify',
        'modulusLength: 2048', 'namedCurve: this.curve',
        'Promise.all(batchPromises)'
      ];

      keyTerms.forEach(term => {
        expect(result).toContain(term);
      });

      // 验证表格数据完整性
      const tableData = [
        '2048 bits', '256 bytes', '64 bytes',
        '150', '450', '2.5', '8.1', '0.8', '1.2', '0.3',
        '400', '120', '1250', '556', '3333'
      ];

      tableData.forEach(data => {
        expect(result).toContain(data);
      });

      console.log(`Content retention rate: ${(retentionRate * 100).toFixed(1)}%`);
    });

    it('should produce valid markdown output', async () => {
      const element = createRealConfluenceMarkdownMacro(REAL_PAGE_MARKDOWN_CONTENT, 'BLOCK');

      const result = await processor.process(element, mockContext);

      // 验证 Markdown 语法正确性

      // 1. 标题格式
      const headers = result.match(/^#{1,6}\s+.+$/gm);
      expect(headers).toBeTruthy();
      expect(headers!.length).toBeGreaterThan(10); // 应该有多个标题

      // 2. 代码块格式
      const codeBlocks = result.match(/```\w*\n[\s\S]*?\n```/g);
      expect(codeBlocks).toBeTruthy();
      expect(codeBlocks!.length).toBeGreaterThan(3); // 应该有多个代码块

      // 3. 表格格式
      const tableRows = result.match(/^\|.*\|$/gm);
      expect(tableRows).toBeTruthy();
      expect(tableRows!.length).toBeGreaterThan(10); // 应该有多行表格

      // 4. 列表格式
      const listItems = result.match(/^[\s]*[-*+]\s+.+$/gm);
      expect(listItems).toBeTruthy();
      expect(listItems!.length).toBeGreaterThan(5); // 应该有多个列表项

      // 5. 引用块格式
      const quotes = result.match(/^>\s+.+$/gm);
      expect(quotes).toBeTruthy();
      expect(quotes!.length).toBeGreaterThan(2); // 应该有多个引用块

      // 验证没有格式错误
      expect(result).not.toContain('```\n\n\n'); // 代码块不应该有多余空行
      expect(result).not.toContain('|\n\n|'); // 表格不应该有断行
    });
  });
});