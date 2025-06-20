# 搜索功能故障排除指南

## 问题: searchContent 返回 400 错误

### 错误现象
```json
{
  "content": [
    {
      "type": "text",
      "text": "搜索内容失败: Request failed with status code 400"
    }
  ],
  "isError": true
}
```

## 🔍 可能的原因和解决方案

### 1. CQL 查询语法错误

**原因**: Confluence 使用 CQL (Confluence Query Language) 进行搜索，直接传入中文可能导致语法错误。

**解决方案**: 已在代码中添加自动 CQL 转换：
- 简单文本查询会自动转换为 `text ~ "查询词"`
- 支持 CQL 语法错误时的回退机制

### 2. 认证问题

**检查步骤**:
```bash
# 检查环境变量是否正确设置
echo $CONFLUENCE_URL
echo $CONFLUENCE_USERNAME  
echo $CONFLUENCE_ACCESS_TOKEN
```

**常见问题**:
- Access Token 过期或无效
- 用户名/密码不正确
- Base URL 格式错误

### 3. 权限问题

**症状**: 用户没有搜索权限
**解决**: 确保 Confluence 用户有以下权限：
- 查看空间权限
- 搜索权限
- 查看页面权限

### 4. Confluence 版本兼容性

**支持版本**: Confluence 7.4+
**API 端点**: `/rest/api/content/search`

## 🛠️ 调试步骤

### 步骤 1: 检查配置
```bash
# 验证 Confluence 连接
curl -X GET "$CONFLUENCE_URL/rest/api/space" \
  -H "Authorization: Bearer $CONFLUENCE_ACCESS_TOKEN" \
  -H "Accept: application/json"
```

### 步骤 2: 测试基本搜索
```bash
# 手动测试搜索 API
curl -X GET "$CONFLUENCE_URL/rest/api/content/search?cql=text~\"test\"" \
  -H "Authorization: Bearer $CONFLUENCE_ACCESS_TOKEN" \
  -H "Accept: application/json"
```

### 步骤 3: 查看详细日志
启动服务器并查看日志输出：
```bash
npm run build
npm run inspector:dev  # 带详细日志
```

查找日志中的以下信息：
- 原始查询词
- 转换后的 CQL
- HTTP 状态码
- 错误详情

## 🔧 修复措施

### 已实现的改进

1. **自动 CQL 转换**
   ```typescript
   // 自动将简单查询转换为 CQL 语法
   if (!cql.includes('type') && !cql.includes('space')) {
     cql = `text ~ "${query.replace(/"/g, '\\"')}"`;
   }
   ```

2. **错误回退机制**
   ```typescript
   // 如果 CQL 错误，尝试基本文本搜索
   if (error.response?.status === 400) {
     const fallbackCql = `text ~ "${query.replace(/"/g, '\\"')}"`;
     // 重试搜索...
   }
   ```

3. **详细错误日志**
   - 记录原始查询
   - 记录转换后的 CQL
   - 记录完整错误信息

### 建议的 CQL 查询格式

```typescript
// ✅ 正确的查询格式
"text ~ \"限流\""                    // 文本搜索
"title ~ \"API\" AND type = page"    // 标题搜索
"space = \"DEV\" AND text ~ \"限流\"" // 限定空间搜索
"type = page AND creator = username"  // 按创建者搜索

// ❌ 可能导致错误的格式  
"限流"                              // 直接中文
"text~限流"                         // 缺少引号和空格
```

## 📝 测试用例

### 测试 1: 基本文本搜索
```json
{
  "name": "searchContent",
  "arguments": {
    "query": "限流"
  }
}
```

### 测试 2: CQL 格式搜索
```json
{
  "name": "searchContent", 
  "arguments": {
    "query": "text ~ \"限流\" AND type = page"
  }
}
```

### 测试 3: 英文搜索
```json
{
  "name": "searchContent",
  "arguments": {
    "query": "API"
  }
}
```

## 🚨 紧急解决方案

如果搜索功能仍然无法工作，可以尝试以下临时方案：

### 方案 1: 使用其他工具
```json
// 获取特定空间的所有页面
{
  "name": "getSpace",
  "arguments": {
    "spaceKey": "YOUR_SPACE_KEY"
  }
}
```

### 方案 2: 直接访问页面
```json
// 如果知道页面 ID
{
  "name": "getPage", 
  "arguments": {
    "pageId": "PAGE_ID"
  }
}
```

### 方案 3: 使用 Pretty URL
```json
// 通过标题搜索
{
  "name": "getPageByPrettyUrl",
  "arguments": {
    "spaceKey": "SPACE_KEY",
    "title": "页面标题"
  }
}
```

## 📞 获取帮助

如果问题仍然存在，请提供以下信息：

1. Confluence 版本
2. 完整的错误日志
3. 使用的查询词
4. 认证方式（Token/用户名密码）
5. 用户权限级别

这将帮助我们快速定位和解决问题。 