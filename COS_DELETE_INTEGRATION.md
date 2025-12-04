# COS资产删除功能集成文档

## 概述

本次更新为各模块添加了**COS资产自动删除**功能，确保在删除JSON记录时，同时删除COS上存储的实际文件资产（图片、视频、音频、模型文件）。

## 实现架构

### 1. 核心组件

#### 1.1 资产清理API (`service/src/api/asset-cleanup.ts`)
新增统一的COS资产清理服务，提供以下接口：

- **POST `/api/asset-cleanup/delete`** - 删除单个COS文件
- **POST `/api/asset-cleanup/delete-batch`** - 批量删除COS文件
- **POST `/api/asset-cleanup/delete-from-record`** - 从记录中提取URL并删除

**核心功能：**
- ✅ 智能识别COS URL（支持标准域名和自定义域名）
- ✅ 用户权限验证（防止误删其他用户文件）
- ✅ 幂等性设计（重复删除不报错）
- ✅ 批量删除支持

#### 1.2 集成的存储API

已为以下模块集成COS资产删除功能：

| 模块 | 后端API | 前端API | 资产类型 |
|------|---------|---------|----------|
| **MJ图片** | `service/src/api/mj-storage.ts` | `src/api/mjStorage.ts` | 图片 |
| **Suno音频** | `service/src/api/suno-storage.ts` | `src/api/sunoStorage.ts` | 音频 + 封面图 |
| **视频** | `service/src/api/video-storage.ts` | `src/api/videoStorage.ts` | 视频 + 封面图 |
| **3D模型** | `service/src/api/model-storage.ts` | `src/api/modelStorage.ts` | 多格式模型 + 预览图 |
| **通用图片** | `service/src/api/image-storage.ts` | `src/api/imageStorage.ts` | 图片 |

### 2. 删除流程

```
用户点击删除按钮
    ↓
前端调用删除API (如 deleteMJImageFromCOS)
    ↓
后端存储API处理
    ├─ 1. 加载JSON记录列表
    ├─ 2. 找到要删除的记录
    ├─ 3. 从列表中移除记录
    ├─ 4. 保存更新后的JSON到COS
    └─ 5. 🔥 调用 asset-cleanup API
           ├─ 提取记录中所有COS URL
           ├─ 验证URL属于当前用户
           └─ 批量删除COS文件
    ↓
返回成功响应
```

### 3. 智能URL提取

`delete-from-record` 接口会自动识别以下URL字段：

```typescript
[
  'image_url',        // 图片URL
  'cos_url',          // COS镜像URL
  'original_url',     // 原始URL
  'audio_url',        // 音频URL
  'video_url',        // 视频URL
  'poster_url',       // 封面图URL
  'preview_url',      // 预览图URL
  'cos_model_url',    // 主模型URL
  'cos_base_model_url',   // 基础模型URL
  'cos_pbr_model_url',    // PBR模型URL
  'cos_stl_model_url',    // STL模型URL
  'cos_preview_url',  // 模型预览图URL
  'image_large_url',  // 大图URL
]
```

## 使用示例

### MJ图片删除
```typescript
// 前端调用
await deleteMJImageFromCOS(imageId);

// 后端自动处理
// 1. 删除 images.json 中的记录
// 2. 删除 COS 上的图片文件
```

### 视频删除
```typescript
// 前端调用
await deleteVideoFromCOS(videoId);

// 后端自动处理
// 1. 删除 videos.json 中的记录
// 2. 删除视频文件 (cos_url)
// 3. 删除封面图 (poster_url)
```

### 3D模型删除
```typescript
// 前端调用
await deleteModelFromCOS(modelId);

// 后端自动处理
// 1. 删除 models.json 中的记录
// 2. 删除主模型文件
// 3. 删除预览图
// 4. 删除其他格式文件（GLB/STL/PBR等）
```

## 安全性保障

### 1. 用户隔离
```typescript
function validateUserKey(key: string, userUuid: string): boolean {
  // Key必须以userUuid开头
  return key.startsWith(`${userUuid}/`);
}
```

### 2. URL验证
```typescript
function extractCOSKey(url: string): string | null {
  // 仅处理COS域名的URL
  // - https://*.cos.*.myqcloud.com/*
  // - https://cos.lsaigc.com/*
}
```

