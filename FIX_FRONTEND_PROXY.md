# 前端代理配置修复说明

## 问题描述

前端运行在 `localhost:3001`，请求 `/api/supabase/upload` 时返回 404 错误。

### 原因分析

Vite 配置中的 `/api` 代理规则会将 `/api/` 替换为 `/`，导致：

```
前端请求：/api/supabase/upload
  ↓ (Vite 代理 rewrite)
代理后：/supabase/upload
  ↓ (后端实际路由)
后端路由：/api/supabase/upload  ❌ 不匹配
```

---

## 解决方案

已在 `vite.config.ts` 中添加特殊代理配置：

```typescript
proxy: {
  // 新增：Supabase 上传 API（不 rewrite）
  '/api/supabase': {
    target: viteEnv.VITE_APP_API_BASE_URL,
    changeOrigin: true,
    // 不进行 rewrite，保留完整路径
  },
  // 新增：资产存储 API（不 rewrite）
  '/api/assets': {
    target: viteEnv.VITE_APP_API_BASE_URL,
    changeOrigin: true,
    // 不进行 rewrite，保留完整路径
  },
  // 原有配置...
  '/api': {
    target: viteEnv.VITE_APP_API_BASE_URL,
    changeOrigin: true,
    rewrite: path => path.replace('/api/', '/'),
  },
}
```

**关键点**：
- `/api/supabase` 和 `/api/assets` 配置在 `/api` **之前**
- Vite 会按顺序匹配，更具体的规则优先
- 这两个路由不进行 rewrite，保留完整路径

---

## 操作步骤

### 步骤 1：重启前端服务器

```bash
# 停止当前运行的前端（如果有）
# Ctrl+C 或关闭终端

# 重新启动前端
bun run dev
```

### 步骤 2：验证代理配置

打开浏览器 DevTools（F12），在 Console 中运行：

```javascript
// 测试 Supabase 健康检查
fetch('/api/supabase/health')
  .then(r => r.json())
  .then(d => console.log('✅ Supabase 代理正常:', d))
  .catch(e => console.error('❌ 代理失败:', e));
```

预期输出：
```json
{
  "success": true,
  "message": "Supabase 连接正常",
  "buckets": ["pika-images"],
  "pika_bucket_exists": true
}
```

### 步骤 3：测试图片上传

1. 访问：http://localhost:3001
2. 进入 Pika 页面
3. 点击"选择图片"
4. 选择一张图片（< 10MB）
5. 观察提示消息

**预期结果**：
```
✅ 图片上传成功 (2.5MB) - 使用云存储
```

**Network 面板检查**：
```
Request URL: http://localhost:3001/api/supabase/upload
Status: 200 OK
Response:
{
  "success": true,
  "url": "https://lxxbjwxwujcpgqfoquvv.supabase.co/storage/v1/object/public/pika-images/...",
  "path": "2025-10-29/xxx.png",
  "size": 1234567
}
```

---

## 故障排查

### 问题 1：仍然 404

**检查点**：
```bash
# 1. 确认环境变量
cat .env | grep VITE_APP_API_BASE_URL
# 预期：VITE_APP_API_BASE_URL=http://127.0.0.1:3002

# 2. 确认后端运行在 3002
curl http://localhost:3002/api/supabase/health
# 预期：{"success":true,...}

# 3. 重启前端（必须！）
bun run dev
```

### 问题 2：Supabase 500 错误

**原因**：存储桶未创建或环境变量缺失

**解决**：
```bash
# 测试后端 Supabase 连接
curl http://localhost:3002/api/supabase/health

# 如果返回 "pika_bucket_exists": false
# 请查看 docs/SUPABASE_STORAGE_SETUP.md
```

### 问题 3：Pika 500 错误

**原因**：图片 URL 格式或 Pika API Key 问题

**检查**：
```javascript
// 查看请求体
// Network → pika/generate → Payload

// 正确格式
{
  "image": "https://lxxbjwxwujcpgqfoquvv.supabase.co/storage/v1/object/public/pika-images/...",
  "promptText": "...",
  "model": "1.5"
}
```

---

## 代理配置详解

### Vite 代理匹配顺序

```typescript
proxy: {
  '/api/supabase': {...},  // ← 1. 优先匹配
  '/api/assets': {...},    // ← 2. 次优先
  '/api': {...},           // ← 3. 最后匹配（通用）
}
```

### 请求流程

```
前端请求：/api/supabase/upload
  ↓
Vite 代理：匹配到 /api/supabase 规则
  ↓
转发到：http://127.0.0.1:3002/api/supabase/upload
  ↓
后端路由：app.use('/api/supabase', supabaseUploadRouter)
  ↓
处理器：POST /upload
  ↓
完整路径：/api/supabase/upload ✅ 匹配成功
```

---

## 环境变量说明

### 前端 (.env)

```bash
# Vite 代理目标地址
VITE_APP_API_BASE_URL=http://127.0.0.1:3002
```

### 后端 (service/.env)

```bash
# Supabase 配置
SUPABASE_URL=https://lxxbjwxwujcpgqfoquvv.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOi...

# Pika 配置
PIKA_SERVER=https://railway.lsaigc.com
PIKA_KEY=sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw
```

---

## 验证清单

### 后端检查

```bash
# 1. 后端运行状态
curl http://localhost:3002/api/supabase/health

# 2. 直接测试上传（使用 Postman 或 curl）
curl -X POST http://localhost:3002/api/supabase/upload \
  -F "file=@test.png"
```

### 前端检查

```bash
# 1. 重启前端
bun run dev

# 2. 浏览器访问
open http://localhost:3001

# 3. DevTools Console
fetch('/api/supabase/health').then(r => r.json()).then(console.log)
```

---

## 快速测试命令

### 一键测试脚本

在项目根目录运行：

```bash
# 测试后端
echo "=== 测试后端 Supabase 连接 ==="
curl -s http://localhost:3002/api/supabase/health | jq .

# 测试前端代理（需先启动前端）
echo -e "\n=== 测试前端代理 ==="
curl -s http://localhost:3001/api/supabase/health | jq .

# 如果两个都返回相同的成功结果，说明配置正确
```

---

## 修复总结

### 已完成

- ✅ 添加 `/api/supabase` 特殊代理配置
- ✅ 添加 `/api/assets` 特殊代理配置
- ✅ 保持原有 `/api` 代理配置不变

### 需要操作

- [ ] 重启前端服务器（**必须！**）
- [ ] 测试图片上传
- [ ] 验证 Pika 请求

### 预期效果

- ✅ 前端请求 `/api/supabase/upload` → 200 OK
- ✅ 图片上传到 Supabase Storage
- ✅ 返回公网 URL
- ✅ Pika API 接收 URL 格式图片
- ✅ 请求体大小 ~100 bytes（vs 13MB Base64）

---

## 常见问题 FAQ

### Q: 为什么要在 /api 之前配置？

A: Vite 代理按顺序匹配，更具体的规则必须放在前面。如果 `/api` 在前，会先匹配并 rewrite，导致后续规则无法生效。

### Q: 可以直接修改 /api 规则吗？

A: 不推荐。`/api` 规则被其他路由使用（如 `/api/` → `/`），修改会影响现有功能。

### Q: 生产环境需要这个配置吗？

A: 不需要。生产环境中前后端通常在同一域名下，或使用 Nginx 代理，不需要 Vite 代理。

---

完成！现在请重启前端服务器并测试。
