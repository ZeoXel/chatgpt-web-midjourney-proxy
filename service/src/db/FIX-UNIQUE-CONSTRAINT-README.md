# 修复数据库唯一约束问题

## 问题描述

错误信息：
```
Error: API error: 500 - {"success":false,"error":"Failed to create/update asset","details":"there is no unique or exclusion constraint matching the ON CONFLICT specification"}
```

**根本原因**：
- 后端代码使用 `onConflict: 'user_id,service,task_id'` 进行 UPSERT 操作
- 数据库表 `ai_assets` 只有 `task_id` 的单字段唯一索引
- 缺少 `(user_id, service, task_id)` 的复合唯一约束

## 解决方案

### 步骤 1：登录 Supabase Dashboard

1. 打开浏览器，访问 [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. 登录你的账号
3. 选择对应的项目

### 步骤 2：执行 SQL 脚本

1. 在左侧菜单中点击 **SQL Editor**
2. 点击 **New query** 创建新查询
3. 复制 `fix-unique-constraint.sql` 文件的全部内容
4. 粘贴到 SQL Editor 中
5. 点击 **Run** 按钮执行

### 步骤 3：验证修复结果

执行后应该看到类似输出：

```
✓ 旧索引不存在: idx_ai_assets_task_id_unique
或
✅ 删除旧索引: idx_ai_assets_task_id_unique

✅ 创建复合唯一索引: idx_ai_assets_user_service_task_unique

🎉 唯一约束修复完成！

📊 约束详情:
  - 字段组合: (user_id, service, task_id)
  - 约束类型: UNIQUE INDEX
  - 支持操作: UPSERT with ON CONFLICT

✅ 现在可以正常使用 UPSERT 操作保存对话历史了
```

### 步骤 4：测试修复

1. 回到前端应用
2. 刷新页面（清除错误状态）
3. 创建新的对话或切换对话
4. 检查控制台，应该看到成功日志：
   ```
   [Chat Save] 💾 保存对话: { uuid: xxx, title: xxx, ... }
   [Chat Save] ✅ 保存成功: asset-id-xxx
   ```

## 技术细节

### 旧索引（问题所在）
```sql
CREATE UNIQUE INDEX idx_ai_assets_task_id_unique
ON ai_assets(task_id)
WHERE task_id IS NOT NULL;
```
- 只约束 `task_id` 字段
- 不支持 `(user_id, service, task_id)` 的 UPSERT

### 新索引（修复后）
```sql
CREATE UNIQUE INDEX idx_ai_assets_user_service_task_unique
ON ai_assets(user_id, service, task_id)
WHERE task_id IS NOT NULL;
```
- 约束 `(user_id, service, task_id)` 三个字段的组合
- 支持后端代码的 UPSERT 操作
- 确保同一用户、同一服务、同一任务 ID 的资产唯一

### 为什么需要复合唯一约束？

1. **多租户隔离**：不同用户可以有相同的 `task_id`（虽然实际上 UUID 基本不会重复）
2. **服务隔离**：同一用户在不同服务（chat, midjourney, suno）中可以使用相同的 `task_id`
3. **UPSERT 语义**：当保存对话时，如果已存在则更新，否则插入

## 常见问题

### Q1: 执行脚本时提示权限错误？
A: 确保你的 Supabase 账号有数据库管理权限。如果使用的是项目服务密钥（Service Key），应该有完整权限。

### Q2: 执行后仍然报错？
A:
1. 检查 SQL Editor 是否显示执行成功
2. 清除浏览器缓存并刷新前端应用
3. 检查 Supabase 项目是否正确连接

### Q3: 之前保存的数据会丢失吗？
A: 不会！这个脚本只修改索引结构，不会删除或修改任何数据。

### Q4: 能否回滚这个修改？
A: 可以，但不建议。如果需要回滚，执行：
```sql
DROP INDEX IF EXISTS idx_ai_assets_user_service_task_unique;
CREATE UNIQUE INDEX idx_ai_assets_task_id_unique
ON ai_assets(task_id)
WHERE task_id IS NOT NULL;
```

## 后续建议

- 定期检查数据库索引使用情况
- 如果遇到性能问题，可以运行 `add-performance-indexes.sql` 添加更多优化索引
- 建议在生产环境部署前先在开发环境测试
