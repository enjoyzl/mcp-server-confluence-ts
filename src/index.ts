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
 * 全局计数器用于调试重复调用问题
 */
let globalCallCounter = 0;

/**
 * 主函数
 * 负责初始化和启动 MCP 服务器
 */
async function main() {
  try {
    const mainStartId = Math.random().toString(36).substring(2, 8);
    logger.info(`MCP 服务器启动中[${mainStartId}]...`);

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

    logger.debug(`MCP 服务器已创建[${mainStartId}]`);

    // 创建 Confluence 服务实例
    const config = configService.getConfig();
    const commentConfig = configService.getCommentConfig();
    const confluenceService = new ConfluenceService({
      baseUrl: config.baseUrl,
      username: config.username,
      password: config.password,
      accessToken: config.accessToken,
      timeout: config.timeout,
      rejectUnauthorized: config.rejectUnauthorized,
      commentConfig: commentConfig
    });

    // ===========================================
    // 1. 基础信息工具 - 最常用的查询功能
    // ===========================================
    
    server.tool(
      "getSpace",
      "获取指定空间的详细信息",
      { spaceKey: z.string().describe('空间Key（如：DEV, TECH, DOC 等）') },
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
      "getPageByPrettyUrl",
      "通过空间Key和页面标题精确获取页面信息",
      { 
        spaceKey: z.string().describe('空间Key（如：DEV, TECH 等）'),
        title: z.string().describe('页面标题（精确匹配）')
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

    // ===========================================
    // 2. 页面管理工具 - 核心功能
    // ===========================================

    server.tool(
      "managePages",
      "管理Confluence页面，包括创建、更新、删除和查询页面信息",
      {
        action: z.enum(['create', 'update', 'delete', 'get', 'getContent']).describe('操作类型: create=创建页面, update=更新页面, delete=删除页面, get=获取页面基本信息, getContent=获取页面详细内容'),
        // 通用参数
        pageId: z.string().optional().describe('页面ID（用于update/delete/get/getContent操作）'),
        spaceKey: z.string().optional().describe('空间Key（用于create操作，必填）'),
        title: z.string().optional().describe('页面标题（用于create操作必填，update操作可选）'),
        content: z.string().optional().describe('页面内容（用于create操作必填，update操作可选）'),
        // 创建/更新页面参数
        parentId: z.string().optional().describe('父页面ID（可选，用于创建子页面）'),
        representation: z.enum(['storage', 'wiki', 'editor2', 'view', 'markdown']).optional().describe('内容格式: storage=HTML存储格式（推荐）, wiki=Wiki标记语法, editor2=编辑器格式, view=查看格式, markdown=Markdown格式'),
        version: z.number().optional().describe('页面版本号（用于update操作，建议填写以避免冲突）'),
        // 获取页面参数
        expand: z.string().optional().describe('扩展参数（可选，用于指定返回额外信息，如：body.storage,version,space）')
      },
      async ({ action, pageId, spaceKey, title, content, parentId, representation, version, expand }) => {
        try {
          logger.debug(`调用 managePages 工具，参数:`, { action, pageId, spaceKey, title });
          
          let result: any;
          
          switch (action) {
            case 'create':
              if (!spaceKey || !title || !content) {
                throw new Error('创建页面需要 spaceKey、title 和 content 参数');
              }
              result = await confluenceService.createPage({
            spaceKey,
            title,
            content,
            parentId,
            representation
          });
              break;
              
            case 'update':
              if (!pageId) {
                throw new Error('更新页面需要 pageId 参数');
              }
              result = await confluenceService.updatePage({
                id: pageId,
                title,
                content,
                version,
                representation
              });
              break;
              
            case 'delete':
              if (!pageId) {
                throw new Error('删除页面需要 pageId 参数');
              }
              await confluenceService.deletePage(pageId);
              result = { message: `页面 ${pageId} 已成功删除` };
              break;
              
            case 'get':
              if (!pageId) {
                throw new Error('获取页面需要 pageId 参数');
              }
              result = await confluenceService.getPage(pageId);
              break;
              
            case 'getContent':
              if (!pageId) {
                throw new Error('获取页面内容需要 pageId 参数');
              }
              result = await confluenceService.getPageContent(pageId);
              break;
              
            default:
              throw new Error(`不支持的操作: ${action}`);
          }
          
          return {
            content: [{ 
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          const err = error as ErrorResponse;
          return {
            content: [{
              type: "text",
              text: `页面操作失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    // ===========================================
    // 3. 评论管理工具 - 扩展功能
    // ===========================================

    server.tool(
      "manageComments",
      "管理Confluence页面评论，支持普通评论和行内评论的增删改查操作",
      {
        action: z.enum(['create', 'update', 'delete', 'reply']).describe('操作类型: create=创建评论, update=更新评论, delete=删除评论, reply=回复评论'),
        commentType: z.enum(['regular', 'inline']).optional().describe('评论类型: regular=普通评论（默认）, inline=行内评论'),
        // 通用参数
        pageId: z.string().optional().describe('页面ID（用于create/reply操作时必填）'),
        commentId: z.string().optional().describe('评论ID（用于update/delete操作必填，行内评论reply时必填）'),
        content: z.string().optional().describe('评论内容（用于create/update/reply操作必填）'),
        // 普通评论参数
        representation: z.enum(['storage', 'wiki', 'editor2', 'view', 'markdown']).optional().describe('内容格式: storage=HTML存储格式（推荐）, wiki=Wiki标记语法, editor2=编辑器格式, view=查看格式, markdown=Markdown格式'),
        parentCommentId: z.string().optional().describe('父评论ID（用于普通评论的reply操作必填，或创建子评论）'),
        version: z.number().optional().describe('评论版本号（用于update操作，建议填写以避免冲突）'),
        watch: z.boolean().optional().describe('是否监视评论（布尔值，默认false，用于reply操作）'),
        // 行内评论参数
        originalSelection: z.string().optional().describe('原始选中文本（用于创建行内评论时必填）'),
        matchIndex: z.number().optional().describe('匹配索引（当页面有多个相同文本时指定第几个，默认0）'),
        numMatches: z.number().optional().describe('匹配总数（页面中相同文本的总数，默认1）'),
        serializedHighlights: z.string().optional().describe('序列化高亮信息（JSON格式字符串，可选）')
      },
      async ({ action, commentType = 'regular', pageId, commentId, content, representation, parentCommentId, version, watch, originalSelection, matchIndex, numMatches, serializedHighlights }) => {
        try {
          logger.debug(`调用 manageComments 工具，参数:`, { action, commentType, pageId, commentId });
          
          let result: any;
          
          switch (action) {
            case 'create':
              if (commentType === 'inline') {
                if (!pageId || !content || !originalSelection) {
                  throw new Error('创建行内评论需要 pageId、content 和 originalSelection 参数');
                }
                result = await confluenceService.createInlineComment(
                  pageId,
                  content,
                  originalSelection,
                  matchIndex,
                  numMatches,
                  serializedHighlights,
                  parentCommentId
                );
              } else {
                if (!pageId || !content) {
                  throw new Error('创建普通评论需要 pageId 和 content 参数');
                }
                result = await confluenceService.createComment(
                  pageId,
                  content,
                  representation,
                  parentCommentId
                );
              }
              break;
              
            case 'update':
              if (commentType === 'inline') {
                if (!commentId || !content) {
                  throw new Error('更新行内评论需要 commentId 和 content 参数');
                }
                result = await confluenceService.updateInlineComment({
                  commentId,
                  content
                });
              } else {
                if (!commentId || !content) {
                  throw new Error('更新普通评论需要 commentId 和 content 参数');
                }
                result = await confluenceService.updateComment({
                  id: commentId,
            content,
            version,
            representation
          });
              }
              break;
              
            case 'delete':
              if (!commentId) {
                throw new Error('删除评论需要 commentId 参数');
              }
              if (commentType === 'inline') {
                await confluenceService.deleteInlineComment(commentId);
                result = { message: `行内评论 ${commentId} 已成功删除` };
              } else {
                await confluenceService.deleteComment(commentId);
                result = { message: `评论 ${commentId} 已成功删除` };
              }
              break;
              
            case 'reply':
              if (commentType === 'inline') {
                if (!commentId || !pageId || !content) {
                  throw new Error('回复行内评论需要 commentId、pageId 和 content 参数');
                }
                result = await confluenceService.replyInlineComment({
                  commentId,
                  pageId,
                  content
                });
              } else {
                if (!pageId || !parentCommentId || !content) {
                  throw new Error('回复普通评论需要 pageId、parentCommentId 和 content 参数');
                }
                result = await confluenceService.replyComment({
                  pageId,
                  parentCommentId,
                  content,
                  watch
                });
              }
              break;
              
            default:
              throw new Error(`不支持的操作: ${action}`);
          }
          
          return {
            content: [{ 
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          const err = error as ErrorResponse;
          return {
            content: [{
              type: "text",
              text: `评论操作失败: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    server.tool(
      "getPageComments",
      "获取指定页面的所有评论列表",
      {
        pageId: z.string().describe('页面ID'),
        start: z.number().optional().describe('起始位置（分页参数，默认0）'),
        limit: z.number().optional().describe('每页数量（分页参数，默认25）')
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
      "获取指定ID的评论详细信息",
      { commentId: z.string().describe('评论ID') },
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

    // ===========================================
    // 4. 搜索工具 - 专用搜索功能
    // ===========================================

    server.tool(
      "searchContent",
      "在Confluence中搜索内容，支持使用Confluence Query Language (CQL)进行高级搜索",
      { query: z.string().describe('搜索关键词（支持中文和英文，将自动转换为CQL格式）') },
      async ({ query }) => {
        try {
          globalCallCounter++;
          const callId = Math.random().toString(36).substring(2, 8);
          logger.debug(`调用 searchContent 工具[${callId}]，参数: ${query}，全局计数: ${globalCallCounter}`);
          const results = await confluenceService.searchContent(query);
          logger.debug(`searchContent 工具[${callId}]执行完成，全局计数: ${globalCallCounter}`);
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
      "searchComments",
      "在Confluence中搜索评论内容",
      {
        query: z.string().describe('搜索关键词（在评论内容中搜索）'),
        start: z.number().optional().describe('起始位置（分页参数，默认0）'),
        limit: z.number().optional().describe('每页数量（分页参数，默认25）'),
        spaceKey: z.string().optional().describe('限定搜索的空间Key（可选）')
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