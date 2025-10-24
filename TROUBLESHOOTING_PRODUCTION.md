# 生产环境数据库读取问题排查指南

## 问题描述
部署到生产环境后，无法从Supabase数据库读取MJ资产数据。

## 用户区分机制

### 认证流程
```
前端用户配置API Key
    ↓
存储在 localStorage['gptServerStore'].OPENAI_API_KEY
    ↓
前端发起请求时，在header中携带: x-api-key: <用户的API Key>
    ↓
后端验证流程 (service/src/api/assets.ts:36-79):
    1. 从header提取api_key
    2. 查询 api_keys 表: SELECT assigned_user_id, status WHERE key_value = api_key
    3. 验证 status = 'assigned' 或 'active'
    4. 验证 assigned_user_id 不为空
    5. 将 user_id 附加到请求: req.userId = assigned_user_id
    ↓
后端查询数据时过滤: WHERE user_id = req.userId
    ↓
返回该用户的专属数据
```

### 数据隔离原理
- 每个用户分配一个唯一的API Key (存在 `api_keys` 表)
- API Key 通过 `assigned_user_id` 关联到 `users.id`
- 所有资产表 `ai_assets` 有 `user_id` 外键约束
- 查询时自动过滤：只返回当前用户的数据

## 生产环境排查清单

### 1. 检查前端配置

打开浏览器控制台，执行：

```javascript
// 检查是否配置了API Key
const store = localStorage.getItem('gptServerStore');
const config = JSON.parse(store);
console.log('API Key:', config.OPENAI_API_KEY);
console.log('API Base URL:', config.OPENAI_API_BASE_URL);
```

**预期结果**：
- `OPENAI_API_KEY` 应该是一个有效的密钥字符串
- 如果为空或undefined，说明用户未配置API Key

**解决方案**：
- 前往设置页面配置 `OPENAI_API_KEY`
- 确保使用的是数据库 `api_keys` 表中存在的 `key_value`

---

### 2. 检查网络请求

打开浏览器 DevTools → Network 标签，刷新画廊页面，查找：

```
GET /api/api/assets?service=midjourney&type=image&limit=100&offset=0
```

**检查项**：

**A. 请求是否发出？**
- ❌ 未发出 → 前端代码未执行，检查console日志
- ✅ 已发出 → 继续检查响应

**B. 响应状态码？**
- `401 Unauthorized` → API Key无效或未配置
- `403 Forbidden` → API Key状态异常或未分配用户
- `404 Not Found` → 后端路由未注册
- `500 Internal Server Error` → 后端环境变量或数据库连接问题
- `200 OK` → 成功，检查返回数据

**C. 请求头是否包含？**
```
x-api-key: <你的API Key>
```

---

### 3. 检查后端环境变量

SSH到生产服务器，检查：

```bash
cd /path/to/your/service
cat .env | grep SUPABASE
```

**必须包含**：
```bash
SUPABASE_URL=https://lxxbjwxwujcpgqfoquvv.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
```

**验证方法**：
```bash
cd service
bun run test:supabase
```

**预期输出**：
```
✅ Supabase连接成功
✅ api_keys表存在
✅ users表存在
✅ ai_assets表存在
```

---

### 4. 检查API Key在数据库中的状态

使用Supabase SQL Editor或MCP执行：

```sql
-- 查询你的API Key信息
SELECT
  key_value,
  status,
  assigned_user_id,
  provider,
  created_at
FROM api_keys
WHERE key_value = 'YOUR_API_KEY_HERE';
```

**预期结果**：
```
key_value: sk-xxxxx
status: assigned (或 active)
assigned_user_id: <UUID> (不能为空)
```

**常见问题**：
- ❌ `status = 'pending'` → API Key未激活
- ❌ `assigned_user_id = NULL` → API Key未分配给用户
- ❌ 查询无结果 → API Key不存在于数据库

**修复方法**：
```sql
-- 将API Key分配给用户
UPDATE api_keys
SET
  status = 'assigned',
  assigned_user_id = '<用户UUID>'
WHERE key_value = 'YOUR_API_KEY_HERE';
```

