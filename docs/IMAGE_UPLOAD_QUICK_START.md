# 图片上传优化 - 快速开始指南

## 🎯 问题与解决方案

### 原有问题
- ❌ **请求体过大**：10MB 图片 → 13.3MB Base64
- ❌ **网关限制**：超过 1-2MB 限制导致失败
- ❌ **生产环境失败率高**

### 解决方案
✅ **Supabase Storage**（优先）：上传到云存储，返回 URL（100 bytes）
✅ **压缩 Base64**（兜底）：本地压缩到 1-2MB

---

## ⚡ 5 分钟快速配置

### 步骤 1：创建 Supabase 存储桶（2 分钟）

1. 访问：https://supabase.com/dashboard/project/lxxbjwxwujcpgqfoquvv/storage/buckets

2. 点击 **New Bucket**

3. 配置：
   ```
   Name: pika-images
   Public bucket: ✅ 选中
   File size limit: 10 MB
   Allowed MIME types: image/jpeg, image/png, image/gif
   ```

4. 点击 **Create**

### 步骤 2：验证配置（1 分钟）

```bash
# 1. 启动后端
cd service
bun run dev

# 2. 测试连接（新终端）
curl http://localhost:3002/api/supabase/health
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

### 步骤 3：启动前端测试（2 分钟）

```bash
# 1. 启动前端
cd /Users/g/Desktop/工作/9.18开始优化工具平台/chatgpt-web-midjourney-proxy
bun run dev

# 2. 打开浏览器
open http://localhost:1002

# 3. 进入 Pika 页面
点击 "Pika" → 上传测试图片
```

---

## ✅ 测试清单

### 测试 1：Supabase Storage 上传

**操作**：
1. 打开 Pika 输入页面
2. 点击"选择图片"
3. 选择一张 < 10MB 的图片
4. 观察提示消息

**预期结果**：
```
✅ 图片上传成功 (2.5MB) - 使用云存储
```

**验证**：
- 查看数据库记录：
  ```sql
  SELECT * FROM temp_image_uploads ORDER BY created_at DESC LIMIT 1;
  ```

- 访问返回的 URL（应该能看到图片）

---

### 测试 2：自动降级到压缩 Base64

**操作**：
1. 临时停止后端：`Ctrl+C`
2. 修改环境变量（临时禁用 Supabase）：
   ```bash
   export SUPABASE_URL=""
   ```
3. 重启后端：`bun run dev`
4. 上传图片

**预期结果**：
```
✅ 图片压缩成功 (1.8MB) - 使用压缩Base64
```

**控制台日志**：
```
⚠️ Supabase 未配置或存储桶不存在，使用压缩 Base64
🔄 开始压缩图片...
✅ 压缩完成：8000KB → 1800KB
```

---

### 测试 3：文件大小限制

**操作**：上传一张 > 10MB 的图片

**预期结果**：
```
❌ 图片上传失败: 图片大小 12.5MB 超过限制 10MB
```

---

### 测试 4：文件格式限制

**操作**：上传一个非图片文件（如 PDF）

**预期结果**：
```
❌ 图片上传失败: 不支持的图片格式，仅支持：.jpg, .jpeg, .png, .gif
```

---

## 📊 工作流程

### 完整上传流程

```
┌─────────────────┐
│ 用户选择图片     │
└────────┬────────┘
         │
         ↓
┌─────────────────────────┐
│ 验证文件大小和格式        │
│ (< 10MB, jpg/png/gif)   │
└────────┬────────────────┘
         │
         ↓
   ┌─────────────┐
   │ 尝试 Supabase │
   │   Storage    │
   └─────┬────────┘
         │
    成功 │ 失败/未配置
         │
    ┌────┴────┐
    ↓         ↓
┌───────┐  ┌──────────┐
│返回 URL│  │压缩 Base64│
│~100字节│  │ ~1-2MB   │
└───┬───┘  └────┬─────┘
    │           │
    └─────┬─────┘
          │
          ↓
   ┌─────────────┐
   │ Pika 请求体  │
   │{"image":"xx"}│
   └─────────────┘
```

---

## 🔧 故障排查

### 问题 1：健康检查失败

```json
{
  "success": false,
  "error": "缺少 Supabase 配置：SUPABASE_URL 或 SUPABASE_SERVICE_KEY"
}
```

**解决**：
```bash
# 检查环境变量
cd service
cat .env | grep SUPABASE

