import { MacroConfigService, macroConfigService } from '../../src/services/macro-config.service.js';
import { MacroFallbackStrategy } from '../../src/types/macro.types.js';
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

describe('MacroConfigService', () => {
  const testConfigDir = join(process.cwd(), 'test-config');
  const testConfigPath = join(testConfigDir, 'macro-config.json');

  beforeEach(() => {
    // 创建测试配置目录
    if (!existsSync(testConfigDir)) {
      mkdirSync(testConfigDir, { recursive: true });
    }
  });

  afterEach(() => {
    // 清理测试配置文件
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe('默认配置', () => {
    it('应该能够创建默认配置', () => {
      const config = macroConfigService.getConfig();
      
      expect(config.fallbackStrategy).toBe(MacroFallbackStrategy.PRESERVE_HTML);
      expect(config.maxRecursionDepth).toBe(5);
      expect(config.timeout).toBe(30000);
      expect(config.enableConcurrency).toBe(true);
      expect(config.preserveUnknownMacros).toBe(true);
      expect(config.debugMode).toBe(false);
      expect(config.logLevel).toBe('info');
    });

    it('应该包含默认的处理器设置', () => {
      const config = macroConfigService.getConfig();
      
      expect(config.processorSettings).toBeDefined();
      expect(config.processorSettings?.markdown).toBeDefined();
      expect(config.processorSettings?.code).toBeDefined();
      expect(config.processorSettings?.info).toBeDefined();
      expect(config.processorSettings?.table).toBeDefined();
      expect(config.processorSettings?.chart).toBeDefined();
      expect(config.processorSettings?.include).toBeDefined();
    });
  });

  describe('配置文件加载', () => {
    it('应该能够加载有效的配置文件', () => {
      const testConfig = {
        enabledProcessors: ['markdown', 'code'],
        disabledProcessors: ['chart'],
        blacklistedMacros: ['deprecated'],
        fallbackStrategy: 'add_comment',
        maxRecursionDepth: 3,
        timeout: 15000,
        enableConcurrency: false,
        preserveUnknownMacros: false,
        debugMode: true,
        logLevel: 'debug'
      };

      writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const config = macroConfigService.loadConfig(testConfigPath);

      expect(config.enabledProcessors).toEqual(['markdown', 'code']);
      expect(config.disabledProcessors).toEqual(['chart']);
      expect(config.blacklistedMacros).toEqual(['deprecated']);
      expect(config.fallbackStrategy).toBe(MacroFallbackStrategy.ADD_COMMENT);
      expect(config.maxRecursionDepth).toBe(3);
      expect(config.timeout).toBe(15000);
      expect(config.enableConcurrency).toBe(false);
      expect(config.preserveUnknownMacros).toBe(false);
      expect(config.debugMode).toBe(true);
      expect(config.logLevel).toBe('debug');
    });

    it('应该能够处理部分配置文件', () => {
      const partialConfig = {
        maxRecursionDepth: 10,
        debugMode: true
      };

      writeFileSync(testConfigPath, JSON.stringify(partialConfig, null, 2));

      const config = macroConfigService.loadConfig(testConfigPath);

      // 应该合并默认配置
      expect(config.maxRecursionDepth).toBe(10);
      expect(config.debugMode).toBe(true);
      expect(config.fallbackStrategy).toBe(MacroFallbackStrategy.PRESERVE_HTML); // 默认值
      expect(config.timeout).toBe(30000); // 默认值
    });

    it('应该能够处理无效的配置文件', () => {
      const invalidConfig = {
        maxRecursionDepth: -1, // 无效值
        timeout: 500, // 太小
        logLevel: 'invalid' // 无效级别
      };

      writeFileSync(testConfigPath, JSON.stringify(invalidConfig, null, 2));

      // 应该回退到默认配置
      const config = macroConfigService.loadConfig(testConfigPath);
      expect(config.fallbackStrategy).toBe(MacroFallbackStrategy.PRESERVE_HTML);
    });

    it('应该能够处理不存在的配置文件', () => {
      const config = macroConfigService.loadConfig('/nonexistent/path/config.json');
      
      // 应该使用默认配置
      expect(config.fallbackStrategy).toBe(MacroFallbackStrategy.PRESERVE_HTML);
      expect(config.maxRecursionDepth).toBe(5);
    });
  });

  describe('配置验证', () => {
    it('应该验证冲突的启用/禁用列表', () => {
      const conflictConfig = {
        enabledProcessors: ['markdown', 'code'],
        disabledProcessors: ['code', 'chart'] // code同时在两个列表中
      };

      writeFileSync(testConfigPath, JSON.stringify(conflictConfig, null, 2));

      const config = macroConfigService.loadConfig(testConfigPath);

      // 禁用列表应该优先，code应该从启用列表中移除
      expect(config.enabledProcessors).toEqual(['markdown']);
      expect(config.disabledProcessors).toEqual(['code', 'chart']);
    });

    it('应该验证递归深度的有效性', () => {
      const invalidDepthConfig = {
        maxRecursionDepth: 0 // 无效值
      };

      writeFileSync(testConfigPath, JSON.stringify(invalidDepthConfig, null, 2));

      const config = macroConfigService.loadConfig(testConfigPath);

      // 应该使用默认值
      expect(config.maxRecursionDepth).toBe(5);
    });

    it('应该验证超时时间的有效性', () => {
      const invalidTimeoutConfig = {
        timeout: 500 // 太小
      };

      writeFileSync(testConfigPath, JSON.stringify(invalidTimeoutConfig, null, 2));

      const config = macroConfigService.loadConfig(testConfigPath);

      // 配置验证失败，应该回退到默认配置
      expect(config.timeout).toBe(30000);
    });
  });

  describe('处理器启用检查', () => {
    it('应该正确检查黑名单中的处理器', () => {
      macroConfigService.updateConfig({
        blacklistedMacros: ['deprecated']
      });

      expect(macroConfigService.isProcessorEnabled('deprecated')).toBe(false);
      expect(macroConfigService.isProcessorEnabled('markdown')).toBe(true);
    });

    it('应该正确检查禁用列表中的处理器', () => {
      macroConfigService.updateConfig({
        disabledProcessors: ['chart']
      });

      expect(macroConfigService.isProcessorEnabled('chart')).toBe(false);
      expect(macroConfigService.isProcessorEnabled('markdown')).toBe(true);
    });

    it('应该正确检查启用列表', () => {
      macroConfigService.updateConfig({
        enabledProcessors: ['markdown', 'code']
      });

      expect(macroConfigService.isProcessorEnabled('markdown')).toBe(true);
      expect(macroConfigService.isProcessorEnabled('code')).toBe(true);
      expect(macroConfigService.isProcessorEnabled('chart')).toBe(false);
    });

    it('应该在没有启用列表时默认启用所有处理器', () => {
      // 清理之前测试的配置状态
      macroConfigService.updateConfig({
        enabledProcessors: undefined,
        disabledProcessors: [],
        blacklistedMacros: []
      });

      expect(macroConfigService.isProcessorEnabled('markdown')).toBe(true);
      expect(macroConfigService.isProcessorEnabled('code')).toBe(true);
      expect(macroConfigService.isProcessorEnabled('chart')).toBe(true);
    });
  });

  describe('处理器设置', () => {
    it('应该能够获取特定处理器的设置', () => {
      const markdownSettings = macroConfigService.getProcessorSettings('markdown');
      
      expect(markdownSettings).toBeDefined();
      expect(markdownSettings.preserveFormatting).toBe(true);
      expect(markdownSettings.convertInlineToBlock).toBe(false);
    });

    it('应该为不存在的处理器返回空对象', () => {
      const nonexistentSettings = macroConfigService.getProcessorSettings('nonexistent');
      
      expect(nonexistentSettings).toEqual({});
    });
  });

  describe('配置摘要', () => {
    it('应该能够获取配置摘要', () => {
      const summary = macroConfigService.getConfigSummary();
      
      expect(summary).toHaveProperty('configPath');
      expect(summary).toHaveProperty('totalProcessorSettings');
      expect(summary).toHaveProperty('enabledProcessorsCount');
      expect(summary).toHaveProperty('disabledProcessorsCount');
      expect(summary).toHaveProperty('blacklistedMacrosCount');
      expect(summary).toHaveProperty('customProcessorsCount');
      expect(summary).toHaveProperty('fallbackStrategy');
      expect(summary).toHaveProperty('debugMode');
      
      expect(typeof summary.totalProcessorSettings).toBe('number');
      expect(summary.fallbackStrategy).toBe(MacroFallbackStrategy.PRESERVE_HTML);
      expect(summary.debugMode).toBe(false);
    });
  });

  describe('配置更新', () => {
    it('应该能够更新配置', () => {
      const originalConfig = macroConfigService.getConfig();
      expect(originalConfig.debugMode).toBe(false);

      macroConfigService.updateConfig({
        debugMode: true,
        logLevel: 'debug'
      });

      const updatedConfig = macroConfigService.getConfig();
      expect(updatedConfig.debugMode).toBe(true);
      expect(updatedConfig.logLevel).toBe('debug');
    });

    it('应该能够重新加载配置', () => {
      const testConfig = {
        debugMode: true,
        logLevel: 'debug'
      };

      writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const reloadedConfig = macroConfigService.reloadConfig();
      expect(reloadedConfig.debugMode).toBe(true);
      expect(reloadedConfig.logLevel).toBe('debug');
    });
  });
});