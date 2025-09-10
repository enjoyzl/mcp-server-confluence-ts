# Confluence MCP 服务器配置指南

## 环境变量配置

在项目根目录创建 `.env` 文件，配置以下参数：

## 配置示例

```env
# ===========================================
# Confluence 连接配置
# ===========================================
CONFLUENCE_URL=https://your-confluence.com
CONFLUENCE_USERNAME=your-username
CONFLUENCE_PASSWORD=your-password

# 或者使用访问令牌（推荐用于生产环境）
# CONFLUENCE_ACCESS_TOKEN=your-access-token

# 请求超时时间（毫秒）
TIMEOUT=10000

# 是否验证SSL证书（生产环境建议为true）
REJECT_UNAUTHORIZED=true

# ===========================================
# 服务器配置
# ===========================================
PORT=3000
NODE_ENV=development
SERVER_TIMEOUT=10000

# ===========================================
# 评论 API 策略配置
# ===========================================

# 评论API实现策略
# - standard: 使用标准REST API（默认，推荐生产环境）
# - tinymce: 使用TinyMCE端点（功能更丰富）
# - auto: 自动选择（优先TinyMCE，失败时回退到标准API）
COMMENT_API_STRATEGY=standard

# 是否启用回退机制
# - true: 当首选API失败时，自动尝试备用API（默认）
# - false: 只使用指定的API，失败时直接抛出错误
COMMENT_ENABLE_FALLBACK=true

# 评论请求超时时间（毫秒）
# 建议标准API使用10-15秒，TinyMCE API使用15-20秒
COMMENT_TIMEOUT=15000
```

## 配置说明

### 必需配置

#### Confluence 连接
- `CONFLUENCE_URL`: Confluence 服务器地址（必填）
- 认证方式（二选一）：
  - 用户名密码：`CONFLUENCE_USERNAME` + `CONFLUENCE_PASSWORD`
  - 访问令牌：`CONFLUENCE_ACCESS_TOKEN`（推荐）

### 可选配置

#### 连接设置
- `TIMEOUT`: 请求超时时间，默认 10000 毫秒
- `REJECT_UNAUTHORIZED`: 是否验证SSL证书，默认 true

#### 服务器设置
- `PORT`: 服务器端口，默认 3000
- `NODE_ENV`: 运行环境，development 或 production，默认 development
- `SERVER_TIMEOUT`: 服务器超时时间，默认 10000 毫秒

#### 评论策略设置
- `COMMENT_API_STRATEGY`: 评论API策略，默认 standard
- `COMMENT_ENABLE_FALLBACK`: 启用回退机制，默认 true
- `COMMENT_TIMEOUT`: 评论请求超时，默认 15000 毫秒

## 评论策略详解

### 1. Standard API (standard)
**推荐用于生产环境**

- ✅ 兼容性好，适合 Confluence 7.4+
- ✅ 稳定性高，错误处理完善
- ✅ 标准化实现，易于维护
- ❌ 功能相对基础

**适用场景**：
- 生产环境
- 需要高稳定性的应用
- Confluence 7.4+ 版本

### 2. TinyMCE API (tinymce)
**功能最丰富**

- ✅ 功能完整，模拟浏览器行为
- ✅ 支持复杂的评论格式
- ✅ 与Confluence Web界面行为一致
- ❌ 兼容性依赖较强
- ❌ 可能有版本兼容问题

**适用场景**：
- 开发环境测试
- 需要完整功能的应用
- 与Web界面行为保持一致

### 3. Auto Strategy (auto)
**自动选择最佳策略**

- ✅ 平衡功能性和兼容性
- ✅ 优先使用TinyMCE，失败时回退
- ✅ 适应不同环境
- ❌ 可能增加请求延迟

**适用场景**：
- 多环境部署
- 不确定Confluence版本特性
- 希望最大化功能可用性

## 回退机制

当 `COMMENT_ENABLE_FALLBACK=true` 时：

1. **Standard → TinyMCE**: 如果标准API失败，自动尝试TinyMCE API
2. **TinyMCE → Standard**: 如果TinyMCE API失败，自动回退到标准API
3. **Auto**: 自动在两种API间切换

## 超时配置建议

### 标准API
- **开发环境**: 10-15 秒
- **生产环境**: 15-20 秒

### TinyMCE API
- **开发环境**: 15-20 秒
- **生产环境**: 20-30 秒

### 影响因素
- 网络延迟
- Confluence 服务器性能
- 认证方式（Token vs 用户名密码）
- 请求复杂度

## 安全建议

### 认证
- ✅ 生产环境使用访问令牌
- ✅ 定期更换密码/令牌
- ❌ 避免在代码中硬编码凭据

### SSL/TLS
- ✅ 生产环境启用 `REJECT_UNAUTHORIZED=true`
- ✅ 使用HTTPS连接
- ❌ 开发环境可设置为false便于调试

### 环境变量
- ✅ 使用 .env 文件管理配置
- ✅ 将 .env 添加到 .gitignore
- ❌ 不要提交包含敏感信息的配置文件

## 故障排除

### 连接失败
1. 检查 `CONFLUENCE_URL` 是否正确
2. 验证认证信息
3. 确认网络连通性
4. 检查SSL证书设置

### 评论功能异常
1. 尝试切换评论策略
2. 启用回退机制
3. 增加超时时间
4. 查看详细错误日志

### 性能问题
1. 调整超时设置
2. 使用标准API提高稳定性
3. 检查Confluence服务器负载
4. 优化网络连接 