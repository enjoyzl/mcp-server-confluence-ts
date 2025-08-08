import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { z } from 'zod';
import { MacroProcessorConfig, MacroFallbackStrategy } from '../types/macro.types.js';
import { Logger } from '../utils/logger.js';

// Zod 验证模式
const MacroProcessorConfigSchema = z.object({
  enabledProcessors: z.array(z.string()).optional(),
  disabledProcessors: z.array(z.string()).optional(),
  blacklistedMacros: z.array(z.string()).optional(),
  fallbackStrategy: z.nativeEnum(MacroFallbackStrategy).optional(),
  maxRecursionDepth: z.number().min(1).max(20).optional(),
  timeout: z.number().min(1000).max(300000).optional(),
  enableConcurrency: z.boolean().optional(),
  preserveUnknownMacros: z.boolean().optional(),
  customProcessors: z.record(z.object({
    path: z.string(),
    priority: z.number().optional(),
    enabled: z.boolean().optional()
  })).optional(),
  processorSettings: z.record(z.record(z.any())).optional(),
  debugMode: z.boolean().optional(),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).optional()
});

/**
 * 宏配置服务
 * 负责加载、验证和管理宏处理器的配置
 */
export class MacroConfigService {
  private static instance: MacroConfigService;
  private config: MacroProcessorConfig;
  private configPath: string | null = null;
  private defaultConfig: MacroProcessorConfig;

  private constructor() {
    this.defaultConfig = this.createDefaultConfig();
    this.config = { ...this.defaultConfig };
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): MacroConfigService {
    if (!MacroConfigService.instance) {
      MacroConfigService.instance = new MacroConfigService();
    }
    return MacroConfigService.instance;
  }

  /**
   * 创建默认配置
   */
  private createDefaultConfig(): MacroProcessorConfig {
    return {
      enabledProcessors: undefined, // undefined 表示启用所有处理器
      disabledProcessors: [],
      blacklistedMacros: [],
      fallbackStrategy: MacroFallbackStrategy.PRESERVE_HTML,
      maxRecursionDepth: 5,
      timeout: 30000, // 30秒
      enableConcurrency: true,
      preserveUnknownMacros: true,
      customProcessors: {},
      processorSettings: {
        markdown: {
          preserveFormatting: true,
          convertInlineToBlock: false
        },
        code: {
          preserveLineNumbers: true,
          addLanguageComment: true,
          enableSyntaxHighlighting: false
        },
        info: {
          useEmojis: true,
          preserveColors: false
        },
        table: {
          maxComplexity: 10,
          preserveHtmlForComplex: true
        },
        chart: {
          preferMermaid: true,
          exportAsImage: false,
          includeDataLinks: true
        },
        include: {
          maxDepth: 3,
          handleCircularReferences: true,
          preservePermissionErrors: true
        }
      },
      debugMode: false,
      logLevel: 'info'
    };
  }

  /**
   * 加载配置文件
   */
  public loadConfig(configPath?: string): MacroProcessorConfig {
    try {
      const paths = this.getConfigPaths(configPath);
      let loadedConfig: Partial<MacroProcessorConfig> = {};
      let configFound = false;

      // 尝试从多个路径加载配置
      const logger = Logger.getInstance();
      for (const path of paths) {
        if (existsSync(path)) {
          logger.info(`Loading macro config from: ${path}`);
          const configContent = readFileSync(path, 'utf-8');
          const parsedConfig = JSON.parse(configContent);
          
          // 验证配置
          const validationResult = this.validateConfig(parsedConfig);
          if (validationResult.success) {
            loadedConfig = { ...loadedConfig, ...validationResult.data };
            this.configPath = path;
            configFound = true;
            break;
          } else {
            logger.error(`Invalid config file at ${path}:`, validationResult.error);
            throw new Error(`Configuration validation failed: ${validationResult.error?.message || 'Unknown validation error'}`);
          }
        }
      }

      if (!configFound) {
        logger.info('No config file found, using default configuration');
      }

      // 合并默认配置和加载的配置
      this.config = this.mergeConfigs(this.defaultConfig, loadedConfig);
      
      // 验证最终配置
      this.validateFinalConfig();
      
      logger.info('Macro configuration loaded successfully', {
        configPath: this.configPath,
        enabledProcessors: this.config.enabledProcessors?.length || 'all',
        disabledProcessors: this.config.disabledProcessors?.length || 0,
        blacklistedMacros: this.config.blacklistedMacros?.length || 0
      });

      return this.config;
    } catch (error) {
      const logger = Logger.getInstance();
      logger.error('Failed to load macro configuration:', error);
      logger.warn('Falling back to default configuration');
      this.config = { ...this.defaultConfig };
      return this.config;
    }
  }

  /**
   * 获取可能的配置文件路径
   */
  private getConfigPaths(customPath?: string): string[] {
    const paths: string[] = [];
    
    if (customPath) {
      paths.push(resolve(customPath));
    }

    // 项目根目录的配置文件
    const projectRoot = process.cwd();
    paths.push(
      join(projectRoot, 'src/config/macro-config.json'),
      join(projectRoot, 'config/macro-config.json'),
      join(projectRoot, 'macro-config.json'),
      join(projectRoot, '.macro-config.json')
    );

    return paths;
  }