### 3. 错误处理
- 文件不存在时不报错（幂等性）
- 删除失败不影响JSON记录删除
- 详细日志记录所有操作

## 测试验证

### 测试场景

#### 1. MJ图片删除测试
```bash
# 1. 生成MJ图片
# 2. 确认文件在COS中存在
# 3. 点击删除按钮
# 4. 验证：
#    - JSON记录已删除
#    - COS文件已删除
```

#### 2. Suno音频删除测试
```bash
# 1. 生成Suno音频
# 2. 确认音频+封面图在COS中存在
# 3. 点击删除按钮
# 4. 验证：
#    - JSON记录已删除
#    - 音频文件已删除
#    - 封面图已删除
```

#### 3. 视频删除测试
```bash
# 测试各视频服务：Vidu, Luma, Runway, Kling, Pika
# 验证视频文件和封面图都被正确删除
```

#### 4. 3D模型删除测试
```bash
# 测试Tripo模型
# 验证所有格式文件（GLB/STL/PBR）和预览图都被删除
```

### 预期日志输出

#### 成功删除
```
[MJ Storage] 删除图片: { userUuid: 'xxx', imageId: 'yyy' }
[Asset Cleanup] 从记录删除资产: { userUuid: 'xxx', recordKeys: [...] }
[Asset Cleanup] 找到 1 个URL，开始删除...
[Asset Cleanup] ✅ 删除成功: xxx/assets/mj/images/xxx.jpg
[MJ Storage] ✅ COS文件删除成功: 1 个文件
```

#### 文件不存在（正常）
```
[Asset Cleanup] ⚠️ 文件已不存在: xxx/assets/xxx.jpg
[MJ Storage] ✅ COS文件删除成功: 1 个文件
```

#### 非COS URL（跳过）
```
[Asset Cleanup] ⚠️ 非COS URL，跳过: https://external-site.com/xxx.jpg
[MJ Storage] ✅ COS文件删除成功: 0 个文件
```

## 配置要求

### 环境变量
确保以下环境变量已配置：

```env
# 启用腾讯云COS
ENABLE_TENCENT_COS=true

# COS配置
COS_SECRET_ID=your_secret_id
COS_SECRET_KEY=your_secret_key
COS_BUCKET=your_bucket_name
COS_REGION=ap-guangzhou
COS_DOMAIN=https://cos.lsaigc.com  # 可选
```

## 升级说明

### 从旧版本升级
- ✅ 向后兼容：旧记录删除时也会尝试清理COS文件
- ✅ 渐进式删除：即使COS清理失败，JSON记录仍会删除
- ✅ 无需数据迁移

### 已知限制
1. **历史数据**：升级前已删除的记录对应的COS文件不会被清理
2. **外部URL**：非COS域名的URL不会被删除（按设计）
3. **共享资产**：相同URL被多个记录引用时，第一次删除会清理文件

## 未来优化

### 短期
- [ ] 添加"删除确认"对话框
- [ ] 显示待删除文件大小
- [ ] 批量删除支持

### 中期
- [ ] 回收站功能（软删除）
- [ ] 删除历史记录
- [ ] 存储空间统计

### 长期
- [ ] 引用计数（防止误删共享资产）
- [ ] 定期清理孤立文件
- [ ] 成本优化建议

## 故障排查

### 问题1: 删除记录成功，但COS文件仍存在

**原因：**
- URL格式不匹配
- 用户权限验证失败
- 网络问题

**解决：**
```bash
# 1. 检查日志
grep "Asset Cleanup" service/logs/app.log

# 2. 手动删除
curl -X POST http://localhost:3002/api/asset-cleanup/delete \
  -H "Content-Type: application/json" \
  -d '{"userUuid":"xxx","url":"https://..."}'
```

### 问题2: COS删除请求失败

**原因：**
- COS服务未启用
- API端口错误

**解决：**
```bash
# 检查环境变量
echo $ENABLE_TENCENT_COS

# 检查API可达性
curl http://localhost:3002/api/asset-cleanup/delete
```

## 总结

本次更新实现了**完整的COS资产生命周期管理**：

✅ **保存时**：下载外部资产到COS
✅ **使用时**：读取COS URL
✅ **删除时**：同步清理COS文件（新增）

这确保了**存储空间的有效利用**和**用户数据的完整性管理**。
