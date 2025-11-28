# 腾讯云COS集成 - 快速开始

## ✅ 已完成的工作

### 1. SDK安装 ✓
- 安装 `cos-nodejs-sdk-v5@2.15.4`
- 无额外依赖,轻量集成

### 2. 核心组件 ✓
```
service/src/
├── storage/
│   ├── cos-client.ts         # COS客户端封装
│   └── unified-storage.ts    # 统一存储服务
└── routes/
    └── upload.ts             # 上传API路由
```

### 3. 测试验证 ✓
```bash
pnpm test:cos      # COS连接测试 - ✅ 通过
pnpm inspect:cos   # 存储桶检查 - ✅ 18个文件
pnpm test:upload   # 上传功能测试 - ✅ 所有测试通过
```

## 📋 当前存储桶状态

```
存储桶: lsjx-1354453097
区域: ap-beijing
CDN域名: https://cos.lsaigc.com
文件数: 18个 (约380MB)
```

**问题**: 文件直接堆在根目录,无组织结构

**解决方案**: 实施新的用户隔离目录结构

## 🚀 集成步骤(10分钟完成)

### 步骤1: 集成上传路由

编辑 `service/src/index.ts`,添加以下代码:

```typescript
// 1. 在文件顶部导入
import uploadRouter from './routes/upload';

// 2. 在现有路由之前注册(约在 router.post('/chat-process') 之前)
app.use('/api', authV2, uploadRouter);
```

**插入位置示例**:
```typescript
// ... 现有代码 ...

app.all('*', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  // ...
})

// 👇 在这里插入
app.use('/api', authV2, uploadRouter);

router.post('/chat-process', authV2, async (req, res) => {
  // ...
})
```

### 步骤2: 重启服务测试

```bash
# 开发模式
cd service
pnpm dev

# 测试上传
curl -X POST http://localhost:3002/api/upload \
  -H "x-ptoken: test_user_123" \
  -F "file=@test.png"
```

**预期响应**:
```json
{
  "success": true,
  "url": "https://cos.lsaigc.com/users/test_user_1/images/2025-11-27/...",
  "key": "users/test_user_1/images/2025-11-27/...",
  "size": 123456,
  "storage": "tencent-cos"
}
```

### 步骤3: 前端集成

更新前端API调用:

```typescript
// src/api/imageUpload.ts

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'x-ptoken': getAuthToken(), // 从store获取token
    },
    body: formData,
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error);
  }

  return result.url;
}
```

## 📁 新的目录结构

```
lsjx-1354453097/
├── users/
│   ├── test_user_123/          # 用户目录
│   │   ├── images/             # 图片
│   │   │   └── 2025-11-27/
│   │   │       └── 1764231804078-9w2c05.png
│   │   ├── videos/             # 视频
│   │   ├── audio/              # 音频
│   │   └── documents/          # 文档
│   └── anonymous/              # 未登录用户
│       ├── images/
│       └── videos/
│           └── 2025-11-27/
│               └── 1764231804341-bvnlya.mp4
└── [旧文件保持不变]
```

## 🔄 替换现有上传接口(可选)

### 方案A: 新旧并存(推荐)
```typescript
// 保留旧接口
/openapi/v1/upload  → 旧逻辑(本地/R2)

// 新增新接口
/api/upload         → 新逻辑(COS)

// 前端逐步切换
```

### 方案B: 直接替换
```typescript
// 编辑 service/src/index.ts

// 找到这段代码(约243行):
app.use('/openapi/v1/upload', authV2, upload.single('file'), (req, res) => {
  // 旧逻辑...
})

// 替换为:
import { UnifiedStorageService } from './storage/unified-storage';
const storageService = new UnifiedStorageService();

app.use('/openapi/v1/upload', authV2, upload2.single('file'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.json({ error: '未上传文件', created: Date.now() });
    }

    const userId = req.headers['x-ptoken'] || req.headers['x-vtoken'];

    const result = await storageService.upload({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      userId,
    });

    res.json({ url: result.url, created: Date.now() });
  } catch (error: any) {
    res.json({ error: error.message, created: Date.now() });
  }
});
```

## 🎯 API接口说明

