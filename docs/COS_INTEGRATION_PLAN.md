# 腾讯云COS集成方案 - 简洁高效版

## 一、现状分析

### 当前存储桶状态
```
存储桶: lsjx-1354453097
区域: ap-beijing
文件数: 18个
总大小: 约380MB
```

**存在的问题**:
1. ❌ 文件直接堆在根目录,无组织结构
2. ❌ 缺少用户隔离机制
3. ❌ 多套存储方案并存(本地/R2/Supabase),复杂度高
4. ❌ 文件命名混乱(时间戳/uuid/普通名称混合)

### 现有上传端点
```typescript
// 分散在多处的上传接口:
/openapi/v1/upload          // OpenAI图片上传
/openapi/v1/audio/transcriptions  // 音频转录
/viggle/asset               // Viggle资源
/tripo/upload/sts           // Tripo 3D
/ideogram/remix             // Ideogram图片
```

## 二、设计方案(简洁高效)

### 核心原则
1. **单一存储**: 仅使用腾讯云COS,放弃Supabase等复杂方案
2. **用户隔离**: 基于token自动分目录
3. **可选备份**: R2作为备份,不强制依赖
4. **最小改动**: 复用现有authV2中间件

### 目录结构设计

```
lsjx-1354453097/
├── users/                          # 用户文件区
│   ├── {userId-hash}/              # 用户目录(MD5哈希,保护隐私)
│   │   ├── images/                 # 图片
│   │   │   ├── 2025-01-27/
│   │   │   │   ├── 1737988800000-a1b2c3.png
│   │   │   │   └── 1737988900000-d4e5f6.jpg
│   │   │   └── 2025-01-28/
│   │   ├── videos/                 # 视频
│   │   │   └── 2025-01-27/
│   │   │       └── 1737988800000-x1y2z3.mp4
│   │   ├── audio/                  # 音频
│   │   │   └── 2025-01-27/
│   │   └── documents/              # 文档
│   │       └── 2025-01-27/
│   └── anonymous/                  # 未登录用户临时文件
│       ├── images/2025-01-27/
│       ├── videos/2025-01-27/
│       └── audio/2025-01-27/
└── shared/                         # 公共资源(未来扩展)
    └── templates/
```

**设计要点**:
- ✅ 用户ID使用MD5哈希(16位),保护隐私
- ✅ 按类型分类(images/videos/audio/documents)
- ✅ 按日期分目录,便于管理和清理
- ✅ 文件名: `timestamp-random.ext`,避免冲突

### 用户识别机制

```typescript
// 从HTTP请求头提取用户标识
优先级:
1. x-ptoken     (主要token,前端传递)
2. x-vtoken     (虚拟token)
3. Authorization Bearer (备选)

// 目录映射
Token: "abc123def456..."  (长token)
→ MD5哈希: "a1b2c3d4e5f6g7h8"
→ 存储路径: users/a1b2c3d4e5f6g7h8/

Token: "user001" (短ID)
→ 直接使用: "user001"
→ 存储路径: users/user001/

无Token:
→ 存储路径: users/anonymous/
```

## 三、实现方案

### 架构图

```
┌─────────────┐
│  前端上传   │
└──────┬──────┘
       │ FormData + x-ptoken
       ▼
┌─────────────────────────┐
│  Express Router         │
│  /api/upload            │
│  (authV2中间件)         │
└──────┬──────────────────┘
       │ Buffer + userId
       ▼
┌─────────────────────────┐
│  UnifiedStorageService  │
│  - 构建存储路径         │
│  - 上传到COS            │
│  - (可选)备份到R2       │
└──────┬──────────────────┘
       │ COS SDK
       ▼
┌─────────────────────────┐
│   腾讯云COS             │
│   lsjx-1354453097       │
└─────────────────────────┘
```

### 核心代码结构

```
service/src/
├── storage/
│   ├── cos-client.ts           # COS客户端封装(已完成)
│   └── unified-storage.ts      # 统一存储服务(新增)
└── routes/
    └── upload.ts               # 上传路由(新增)
```

### 环境变量配置

