/**
 * 基础宏处理器测试
 * 
 * 测试BaseMacroProcessor抽象类的通用功能
 */

import { BaseMacroProcessor } from '../../../src/utils/macro-processors/base-macro-processor.js';
import { MacroFallbackStrategy, MacroErrorType } from '../../../src/types/macro.types.js';
import type { MacroProcessingContext } from '../../../src/types/macro.types.js';

// 创建一个测试用的具体宏处理器
class TestMacroProcessor extends BaseMacroProcessor {
  public readonly macroType = 'test';
  
  canProcess(macroElement: Element): boolean {
    return macroElement.tagName === 'test-macro';
  }
  
  async process(macroElement: Element, context: MacroProcessingContext): Promise<string> {
    return 'processed content';
  }
}

// Mock DOM环境
const mockElement = {
  tagName: 'test-macro',
  className: 'macro-test-param',
  textContent: 'test content',
  outerHTML: '<test-macro>test content</test-macro>',
  attributes: [
    { name: 'data-language', value: 'javascript' },
    { name: 'data-linenumbers', value: 'true' }
  ],
  getAttribute: jest.fn((name: string) => {
    const attrs: Record<string, string> = {
      'ac:name': 'test',
      'ac:schema-version': '1'
    };
    return attrs[name] || null;
  }),
  querySelectorAll: jest.fn((selector: string) => {
    if (selector === 'ac\\:parameter') {
      return [
        {
          getAttribute: (name: string) => name === 'ac:name' ? 'title' : null,
          textContent: 'Test Title'
        },
        {
          getAttribute: (name: string) => name === 'ac:name' ? 'collapse' : null,
          textContent: 'false'
        }
      ];
    }
    return [];
  }),
  querySelector: jest.fn((selector: string) => {
    if (selector === 'ac\\:plain-text-body') {
      return {
        textContent: 'CDATA content here'
      };
    }
    return null;
  })
} as unknown as Element;

