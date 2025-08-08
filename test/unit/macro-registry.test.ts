import { MacroRegistry } from '../../src/services/macro-processors/macro-registry.js';
import { BaseMacroProcessor } from '../../src/services/macro-processors/base-macro-processor.js';
import { MacroProcessingContext, MacroFallbackStrategy } from '../../src/types/macro.types.js';

// 创建测试用的宏处理器
class TestMacroProcessor extends BaseMacroProcessor {
  public readonly macroType = 'test';
  public readonly priority = 10;

  public canProcess(macroElement: Element): boolean {
    return macroElement.tagName === 'test-macro';
  }

  public async process(macroElement: Element, context: MacroProcessingContext): Promise<string> {
    return 'processed test macro';
  }
}

class AnotherTestProcessor extends BaseMacroProcessor {
  public readonly macroType = 'another';
  public readonly priority = 5;

  public canProcess(macroElement: Element): boolean {
    return macroElement.tagName === 'another-macro';
  }

  public async process(macroElement: Element, context: MacroProcessingContext): Promise<string> {
    return 'processed another macro';
  }
}

describe('MacroRegistry', () => {
  beforeEach(() => {
    // 清空注册表
    MacroRegistry.clear();
  });

  afterEach(() => {
    // 清空注册表
    MacroRegistry.clear();
  });

  describe('基本注册和查找功能', () => {
    it('应该能够注册和获取宏处理器', () => {
      const processor = new TestMacroProcessor();

      MacroRegistry.register('test', processor);

      const retrieved = MacroRegistry.getProcessor('test');
      expect(retrieved).toBe(processor);
    });

    it('应该能够获取所有已注册的宏类型', () => {
      const processor1 = new TestMacroProcessor();
      const processor2 = new AnotherTestProcessor();

      MacroRegistry.register('test', processor1);
      MacroRegistry.register('another', processor2);

      const types = MacroRegistry.getRegisteredMacroTypes();
      expect(types).toContain('test');
      expect(types).toContain('another');
      expect(types).toHaveLength(2);
    });

    it('应该能够检查宏是否支持', () => {
      const processor = new TestMacroProcessor();
      MacroRegistry.register('test', processor);

      expect(MacroRegistry.isSupported('test')).toBe(true);
      expect(MacroRegistry.isSupported('nonexistent')).toBe(false);
    });

    it('应该能够注销宏处理器', () => {
      const processor = new TestMacroProcessor();
      MacroRegistry.register('test', processor);

      expect(MacroRegistry.isSupported('test')).toBe(true);

      const unregistered = MacroRegistry.unregister('test');
      expect(unregistered).toBe(true);
      expect(MacroRegistry.isSupported('test')).toBe(false);
    });
  });

  describe('配置管理', () => {
    it('应该能够设置配置并应用黑名单', () => {
      const registry = MacroRegistry.getInstance();
      const processor = new TestMacroProcessor();

      // 先注册处理器
      MacroRegistry.register('test', processor);
      expect(MacroRegistry.isSupported('test')).toBe(true);

      // 设置包含黑名单的配置
      registry.setConfig({
        blacklistedMacros: ['test'],
        fallbackStrategy: MacroFallbackStrategy.PRESERVE_HTML
      });

      // 黑名单中的宏应该不被支持
      expect(MacroRegistry.isSupported('test')).toBe(false);
      expect(MacroRegistry.getProcessor('test')).toBeNull();
    });

    it('应该能够根据启用列表过滤处理器', () => {
      const registry = MacroRegistry.getInstance();

      // 设置只启用特定处理器的配置
      registry.setConfig({
        enabledProcessors: ['test'],
        fallbackStrategy: MacroFallbackStrategy.PRESERVE_HTML
      });

      const processor1 = new TestMacroProcessor();
      const processor2 = new AnotherTestProcessor();

      // 尝试注册两个处理器
      MacroRegistry.register('test', processor1);
      MacroRegistry.register('another', processor2);

      // 只有在启用列表中的处理器应该被注册
      expect(MacroRegistry.isSupported('test')).toBe(true);
      expect(MacroRegistry.isSupported('another')).toBe(false);
    });

    it('应该能够根据禁用列表过滤处理器', () => {
      const registry = MacroRegistry.getInstance();

      // 设置禁用特定处理器的配置
      registry.setConfig({
        disabledProcessors: ['test'],
        fallbackStrategy: MacroFallbackStrategy.PRESERVE_HTML
      });

      const processor1 = new TestMacroProcessor();
      const processor2 = new AnotherTestProcessor();

      // 尝试注册两个处理器
      MacroRegistry.register('test', processor1);
      MacroRegistry.register('another', processor2);

      // 禁用列表中的处理器不应该被注册
      expect(MacroRegistry.isSupported('test')).toBe(false);
      expect(MacroRegistry.isSupported('another')).toBe(true);
    });
  });

  describe('优先级管理', () => {
    it('应该能够按优先级排序处理器', () => {
      const registry = MacroRegistry.getInstance();

      // 清除任何现有配置
      registry.setConfig({
        fallbackStrategy: MacroFallbackStrategy.PRESERVE_HTML
      });

      const processor1 = new TestMacroProcessor(); // priority: 10
      const processor2 = new AnotherTestProcessor(); // priority: 5

      MacroRegistry.register('test', processor1, 10);
      MacroRegistry.register('another', processor2, 5);

      const sortedProcessors = registry.getProcessorsByPriority();

      // 优先级高的（数字大的）应该排在前面
      expect(sortedProcessors).toHaveLength(2);
      expect(sortedProcessors[0].type).toBe('test');
      expect(sortedProcessors[0].priority).toBe(10);
      expect(sortedProcessors[1].type).toBe('another');
      expect(sortedProcessors[1].priority).toBe(5);
    });
  });

  describe('统计信息', () => {
    it('应该能够获取注册统计信息', () => {
      const registry = MacroRegistry.getInstance();

      // 清除任何现有配置
      registry.setConfig({
        fallbackStrategy: MacroFallbackStrategy.PRESERVE_HTML
      });

      const processor1 = new TestMacroProcessor();
      const processor2 = new AnotherTestProcessor();

      MacroRegistry.register('test', processor1);
      MacroRegistry.register('another', processor2);

      const stats = registry.getRegistrationStats();

      expect(stats.totalRegistered).toBe(2);
      expect(stats.blacklisted).toBe(0);
      expect(stats.available).toBe(2);
      expect(stats.processorTypes).toContain('test');
      expect(stats.processorTypes).toContain('another');
    });

    it('应该能够正确统计黑名单影响', () => {
      const registry = MacroRegistry.getInstance();

      // 先注册处理器
      const processor1 = new TestMacroProcessor();
      const processor2 = new AnotherTestProcessor();

      MacroRegistry.register('test', processor1);
      MacroRegistry.register('another', processor2);

      // 然后设置黑名单配置（这会移除黑名单中的处理器）
      registry.setConfig({
        blacklistedMacros: ['test'],
        fallbackStrategy: MacroFallbackStrategy.PRESERVE_HTML
      });

      const stats = registry.getRegistrationStats();

      expect(stats.totalRegistered).toBe(1); // 只有another还在注册表中
      expect(stats.blacklisted).toBe(1); // test在黑名单中
      expect(stats.available).toBe(1); // 只有another可用
      expect(stats.processorTypes).not.toContain('test');
      expect(stats.processorTypes).toContain('another');
    });
  });

  describe('处理器验证', () => {
    it('应该能够验证有效的处理器', () => {
      const registry = MacroRegistry.getInstance();
      const processor = new TestMacroProcessor();

      const isValid = registry.validateProcessor(processor);
      expect(isValid).toBe(true);
    });

    it('应该能够检测无效的处理器', () => {
      const registry = MacroRegistry.getInstance();
      const invalidProcessor = {} as BaseMacroProcessor;

      const isValid = registry.validateProcessor(invalidProcessor);
      expect(isValid).toBe(false);
    });
  });
});