import { Logger } from './logger.js';

/**
 * 性能优化工具类
 */
export class PerformanceOptimizer {
  private static readonly logger = Logger.getInstance();

  /**
   * 并发控制器
   * 限制同时执行的异步操作数量
   */
  static async concurrentMap<T, R>(
    items: T[],
    mapper: (item: T, index: number) => Promise<R>,
    concurrency: number = 3
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      const promise = mapper(item, i).then(result => {
        results[i] = result;
      });
      
      executing.push(promise);
      
      // 当达到并发限制时，等待一个任务完成
      if (executing.length >= concurrency) {
        await Promise.race(executing);
        // 移除已完成的任务
        const completedIndex = executing.findIndex(p => 
          p === promise || (p as any).isResolved
        );
        if (completedIndex !== -1) {
          executing.splice(completedIndex, 1);
        }
      }
    }
    
    // 等待所有剩余任务完成
    await Promise.all(executing);
    
    return results;
  }

  /**
   * 重试机制
   * 对失败的操作进行重试
   */
  static async retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
    backoffMultiplier: number = 2
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          this.logger.error(`操作失败，已达到最大重试次数 ${maxRetries}:`, error);
          throw lastError;
        }
        
        const currentDelay = delay * Math.pow(backoffMultiplier, attempt);
        this.logger.warn(`操作失败，${currentDelay}ms 后进行第 ${attempt + 1} 次重试:`, error);
        
        await this.sleep(currentDelay);
      }
    }
    
    throw lastError!;
  }

  /**
   * 睡眠函数
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 内存使用监控
   */
  static getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  /**
   * 记录内存使用情况
   */
  static logMemoryUsage(label: string): void {
    const usage = this.getMemoryUsage();
    this.logger.debug(`内存使用 [${label}]:`, {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`
    });
  }

  /**
   * 性能计时器
   */
  static createTimer(label: string): () => number {
    const startTime = Date.now();
    this.logger.debug(`性能计时开始: ${label}`);
    
    return () => {
      const duration = Date.now() - startTime;
      this.logger.debug(`性能计时结束: ${label}, 耗时: ${duration}ms`);
      return duration;
    };
  }

  /**
   * 批处理优化
   * 将大数组分批处理，避免内存溢出
   */
  static async processBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = 10
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      this.logger.debug(`处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}, 大小: ${batch.length}`);
      
      const batchResults = await processor(batch);
      results.push(...batchResults);
      
      // 在批次之间稍作停顿，避免过度占用资源
      if (i + batchSize < items.length) {
        await this.sleep(100);
      }
    }
    
    return results;
  }

  /**
   * 缓存装饰器
   * 为函数结果提供简单的内存缓存
   */
  static createCache<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    ttl: number = 300000 // 5分钟默认TTL
  ): T {
    const cache = new Map<string, { value: any; expiry: number }>();
    
    return (async (...args: Parameters<T>) => {
      const key = JSON.stringify(args);
      const now = Date.now();
      
      // 检查缓存
      const cached = cache.get(key);
      if (cached && cached.expiry > now) {
        this.logger.debug(`缓存命中: ${fn.name}`);
        return cached.value;
      }
      
      // 执行函数并缓存结果
      const result = await fn(...args);
      cache.set(key, {
        value: result,
        expiry: now + ttl
      });
      
      // 清理过期缓存
      const entries = Array.from(cache.entries());
      for (const [cacheKey, cacheValue] of entries) {
        if (cacheValue.expiry <= now) {
          cache.delete(cacheKey);
        }
      }
      
      return result;
    }) as T;
  }

  /**
   * 流式处理大文件
   * 避免将整个文件内容加载到内存中
   */
  static async processLargeContent(
    content: string,
    processor: (chunk: string) => string,
    chunkSize: number = 1024 * 1024 // 1MB chunks
  ): Promise<string> {
    if (content.length <= chunkSize) {
      return processor(content);
    }
    
    let result = '';
    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.slice(i, i + chunkSize);
      const processedChunk = processor(chunk);
      result += processedChunk;
      
      // 定期释放事件循环
      if (i % (chunkSize * 10) === 0) {
        await this.sleep(0);
      }
    }
    
    return result;
  }

  /**
   * 资源使用统计
   */
  static createResourceMonitor() {
    const startTime = Date.now();
    const startMemory = this.getMemoryUsage();
    
    return {
      getStats: () => {
        const currentMemory = this.getMemoryUsage();
        const duration = Date.now() - startTime;
        
        return {
          duration,
          memoryDelta: {
            rss: currentMemory.rss - startMemory.rss,
            heapTotal: currentMemory.heapTotal - startMemory.heapTotal,
            heapUsed: currentMemory.heapUsed - startMemory.heapUsed,
            external: currentMemory.external - startMemory.external
          },
          currentMemory
        };
      }
    };
  }

  /**
   * 智能延迟
   * 根据系统负载动态调整延迟时间
   */
  static async smartDelay(baseDelay: number = 100): Promise<void> {
    const usage = this.getMemoryUsage();
    const heapUsageRatio = usage.heapUsed / usage.heapTotal;
    
    // 如果内存使用率高，增加延迟
    const multiplier = heapUsageRatio > 0.8 ? 3 : heapUsageRatio > 0.6 ? 2 : 1;
    const delay = baseDelay * multiplier;
    
    if (multiplier > 1) {
      this.logger.debug(`系统负载较高，延迟 ${delay}ms`);
    }
    
    await this.sleep(delay);
  }
}