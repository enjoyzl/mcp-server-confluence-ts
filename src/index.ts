import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from 'zod';
import { configService } from './config/config.service.js';
import { ConfluenceService } from './services/confluence.service.js';
import { Logger } from './utils/logger.js';
import { ErrorResponse } from './types/confluence.types.js';

/**
 * MCP 服务器实例
 */
const logger = Logger.getInstance();

/**
 * 主函数
 * 负责初始化和启动 MCP 服务器
 */
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

    // 创建 Confluence 服务实例
    const config = configService.getConfig();
    const confluenceService = new ConfluenceService({
      baseUrl: config.baseUrl,
      username: config.username,
      password: config.password,
      timeout: config.timeout,
      rejectUnauthorized: config.rejectUnauthorized
    });

    // 注册工具
    server.tool(
      "getSpace",
      { spaceKey: z.string() },
      async ({ spaceKey }) => {
        try {
          logger.debug(`调用 getSpace 工具，参数: ${spaceKey}`);
          const space = await confluenceService.getSpace(spaceKey);
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
          const page = await confluenceService.getPage(pageId);
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
      "getPageByPrettyUrl",
      { 
        spaceKey: z.string(),
        title: z.string()
      },
      async ({ spaceKey, title }) => {
        try {
          logger.debug(`调用 getPageByPrettyUrl 工具，参数: ${spaceKey}, ${title}`);
          const page = await confluenceService.getPageByPrettyUrl({ spaceKey, title });
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
          const results = await confluenceService.searchContent(query);
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
          const content = await confluenceService.getPageContent(pageId);
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

    server.tool(
      "createPage",
      {
        spaceKey: z.string(),
        title: z.string(),
        content: z.string(),
        parentId: z.string().optional(),
        representation: z.enum(['storage', 'wiki', 'editor2', 'view']).optional()
      },
      async ({ spaceKey, title, content, parentId, representation }) => {
        try {
          logger.debug(`调用 createPage 工具，参数:`, { spaceKey, title, parentId });
          const page = await confluenceService.createPage({
            spaceKey,
            title,
            content,
            parentId,
            representation
          });
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
              text: `创建页面失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    server.tool(
      "updatePage",
      {
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        version: z.number().optional(),
        representation: z.enum(['storage', 'wiki', 'editor2', 'view']).optional()
      },
      async ({ id, title, content, version, representation }) => {
        try {
          logger.debug(`调用 updatePage 工具，参数:`, { id, title });
          const page = await confluenceService.updatePage({
            id,
            title,
            content,
            version,
            representation
          });
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
              text: `更新页面失败: ${err.message}`
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

    // 注册进程事件处理
    registerProcessHandlers(transport);

  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

/**
 * 注册进程事件处理器
 */
function registerProcessHandlers(transport: StdioServerTransport): void {
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
}

// 启动服务器
main(); 