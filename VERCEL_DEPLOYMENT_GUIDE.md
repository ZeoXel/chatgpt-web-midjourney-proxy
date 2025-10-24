# Vercel 部署指南 - 数据库API集成

## 问题诊断

**症状**: 生产环境返回 404 Not Found when accessing `/api/assets`

**原因**: Vercel 使用 Serverless Functions 架构，需要在 `api/` 目录创建对应的函数文件

---

## 🚀 部署步骤（3步完成）

### 步骤1: 添加依赖到根 package.json

在项目根目录的 `package.json` 的 `dependencies` 中添加：

```bash
pnpm add @supabase/supabase-js
```

或手动编辑 `package.json`，在 `dependencies` 部分添加：

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.76.1"
  }
}
```

然后运行：
```bash
pnpm install
```

---

### 步骤2: 配置 Vercel 环境变量

在 Vercel 控制台添加以下环境变量：

1. 打开你的 Vercel 项目
2. 进入 **Settings** → **Environment Variables**
3. 添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `SUPABASE_URL` | `https://lxxbjwxwujcpgqfoquvv.supabase.co` | Supabase项目URL |
| `SUPABASE_SERVICE_KEY` | `your_service_role_key_here` | Supabase Service Role Key |

**获取 Service Role Key**：
1. 打开 Supabase 项目控制台
2. Settings → API → Project API keys
3. 复制 `service_role` key（**注意**：不是 `anon` key）

---

### 步骤3: 提交代码并重新部署

```bash
# 提交新创建的 api/assets.js
git add api/assets.js
git add package.json
git commit -m "feat: 添加 Vercel Serverless Function 支持数据库API"
git push origin main  # 或你的分支名

# Vercel 会自动触发重新部署
```

---

## ✅ 验证部署

### 方法1: 使用浏览器Console测试

部署完成后，打开生产环境网站，按 F12 打开Console，执行：

```javascript
(async () => {
  const store = localStorage.getItem('gptServerStore');
  const config = store ? JSON.parse(store) : {};
  const apiKey = config.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('请先配置API Key');
    return;
  }

  const response = await fetch('/api/assets?service=midjourney&type=image&limit=5', {
    method: 'GET',
    headers: { 'x-api-key': apiKey }
  });

  console.log('状态:', response.status);
  const data = await response.json();
  console.log('响应:', data);
})();
```

**预期结果**：
```
状态: 200
响应: {success: true, assets: [...], total: X}
```

---

### 方法2: 使用curl测试

```bash
curl -X GET \
  'https://你的域名.vercel.app/api/assets?service=midjourney&type=image&limit=5' \
  -H 'x-api-key: 你的API_KEY'
```

---

## 📋 文件清单

已创建的文件：

- ✅ `api/assets.js` - Vercel Serverless Function
- ✅ `VERCEL_DEPLOYMENT_GUIDE.md` - 本文档

需要修改的文件：

- ⏳ `package.json` - 添加 `@supabase/supabase-js` 依赖

---

## 🔍 故障排查

### 问题1: 部署后仍然返回 404

**检查**：
1. 确认 `api/assets.js` 文件已提交并推送
2. 在 Vercel 控制台查看 Functions 标签，确认函数已部署
3. 检查 Vercel 构建日志是否有错误

---

### 问题2: 返回 500 Internal Server Error

**原因**: 环境变量未配置

**检查**：
1. Vercel Settings → Environment Variables
2. 确认 `SUPABASE_URL` 和 `SUPABASE_SERVICE_KEY` 已设置
3. **重要**：添加环境变量后需要重新部署才能生效

---

### 问题3: 返回 401 Unauthorized

**原因**: API Key无效或未分配用户

**解决**：
```sql
-- 在 Supabase SQL Editor 执行
SELECT key_value, status, assigned_user_id
FROM api_keys
WHERE key_value = '你的API_KEY';

-- 如果status不是'assigned'，执行
UPDATE api_keys
SET status = 'assigned'
WHERE key_value = '你的API_KEY';

-- 如果assigned_user_id为空，执行
UPDATE api_keys
SET assigned_user_id = '<用户UUID>'
WHERE key_value = '你的API_KEY';
```

---

### 问题4: Supabase连接超时

**原因**: Service Role Key错误或Supabase项目不可用

**检查**：
1. 确认 `SUPABASE_URL` 格式正确（https://xxx.supabase.co）
2. 确认 `SUPABASE_SERVICE_KEY` 是 service_role key，不是 anon key
3. 尝试在 Supabase SQL Editor 运行查询，确认项目正常

---

## 📊 Vercel Serverless Functions 架构说明

### 传统Express架构 vs Vercel架构

**传统方式** (本地开发):
```
service/src/index.ts  →  Express服务器
  ├─ app.use('/api/assets', assetsRouter)
  ├─ app.use('/api/proxy', proxyRouter)
  └─ app.listen(3002)
```

**Vercel方式**:
```
api/
  ├─ assets.js          →  /api/assets 路由
  ├─ proxy.js           →  /api/proxy 路由
  └─ [name].js          →  /api/[name] 路由
```

每个文件是一个独立的 Serverless Function，**不需要 Express 服务器**。

---

## 🔄 本地开发 vs 生产环境

### 本地开发
```bash
cd service
bun run dev  # 启动 Express 服务器在 3002 端口
```

### 生产环境 (Vercel)
- 前端静态文件由 Vercel CDN 提供
- `/api/*` 路由由 Serverless Functions 处理
- 无需手动启动服务器，Vercel 自动管理

---

## 💡 优化建议

### 1. 使用Edge Functions（可选）

如果需要更低延迟，可以将 `api/assets.js` 改为 Edge Function：

```javascript
// api/assets.js
export const config = {
  runtime: 'edge',  // 使用 Edge Runtime
};

export default async function handler(req) {
  // 代码保持不变
}
```

**优点**：
- 延迟更低（全球边缘节点）
- 冷启动更快

**限制**：
- 不支持所有 Node.js API
- 最大执行时间30秒

---

### 2. 缓存优化

在 `vercel.json` 中添加缓存配置：

```json
{
  "headers": [
    {
      "source": "/api/assets",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=60, stale-while-revalidate"
        }
      ]
    }
  ]
}
```

---

### 3. 监控和日志

查看 Function 日志：
1. Vercel 控制台 → Deployments
2. 选择最新部署 → Functions 标签
3. 点击 `api/assets` 查看实时日志

---

## 📝 部署检查清单

完成部署后，确认以下项目：

- [ ] `api/assets.js` 文件已创建并提交
- [ ] `package.json` 包含 `@supabase/supabase-js` 依赖
- [ ] Vercel 环境变量 `SUPABASE_URL` 已配置
- [ ] Vercel 环境变量 `SUPABASE_SERVICE_KEY` 已配置
- [ ] 代码已推送到 Git 仓库
- [ ] Vercel 自动部署已完成
- [ ] 浏览器测试返回 200 状态码
- [ ] 前端画廊可以读取数据库数据

---

## 🎉 部署完成

部署成功后，你的生产环境将能够：

✅ 自动保存 MJ UPSCALE 结果到 Supabase 数据库
✅ 从数据库读取历史记录并与localStorage合并
✅ 支持跨设备数据同步
✅ 使用高性能索引优化查询速度

---

最后更新: 2025-10-24