  /**
   * 验证配置
   */
  private validateConfig(config: any): { success: boolean; data?: MacroProcessorConfig; error?: z.ZodError } {
    try {
      const validatedConfig = MacroProcessorConfigSchema.parse(config);
      return { success: true, data: validatedConfig };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, error };
      }
      throw error;
    }
  }

  /**
   * 验证最终配置的逻辑一致性
   */
  private validateFinalConfig(): void {
    const logger = Logger.getInstance();
    
    // 检查启用和禁用列表的冲突
    if (this.config.enabledProcessors && this.config.disabledProcessors) {
      const conflicts = this.config.enabledProcessors.filter(processor => 
        this.config.disabledProcessors!.includes(processor)
      );
      
      if (conflicts.length > 0) {
        logger.warn(`Conflicting processor configuration found: ${conflicts.join(', ')}`);
        // 移除冲突的处理器（禁用列表优先）
        this.config.enabledProcessors = this.config.enabledProcessors.filter(
          processor => !this.config.disabledProcessors!.includes(processor)
        );
      }
    }

    // 验证递归深度
    if (this.config.maxRecursionDepth && this.config.maxRecursionDepth < 1) {
      logger.warn('Invalid maxRecursionDepth, using default value');
      this.config.maxRecursionDepth = this.defaultConfig.maxRecursionDepth;
    }

    // 验证超时时间
    if (this.config.timeout && this.config.timeout < 1000) {
      logger.warn('Timeout too low, using minimum value of 1000ms');
      this.config.timeout = 1000;
    }
  }

  /**
   * 合并配置
   */
  private mergeConfigs(defaultConfig: MacroProcessorConfig, userConfig: Partial<MacroProcessorConfig>): MacroProcessorConfig {
    return {
      ...defaultConfig,
      ...userConfig,
      // 深度合并处理器设置
      processorSettings: {
        ...defaultConfig.processorSettings,
        ...userConfig.processorSettings
      },
      // 深度合并自定义处理器
      customProcessors: {
        ...defaultConfig.customProcessors,
        ...userConfig.customProcessors
      }
    };
  }

  /**
   * 获取当前配置
   */
  public getConfig(): MacroProcessorConfig {
    return { ...this.config };
  }

  /**
   * 获取特定处理器的设置
   */
  public getProcessorSettings(processorType: string): Record<string, any> {
    return this.config.processorSettings?.[processorType] || {};
  }

  /**
   * 更新配置
   */
  public updateConfig(updates: Partial<MacroProcessorConfig>): void {
    this.config = this.mergeConfigs(this.config, updates);
    this.validateFinalConfig();
    const logger = Logger.getInstance();
    logger.info('Configuration updated', updates);
  }

  /**
   * 重新加载配置
   */
  public reloadConfig(): MacroProcessorConfig {
    return this.loadConfig(this.configPath || undefined);
  }

  /**
   * 检查处理器是否启用
   */
  public isProcessorEnabled(processorType: string): boolean {
    // 检查黑名单
    if (this.config.blacklistedMacros?.includes(processorType)) {
      return false;
    }

    // 检查禁用列表
    if (this.config.disabledProcessors?.includes(processorType)) {
      return false;
    }

    // 检查启用列表（如果定义了启用列表，只有在列表中的才启用）
    if (this.config.enabledProcessors) {
      return this.config.enabledProcessors.includes(processorType);
    }

    // 默认启用
    return true;
  }

  /**
   * 获取配置摘要
   */
  public getConfigSummary(): {
    configPath: string | null;
    totalProcessorSettings: number;
    enabledProcessorsCount: number | 'all';
    disabledProcessorsCount: number;
    blacklistedMacrosCount: number;
    customProcessorsCount: number;
    fallbackStrategy: MacroFallbackStrategy;
    debugMode: boolean;
  } {
    return {
      configPath: this.configPath,
      totalProcessorSettings: Object.keys(this.config.processorSettings || {}).length,
      enabledProcessorsCount: this.config.enabledProcessors?.length || 'all',
      disabledProcessorsCount: this.config.disabledProcessors?.length || 0,
      blacklistedMacrosCount: this.config.blacklistedMacros?.length || 0,
      customProcessorsCount: Object.keys(this.config.customProcessors || {}).length,
      fallbackStrategy: this.config.fallbackStrategy || MacroFallbackStrategy.PRESERVE_HTML,
      debugMode: this.config.debugMode || false
    };
  }
}

// 导出便捷函数和实例
export const macroConfigService = MacroConfigService.getInstance();
export const loadMacroConfig = (configPath?: string) => macroConfigService.loadConfig(configPath);
export const getMacroConfig = () => macroConfigService.getConfig();
export const getProcessorSettings = (processorType: string) => macroConfigService.getProcessorSettings(processorType);
export const isProcessorEnabled = (processorType: string) => macroConfigService.isProcessorEnabled(processorType);