```env
# 腾讯云COS(必需)
ENABLE_TENCENT_COS=true
COS_SECRET_ID=your-secret-id
COS_SECRET_KEY=your-secret-key
COS_BUCKET=lsjx-1354453097
COS_REGION=ap-beijing
COS_DOMAIN=https://your-cdn-domain.com  # 可选

# R2备份(可选,默认关闭)
ENABLE_R2_BACKUP=false
R2_ACCOUNT_ID=...
R2_KEY_ID=...
R2_KEY_SECRET=...
R2_BUCKET_NAME=...

# 废弃配置(可删除)
# ENABLE_SUPABASE_UPLOAD=false
# SUPABASE_URL=...
# SUPABASE_SERVICE_KEY=...
```

## 四、API接口设计

### 1. 上传文件

```http
POST /api/upload
Content-Type: multipart/form-data
x-ptoken: user-token-here

file=@image.png
```

**响应**:
```json
{
  "success": true,
  "url": "https://your-domain.com/users/a1b2c3d4/images/2025-01-27/1737988800000-x1y2z3.png",
  "key": "users/a1b2c3d4/images/2025-01-27/1737988800000-x1y2z3.png",
  "size": 1234567,
  "storage": "tencent-cos"
}
```

### 2. 列出用户文件

```http
GET /api/files?category=images
x-ptoken: user-token-here
```

**响应**:
```json
{
  "success": true,
  "files": [
    {
      "key": "users/a1b2c3d4/images/2025-01-27/xxx.png",
      "size": 1234567,
      "lastModified": "2025-01-27T12:00:00Z",
      "url": "https://..."
    }
  ]
}
```

### 3. 删除文件

```http
DELETE /api/files/users/a1b2c3d4/images/2025-01-27/xxx.png
x-ptoken: user-token-here
```

**响应**:
```json
{
  "success": true,
  "message": "文件已删除"
}
```

## 五、集成步骤

### 步骤1: 集成路由(5分钟)

编辑 `service/src/index.ts`:

```typescript
// 1. 导入上传路由
import uploadRouter from './routes/upload';

// 2. 注册路由(在现有路由之前)
app.use('/api', authV2, uploadRouter);
```

### 步骤2: 替换现有上传端点(可选)

**方案A: 渐进式迁移**
```typescript
// 保留旧端点,逐步迁移到新接口
// 旧: /openapi/v1/upload
// 新: /api/upload
// 前端逐步切换
```

**方案B: 直接替换**
```typescript
// 将 /openapi/v1/upload 指向新服务
app.use('/openapi/v1/upload', authV2, upload.single('file'), async (req, res) => {
  // 使用 UnifiedStorageService
  const result = await storageService.upload({...});
  res.json({ url: result.url, created: Date.now() });
});
```

### 步骤3: 清理旧文件(可选)

```bash
# 迁移存储桶中的旧文件到新结构
cd service
pnpm migrate:cos
```

## 六、跨平台同步策略

### 方案: 主存储+可选备份

```typescript
// 配置示例
ENABLE_TENCENT_COS=true    // 主存储,必需
ENABLE_R2_BACKUP=false     // 备份,可选

// 上传流程:
1. 上传到腾讯云COS (同步,阻塞)
2. 返回COS URL给前端
3. 异步备份到R2 (后台任务,不阻塞)
4. 备份失败仅记录日志,不影响主流程
```

**优势**:
- ✅ 响应快速(不等待备份)
- ✅ 可靠性高(主存储有保障)
- ✅ 灵活可选(R2可开可关)
- ✅ 成本可控(按需启用备份)

### R2备份实现(可选)

```typescript
// service/src/storage/unified-storage.ts

private async backupToR2(buffer: Buffer, key: string, mimeType: string) {
  if (!process.env.ENABLE_R2_BACKUP) return;

  try {
    const s3 = new AWS.S3({
      endpoint: new AWS.Endpoint(`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`),
      credentials: new AWS.Credentials(
        process.env.R2_KEY_ID!,
        process.env.R2_KEY_SECRET!
      ),
      signatureVersion: 'v4',
    });

    await s3.putObject({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }).promise();

    console.log('[R2 Backup] 备份成功:', key);
  } catch (error: any) {
    console.error('[R2 Backup] 备份失败:', error.message);
  }
}
```

## 七、废弃的方案

以下方案建议废弃,简化架构:

### ❌ Supabase Storage
```typescript
// 移除 service/src/api/supabase-upload.ts
// 移除 app.use('/api/supabase', supabaseUploadRouter)
// 删除相关环境变量
```

