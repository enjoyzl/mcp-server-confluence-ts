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
      accessToken: config.accessToken,
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

    // 评论相关工具
    server.tool(
      "getPageComments",
      {
        pageId: z.string(),
        start: z.number().optional(),
        limit: z.number().optional()
      },
      async ({ pageId, start, limit }) => {
        try {
          logger.debug(`调用 getPageComments 工具，参数:`, { pageId, start, limit });
          const comments = await confluenceService.getPageComments(pageId, { start, limit });
          return {
            content: [{ 
              type: "text",
              text: JSON.stringify(comments, null, 2)
            }]
          };
        } catch (error) {
          const err = error as ErrorResponse;
          return {
            content: [{
              type: "text",
              text: `获取页面评论失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    server.tool(
      "getComment",
      { commentId: z.string() },
      async ({ commentId }) => {
        try {
          logger.debug(`调用 getComment 工具，参数: ${commentId}`);
          const comment = await confluenceService.getComment(commentId);
          return {
            content: [{ 
              type: "text",
              text: JSON.stringify(comment, null, 2)
            }]
          };
        } catch (error) {
          const err = error as ErrorResponse;
          return {
            content: [{
              type: "text",
              text: `获取评论失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    server.tool(
      "createComment",
      {
        pageId: z.string(),
        content: z.string(),
        representation: z.enum(['storage', 'wiki', 'editor2', 'view']).optional(),
        parentCommentId: z.string().optional()
      },
      async ({ pageId, content, representation, parentCommentId }) => {
        try {
          logger.debug(`调用 createComment 工具，参数:`, { pageId, parentCommentId });
          const comment = await confluenceService.createComment(
            pageId,
            content,
            representation,
            parentCommentId
          );
          return {
            content: [{ 
              type: "text",
              text: JSON.stringify(comment, null, 2)
            }]
          };
        } catch (error) {
          const err = error as ErrorResponse;
          return {
            content: [{
              type: "text",
              text: `创建评论失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    server.tool(
      "updateComment",
      {
        id: z.string(),
        content: z.string(),
        version: z.number().optional(),
        representation: z.enum(['storage', 'wiki', 'editor2', 'view']).optional()
      },
      async ({ id, content, version, representation }) => {
        try {
          logger.debug(`调用 updateComment 工具，参数:`, { id, version: version || 'auto' });
          const comment = await confluenceService.updateComment({
            id,
            content,
            version,
            representation
          });
          return {
            content: [{ 
              type: "text",
              text: JSON.stringify(comment, null, 2)
            }]
          };
        } catch (error) {
          const err = error as ErrorResponse;
          return {
            content: [{
              type: "text",
              text: `更新评论失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    server.tool(
      "deleteComment",
      { commentId: z.string() },
      async ({ commentId }) => {
        try {
          logger.debug(`调用 deleteComment 工具，参数: ${commentId}`);
          await confluenceService.deleteComment(commentId);
          return {
            content: [{ 
              type: "text",
              text: `评论 ${commentId} 已成功删除`
            }]
          };
        } catch (error) {
          const err = error as ErrorResponse;
          return {
            content: [{
              type: "text",
              text: `删除评论失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    server.tool(
      "searchComments",
      {
        query: z.string(),
        start: z.number().optional(),
        limit: z.number().optional(),
        spaceKey: z.string().optional()
      },
      async ({ query, start, limit, spaceKey }) => {
        try {
          logger.debug(`调用 searchComments 工具，参数:`, { query, start, limit, spaceKey });
          const results = await confluenceService.searchComments(query, { start, limit, spaceKey });
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
              text: `搜索评论失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    // 行内评论相关工具
    server.tool(
      "createInlineComment",
      {
        pageId: z.string(),
        content: z.string(),
        originalSelection: z.string(),
        matchIndex: z.number().optional(),
        numMatches: z.number().optional(),
        serializedHighlights: z.string().optional(),
        parentCommentId: z.string().optional()
      },
      async ({ pageId, content, originalSelection, matchIndex, numMatches, serializedHighlights, parentCommentId }) => {
        try {
          logger.debug(`调用 createInlineComment 工具，参数:`, { pageId, originalSelection, matchIndex });
          const comment = await confluenceService.createInlineComment(
            pageId,
            content,
            originalSelection,
            matchIndex,
            numMatches,
            serializedHighlights,
            parentCommentId
          );
          return {
            content: [{ 
              type: "text",
              text: JSON.stringify(comment, null, 2)
            }]
          };
        } catch (error) {
          const err = error as ErrorResponse;
          return {
            content: [{
              type: "text",
              text: `创建行内评论失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    server.tool(
      "updateInlineComment",
      {
        commentId: z.string(),
        content: z.string()
      },
      async ({ commentId, content }) => {
        try {
          logger.debug(`调用 updateInlineComment 工具，参数:`, { commentId });
          const comment = await confluenceService.updateInlineComment({
            commentId,
            content
          });
          return {
            content: [{ 
              type: "text",
              text: JSON.stringify(comment, null, 2)
            }]
          };
        } catch (error) {
          const err = error as ErrorResponse;
          return {
            content: [{
              type: "text",
              text: `更新行内评论失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    server.tool(
      "deleteInlineComment",
      { commentId: z.string() },
      async ({ commentId }) => {
        try {
          logger.debug(`调用 deleteInlineComment 工具，参数: ${commentId}`);
          await confluenceService.deleteInlineComment(commentId);
          return {
            content: [{ 
              type: "text",
              text: `行内评论 ${commentId} 已成功删除`
            }]
          };
        } catch (error) {
          const err = error as ErrorResponse;
          return {
            content: [{
              type: "text",
              text: `删除行内评论失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    server.tool(
      "replyInlineComment",
      {
        commentId: z.string(),
        pageId: z.string(),
        content: z.string()
      },
      async ({ commentId, pageId, content }) => {
        try {
          logger.debug(`调用 replyInlineComment 工具，参数:`, { commentId, pageId });
          const reply = await confluenceService.replyInlineComment({
            commentId,
            pageId,
            content
          });
          return {
            content: [{ 
              type: "text",
              text: JSON.stringify(reply, null, 2)
            }]
          };
        } catch (error) {
          const err = error as ErrorResponse;
          return {
            content: [{
              type: "text",
              text: `回复行内评论失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    server.tool(
      "replyComment",
      {
        pageId: z.string(),
        parentCommentId: z.string(),
        content: z.string(),
        watch: z.boolean().optional()
      },
      async ({ pageId, parentCommentId, content, watch }) => {
        try {
          logger.debug(`调用 replyComment 工具，参数:`, { pageId, parentCommentId, watch: watch || false });
          const reply = await confluenceService.replyComment({
            pageId,
            parentCommentId,
            content,
            watch
          });
          return {
            content: [{ 
              type: "text",
              text: JSON.stringify(reply, null, 2)
            }]
          };
        } catch (error) {
          const err = error as ErrorResponse;
          return {
            content: [{
              type: "text",
              text: `回复评论失败: ${err.message}`
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