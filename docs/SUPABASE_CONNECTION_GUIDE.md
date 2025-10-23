# Supabase数据库连接配置指南

本指南将帮助你配置Supabase数据库连接，并使用Claude Code直接检查配置。

## 📋 前置条件

1. **Supabase账号**
   - 访问 https://supabase.com
   - 注册并创建一个新项目（免费）
   - 等待项目初始化完成（约2分钟）

2. **获取连接凭证**
   - 进入你的Supabase项目
   - 左侧菜单 → **Settings** → **API**
   - 复制以下信息：
     - **Project URL**: `https://xxxxx.supabase.co`
     - **Service Role Key** (⚠️ 保密): `eyJhbGci...`

## 🔧 步骤1: 配置环境变量

### 方法1: 手动配置

编辑 `service/.env` 文件（如果不存在，复制 `.env.example`）：

```bash
# Supabase数据库配置
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx
```

### 方法2: 使用命令行

```bash
cd service

# 创建.env文件（如果不存在）
cp .env.example .env

# 添加Supabase配置
echo "SUPABASE_URL=https://your-project-id.supabase.co" >> .env
echo "SUPABASE_SERVICE_KEY=your-service-role-key" >> .env
```

## 🗄️ 步骤2: 初始化数据库表

### 方法1: 使用Supabase SQL Editor（推荐）

1. 访问 Supabase 控制台
2. 左侧菜单 → **SQL Editor**
3. 点击 **New query**
4. 复制 `service/src/db/supabase-init.sql` 的全部内容
5. 粘贴并点击 **Run** 执行

### 方法2: 使用命令行（需要supabase CLI）

```bash
# 安装Supabase CLI
brew install supabase/tap/supabase  # macOS
# 或
npm install -g supabase             # 其他系统

# 登录
supabase login

# 连接到项目
supabase link --project-ref your-project-id

# 执行SQL
supabase db push < service/src/db/supabase-init.sql
```

## ✅ 步骤3: 测试数据库连接

运行自动化测试脚本：

```bash
cd service

# 使用bun（推荐）
bun run test:supabase

# 或使用npm/pnpm
npm run test:supabase
pnpm test:supabase
```

### 预期输出

✅ **成功情况**：
```
========================================
  Supabase 数据库连接测试
========================================

📋 步骤1: 检查环境变量配置
✅ SUPABASE_URL: https://xxxxx.supabase.co
✅ SUPABASE_SERVICE_KEY: eyJhbGciOiJIUzI1Ni...

📋 步骤2: 创建Supabase客户端
✅ 客户端创建成功

📋 步骤3: 测试数据库连接
✅ 数据库连接成功

📋 步骤4: 检查表结构
✅ 表 chat_sessions 存在
✅ 表 ai_assets 存在
✅ 表 user_configs 存在

📋 步骤5: 获取表统计信息
📊 chat_sessions: 0 条记录
📊 ai_assets: 0 条记录
📊 user_configs: 0 条记录

📋 步骤6: 测试写入权限
✅ 写入测试成功
✅ 测试数据已清理

========================================
  测试结果总结
========================================

✅ 所有检查通过！数据库配置正确
```

❌ **失败情况**：
```
❌ 错误: SUPABASE_URL 未配置
   请在 service/.env 中添加: SUPABASE_URL=https://xxx.supabase.co
```

或

```
⚠️  表 chat_sessions 不存在
   需要先执行初始化SQL脚本
```

## 🐛 常见问题排查

### Q1: `SUPABASE_URL 未配置`

**原因**: 环境变量未正确加载

**解决**:
```bash
# 检查.env文件是否存在
ls -la service/.env

# 检查文件内容
cat service/.env | grep SUPABASE

# 确保没有多余空格
SUPABASE_URL=https://xxx.supabase.co  # ✅ 正确
SUPABASE_URL = https://xxx.supabase.co  # ❌ 错误（有空格）
```

### Q2: `连接失败: Invalid API key`

**原因**: Service Role Key 不正确或已过期

**解决**:
1. 重新获取 Service Role Key（Supabase → Settings → API）
2. 确保复制的是 **service_role** key，而不是 **anon** key
3. 检查是否复制完整（通常很长，约300+字符）

### Q3: `表不存在`

**原因**: 数据库未初始化

**解决**:
1. 执行 `service/src/db/supabase-init.sql`
2. 或手动在Supabase SQL Editor中创建表

### Q4: `permission denied for table`

**原因**: RLS (Row Level Security) 已启用但未配置策略

**解决**:
```sql
-- 在Supabase SQL Editor中执行
ALTER TABLE chat_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_configs DISABLE ROW LEVEL SECURITY;

-- 或者配置正确的RLS策略
```

## 🔍 如何让Claude Code直接检查配置

### 方法1: 运行测试脚本（推荐）

在对话中告诉Claude：

```
请运行 bun run test:supabase 检查我的Supabase配置
```

Claude会执行测试脚本并分析输出结果。

### 方法2: 提供环境变量

在对话中分享（注意脱敏）：

```
我的Supabase配置：
URL: https://xxxxx.supabase.co
Service Key: eyJhbGci...[前20个字符]

请帮我检查配置是否正确
```

Claude会创建临时测试代码验证连接。

### 方法3: 分享错误日志

如果遇到错误，直接复制粘贴错误信息：

```
我运行 test:supabase 遇到错误：
[粘贴完整错误堆栈]

请帮我分析问题
```

## 📊 手动验证数据库

### 使用Supabase控制台

1. 访问 Supabase → **Table Editor**
2. 检查是否看到以下表：
   - `chat_sessions`
   - `ai_assets`
   - `user_configs`

3. 点击任意表，查看列结构：

**chat_sessions** 应包含：
- `id` (uuid)
- `user_id` (varchar)
- `title` (varchar)
- `messages` (jsonb)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### 使用psql命令行

如果你熟悉PostgreSQL：

```bash
# 获取连接字符串（Supabase → Settings → Database）
psql "postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"

# 查看所有表
\dt

# 查看表结构
\d chat_sessions

# 测试查询
SELECT COUNT(*) FROM chat_sessions;
```

## 🚀 下一步

配置验证通过后，继续：

1. **集成同步API**
   - 编辑 `service/src/index.ts`
   - 添加: `import syncRouter from './api/sync-simple';`
   - 注册路由: `app.use('/sync', authV2, syncRouter);`

2. **重启服务**
   ```bash
   cd service
   bun run dev
   ```

3. **测试API端点**
   ```bash
   # 获取会话列表
   curl http://localhost:3002/sync/sessions \
     -H "X-Ptoken: your-api-key"

   # 应返回
   {"success":true,"sessions":[],"count":0}
   ```

4. **前端集成**
   - 参考 `docs/SYNC_SETUP_GUIDE.md` 完成前端同步功能

## 🆘 获取帮助

如果遇到问题：

1. **检查测试脚本输出**
   - 运行 `bun run test:supabase`
   - 查看具体错误信息

2. **查看Supabase日志**
   - Supabase → Logs → Database
   - 查看是否有错误记录

3. **在对话中询问Claude**
   ```
   我遇到了[具体问题描述]
   测试脚本输出：[粘贴输出]
   请帮我排查原因
   ```

---

**配置完成标志**：
- ✅ 测试脚本输出 "所有检查通过"
- ✅ Supabase Table Editor 可以看到3个表
- ✅ 可以手动在表中插入和查询数据

完成后，你的应用就具备了多平台数据同步能力！🎉
