# COS资产删除功能 - 快速开始

## 1分钟快速理解

### 问题
之前删除MJ图片、Suno音频、视频、模型时，**只删除了JSON记录，COS上的文件还在**，浪费存储空间。

### 解决方案
现在删除记录时，**自动删除COS上的实际文件**，一键清理。

## 立即使用

### 前端调用（无需修改）

前端删除API**已存在且正常工作**，现在会自动触发COS文件删除：

```typescript
// MJ图片删除
import { deleteMJImageFromCOS } from '@/api/mjStorage'
await deleteMJImageFromCOS(imageId)

// Suno音频删除
import { deleteSunoAudioFromCOS } from '@/api/sunoStorage'
await deleteSunoAudioFromCOS(audioId)

// 视频删除
import { deleteVideoFromCOS } from '@/api/videoStorage'
await deleteVideoFromCOS(videoId)

// 3D模型删除（新增）
import { deleteModelFromCOS } from '@/api/modelStorage'
await deleteModelFromCOS(modelId)

// 通用图片删除
import { deleteImageFromCOS } from '@/api/imageStorage'
await deleteImageFromCOS(imageId)
```

### 后端自动处理

后端已集成COS文件删除，**无需手动调用**：

1. ✅ 删除JSON记录
2. ✅ 自动提取所有COS URL
3. ✅ 验证用户权限
4. ✅ 批量删除COS文件
5. ✅ 返回成功

## 测试验证

### 方法1: 运行测试脚本
```bash
cd service
npx tsx test-asset-cleanup.ts
```

### 方法2: 实际操作测试
```bash
# 1. 启动服务
cd service && pnpm dev

# 2. 打开前端
pnpm dev

# 3. 在对应模块执行删除操作
# - MJ画廊 → 删除图片
# - Suno音乐 → 删除音频
# - 视频列表 → 删除视频
# - 3D模型 → 删除模型

# 4. 查看日志确认COS文件已删除
```

### 预期日志输出
```
[MJ Storage] 删除图片: { userUuid: 'xxx', imageId: 'yyy' }
[Asset Cleanup] 从记录删除资产
[Asset Cleanup] 找到 1 个URL，开始删除...
[Asset Cleanup] ✅ 删除成功: user123/assets/mj/xxx.jpg
[MJ Storage] ✅ COS文件删除成功: 1 个文件
```

## 常见场景

### 场景1: 删除MJ图片
**操作**: 在MJ画廊点击删除按钮
**效果**:
- ✅ JSON记录删除
- ✅ COS图片文件删除

### 场景2: 删除Suno音频
**操作**: 在Suno音乐库点击删除按钮
**效果**:
- ✅ JSON记录删除
- ✅ 音频文件删除
- ✅ 封面图删除
- ✅ 大封面图删除

### 场景3: 删除视频
**操作**: 在视频列表点击删除按钮
**效果**:
- ✅ JSON记录删除
- ✅ 视频文件删除
- ✅ 封面图删除

### 场景4: 删除3D模型
**操作**: 在模型列表点击删除按钮
**效果**:
- ✅ JSON记录删除
- ✅ GLB模型文件删除
- ✅ STL模型文件删除
- ✅ PBR模型文件删除
- ✅ 预览图删除

## 故障排查

### 问题: 删除记录成功，但COS文件还在

#### 检查1: 查看日志
```bash
# 查看后端日志，搜索 "Asset Cleanup"
cd service
grep "Asset Cleanup" logs/app.log
```

#### 检查2: 确认URL格式
```typescript
// COS URL必须是以下格式之一
✅ https://bucket.cos.ap-guangzhou.myqcloud.com/user/...
✅ https://cos.lsaigc.com/user/...
❌ https://external-site.com/...  (外部URL会跳过)
```

#### 检查3: 手动删除
```bash
curl -X POST http://localhost:3002/api/asset-cleanup/delete \
  -H "Content-Type: application/json" \
  -d '{
    "userUuid": "your_uuid",
    "url": "https://your-cos-url"
  }'
```

### 问题: API调用失败

#### 检查服务器运行
```bash
# 确认服务器在3002端口运行
curl http://localhost:3002/api/asset-cleanup/delete
```

#### 检查COS配置
```bash
# 确认环境变量
echo $ENABLE_TENCENT_COS  # 应该是 true
echo $COS_SECRET_ID       # 应该有值
```

## 高级用法

### 直接调用删除API

如果需要手动删除COS文件：

```typescript
// 删除单个文件
await fetch('/api/asset-cleanup/delete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userUuid: 'user123',
    url: 'https://bucket.cos.ap-guangzhou.myqcloud.com/user123/test.jpg'
  })
})

// 批量删除
await fetch('/api/asset-cleanup/delete-batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userUuid: 'user123',
    urls: [
      'https://bucket.cos.ap-guangzhou.myqcloud.com/user123/1.jpg',
      'https://bucket.cos.ap-guangzhou.myqcloud.com/user123/2.jpg'
    ]
  })
})

// 从记录删除
await fetch('/api/asset-cleanup/delete-from-record', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userUuid: 'user123',
    record: {
      image_url: 'https://...',
      poster_url: 'https://...'
    }
  })
})
```

## 相关文档

- **详细集成文档**: `COS_DELETE_INTEGRATION.md`
- **功能总结**: `COS_DELETE_SUMMARY.md`
- **测试脚本**: `service/test-asset-cleanup.ts`

## 核心优势

| 功能 | 之前 | 现在 |
|------|------|------|
| 删除JSON记录 | ✅ | ✅ |
| 删除COS文件 | ❌ | ✅ |
| 存储空间管理 | 手动清理 | 自动清理 |
| 用户体验 | 需要额外操作 | 一键完成 |

## 开始使用

无需任何配置，**现有删除功能自动升级**！

只要你的项目已启用COS（`ENABLE_TENCENT_COS=true`），删除操作就会自动清理COS文件。

🎉 **享受自动化的COS资产管理吧！**
