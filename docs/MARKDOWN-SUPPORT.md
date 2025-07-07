# Markdown 格式支持功能

## 🚀 概述

现在 mcp-server-confluence-ts 已完全支持 **Markdown 格式**，可以在创建和更新页面、评论时使用 Markdown 语法，系统会自动将其转换为 Confluence 支持的 HTML 存储格式。

### 🎯 主要特性
- **智能检测**: 自动识别 Markdown 格式内容
- **安全转换**: 内置安全过滤，防止 XSS 攻击
- **全面兼容**: 支持 GitHub Flavored Markdown (GFM)
- **无缝集成**: 与现有 API 完全兼容

## 📁 支持范围

### 1. 页面管理
- ✅ 创建页面 (`managePages` action: `create`)
- ✅ 更新页面 (`managePages` action: `update`)

### 2. 评论管理  
- ✅ 创建普通评论 (`manageComments` action: `create`, commentType: `regular`)
- ✅ 更新普通评论 (`manageComments` action: `update`, commentType: `regular`)
- ✅ 回复普通评论 (`manageComments` action: `reply`, commentType: `regular`)
- ✅ 创建行内评论 (`manageComments` action: `create`, commentType: `inline`)
- ✅ 更新行内评论 (`manageComments` action: `update`, commentType: `inline`)
- ✅ 回复行内评论 (`manageComments` action: `reply`, commentType: `inline`)

## 🔧 使用方法

### 方式一：明确指定 Markdown 格式

```json
{
  "name": "managePages",
  "arguments": {
    "action": "create",
    "spaceKey": "DEV",
    "title": "API 文档",
    "content": "# API 接口说明\n\n## 用户管理\n\n### 创建用户\n\n```javascript\nPOST /api/users\n```\n\n**参数说明:**\n\n| 参数名 | 类型 | 必填 | 说明 |\n|--------|------|------|------|\n| name | string | ✅ | 用户名 |\n| email | string | ✅ | 邮箱 |\n\n> **注意**: 邮箱必须唯一",
    "representation": "markdown"
  }
}
```

### 方式二：自动检测

系统会自动检测内容中的 Markdown 语法：

```json
{
  "name": "manageComments",
  "arguments": {
    "action": "create",
    "pageId": "123456",
    "content": "## 代码审查意见\n\n这段代码有以下问题：\n\n- **性能问题**: 使用了同步 I/O\n- **安全问题**: 没有输入验证\n\n建议修改为：\n\n```javascript\n// 异步处理\nconst result = await processData(input);\n```"
  }
}
```

## 📝 支持的 Markdown 语法

### 1. 标题
```markdown
# 一级标题
## 二级标题
### 三级标题
#### 四级标题
##### 五级标题
###### 六级标题
```

### 2. 文本格式
```markdown
**粗体文本**
*斜体文本*
~~删除线~~
`行内代码`
```

### 3. 列表
```markdown
# 无序列表
- 项目一
- 项目二
  - 子项目
  - 子项目

# 有序列表  
1. 第一项
2. 第二项
   1. 子项目
   2. 子项目
