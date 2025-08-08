# 产品概述

## 项目简介
MCP Confluence 服务是一个基于 Model Context Protocol (MCP) 的 Confluence API 服务实现。该服务为 AI 助手提供了与 Atlassian Confluence 进行交互的能力。

## 核心功能
- **页面管理**: 创建、更新、删除和查询 Confluence 页面
- **评论系统**: 支持普通评论和行内评论的完整生命周期管理
- **搜索功能**: 全文搜索内容和评论，支持 CQL 语法
- **导出功能**: 将 Confluence 页面导出为 Markdown 文件，支持宏处理
- **空间管理**: 获取和管理 Confluence 空间信息

## 技术特色
- **MCP 协议**: 基于 Model Context Protocol 标准，为 AI 应用提供标准化接口
- **智能宏处理**: 自动识别和转换 Confluence 宏为 Markdown 格式
- **多种认证方式**: 支持 Access Token 和用户名密码认证
- **性能优化**: 包含缓存、连接复用、请求压缩等优化机制
- **错误恢复**: 完善的错误处理和回退机制

## 目标用户
- AI 开发者和研究人员
- 需要自动化 Confluence 操作的团队
- 希望将 Confluence 内容集成到 AI 工作流的用户

## 部署方式
- 作为 MCP 服务器运行，通过 Cursor IDE 或其他 MCP 客户端调用
- 支持本地部署和 Docker 容器化部署
- 可通过 Smithery 包管理器快速安装和配置