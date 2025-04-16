import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ConfluenceClient, ConfluenceConfig } from './confluence-client.js';
import dotenv from 'dotenv';
import { z } from 'zod';

// 定义日志函数
function log(message: string) {
  console.error(`[DEBUG] ${message}`);
}

log("MCP 服务器启动中...");

dotenv.config();

// 验证环境变量
const requiredEnvVars = ['CONFLUENCE_URL', 'CONFLUENCE_USERNAME', 'CONFLUENCE_PASSWORD'] as const;
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    log(`缺少必需的环境变量: ${envVar}`);
    throw new Error(`缺少必需的环境变量: ${envVar}`);
  }
  log(`环境变量 ${envVar} 已设置`);
}

// 创建 MCP 服务器
const server = new McpServer({
  name: "confluence-mcp-server",
  version: "1.0.0",
  description: "Confluence MCP 服务器",
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

log("MCP 服务器已创建");

// 创建 Confluence 客户端
const confluenceConfig: ConfluenceConfig = {
  baseUrl: process.env.CONFLUENCE_URL!,
  username: process.env.CONFLUENCE_USERNAME!,
  password: process.env.CONFLUENCE_PASSWORD!
};

const confluenceClient = new ConfluenceClient(confluenceConfig);

// 定义工具
server.tool(
  "getSpace",
  { spaceKey: z.string() },
  async ({ spaceKey }) => {
    log(`调用 getSpace 工具，参数: ${spaceKey}`);
    try {
      const space = await confluenceClient.getSpace(spaceKey);
      log(`获取空间信息成功: ${spaceKey}`);
      return {
        content: [{ 
          type: "text",
          text: JSON.stringify(space, null, 2)
        }]
      };
    } catch (error) {
      log(`获取空间信息失败: ${error}`);
      return {
        content: [{
          type: "text",
          text: `获取空间信息失败: ${error}`
        }],
        isError: true
      };
    }
  }
);

log("getSpace 工具已注册");

server.tool(
  "getPage",
  { pageId: z.string() },
  async ({ pageId }) => {
    log(`调用 getPage 工具，参数: ${pageId}`);
    try {
      const page = await confluenceClient.getPage(pageId);
      log(`获取页面信息成功: ${pageId}`);
      return {
        content: [{ 
          type: "text",
          text: JSON.stringify(page, null, 2)
        }]
      };
    } catch (error) {
      log(`获取页面信息失败: ${error}`);
      return {
        content: [{
          type: "text",
          text: `获取页面信息失败: ${error}`
        }],
        isError: true
      };
    }
  }
);

log("getPage 工具已注册");

server.tool(
  "searchContent",
  { query: z.string() },
  async ({ query }) => {
    log(`调用 searchContent 工具，参数: ${query}`);
    try {
      const results = await confluenceClient.searchContent(query);
      log(`搜索内容成功: ${query}`);
      return {
        content: [{ 
          type: "text",
          text: JSON.stringify(results, null, 2)
        }]
      };
    } catch (error) {
      log(`搜索内容失败: ${error}`);
      return {
        content: [{
          type: "text",
          text: `搜索内容失败: ${error}`
        }],
        isError: true
      };
    }
  }
);

log("searchContent 工具已注册");

server.tool(
  "getPageContent",
  { pageId: z.string() },
  async ({ pageId }) => {
    log(`调用 getPageContent 工具，参数: ${pageId}`);
    try {
      const content = await confluenceClient.getPageContent(pageId);
      log(`获取页面内容成功: ${pageId}`);
      return {
        content: [{ 
          type: "text",
          text: JSON.stringify(content, null, 2)
        }]
      };
    } catch (error) {
      log(`获取页面内容失败: ${error}`);
      return {
        content: [{
          type: "text",
          text: `获取页面内容失败: ${error}`
        }],
        isError: true
      };
    }
  }
);

log("getPageContent 工具已注册");

// 创建传输层
const transport = new StdioServerTransport();

// 连接服务器
server.connect(transport).then(() => {
  log("MCP 服务器已成功连接并启动");
  
  // 保持进程运行
  process.on('SIGINT', () => {
    log("收到 SIGINT 信号，正在关闭...");
    transport.close();
    process.exit(0);
  });
}).catch((error: Error) => {
  log(`服务器启动失败: ${error.message}`);
  process.exit(1);
}); 