---

### 5. 检查是否有历史数据

```sql
-- 查询该用户的所有资产
SELECT
  id,
  service,
  type,
  task_id,
  main_url,
  created_at
FROM ai_assets
WHERE user_id = '<用户UUID>'
ORDER BY created_at DESC
LIMIT 10;
```

**如果返回空**：
- 可能数据库中真的没有数据（新用户）
- 尝试生成一张MJ图片，检查是否保存成功

---

### 6. 检查前端Console日志

刷新画廊页面，查看浏览器Console输出：

**正常流程**：
```
🌐 开始加载画廊（DB + localStorage）...
[MJ Asset Load] ✅ 从数据库加载 5 个资产
📊 画廊统计:
  - 数据库: 5 张
  - 本地: 3 张
  - 合并后: 7 张 (去重)
```

**异常情况A - 未配置API Key**：
```
[MJ Asset Load] 未配置API Key，跳过数据库读取
📊 画廊统计:
  - 数据库: 0 张
  - 本地: 3 张
  - 合并后: 3 张
```
→ 去设置中配置 `OPENAI_API_KEY`

**异常情况B - API请求失败**：
```
[MJ Asset Load] ❌ 加载失败: API error: 401
```
→ API Key无效，检查数据库

**异常情况C - 网络错误**：
```
[MJ Asset Load] ❌ 加载失败: Failed to fetch
```
→ 后端服务未启动或环境变量配置错误

---

### 7. 检查后端路由注册

确认 `service/src/index.ts` 中已注册资产路由：

```bash
grep -n "assetsRouter" service/src/index.ts
```

**应该包含**：
```typescript
import assetsRouter from './api/assets';  // 第20行左右
app.use('/api/assets', assetsRouter);     // 第763行左右
```

**验证方法**：
```bash
curl http://localhost:3002/api/assets/health
```

预期返回：`{"status":"ok"}`（如果有health端点）

---

### 8. 测试完整流程

**步骤1**: 生成一张MJ图片
```
1. 打开MJ绘图页面
2. 输入提示词: "a beautiful sunset"
3. 等待生成完成 → UPSCALE一张图片
```

**步骤2**: 检查保存日志
```
打开Console，应该看到:
[MJ Asset Save] ✅ 保存成功: <UUID>
```

**步骤3**: 刷新画廊
```
打开AI画廊页面，应该看到:
[MJ Asset Load] ✅ 从数据库加载 1 个资产
```

**步骤4**: 验证数据库
```sql
SELECT * FROM ai_assets
WHERE task_id = '<mjID>'
ORDER BY created_at DESC
LIMIT 1;
```

---

## 快速诊断命令

在浏览器Console中执行以下脚本，一键诊断：

```javascript
(async function diagnose() {
  console.log('=== 生产环境诊断工具 ===\n');

  // 1. 检查API Key配置
  const store = localStorage.getItem('gptServerStore');
  const config = store ? JSON.parse(store) : {};
  const apiKey = config.OPENAI_API_KEY;

  console.log('1️⃣ API Key配置:');
  console.log('  - 已配置:', apiKey ? '✅ 是' : '❌ 否');
  console.log('  - Key前缀:', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');
  console.log('  - Base URL:', config.OPENAI_API_BASE_URL || 'N/A');

  if (!apiKey) {
    console.warn('⚠️ 未配置API Key，无法读取数据库');
    return;
  }

  // 2. 测试API连接
  console.log('\n2️⃣ 测试数据库连接:');
  try {
    const response = await fetch('/api/api/assets?service=midjourney&type=image&limit=5', {
      method: 'GET',
      headers: { 'x-api-key': apiKey }
    });

    console.log('  - 状态码:', response.status);
    console.log('  - 状态文本:', response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log('  - 返回资产数:', data.assets?.length || 0);
      console.log('  - 总数:', data.total || 0);
      console.log('✅ 数据库连接正常');
    } else {
      const error = await response.json().catch(() => ({}));
      console.error('❌ API请求失败:', error);
    }
  } catch (err) {
    console.error('❌ 网络错误:', err.message);
  }

  // 3. 检查本地数据
  console.log('\n3️⃣ 本地存储:');
  const localforage = (await import('localforage')).default;
  localforage.config({ name: 'mj', storeName: 'mjkv' });
  const localGallery = await localforage.getItem('MJ:gallery:images');
  console.log('  - 本地图片数:', localGallery ? localGallery.length : 0);

  console.log('\n=== 诊断完成 ===');
})();
```

