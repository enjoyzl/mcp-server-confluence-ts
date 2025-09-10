# Confluence 7.4 故障排除指南

## 概述

本文档记录了在Confluence 7.4环境中使用mcp-server-confluence-ts时遇到的常见问题和解决方案。

## 常见问题

### 1. 评论创建超时问题

**症状：**
- 创建评论时返回500错误
- 后台日志显示StuckThreadDetectionValve警告
- 线程活跃时间超过60秒

**原因分析：**
```
20-Jun-2025 10:58:12.323 WARNING [Catalina-utility-4] 
org.apache.catalina.valves.StuckThreadDetectionValve.notifyStuckThreadDetected 
Thread [http-nio-8095-exec-668] (id=[255585]) has been active for [67,605] milliseconds
```

这是由于Confluence 7.4的权限系统在处理复杂权限继承时存在性能问题：
- 权限检查中的Hibernate级联操作导致数据库查询时间过长
- TinyMCE宏预览功能触发了复杂的权限验证流程
- IndexMacro.fetchPages()方法在获取可访问页面时卡死

**解决方案：**

1. **超时控制**：在评论创建请求中添加30秒超时限制
2. **备用端点**：使用页面特定的评论创建端点作为fallback
3. **重试策略优化**：减少重试次数（2次），增加重试间隔（2秒）
4. **错误处理增强**：提供更友好的错误信息

### 2. 权限验证性能问题

**症状：**
- 页面访问检查缓慢
- 内容权限验证超时
- 权限相关的数据库查询执行时间过长

**技术分析：**
```java
com.atlassian.confluence.security.persistence.dao.hibernate.HibernateContentPermissionSetDao.getInheritedContentPermissionSets
com.atlassian.confluence.core.DefaultContentPermissionManager.hasContentLevelPermission
```

**解决方案：**

1. **缓存优化**：
   ```typescript
   // 增加权限检查结果的缓存时间
   private readonly cacheTTL: number = 5 * 60 * 1000; // 5分钟缓存
   ```

2. **避免复杂权限查询**：
   ```typescript
   // 简化数据结构，减少权限验证复杂度
   const data = {
     type: 'comment',
     container: { id: pageId },
     body: { [representation]: { value: content, representation } },
     ...(parentCommentId && { ancestors: [{ id: parentCommentId }] })
   };
   ```

### 3. TinyMCE宏预览问题

**症状：**
- `/rest/tinymce/1/macro/preview`端点响应缓慢
- IndexMacro执行超时
- 宏预览功能不可用

**解决方案：**

1. **避免触发宏预览**：
   - 在评论内容中避免使用复杂的宏
   - 使用简单的storage格式内容
   - 减少页面引用和链接

2. **API优化**：
   ```typescript
   // 使用更简单的内容格式
   const content = "注意性能和测试"; // 避免复杂的HTML或宏
   ```

## 最佳实践

### 1. 超时控制

```typescript
// 为所有API调用添加超时控制
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Operation timeout')), 30000);
});

const response = await Promise.race([apiCall, timeoutPromise]);
```

### 2. 错误处理

```typescript
// 提供详细的错误信息和恢复建议
if (error.response?.status === 500) {
  throw new Error(`服务器内部错误: ${error.message}. 请稍后重试或联系管理员。`);
}
```

### 3. 性能监控

```typescript
// 记录操作耗时
const startTime = Date.now();
try {
  const result = await operation();
  this.logger.debug(`Operation completed in ${Date.now() - startTime}ms`);
  return result;
} catch (error) {
  this.logger.error(`Operation failed after ${Date.now() - startTime}ms:`, error);
  throw error;
}
```

## 环境配置建议

### 1. Confluence设置

```xml
<!-- 在confluence.cfg.xml中增加超时设置 -->
<property name="confluence.request.timeout">30000</property>
<property name="confluence.database.timeout">15000</property>
```

### 2. 数据库优化

```sql
-- 为权限相关表添加索引
CREATE INDEX idx_content_permission_set ON contentpermissions(contentid, permtype);
CREATE INDEX idx_content_permission_user ON contentpermissions(username, permtype);
```

### 3. JVM调优

```bash
# 增加内存分配和垃圾回收优化
-Xms2g -Xmx4g
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200
```

## 故障诊断步骤

1. **检查日志**：
   - 查看Confluence后台日志
   - 搜索StuckThreadDetectionValve警告
   - 分析权限相关的错误堆栈

2. **性能分析**：
   - 监控数据库查询时间
   - 检查内存使用情况
   - 分析线程池状态

3. **功能测试**：
   - 测试简单的评论创建
   - 验证权限检查功能
   - 确认API响应时间

## 联系支持

如果问题仍然存在，请提供以下信息：
- Confluence版本信息
- 详细的错误日志
- 操作步骤重现
- 系统环境配置

---

*更新时间：2025年6月* 