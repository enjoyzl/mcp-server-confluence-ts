import dotenv from 'dotenv';

dotenv.config();

// 验证环境变量
const requiredEnvVars = ['CONFLUENCE_URL', 'CONFLUENCE_USERNAME', 'CONFLUENCE_PASSWORD'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`缺少必需的环境变量: ${envVar}`);
  }
}

export const config = {
  baseUrl: process.env.CONFLUENCE_URL!,
  username: process.env.CONFLUENCE_USERNAME!,
  password: process.env.CONFLUENCE_PASSWORD!
}; 