# 如果为空，配置环境变量
echo "SUPABASE_URL=https://lxxbjwxwujcpgqfoquvv.supabase.co" >> .env
echo "SUPABASE_SERVICE_KEY=your_service_key" >> .env
```

---

### 问题 2：存储桶不存在

```json
{
  "success": false,
  "error": "存储桶 \"pika-images\" 不存在",
  "hint": "请在 Supabase 控制台创建存储桶..."
}
```

**解决**：按照"步骤 1"创建存储桶

---

### 问题 3：图片上传后无法访问

**症状**：返回了 URL 但访问 404

**原因**：存储桶未设置为 Public

**解决**：
1. Storage → pika-images → Settings
2. 勾选 **Public bucket**
3. 保存

---

## 📝 代码示例

### 前端使用

```vue
<script setup lang="ts">
import { smartUploadImage } from '@/api/imageUpload';

async function handleFileSelect(file: File) {
  try {
    // 智能上传（自动选择最佳方式）
    const result = await smartUploadImage(file);

    console.log('上传成功！');
    console.log('URL:', result.url);
    console.log('类型:', result.type);  // 'url' 或 'base64'
    console.log('大小:', result.size);  // 字节

    // 使用 URL 构造请求
    const pikaRequest = {
      image: result.url,
      promptText: '...',
      model: '1.5'
    };

  } catch (error) {
    console.error('上传失败:', error.message);
  }
}
</script>
```

### 后端 API

```typescript
// 上传接口
POST /api/supabase/upload
Content-Type: multipart/form-data

{
  file: <binary>
}

// 响应
{
  "success": true,
  "url": "https://lxxbjwxwujcpgqfoquvv.supabase.co/storage/v1/object/public/pika-images/2025-10-29/xxx.jpg",
  "path": "2025-10-29/xxx.jpg",
  "bucket": "pika-images",
  "size": 1234567
}
```

---

## 📈 性能监控

### 查看上传记录

```sql
-- 最近 10 次上传
SELECT
  file_name,
  file_size / 1024 / 1024 AS size_mb,
  created_at,
  public_url
FROM temp_image_uploads
ORDER BY created_at DESC
LIMIT 10;

-- 按日期统计
SELECT
  DATE(created_at) AS upload_date,
  COUNT(*) AS upload_count,
  SUM(file_size) / 1024 / 1024 AS total_mb
FROM temp_image_uploads
GROUP BY DATE(created_at)
ORDER BY upload_date DESC;
```

### 清理过期文件

```sql
-- 查看即将过期的文件（未来 1 天）
SELECT * FROM temp_image_uploads
WHERE expires_at < NOW() + INTERVAL '1 day'
  AND is_deleted = FALSE;

-- 标记过期文件为已删除
UPDATE temp_image_uploads
SET is_deleted = TRUE
WHERE expires_at < NOW()
  AND is_deleted = FALSE;
```

---

## 🎯 核心文件清单

### 前端
- ✅ `src/utils/imageCompressor.ts` - 图片压缩工具
- ✅ `src/api/imageUpload.ts` - 智能上传服务
- ✅ `src/views/luma/pikaInput.vue` - Pika 输入组件

### 后端
- ✅ `service/src/api/supabase-upload.ts` - Supabase 上传 API
- ✅ `service/src/index.ts` - API 路由注册（第 765 行）

### 数据库
- ✅ `temp_image_uploads` 表 - 上传记录

### 文档
- ✅ `docs/SUPABASE_STORAGE_SETUP.md` - Supabase 配置指南
- ✅ `docs/IMAGE_UPLOAD_QUICK_START.md` - 快速开始指南

---

## ✅ 完成检查

- [ ] Supabase 存储桶已创建
- [ ] 健康检查通过
- [ ] 测试 1：Supabase 上传成功
- [ ] 测试 2：自动降级成功
- [ ] 测试 3：文件大小限制有效
- [ ] 测试 4：文件格式限制有效
- [ ] 生产环境部署

---

## 🚀 部署到生产

### 环境变量检查

```bash
# Vercel / Docker 环境变量
SUPABASE_URL=https://lxxbjwxwujcpgqfoquvv.supabase.co
SUPABASE_SERVICE_KEY=your_production_service_key
```

### 构建和部署

```bash
# 1. 前端构建
bun run build

# 2. 后端构建
cd service
bun run build

# 3. 验证
curl https://your-domain.com/api/supabase/health
```

---

完成！现在您可以在 Pika 功能中使用优化后的图片上传了 🎉
