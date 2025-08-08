import { BaseMacroProcessor } from './base-macro-processor.js';
import { MacroProcessorConfig } from '../../types/macro.types.js';
import { Logger } from '../../utils/logger.js';

/**
 * 宏处理器注册器
 * 负责管理所有宏处理器的注册、查找和生命周期管理
 */
export class MacroRegistry {
  private static instance: MacroRegistry;
  private processors: Map<string, BaseMacroProcessor> = new Map();
  private processorPriorities: Map<string, number> = new Map();
  private blacklistedMacros: Set<string> = new Set();
  private config: MacroProcessorConfig | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): MacroRegistry {
    if (!MacroRegistry.instance) {
      MacroRegistry.instance = new MacroRegistry();
    }
    return MacroRegistry.instance;
  }

  /**
   * 设置配置
   */
  public setConfig(config: MacroProcessorConfig): void {
    this.config = config;
    this.updateBlacklist(config.blacklistedMacros || []);
    const logger = Logger.getInstance();
    logger.info('MacroRegistry configuration updated', {
      blacklistedMacros: config.blacklistedMacros?.length || 0,
      enabledProcessors: config.enabledProcessors?.length || 0
    });
  }

  /**
   * 注册宏处理器
   */
  public static register(macroType: string, processor: BaseMacroProcessor, priority: number = 0): void {
    const instance = MacroRegistry.getInstance();
    instance.registerProcessor(macroType, processor, priority);
  }

  /**
   * 实例方法：注册宏处理器
   */
  public registerProcessor(macroType: string, processor: BaseMacroProcessor, priority: number = 0): void {
    const logger = Logger.getInstance();
    
    if (this.blacklistedMacros.has(macroType)) {
      logger.warn(`Attempted to register blacklisted macro processor: ${macroType}`);
      return;
    }

    // 检查是否在启用列表中（如果配置了启用列表）
    if (this.config?.enabledProcessors && !this.config.enabledProcessors.includes(macroType)) {
      logger.info(`Macro processor ${macroType} not in enabled list, skipping registration`);
      return;
    }

    // 检查是否在禁用列表中
    if (this.config?.disabledProcessors?.includes(macroType)) {
      logger.info(`Macro processor ${macroType} is disabled, skipping registration`);
      return;
    }

    this.processors.set(macroType, processor);
    this.processorPriorities.set(macroType, priority);
    
    logger.info(`Registered macro processor: ${macroType} with priority ${priority}`);
  }

  /**
   * 获取宏处理器
   */
  public static getProcessor(macroType: string): BaseMacroProcessor | null {
    const instance = MacroRegistry.getInstance();
    return instance.getProcessorInstance(macroType);
  }

  /**
   * 实例方法：获取宏处理器
   */
  public getProcessorInstance(macroType: string): BaseMacroProcessor | null {
    const logger = Logger.getInstance();
    
    if (this.blacklistedMacros.has(macroType)) {
      logger.debug(`Macro type ${macroType} is blacklisted`);
      return null;
    }

    const processor = this.processors.get(macroType);
    if (!processor) {
      logger.debug(`No processor found for macro type: ${macroType}`);
    }
    return processor || null;
  }

  /**
   * 获取所有已注册的宏类型
   */
  public static getRegisteredMacroTypes(): string[] {
    const instance = MacroRegistry.getInstance();
    return instance.getRegisteredTypes();
  }

  /**
   * 实例方法：获取所有已注册的宏类型
   */
  public getRegisteredTypes(): string[] {
    return Array.from(this.processors.keys()).filter(type => !this.blacklistedMacros.has(type));
  }

  /**
   * 检查宏是否支持
   */
  public static isSupported(macroType: string): boolean {
    const instance = MacroRegistry.getInstance();
    return instance.isSupportedMacro(macroType);
  }

  /**
   * 实例方法：检查宏是否支持
   */
  public isSupportedMacro(macroType: string): boolean {
    return this.processors.has(macroType) && !this.blacklistedMacros.has(macroType);
  }

  /**
   * 获取按优先级排序的处理器列表
   */
  public getProcessorsByPriority(): Array<{ type: string; processor: BaseMacroProcessor; priority: number }> {
    const processors = Array.from(this.processors.entries())
      .filter(([type]) => !this.blacklistedMacros.has(type))
      .map(([type, processor]) => ({
        type,
        processor,
        priority: this.processorPriorities.get(type) || 0
      }));

    // 按优先级降序排序（优先级数字大的先处理）
    return processors.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 注销宏处理器
   */
  public static unregister(macroType: string): boolean {
    const instance = MacroRegistry.getInstance();
    return instance.unregisterProcessor(macroType);
  }

  /**
   * 实例方法：注销宏处理器
   */
  public unregisterProcessor(macroType: string): boolean {
    const logger = Logger.getInstance();
    const removed = this.processors.delete(macroType);
    this.processorPriorities.delete(macroType);
    
    if (removed) {
      logger.info(`Unregistered macro processor: ${macroType}`);
    }
    
    return removed;
  }

  /**
   * 清空所有注册的处理器
   */
  public static clear(): void {
    const instance = MacroRegistry.getInstance();
    instance.clearAll();
  }

  /**
   * 实例方法：清空所有注册的处理器
   */
  public clearAll(): void {
    const logger = Logger.getInstance();
    this.processors.clear();
    this.processorPriorities.clear();
    logger.info('Cleared all macro processors');
  }

  /**
   * 更新黑名单
   */
  private updateBlacklist(blacklistedMacros: string[]): void {
    const logger = Logger.getInstance();
    this.blacklistedMacros.clear();
    blacklistedMacros.forEach(macro => this.blacklistedMacros.add(macro));
    
    // 移除已被加入黑名单的处理器
    blacklistedMacros.forEach(macro => {
      if (this.processors.has(macro)) {
        this.unregisterProcessor(macro);
        logger.info(`Removed blacklisted macro processor: ${macro}`);
      }
    });
  }

  /**
   * 获取注册统计信息
   */
  public getRegistrationStats(): {
    totalRegistered: number;
    blacklisted: number;
    available: number;
    processorTypes: string[];
  } {
    const availableTypes = this.getRegisteredTypes();
    return {
      totalRegistered: this.processors.size,
      blacklisted: this.blacklistedMacros.size,
      available: availableTypes.length,
      processorTypes: availableTypes
    };
  }

  /**
   * 验证处理器是否正确实现了接口
   */
  public validateProcessor(processor: BaseMacroProcessor): boolean {
    const logger = Logger.getInstance();
    try {
      // 检查必需的属性和方法
      if (!processor.macroType || typeof processor.macroType !== 'string') {
        logger.error('Processor missing or invalid macroType property');
        return false;
      }

      if (typeof processor.canProcess !== 'function') {
        logger.error('Processor missing canProcess method');
        return false;
      }

      if (typeof processor.process !== 'function') {
        logger.error('Processor missing process method');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating processor:', error);
      return false;
    }
  }

  /**
   * 动态加载处理器（支持插件式扩展）
   */
  public async loadProcessor(processorPath: string, macroType: string, priority: number = 0): Promise<boolean> {
    const logger = Logger.getInstance();
    try {
      const processorModule = await import(processorPath);
      const ProcessorClass = processorModule.default || processorModule[Object.keys(processorModule)[0]];
      
      if (!ProcessorClass) {
        logger.error(`No processor class found in module: ${processorPath}`);
        return false;
      }

      const processor = new ProcessorClass();
      
      if (!this.validateProcessor(processor)) {
        logger.error(`Invalid processor loaded from: ${processorPath}`);
        return false;
      }

      this.registerProcessor(macroType, processor, priority);
      logger.info(`Dynamically loaded processor: ${macroType} from ${processorPath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to load processor from ${processorPath}:`, error);
      return false;
    }
  }
}

// 导出静态方法的便捷访问
export const {
  register,
  getProcessor,
  getRegisteredMacroTypes,
  isSupported,
  unregister,
  clear
} = MacroRegistry;