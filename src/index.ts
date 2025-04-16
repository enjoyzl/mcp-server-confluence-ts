import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from 'zod';
import { config } from './config/index.js';
import { ConfluenceClient } from './services/confluence-client.js';
import { Logger } from './utils/logger.js';
import { ErrorResponse } from './types/index.js';

const logger = Logger.getInstance();

async function main() {
  try {
    logger.info("MCP 服务器启动中...");

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

    logger.debug("MCP 服务器已创建");

    // 创建 Confluence 客户端
    const confluenceClient = new ConfluenceClient({
      baseUrl: config.baseUrl,
      username: config.username,
      password: config.password
    });

    // 注册工具
    server.tool(
      "getSpace",
      { spaceKey: z.string() },
      async ({ spaceKey }) => {
        try {
          logger.debug(`调用 getSpace 工具，参数: ${spaceKey}`);
          const space = await confluenceClient.getSpace(spaceKey);
          return {
            content: [{ 
              type: "text",
              text: JSON.stringify(space, null, 2)
            }]
          };
        } catch (error) {
          const err = error as ErrorResponse;
          return {
            content: [{
              type: "text",
              text: `获取空间信息失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    server.tool(
      "getPage",
      { pageId: z.string() },
      async ({ pageId }) => {
        try {
          logger.debug(`调用 getPage 工具，参数: ${pageId}`);
          const page = await confluenceClient.getPage(pageId);
          return {
            content: [{ 
              type: "text",
              text: JSON.stringify(page, null, 2)
            }]
          };
        } catch (error) {
          const err = error as ErrorResponse;
          return {
            content: [{
              type: "text",
              text: `获取页面信息失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    server.tool(
      "searchContent",
      { query: z.string() },
      async ({ query }) => {
        try {
          logger.debug(`调用 searchContent 工具，参数: ${query}`);
          const results = await confluenceClient.searchContent(query);
          return {
            content: [{ 
              type: "text",
              text: JSON.stringify(results, null, 2)
            }]
          };
        } catch (error) {
          const err = error as ErrorResponse;
          return {
            content: [{
              type: "text",
              text: `搜索内容失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    server.tool(
      "getPageContent",
      { pageId: z.string() },
      async ({ pageId }) => {
        try {
          logger.debug(`调用 getPageContent 工具，参数: ${pageId}`);
          const content = await confluenceClient.getPageContent(pageId);
          return {
            content: [{ 
              type: "text",
              text: JSON.stringify(content, null, 2)
            }]
          };
        } catch (error) {
          const err = error as ErrorResponse;
          return {
            content: [{
              type: "text",
              text: `获取页面内容失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    // 创建传输层
    const transport = new StdioServerTransport();

    // 连接服务器
    await server.connect(transport);
    logger.info("MCP 服务器已成功连接并启动");

    // 优雅关闭
    process.on('SIGINT', () => {
      logger.info("收到 SIGINT 信号，正在关闭...");
      transport.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info("收到 SIGTERM 信号，正在关闭...");
      transport.close();
      process.exit(0);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未处理的 Promise 拒绝:', reason);
    });

    process.on('uncaughtException', (error) => {
      logger.error('未捕获的异常:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

main(); 