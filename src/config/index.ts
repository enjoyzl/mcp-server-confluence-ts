import dotenv from 'dotenv';
import { z } from 'zod';
import { Logger } from '../utils/logger.js';
import { ConfluenceConfig } from '../types/index.js';

// 加载环境变量
dotenv.config();

const logger = Logger.getInstance();

// 定义配置模式
const configSchema = z.object({
  baseUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
  server: z.object({
    port: z.number().int().positive().default(3000),
    env: z.enum(['development', 'production']).default('development'),
    timeout: z.number().int().positive().default(10000)
  })
});

// 创建配置
function createConfig(): ConfluenceConfig & { server: { port: number; env: 'development' | 'production'; timeout: number } } {
  try {
    const config = configSchema.parse({
      baseUrl: process.env.CONFLUENCE_URL,
      username: process.env.CONFLUENCE_USERNAME,
      password: process.env.CONFLUENCE_PASSWORD,
      server: {
        port: parseInt(process.env.PORT || '3000'),
        env: process.env.NODE_ENV as 'development' | 'production' || 'development',
        timeout: parseInt(process.env.TIMEOUT || '10000')
      }
    });

    logger.debug('Configuration loaded successfully');
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Configuration validation failed:', error.errors);
      throw new Error('Invalid configuration: ' + error.errors.map(e => e.message).join(', '));
    }
    throw error;
  }
}

export const config = createConfig(); 