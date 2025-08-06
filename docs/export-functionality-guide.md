# Confluence Markdown 导出功能指南

## 概述

Confluence MCP 服务现在支持将 Confluence 页面导出为 Markdown 文件到当前工作空间。此功能支持单页面导出、层次结构导出、批量导出以及按章节拆分等多种导出模式。

## 功能特性

### ✨ 核心功能
- **单页面导出**: 导出指定的 Confluence 页面为 Markdown 文件
- **层次结构导出**: 递归导出页面及其所有子页面，保持目录结构
- **批量导出**: 同时导出多个指定的页面
- **章节拆分**: 根据标题级别将大页面拆分为多个文件

### 🛠️ 高级特性
- **智能内容转换**: HTML 到 Markdown 的高质量转换
- **元数据保留**: 可选的 YAML frontmatter，包含页面元信息
- **文件冲突处理**: 自动重命名或覆盖现有文件
- **进度跟踪**: 实时显示导出进度和状态
- **错误处理**: 详细的错误报告和部分失败处理
- **性能优化**: 并发控制、重试机制、内存优化

## MCP 工具

### 1. exportPage - 单页面导出

导出单个 Confluence 页面为 Markdown 文件。

#### 参数

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `pageId` | string | 否* | 页面ID |
| `spaceKey` | string | 否* | 空间Key（与title配合使用） |
| `title` | string | 否* | 页面标题（与spaceKey配合使用） |
| `outputDir` | string | 否 | 输出目录，默认"confluence-export" |
| `overwrite` | boolean | 否 | 是否覆盖现有文件，默认false |
| `includeMetadata` | boolean | 否 | 是否包含元数据，默认true |
| `preserveAttachments` | boolean | 否 | 是否保留附件信息，默认true |
| `splitByChapters` | boolean | 否 | 是否按章节拆分，默认false |
| `splitLevel` | '1'\|'2'\|'3' | 否 | 拆分级别，默认'2' |

*注：必须提供 `pageId` 或者 `spaceKey` + `title`

#### 使用示例

```json
// 通过页面ID导出
{
  "pageId": "123456789",
  "outputDir": "my-docs",
  "includeMetadata": true
}

// 通过空间和标题导出
{
  "spaceKey": "TECH",
  "title": "API Documentation",
  "splitByChapters": true,
  "splitLevel": "2"
}

// 导出并按章节拆分
{
  "pageId": "987654321",
  "splitByChapters": true,
  "splitLevel": "1",
  "outputDir": "split-docs"
}
```

### 2. exportPageHierarchy - 层次结构导出

导出页面及其所有子页面，保持层次结构。

#### 参数

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `pageId` | string | 是 | 根页面ID |
| `outputDir` | string | 否 | 输出目录，默认"confluence-export" |
| `overwrite` | boolean | 否 | 是否覆盖现有文件，默认false |
| `includeMetadata` | boolean | 否 | 是否包含元数据，默认true |
| `preserveAttachments` | boolean | 否 | 是否保留附件信息，默认true |
| `maxDepth` | number | 否 | 最大递归深度，默认5 |
| `includeChildren` | boolean | 否 | 是否包含子页面，默认true |

#### 使用示例

```json
// 导出完整的文档树
{
  "pageId": "123456789",
  "maxDepth": 3,
  "outputDir": "documentation-tree"
}

// 只导出根页面，不包含子页面
{
  "pageId": "123456789",
  "includeChildren": false
}
```

### 3. batchExportPages - 批量导出

同时导出多个指定的页面。

#### 参数

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `pageIds` | string[] | 是 | 页面ID数组 |
| `outputDir` | string | 否 | 输出目录，默认"confluence-export" |
| `overwrite` | boolean | 否 | 是否覆盖现有文件，默认false |
| `includeMetadata` | boolean | 否 | 是否包含元数据，默认true |
| `preserveAttachments` | boolean | 否 | 是否保留附件信息，默认true |
| `concurrency` | number | 否 | 并发处理数量，默认3 |

#### 使用示例

```json
// 批量导出多个页面
{
  "pageIds": ["123456789", "987654321", "456789123"],
  "concurrency": 2,
  "outputDir": "batch-export"
}

// 高并发批量导出
{
  "pageIds": ["111", "222", "333", "444", "555"],
  "concurrency": 5,
  "overwrite": true
}
```

## 输出格式

### 文件结构

