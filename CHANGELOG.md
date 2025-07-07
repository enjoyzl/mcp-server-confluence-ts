# 更新日志

## [未发布] Markdown 格式支持

### 🆕 新增功能

#### Markdown 完整支持
- **页面管理**: `managePages` 工具现在支持 `representation: "markdown"`
- **评论管理**: `manageComments` 工具全面支持 Markdown 格式
  - 普通评论：创建、更新、回复
  - 行内评论：创建、更新、回复
- **智能检测**: 自动识别 Markdown 语法，无需明确指定格式
- **安全转换**: 使用 `marked` 库安全转换为 HTML

#### 技术实现
- 新增 `MarkdownUtils` 工具类
- 支持 GitHub Flavored Markdown (GFM)
- 内置 XSS 安全防护
- 自动过滤恶意脚本和标签

#### 支持的 Markdown 语法
- ✅ 标题（# ## ### 等）
- ✅ 文本格式（**粗体** *斜体* ~~删除线~~）
- ✅ 列表（有序和无序）
- ✅ 链接和图片
- ✅ 代码块和行内代码
- ✅ 引用块
- ✅ 表格
- ✅ 分割线

### 🔧 技术改进
- 更新所有相关类型定义，添加 `markdown` 格式支持
- 增强内容格式处理能力
- 新增依赖：`marked` 和 `@types/marked`
- **修复**: 移除已过时的 marked 配置选项（`headerIds`, `mangle`），确保与 marked v16.x 兼容

### 📚 文档更新
- 新增 [Markdown 支持功能文档](docs/MARKDOWN-SUPPORT.md)
- 更新 README.md 添加 Markdown 示例
- 更新参数说明文档

### 🛡️ 安全特性
- 自动移除 `<script>` 和 `<iframe>` 标签
- 过滤 `javascript:` 协议
- 移除事件处理器属性

---

## [2024-12-19] 文档架构优化

### 📚 文档更新内容

#### 1. README.md 架构重构
- **功能特性章节**：重新组织为6个主要模块
  - 🔐 认证方式
  - 🔧 MCP 工具架构（已优化）
  - 📄 页面管理功能
  - 💬 评论管理功能
  - 🔍 搜索功能
  - ⚡ 性能优化
  - 📊 日志和监控

#### 2. MCP 工具使用指南全新改版
- **工具架构可视化**：按功能和使用频率重新分组
- **完整JSON示例**：提供所有工具的标准MCP调用格式
- **参数详细说明**：包含action、commentType、representation等参数
- **优化亮点总结**：突出显示工具合并成果

#### 3. 工具概览章节
- **分组展示**：4个功能组的清晰划分
- **优化成果统计**：量化展示改进效果
- **功能标记**：⭐️ 标记重要和新增功能

### 🎯 更新亮点

#### 架构优化成果
- **工具数量优化**: 从12个工具合并为8个（减少33%）
- **API统一设计**: 通过action参数区分操作类型
- **功能增强**: 新增页面删除功能
- **体验提升**: 按使用频率排序，提高查找效率

#### 文档结构优化
- **视觉化改进**: 使用emoji和标记增强可读性
- **内容重组**: 按逻辑分组重新组织内容
- **示例完善**: 提供标准MCP JSON调用格式
- **导航优化**: 更新目录链接，提升导航体验

### 📝 技术文档改进

#### 工具分组架构
```
📁 1. 基础信息工具（最常用）
   ├── getSpace
   └── getPageByPrettyUrl

📁 2. 页面管理工具（核心功能）
   └── managePages ⭐️

📁 3. 评论管理工具（扩展功能）
   ├── manageComments ⭐️
   ├── getPageComments
   └── getComment

📁 4. 搜索工具（专用搜索）
   ├── searchContent
   └── searchComments
```

#### 合并工具详细说明
- **managePages**: 统一管理create/update/delete/get/getContent操作
- **manageComments**: 统一管理普通评论+行内评论的所有操作

### 🔄 向后兼容性
- 保持所有原有功能完整性
- API调用方式统一化
- 错误处理机制增强
- 参数验证智能化

### 📖 相关文档
- [MCP Inspector 调试参数指南](docs/DEBUG-PARAMETER-GUIDE.md)
- [页面管理功能使用指南](docs/pages-management-example.md)
- [评论功能使用指南](docs/comments-merged-example.md)
- [搜索功能故障排除](docs/SEARCH-TROUBLESHOOTING.md)

---

本次更新重点优化了文档结构和内容展示，使用户能够更快速地理解和使用MCP Confluence服务的各项功能。 