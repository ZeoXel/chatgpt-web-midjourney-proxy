# Supabase Storage 配置指南

## 概述

本项目使用 **Supabase Storage** 作为图片上传的主要方案，具有以下优势：

✅ **零成本**：Supabase 免费版提供 1GB 存储 + 2GB 流量/月
✅ **公网 URL**：上传后直接获得 CDN 加速的公网链接
✅ **请求体极小**：仅传递 URL（~100 bytes）而非 Base64（~10MB）
✅ **自动降级**：如果 Supabase 不可用，自动使用压缩 Base64

---

## 快速开始（3 分钟配置）

### 步骤 1：创建存储桶

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目：`lsjxweb`
3. 进入 **Storage** 菜单
4. 点击 **New Bucket**
5. 填写配置：
   ```
   Name: pika-images
   Public bucket: ✅ 是
   Allowed MIME types: image/jpeg, image/png, image/gif
   File size limit: 10 MB
   ```
6. 点击 **Create Bucket**

### 步骤 2：配置 CORS（跨域访问）

1. 在存储桶设置中找到 **CORS configuration**
2. 添加以下规则：

```json
[
  {
    "allowedOrigins": ["*"],
    "allowedMethods": ["GET", "POST", "PUT"],
    "allowedHeaders": ["*"],
    "maxAge": 3600
  }
]
```

### 步骤 3：验证配置

运行健康检查接口：

```bash
# 测试 Supabase 连接
curl http://localhost:3002/api/supabase/health
```

预期返回：
```json
{
  "success": true,
  "message": "Supabase 连接正常",
  "buckets": ["pika-images"],
  "pika_bucket_exists": true
}
```

---

## 环境变量配置

确保 `service/.env` 中已配置（应该已存在）：

```bash
SUPABASE_URL=https://lxxbjwxwujcpgqfoquvv.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
```

**获取 Service Key**：
1. Supabase Dashboard → Settings → API
2. 复制 `service_role` key（**不是** `anon` key）

---

## 使用示例

### 前端上传图片

```typescript
import { smartUploadImage } from '@/api/imageUpload';

// 用户选择文件后
const result = await smartUploadImage(file);

console.log(result.url);   // https://xxx.supabase.co/storage/v1/object/public/pika-images/2025-10-29/xxx.jpg
console.log(result.type);  // 'url'
console.log(result.size);  // 1234567
```

### Pika 请求体

```json
{
  "image": "https://xxx.supabase.co/storage/v1/object/public/pika-images/2025-10-29/xxx.jpg",
  "promptText": "a beautiful landscape",
  "model": "1.5"
}
```

---

## 数据库记录

每次上传都会自动记录到 `temp_image_uploads` 表：

```sql
SELECT * FROM temp_image_uploads ORDER BY created_at DESC LIMIT 10;
```

字段说明：
- `storage_path`：文件在 Storage 中的路径
- `public_url`：公网访问 URL
- `file_size`：文件大小（字节）
- `expires_at`：过期时间（默认 7 天）

---

## 清理过期文件（可选）

创建定时任务清理过期文件：

```sql
-- 查看过期文件
SELECT * FROM temp_image_uploads
WHERE expires_at < NOW() AND is_deleted = FALSE;

-- 标记为已删除
UPDATE temp_image_uploads
SET is_deleted = TRUE
WHERE expires_at < NOW();
```

---

## 故障排查

### 1. 上传失败："存储桶不存在"

**原因**：未创建 `pika-images` 存储桶

**解决**：
1. 检查存储桶是否存在：`GET /api/supabase/health`
2. 如果 `pika_bucket_exists: false`，按步骤 1 创建

---

### 2. 上传失败："403 Forbidden"

**原因**：存储桶未设置为 Public

**解决**：
1. Storage → pika-images → Settings
2. 勾选 **Public bucket**
3. 保存

---

### 3. 图片无法访问："404 Not Found"

**原因**：文件路径错误或已删除

**解决**：
```sql
-- 查询文件记录
SELECT * FROM temp_image_uploads
WHERE public_url LIKE '%文件名%';
```