### ❌ 本地文件存储
```typescript
// 移除 multer.diskStorage
// 移除 ./uploads/ 目录依赖
// 所有文件直接上传COS,不落地本地
```

### ❌ 外部文件服务器
```typescript
// 移除 FILE_SERVER 配置
// 统一使用COS
```

## 八、性能优化

### 1. CDN加速
```env
# 配置CDN域名
COS_DOMAIN=https://cdn.yourdomain.com

# 访问URL将使用:
# https://cdn.yourdomain.com/users/xxx/images/...
# 而不是:
# https://lsjx-1354453097.cos.ap-beijing.myqcloud.com/...
```

### 2. 生命周期管理
```
COS控制台 → 生命周期规则:
- users/anonymous/*  → 7天后删除
- users/*/images/*   → 90天后转低频存储
- users/*/videos/*   → 30天后转低频存储
```

### 3. 图片处理(腾讯云CI)
```typescript
// 上传时自动生成缩略图
const thumbnailUrl = `${url}?imageMogr2/thumbnail/300x300`;

// 图片格式转换
const webpUrl = `${url}?imageMogr2/format/webp`;
```

## 九、安全策略

### 1. 防止路径遍历
```typescript
// 删除文件时验证权限
if (!key.startsWith(`users/${userId}/`)) {
  return res.status(403).json({ error: '无权删除此文件' });
}
```

### 2. 文件大小限制
```typescript
const upload = multer({
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
});
```

### 3. MIME类型验证
```typescript
const allowedTypes = [
  'image/png', 'image/jpeg', 'image/gif',
  'video/mp4', 'video/quicktime',
  'audio/mpeg', 'audio/wav',
];

if (!allowedTypes.includes(file.mimetype)) {
  return res.status(400).json({ error: '不支持的文件类型' });
}
```

## 十、迁移计划

### 阶段1: 测试验证(1天)
- [x] 安装COS SDK
- [x] 测试连接
- [x] 检查存储桶状态
- [ ] 集成新路由
- [ ] 测试上传功能

### 阶段2: 渐进部署(2-3天)
- [ ] 新功能使用新接口
- [ ] 旧功能保持不变
- [ ] 监控错误率和性能

### 阶段3: 全面迁移(1周)
- [ ] 前端切换到新API
- [ ] 迁移旧文件到新结构
- [ ] 移除废弃代码

### 阶段4: 优化清理(按需)
- [ ] 配置CDN加速
- [ ] 设置生命周期规则
- [ ] 移除R2/Supabase依赖

## 十一、成本估算

### 腾讯云COS费用(北京地域)
```
存储费用:
- 标准存储: ¥0.118/GB/月
- 100GB/月 ≈ ¥11.8

流量费用:
- CDN回源: ¥0.15/GB
- 外网流量: ¥0.50/GB
- 100GB/月 ≈ ¥15-50

请求费用:
- 读请求: ¥0.01/万次
- 写请求: ¥0.01/万次
- 可忽略不计

预估: 100GB存储 + 100GB流量 ≈ ¥30-60/月
```

### 对比
- Cloudflare R2: 免费10GB存储 + 10GB流量
- Supabase: 免费1GB存储 + 2GB流量
- **腾讯云COS: 性价比最高,国内访问速度快**

## 十二、FAQ

**Q: 为什么放弃Supabase?**
A: Supabase免费额度小(1GB),且增加了系统复杂度。COS性价比更高,国内访问更快。

**Q: R2备份是否必需?**
A: 不必需。COS本身有多副本保障,除非有合规或灾备需求。

**Q: 如何处理匿名用户文件?**
A: 自动存入 `users/anonymous/` 目录,定期清理(建议7天)。

**Q: 用户ID哈希是否安全?**
A: MD5哈希足够隐藏用户token,COS本身是私有访问,额外保障隐私。

**Q: 如何迁移现有文件?**
A: 编写脚本遍历旧文件,按新规则重新上传。旧文件保留一段时间后删除。

## 十三、总结

✅ **简洁**: 单一COS存储,移除Supabase等复杂方案
✅ **高效**: 内存直传,不落地本地磁盘
✅ **隔离**: 基于token自动用户分目录
✅ **灵活**: R2备份可选,按需启用
✅ **安全**: 路径验证、权限控制、MIME检查
✅ **可扩展**: 预留CDN、图片处理等扩展接口

**下一步**: 集成路由,测试上传,验证效果。