```

### 4. 链接和图片
```markdown
[链接文本](http://example.com)
![图片描述](http://example.com/image.png)
```

### 5. 代码块
```markdown
```javascript
function hello() {
  console.log('Hello, World!');
}
```
```

### 6. 引用
```markdown
> 这是一个引用
> 可以跨越多行
```

### 7. 表格
```markdown
| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 数据1 | 数据2 | 数据3 |
| 数据4 | 数据5 | 数据6 |
```

### 8. 分割线
```markdown
---
```

## 🛡️ 安全特性

系统内置了安全过滤机制：

- ❌ 自动移除 `<script>` 标签
- ❌ 自动移除 `<iframe>` 标签  
- ❌ 过滤 `javascript:` 协议
- ❌ 移除事件处理器属性 (`onclick`, `onload` 等)

## 📋 使用示例

### 创建技术文档页面

```json
{
  "name": "managePages",
  "arguments": {
    "action": "create",
    "spaceKey": "TECH",
    "title": "Redis 缓存策略",
    "representation": "markdown",
    "content": "# Redis 缓存策略\n\n## 缓存模式\n\n### 1. Cache-Aside\n\n```python\ndef get_user(user_id):\n    # 先查缓存\n    user = redis.get(f'user:{user_id}')\n    if user:\n        return json.loads(user)\n    \n    # 缓存未命中，查数据库\n    user = db.get_user(user_id)\n    if user:\n        # 写入缓存\n        redis.setex(f'user:{user_id}', 3600, json.dumps(user))\n    \n    return user\n```\n\n### 优缺点对比\n\n| 模式 | 优点 | 缺点 |\n|------|------|------|\n| Cache-Aside | 简单可控 | 代码冗余 |\n| Write-Through | 数据一致性好 | 写性能差 |\n| Write-Behind | 写性能好 | 可能丢数据 |\n\n> **最佳实践**: 根据业务场景选择合适的缓存模式"
  }
}
```

### 创建代码审查评论

```json
{
  "name": "manageComments", 
  "arguments": {
    "action": "create",
    "pageId": "789012",
    "content": "## 代码审查反馈\n\n### ✅ 优点\n\n- 代码结构清晰\n- 错误处理完善\n- 测试覆盖率高\n\n### 🔧 改进建议\n\n1. **性能优化**\n   ```javascript\n   // 建议使用批量操作\n   const results = await Promise.all(items.map(processItem));\n   ```\n\n2. **类型安全**\n   - 添加 TypeScript 类型定义\n   - 使用接口约束参数\n\n### 📝 总结\n\n总体质量很好，建议合并到主分支。",
    "representation": "markdown"
  }
}
```

### 创建行内评论

```json
{
  "name": "manageComments",
  "arguments": {
    "action": "create", 
    "commentType": "inline",
    "pageId": "345678",
    "content": "**建议**: 这里应该使用 `async/await` 替代 Promise 链式调用：\n\n```javascript\n// 推荐写法\ntry {\n  const data = await fetchData();\n  const result = await processData(data);\n  return result;\n} catch (error) {\n  handleError(error);\n}\n```",
    "originalSelection": "getData().then(processData).catch(handleError)"
  }
}
```

## 🔄 转换过程

1. **检测阶段**: 系统检测内容是否包含 Markdown 语法
2. **清理阶段**: 移除潜在的不安全内容
3. **转换阶段**: 使用 `marked` 库将 Markdown 转换为 HTML
4. **存储阶段**: 以 `storage` 格式存储到 Confluence

## 🔧 技术实现细节

### Markdown 解析器配置

使用 `marked` 库（v16.x）进行 Markdown 解析，主要配置：

- `gfm: true` - 启用 GitHub Flavored Markdown 支持
- `breaks: true` - 支持单行换行转换为 `<br>` 标签

**重要说明**: 从 marked v8.0.0 开始，部分选项已被移除：
- `headerIds` - 如需标题 ID 功能，请使用 `marked-gfm-heading-id` 扩展
- `mangle` - 如需邮箱混淆功能，请使用 `marked-mangle` 扩展

### 依赖信息
- **marked**: ^16.0.0（核心 Markdown 解析）
- **@types/marked**: ^5.0.0（TypeScript 类型定义）

## ⚠️ 注意事项

### 1. 格式限制
- Confluence 不支持所有 HTML 标签，某些复杂的 Markdown 功能可能显示异常
- 建议使用基础的 Markdown 语法以确保最佳兼容性

### 2. 性能考虑
- Markdown 转换会增加少量处理时间
- 大文档建议分段处理

### 3. 最佳实践
- 明确指定 `representation: "markdown"` 以获得最佳体验
- 预览大文档的转换结果
- 在测试环境先验证复杂的 Markdown 内容

## 🐛 故障排除

### 问题：Markdown 未被识别
**解决方案**: 明确设置 `representation: "markdown"`

### 问题：部分语法显示异常
**解决方案**: 检查是否使用了 Confluence 不支持的 HTML 标签

### 问题：代码块格式错误  
**解决方案**: 确保代码块使用三个反引号包围，并指定语言类型

## 📞 支持信息

- **功能版本**: v1.1.0+
- **依赖库**: marked ^4.0.0
- **兼容性**: 所有 Confluence 版本
- **维护状态**: ✅ 积极维护

---

*最后更新：2025年1月20日* 