---

### 4. 自动降级到压缩 Base64

**原因**：Supabase 配置缺失或网络问题

**日志**：
```
⚠️ Supabase 未配置或存储桶不存在，使用压缩 Base64
🔄 开始压缩图片...
✅ 压缩完成：8000KB → 1800KB
```

**解决**：
- 检查环境变量 `SUPABASE_URL` 和 `SUPABASE_SERVICE_KEY`
- 运行健康检查：`GET /api/supabase/health`

---

## 性能对比

### 请求体大小

| 方案 | 10MB 图片 | 请求体大小 | 网关通过率 |
|------|----------|-----------|-----------|
| **Supabase URL** | 上传到云存储 | 100 bytes | ✅ 100% |
| **压缩 Base64** | 压缩到 1-2MB | 1.3-2.7 MB | ⚠️ 取决于网关 |
| ~~原 Base64~~ | 直接编码 | 13.3 MB | ❌ 大概率失败 |

### 上传速度

假设网络上行速度 10 Mbps：

| 方案 | 10MB 图片上传时间 | Pika 请求时间 |
|------|------------------|--------------|
| **Supabase URL** | ~8 秒 | ~0.1 秒 |
| **压缩 Base64** | 0 秒（本地压缩） | ~1.6 秒 |

---

## 成本估算

### Supabase 免费版

- **存储空间**：1 GB
- **流量**：2 GB/月
- **请求数**：无限制

### 使用估算

假设每天上传 100 张图片，每张 2MB：

```
存储使用：100 张 × 2MB × 30天 = 6GB（需升级到 Pro 版）
流量使用：100 张 × 2MB × 30天 = 6GB（需升级）

建议：定期清理过期文件（默认 7 天）
优化后：100 张 × 2MB × 7天 = 1.4GB ✅ 免费版足够
```

### Supabase Pro 版（如需升级）

- **价格**：$25/月
- **存储**：100 GB
- **流量**：250 GB/月

---

## 两种上传方案对比

### 方案 1：Supabase Storage（推荐）

**流程**：
```
用户选择图片 → 上传到 Supabase → 获得 URL → 请求 Pika
```

**优点**：
- ✅ 请求体极小（~100 bytes）
- ✅ 不受网关限制
- ✅ 图片可复用
- ✅ CDN 加速

**缺点**：
- ⚠️ 需要配置 Supabase
- ⚠️ 依赖网络（上传时间 ~8秒）

---

### 方案 2：压缩 Base64（兜底）

**流程**：
```
用户选择图片 → 本地压缩 → 转 Base64 → 请求 Pika
```

**优点**：
- ✅ 零配置
- ✅ 无需网络上传
- ✅ 适合开发环境

**缺点**：
- ⚠️ 请求体较大（~2MB）
- ⚠️ 可能超过网关限制
- ⚠️ 图片不可复用

---

## 推荐配置

### 开发环境

```bash
# 可选配置 Supabase（推荐）
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx

# 如果未配置，自动使用压缩 Base64
```

### 生产环境

```bash
# 必须配置 Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
```

---

## 总结

| 特性 | Supabase Storage | 压缩 Base64 |
|------|-----------------|-------------|
| 请求体大小 | 100 bytes | 1-2 MB |
| 配置难度 | ⭐⭐ 中等 | ⭐ 简单 |
| 稳定性 | ⭐⭐⭐ 高 | ⭐⭐ 中等 |
| 成本 | 免费版足够 | 无成本 |
| 推荐场景 | 生产环境 | 开发/测试 |

**最佳实践**：
1. ✅ 配置 Supabase Storage（3 分钟）
2. ✅ 保留压缩 Base64 作为兜底
3. ✅ 定期清理过期文件（7 天）

---

## 下一步

1. [ ] 创建 `pika-images` 存储桶
2. [ ] 测试上传：`POST /api/supabase/upload`
3. [ ] 验证降级：临时关闭 Supabase，测试压缩 Base64
4. [ ] 生产部署：更新环境变量

完成！🎉