### 1. 上传文件
```http
POST /api/upload
Content-Type: multipart/form-data
x-ptoken: {用户token}

Body:
file: <文件>
```

### 2. 列出文件
```http
GET /api/files?category=images
x-ptoken: {用户token}
```

### 3. 删除文件
```http
DELETE /api/files/{完整key路径}
x-ptoken: {用户token}
```

## ⚡ 性能优化(可选)

### 1. 配置CDN(已配置)
```env
COS_DOMAIN=https://cos.lsaigc.com
```
✅ 已启用,无需额外配置

### 2. 设置生命周期规则
在COS控制台设置:
- `users/anonymous/*` → 7天后删除
- `users/*/videos/*` → 30天后转低频存储

### 3. 图片处理
```typescript
// 生成缩略图
const thumbnailUrl = `${url}?imageMogr2/thumbnail/300x300`;

// 格式转换
const webpUrl = `${url}?imageMogr2/format/webp`;
```

## 🗑️ 清理旧代码(可选)

### 移除Supabase依赖
```typescript
// service/src/index.ts
// 删除以下行:
import supabaseUploadRouter from './api/supabase-upload';
app.use('/api/supabase', supabaseUploadRouter);
```

```env
# .env
# 删除以下配置:
ENABLE_SUPABASE_UPLOAD=false
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

### 移除本地存储(可选)
```typescript
// 如果完全迁移到COS,可以移除:
const storage = multer.diskStorage({...});
app.use('/uploads', express.static('uploads'));
```

## 📊 成本估算

### 当前使用量
- 存储: 380MB ≈ 0.38GB
- 流量: 预估 10GB/月

### 费用预估(腾讯云COS-北京)
```
存储费用: 0.38GB × ¥0.118/GB = ¥0.04/月
流量费用: 10GB × ¥0.50/GB = ¥5/月
请求费用: 可忽略

总计: ≈ ¥5/月
```

**对比**:
- Supabase免费额度: 1GB存储 + 2GB流量
- Cloudflare R2: 10GB存储 + 10GB流量(免费)
- **腾讯云COS**: 性价比高,国内访问快

## 🔒 安全建议

1. **配置存储桶权限**: 设为私有读写
2. **启用防盗链**: COS控制台 → 安全管理 → 防盗链
3. **设置签名有效期**: 敏感文件使用临时签名URL
4. **定期审计**: 检查存储桶访问日志

## 📝 迁移旧文件(可选)

创建迁移脚本:

```typescript
// service/migrate-old-files.ts
import { TencentCOSClient } from './src/storage/cos-client';

async function migrateOldFiles() {
  const cosClient = new TencentCOSClient();

  // 1. 列出所有旧文件(根目录)
  const oldFiles = await cosClient.listFiles('', 1000);

  // 2. 筛选需要迁移的文件
  const filesToMigrate = oldFiles.filter((f: any) => {
    return !f.Key.startsWith('users/') && !f.Key.startsWith('shared/');
  });

  console.log(`发现 ${filesToMigrate.length} 个待迁移文件`);

  // 3. 迁移逻辑(复制到新路径)
  // TODO: 根据业务需求实现
}
```

## ✅ 验证清单

- [ ] COS连接测试通过 (`pnpm test:cos`)
- [ ] 上传功能测试通过 (`pnpm test:upload`)
- [ ] 路由已集成到 `src/index.ts`
- [ ] 开发服务器启动正常 (`pnpm dev`)
- [ ] 上传接口响应正常 (`curl测试`)
- [ ] 前端可以正常上传文件
- [ ] 文件访问URL正常
- [ ] 用户文件隔离正确

## 🎉 完成!

现在你已经拥有:
- ✅ 简洁的单一存储方案(腾讯云COS)
- ✅ 自动的用户文件隔离
- ✅ 高效的直传机制(无本地落地)
- ✅ 可选的R2备份能力
- ✅ 完整的API接口

下一步:
1. 测试上传功能
2. 前端集成新API
3. 监控错误和性能
4. 配置CDN和生命周期规则

有问题请参考:
- 详细方案: `docs/COS_INTEGRATION_PLAN.md`
- 配置指南: `docs/TENCENT_COS_SETUP.md`