---

## 常见场景解决方案

### 场景1: 新用户首次使用

**症状**: Console显示 "未配置API Key"

**解决**:
1. 前往设置页面
2. 配置 `OPENAI_API_KEY` 为数据库中有效的密钥
3. 确保该密钥已分配给用户

---

### 场景2: API Key已配置但返回401

**症状**: Network显示 401 Unauthorized

**检查**:
```sql
SELECT status, assigned_user_id
FROM api_keys
WHERE key_value = '<你的Key>';
```

**如果 status ≠ 'assigned'**:
```sql
UPDATE api_keys
SET status = 'assigned'
WHERE key_value = '<你的Key>';
```

**如果 assigned_user_id 为空**:
```sql
UPDATE api_keys
SET assigned_user_id = '<用户UUID>'
WHERE key_value = '<你的Key>';
```

---

### 场景3: 数据库中有数据但前端不显示

**检查Vite代理配置** (仅限开发环境):

`vite.config.ts` 中的 `/api` 代理会重写路径：
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3002',
    changeOrigin: true,
    rewrite: path => path.replace('/api/', '/'),
  }
}
```

这意味着：
- 前端请求: `/api/api/assets`
- 经过代理: `/api/assets`
- 后端路由: `/api/assets` ✅

**生产环境无此问题**，因为没有Vite代理。

---

### 场景4: 后端服务未启动

**症状**: Console显示 "Failed to fetch"

**检查**:
```bash
# 查看后端进程
ps aux | grep node | grep service

# 查看后端日志
tail -f /path/to/service/logs/error.log

# 重启后端
cd service
pm2 restart chatgpt-web-service  # 如果使用pm2
# 或
bun run prod
```

---

## 技术架构总结

```
┌─────────────────────────────────────────────────────────┐
│                    前端 (Vue.js)                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  localStorage['gptServerStore']                   │   │
│  │    └─ OPENAI_API_KEY: "sk-xxxxx"                 │   │
│  └──────────────────────────────────────────────────┘   │
│                           │                              │
│                           │ (x-api-key header)          │
│                           ▼                              │
└─────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────┐
│                           ▼                              │
│                  后端 (Express)                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  authenticateApiKey() 中间件                      │   │
│  │    1. 提取 x-api-key                              │   │
│  │    2. 查询 api_keys 表                            │   │
│  │    3. 验证 status 和 assigned_user_id            │   │
│  │    4. 设置 req.userId                             │   │
│  └──────────────────────────────────────────────────┘   │
│                           │                              │
│                           ▼                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │  GET /api/assets                                  │   │
│  │    SELECT * FROM ai_assets                        │   │
│  │    WHERE user_id = req.userId                     │   │
│  │    AND service = 'midjourney'                     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 Supabase PostgreSQL                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  api_keys 表                                      │   │
│  │    - key_value (PK)                               │   │
│  │    - assigned_user_id (FK → users.id)            │   │
│  │    - status                                       │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  ai_assets 表                                     │   │
│  │    - id (PK)                                      │   │
│  │    - user_id (FK → users.id)                     │   │
│  │    - service, type, task_id                      │   │
│  │    - asset_data (JSONB)                           │   │
│  │    - main_url, prompt, created_at                │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 联系支持

如果以上方法均无法解决，请提供以下信息：

1. 浏览器Console完整输出
2. Network标签中 `/api/api/assets` 的请求详情（Headers + Response）
3. 后端日志输出
4. 数据库查询结果（隐藏敏感信息）

---

最后更新: 2025-10-24
