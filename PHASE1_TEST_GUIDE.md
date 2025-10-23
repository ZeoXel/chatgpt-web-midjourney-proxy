# 阶段1测试指南 - Midjourney自动保存到数据库

## ✅ 已完成的修改

### 文件变更
- **src/api/mjapi.ts**
  - 第264-268行: 在 `flechTask()` 中添加自动保存逻辑
  - 第520-567行: 新增 `saveMJAssetToDatabase()` 函数

### 功能说明
当Midjourney图片生成完成时（`status === 'SUCCESS' && progress === '100%' && imageUrl存在`），系统会自动：
1. 从 `gptServerStore.myData.OPENAI_API_KEY` 获取用户的API Key
2. 构建资产数据对象（包含完整的chat.opt信息）
3. 调用 `/api/assets` API保存到Supabase数据库
4. 静默失败（不影响用户正常使用MJ功能）

---

## 🧪 测试步骤

### 前置条件
1. 确保后端服务正在运行：
   ```bash
   cd service
   bun run dev
   # 服务应运行在 http://localhost:3002
   ```

2. 确保已配置Supabase环境变量（service/.env）：
   ```bash
   SUPABASE_URL=https://lxxbjwxwujcpgqfoquvv.supabase.co
   SUPABASE_SERVICE_KEY=your_service_key_here
   ```

3. 确保前端已构建或开发服务器正在运行

### 测试用例1: 生成新图片并验证自动保存

**步骤:**
1. 打开前端应用，进入Midjourney绘图页面
2. 在设置中配置一个有效的 `OPENAI_API_KEY`（对应数据库中api_keys表的key_value）
3. 输入提示词，例如: `a beautiful sunset over mountains`
4. 提交生成任务
5. 等待生成完成（进度达到100%）

**预期结果:**
- MJ图片正常显示
- 浏览器控制台输出: `[MJ Asset Save] ✅ 保存成功: <uuid>`
- localStorage仍然保存数据（向后兼容）

**验证数据库:**
```bash
cd service
bun run query:supabase
```

应该看到新增的记录：
- `service = 'midjourney'`
- `type = 'image'`
- `task_id = mjID`
- `main_url` 包含图片URL
- `asset_data` 包含完整的opt对象

### 测试用例2: 验证API Key认证

**步骤:**
1. 清空设置中的 `OPENAI_API_KEY`
2. 生成一张新图片

**预期结果:**
- MJ功能正常工作
- 控制台输出: `[MJ Asset Save] 未配置API Key，跳过保存`
- 不会保存到数据库（符合预期）

### 测试用例3: 验证错误处理

**步骤:**
1. 配置一个无效的 API Key
2. 生成一张新图片

**预期结果:**
- MJ功能正常工作（不受影响）
- 控制台输出: `[MJ Asset Save] ❌ 保存失败: <error message>`
- 用户体验不受干扰

### 测试用例4: 通过MCP验证数据

**步骤:**
完成测试用例1后，使用MCP查询数据：

```typescript
// 查询该用户的所有Midjourney资产
const { data, error } = await supabase
  .from('ai_assets')
  .select('*')
  .eq('service', 'midjourney')
  .order('created_at', { ascending: false })
  .limit(5);

console.log('最近5张MJ图片:', data);
```

---

## 📊 验证检查清单

- [ ] MJ生成功能正常工作
- [ ] 生成完成后console显示保存成功
- [ ] 数据库中有对应记录
- [ ] task_id 与 mjID 匹配
- [ ] main_url 可访问
- [ ] asset_data 包含完整信息
- [ ] localStorage 仍然有数据（兼容性）
- [ ] API Key错误不影响用户体验
- [ ] 未配置API Key时不报错

---

## 🔍 故障排查

### 问题1: 控制台报错 "Failed to fetch"
**原因**: 后端服务未启动或端口错误
**解决**: 检查 `bun run dev` 是否正常运行在3002端口

### 问题2: 保存失败 "API error: 401"
**原因**: API Key无效或未分配用户
**解决**:
```sql
-- 检查API Key
SELECT key_value, status, assigned_user_id
FROM api_keys
WHERE key_value = 'your_key_here';

-- 确保status='assigned'且assigned_user_id不为空
```

### 问题3: 保存失败 "API error: 400"
**原因**: 数据格式错误或缺少必填字段
**解决**: 检查console中打印的完整错误信息

### 问题4: 数据库中没有记录
**原因**:
1. 可能生成没有完全完成（进度<100%）
2. 可能没有imageUrl
3. 可能保存静默失败

**解决**:
1. 检查浏览器console日志
2. 确认opt对象包含imageUrl字段
3. 检查后端日志（service目录）

---

## 📝 测试报告模板

测试完成后，请填写以下信息：

```
【阶段1测试报告】
测试日期: ____
测试人员: ____

✅ 通过的测试:
- [ ] 测试用例1: 正常生成并保存
- [ ] 测试用例2: 无API Key跳过保存
- [ ] 测试用例3: 错误处理正常
- [ ] 测试用例4: MCP验证数据正确

❌ 失败的测试:
-

🐛 发现的问题:
-

💡 改进建议:
-

📊 数据验证:
- 数据库记录数: ____
- 最近生成的mjID: ____
- 保存成功率: ____%
```

---

## ⏭️  下一步

阶段1验证通过后，将进入：
- **阶段2**: 前端读取 - 从数据库获取历史记录
- **阶段3**: UI增强 - 添加云同步状态显示

当前状态: **等待阶段1验证** ⏸️