```
confluence-export/
├── Page_Title.md                    # 单页面导出
├── Documentation_Tree/              # 层次结构导出
│   ├── Root_Page.md
│   ├── Chapter_1/
│   │   ├── Chapter_1.md
│   │   └── Subsection_1.md
│   └── Chapter_2/
│       └── Chapter_2.md
└── Split_Page/                      # 章节拆分导出
    ├── README.md                    # 章节索引
    ├── 01_introduction.md
    ├── 02_getting_started.md
    └── 03_advanced_topics.md
```

### Markdown 格式

#### 带元数据的文件示例

```markdown
---
title: "API Documentation"
confluence_page_id: "123456789"
confluence_url: "/spaces/TECH/pages/123456789/API+Documentation"
space_key: "TECH"
space_name: "Technical Documentation"
author: "John Doe"
created_date: "2023-01-01T10:00:00.000Z"
modified_date: "2023-12-01T15:30:00.000Z"
version: 5
export_date: "2023-12-01T16:00:00.000Z"
---

# API Documentation

This is the main content of the page...

## Getting Started

Instructions for getting started...
```

#### 章节拆分的索引文件示例

```markdown
# API Documentation

> 原始页面: [API Documentation](/spaces/TECH/pages/123456789/API+Documentation)
> 导出时间: 2023-12-01T16:00:00.000Z
> 章节数量: 3

## 目录

1. [Introduction](./01_introduction.md)
2. [Getting Started](./02_getting_started.md)
3. [Advanced Topics](./03_advanced_topics.md)

---

[页面元数据...]
```

## 最佳实践

### 1. 选择合适的导出方式

- **单页面导出**: 适用于独立的文档页面
- **层次结构导出**: 适用于有组织的文档树
- **批量导出**: 适用于需要导出多个不相关的页面
- **章节拆分**: 适用于长文档，便于管理和阅读

### 2. 性能优化建议

- 批量导出时，建议并发数不超过5，避免API限制
- 对于大型页面，启用章节拆分可以提高处理效率
- 定期清理导出目录，避免文件冲突

### 3. 文件管理

- 使用有意义的输出目录名称
- 启用元数据保留，便于追踪页面来源
- 定期备份导出的文档

### 4. 错误处理

- 检查导出结果中的错误信息
- 对于部分失败的批量导出，可以重新导出失败的页面
- 网络问题导致的失败会自动重试

## 故障排除

### 常见问题

#### 1. 页面未找到
```
错误: 页面未找到: 123456789
解决: 检查页面ID是否正确，或者页面是否已被删除
```

#### 2. 权限不足
```
错误: 没有权限访问页面: Page Title (123456789)
解决: 确保用户有访问该页面的权限
```

#### 3. 文件写入失败
```
错误: 文件写入失败: /path/to/file.md
解决: 检查目录权限，确保有写入权限
```

#### 4. 内容转换失败
```
错误: 内容转换失败: Page Title
解决: 页面可能包含不支持的HTML元素，检查原始页面内容
```

### 性能问题

#### 1. 导出速度慢
- 减少并发数量
- 检查网络连接
- 分批处理大量页面

#### 2. 内存使用过高
- 避免同时导出过多大页面
- 启用章节拆分处理大文档
- 定期重启服务

### 调试技巧

1. **启用调试日志**
   ```bash
   DEBUG=* npx @modelcontextprotocol/inspector node dist/index.js
   ```

2. **检查导出摘要**
   - 查看成功/失败统计
   - 检查文件大小和数量
   - 分析耗时信息

3. **验证输出文件**
   - 检查Markdown语法
   - 验证链接和图片引用
   - 确认元数据完整性

## 更新日志

### v1.1.0 (2023-12-01)
- ✅ 新增章节拆分导出功能
- ✅ 新增层次结构导出功能
- ✅ 新增批量导出功能
- ✅ 优化性能和内存使用
- ✅ 改进错误处理和进度跟踪
- ✅ 支持大文件流式处理

### v1.0.0 (2023-11-01)
- ✅ 基础单页面导出功能
- ✅ HTML到Markdown转换
- ✅ 元数据保留功能
- ✅ 文件冲突处理

## 技术支持

如果遇到问题或需要帮助，请：

1. 查看本文档的故障排除部分
2. 检查服务器日志获取详细错误信息
3. 确认Confluence连接配置正确
4. 验证用户权限设置

---

*本文档随功能更新而持续维护*