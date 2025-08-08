/**
 * HTML 解析器适配器接口和实现
 * 支持 Node.js 和浏览器环境的 HTML 解析
 */

/**
 * HTML 解析器适配器接口
 * 提供统一的 HTML 解析和 DOM 操作接口
 */
export interface HTMLParserAdapter {
  /**
   * 解析 HTML 字符串为 DOM 文档
   * @param html HTML 字符串
   * @returns DOM 文档对象
   */
  parseHTML(html: string): Document;

  /**
   * 将 DOM 文档序列化为 HTML 字符串
   * @param dom DOM 文档对象
   * @returns HTML 字符串
   */
  serializeDOM(dom: Document): string;

  /**
   * 创建元素节点
   * @param tagName 标签名
   * @returns 元素节点
   */
  createElement(tagName: string): Element;

  /**
   * 创建文本节点
   * @param text 文本内容
   * @returns 文本节点
   */
  createTextNode(text: string): Text;

  /**
   * 获取适配器类型
   * @returns 适配器类型标识
   */
  getAdapterType(): 'node' | 'browser';
}

/**
 * Node.js 环境的 HTML 解析器适配器
 * 使用 jsdom 库进行 HTML 解析
 */
export class NodeHTMLParserAdapter implements HTMLParserAdapter {
  private jsdom: any;
  private JSDOM: any;

  constructor() {
    try {
      // 动态导入 jsdom，避免在浏览器环境中出错
      this.jsdom = require('jsdom');
      this.JSDOM = this.jsdom.JSDOM;
    } catch (error) {
      throw new Error('jsdom 库未安装或导入失败。请运行: npm install jsdom');
    }
  }

  parseHTML(html: string): Document {
    try {
      // 创建 JSDOM 实例
      const dom = new this.JSDOM(html, {
        contentType: 'text/html',
        includeNodeLocations: false,
        storageQuota: 10000000
      });
      
      return dom.window.document;
    } catch (error) {
      throw new Error(`HTML 解析失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  serializeDOM(dom: Document): string {
    try {
      // 使用 JSDOM 的序列化功能
      return dom.documentElement.outerHTML;
    } catch (error) {
      throw new Error(`DOM 序列化失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  createElement(tagName: string): Element {
    try {
      // 创建一个临时文档来创建元素
      const tempDom = new this.JSDOM('<!DOCTYPE html><html><body></body></html>');
      return tempDom.window.document.createElement(tagName);
    } catch (error) {
      throw new Error(`创建元素失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  createTextNode(text: string): Text {
    try {
      // 创建一个临时文档来创建文本节点
      const tempDom = new this.JSDOM('<!DOCTYPE html><html><body></body></html>');
      return tempDom.window.document.createTextNode(text);
    } catch (error) {
      throw new Error(`创建文本节点失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getAdapterType(): 'node' | 'browser' {
    return 'node';
  }
}

/**
 * 浏览器环境的 HTML 解析器适配器
 * 使用原生 DOM API 进行 HTML 解析
 */
export class BrowserHTMLParserAdapter implements HTMLParserAdapter {
  private parser: DOMParser;
  private serializer: XMLSerializer;

  constructor() {
    // 检查浏览器环境
    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
      throw new Error('浏览器环境不可用，无法使用原生 DOM API');
    }

    this.parser = new DOMParser();
    this.serializer = new XMLSerializer();
  }

  parseHTML(html: string): Document {
    try {
      // 使用 DOMParser 解析 HTML
      const doc = this.parser.parseFromString(html, 'text/html');
      
      // 检查解析错误
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        throw new Error(`HTML 解析错误: ${parserError.textContent}`);
      }
      
      return doc;
    } catch (error) {
      throw new Error(`HTML 解析失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  serializeDOM(dom: Document): string {
    try {
      // 使用 XMLSerializer 序列化 DOM
      return this.serializer.serializeToString(dom);
    } catch (error) {
      throw new Error(`DOM 序列化失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  createElement(tagName: string): Element {
    try {
      return document.createElement(tagName);
    } catch (error) {
      throw new Error(`创建元素失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  createTextNode(text: string): Text {
    try {
      return document.createTextNode(text);
    } catch (error) {
      throw new Error(`创建文本节点失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getAdapterType(): 'node' | 'browser' {
    return 'browser';
  }
}

/**
 * 环境检测和适配器工厂
 */
export class HTMLParserAdapterFactory {
  /**
   * 检测当前运行环境
   * @returns 环境类型
   */
  static detectEnvironment(): 'node' | 'browser' {
    // 检查是否在 Node.js 环境中
    if (typeof process !== 'undefined' && 
        process.versions && 
        process.versions.node) {
      return 'node';
    }
    
    // 检查是否在浏览器环境中
    if (typeof window !== 'undefined' && 
        typeof document !== 'undefined') {
      return 'browser';
    }
    
    // 默认假设为 Node.js 环境
    return 'node';
  }

  /**
   * 创建适合当前环境的 HTML 解析器适配器
   * @param forceType 强制指定适配器类型（可选）
   * @returns HTML 解析器适配器实例
   */
  static createAdapter(forceType?: 'node' | 'browser'): HTMLParserAdapter {
    const envType = forceType || this.detectEnvironment();
    
    try {
      switch (envType) {
        case 'node':
          return new NodeHTMLParserAdapter();
        case 'browser':
          return new BrowserHTMLParserAdapter();
        default:
          throw new Error(`不支持的环境类型: ${envType}`);
      }
    } catch (error) {
      // 如果创建失败，尝试回退到另一种适配器
      if (!forceType) {
        const fallbackType = envType === 'node' ? 'browser' : 'node';
        try {
          return this.createAdapter(fallbackType);
        } catch (fallbackError) {
          throw new Error(
            `无法创建 HTML 解析器适配器。主要错误: ${error instanceof Error ? error.message : String(error)}。` +
            `回退错误: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
          );
        }
      }
      throw error;
    }
  }

  /**
   * 获取默认的 HTML 解析器适配器实例
   * 单例模式，避免重复创建
   */
  private static defaultAdapter: HTMLParserAdapter | null = null;

  static getDefaultAdapter(): HTMLParserAdapter {
    if (!this.defaultAdapter) {
      this.defaultAdapter = this.createAdapter();
    }
    return this.defaultAdapter;
  }

  /**
   * 重置默认适配器（主要用于测试）
   */
  static resetDefaultAdapter(): void {
    this.defaultAdapter = null;
  }
}

/**
 * 便捷的全局函数，获取默认的 HTML 解析器适配器
 */
export function getHTMLParserAdapter(): HTMLParserAdapter {
  return HTMLParserAdapterFactory.getDefaultAdapter();
}