describe('BaseMacroProcessor', () => {
  let processor: TestMacroProcessor;
  
  beforeEach(() => {
    processor = new TestMacroProcessor();
  });
  
  describe('extractMacroParameters', () => {
    it('should extract parameters from ac:parameter elements', () => {
      const parameters = (processor as any).extractMacroParameters(mockElement);
      
      expect(parameters).toEqual(expect.objectContaining({
        title: 'Test Title',
        collapse: false,
        macroName: 'test',
        schemaVersion: '1',
        language: 'javascript',
        linenumbers: true,
        'test-param': true
      }));
    });
    
    it('should handle empty parameters gracefully', () => {
      const emptyElement = {
        className: '',
        attributes: [],
        getAttribute: jest.fn(() => null),
        querySelectorAll: jest.fn(() => []),
        querySelector: jest.fn(() => null)
      } as unknown as Element;
      
      const parameters = (processor as any).extractMacroParameters(emptyElement);
      expect(parameters).toEqual({});
    });
  });
  
  describe('parseParameterValue', () => {
    it('should parse boolean values correctly', () => {
      expect((processor as any).parseParameterValue('true')).toBe(true);
      expect((processor as any).parseParameterValue('false')).toBe(false);
      expect((processor as any).parseParameterValue('TRUE')).toBe(true);
      expect((processor as any).parseParameterValue('FALSE')).toBe(false);
    });
    
    it('should parse numeric values correctly', () => {
      expect((processor as any).parseParameterValue('123')).toBe(123);
      expect((processor as any).parseParameterValue('45.67')).toBe(45.67);
      expect((processor as any).parseParameterValue('0')).toBe(0);
    });
    
    it('should return string values unchanged', () => {
      expect((processor as any).parseParameterValue('hello')).toBe('hello');
      expect((processor as any).parseParameterValue('test-value')).toBe('test-value');
    });
  });
  
  describe('extractCDATAContent', () => {
    it('should extract content from ac:plain-text-body', () => {
      const content = (processor as any).extractCDATAContent(mockElement);
      expect(content).toBe('CDATA content here');
    });
    
    it('should return empty string if no CDATA content found', () => {
      const emptyElement = {
        querySelector: jest.fn(() => null),
        textContent: ''
      } as unknown as Element;
      
      const content = (processor as any).extractCDATAContent(emptyElement);
      expect(content).toBe('');
    });
  });
  
  describe('generateFallbackContent', () => {
    const testError = new Error('Test error');
    
    it('should preserve HTML when strategy is PRESERVE_HTML', () => {
      const fallback = (processor as any).generateFallbackContent(
        mockElement,
        testError,
        MacroFallbackStrategy.PRESERVE_HTML
      );
      
      expect(fallback).toBe('<test-macro>test content</test-macro>');
    });
    
    it('should convert to text when strategy is CONVERT_TO_TEXT', () => {
      const fallback = (processor as any).generateFallbackContent(
        mockElement,
        testError,
        MacroFallbackStrategy.CONVERT_TO_TEXT
      );
      
      expect(fallback).toBe('test content');
    });
    
    it('should add comment when strategy is ADD_COMMENT', () => {
      const fallback = (processor as any).generateFallbackContent(
        mockElement,
        testError,
        MacroFallbackStrategy.ADD_COMMENT
      );
      
      expect(fallback).toContain('<!-- 宏处理失败: test -->');
      expect(fallback).toContain('<!-- 错误信息: Test error -->');
    });
    
    it('should return empty string when strategy is SKIP', () => {
      const fallback = (processor as any).generateFallbackContent(
        mockElement,
        testError,
        MacroFallbackStrategy.SKIP
      );
      
      expect(fallback).toBe('');
    });
  });
  
  describe('generateParameterComment', () => {
    it('should generate parameter comment correctly', () => {
      const parameters = {
        title: 'Test Title',
        language: 'javascript',
        linenumbers: true,
        collapse: false
      };
      
      const comment = (processor as any).generateParameterComment(parameters);
      
      expect(comment).toContain('<!-- 宏参数:');
      expect(comment).toContain('title: "Test Title"');
      expect(comment).toContain('language: "javascript"');
      expect(comment).toContain('linenumbers: true');
      expect(comment).toContain('collapse: false');
      expect(comment).toContain('-->');
    });
    
    it('should return empty string for empty parameters', () => {
      const comment = (processor as any).generateParameterComment({});
      expect(comment).toBe('');
    });
  });
  
  describe('createMacroError', () => {
    it('should create macro error with correct properties', () => {
      const error = (processor as any).createMacroError(
        MacroErrorType.PROCESSING_FAILED,
        'Test error message',
        mockElement,
        { detail: 'test detail' }
      );
      
      expect(error).toEqual(expect.objectContaining({
        type: MacroErrorType.PROCESSING_FAILED,
        macroType: 'test',
        message: 'Test error message',
        details: { detail: 'test detail' },
        recoverable: true
      }));
      expect(error.timestamp).toBeGreaterThan(0);
    });
  });
  
  describe('isRecoverableError', () => {
    it('should identify recoverable errors correctly', () => {
      expect((processor as any).isRecoverableError(MacroErrorType.TIMEOUT)).toBe(true);
      expect((processor as any).isRecoverableError(MacroErrorType.EXTERNAL_DEPENDENCY)).toBe(true);
      expect((processor as any).isRecoverableError(MacroErrorType.DOM_PARSING_ERROR)).toBe(true);
    });
    
    it('should identify non-recoverable errors correctly', () => {
      expect((processor as any).isRecoverableError(MacroErrorType.UNSUPPORTED_MACRO)).toBe(false);
      expect((processor as any).isRecoverableError(MacroErrorType.MISSING_PARAMETERS)).toBe(false);
      expect((processor as any).isRecoverableError(MacroErrorType.RECURSIVE_INCLUDE)).toBe(false);
    });
  });
  
  describe('validateRequiredParameters', () => {
    it('should pass validation when all required parameters are present', () => {
      const parameters = {
        title: 'Test Title',
        language: 'javascript'
      };
      
      expect(() => {
        (processor as any).validateRequiredParameters(parameters, ['title', 'language']);
      }).not.toThrow();
    });
    
    it('should throw error when required parameters are missing', () => {
      const parameters = {
        title: 'Test Title'
      };
      
      expect(() => {
        (processor as any).validateRequiredParameters(parameters, ['title', 'language']);
      }).toThrow('Missing required parameters: language');
    });
  });
  
  describe('cleanContent', () => {
    it('should clean content correctly', () => {
      const dirtyContent = '\r\n\tHello\t\tWorld\r\n\t';
      const cleanedContent = (processor as any).cleanContent(dirtyContent);
      
      expect(cleanedContent).toBe('Hello    World');
    });
    
    it('should handle empty content', () => {
      expect((processor as any).cleanContent('')).toBe('');
      expect((processor as any).cleanContent(null)).toBe('');
      expect((processor as any).cleanContent(undefined)).toBe('');
    });
  });
  
  describe('isInlineMode', () => {
    it('should detect inline mode correctly', () => {
      const inlineParams = { 'atlassian-macro-output-type': 'INLINE' };
      const blockParams = { 'atlassian-macro-output-type': 'BLOCK' };
      const noParams = {};
      
      expect((processor as any).isInlineMode(inlineParams)).toBe(true);
      expect((processor as any).isInlineMode(blockParams)).toBe(false);
      expect((processor as any).isInlineMode(noParams)).toBe(false);
    });
  });
  
  describe('processInlineContent', () => {
    it('should process inline content correctly', () => {
      const blockContent = 'Line 1\nLine 2\n\nLine 3';
      const inlineContent = (processor as any).processInlineContent(blockContent);
      
      expect(inlineContent).toBe('Line 1 Line 2 Line 3');
    });
  });
  
  describe('getProcessorInfo', () => {
    it('should return correct processor info', () => {
      const info = processor.getProcessorInfo();
      
      expect(info).toEqual({
        macroType: 'test',
        priority: 100,
        enabled: true,
        className: 'TestMacroProcessor'
      });
    });
  });
});