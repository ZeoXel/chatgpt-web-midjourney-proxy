# 资产镜像实施方案

## 📋 方案概述

**目标**: 将所有AI生成的外部资产(Suno音频、MJ图片、Vidu视频等)自动下载到COS,统一存储管理。

**核心思路**:
1. AI服务生成完成后,调用资产镜像API
2. 后端下载外部URL到COS
3. 返回COS URL并替换原URL
4. 前端无需改动,只是URL变成COS域名

**优势**:
- ✅ 资产持久化,不依赖外部CDN
- ✅ 统一管理,所有资产在COS
- ✅ 最小改动,利用现有AssetProcessor
- ✅ 失败降级,镜像失败仍使用原URL

---

## 🏗️ 架构设计

### 后端API (已实现)

**文件**: `service/src/api/asset-mirror.ts`

**端点**:
```
POST /api/asset-mirror/single  - 镜像单个资产
POST /api/asset-mirror/batch   - 批量镜像资产
GET  /api/asset-mirror/cache-stats - 缓存统计
POST /api/asset-mirror/clear-cache - 清除缓存
```

**工作流程**:
```
前端调用 → AssetProcessor → 下载外部URL → 上传到COS → 返回COS URL
```

**存储路径**:
```
users/{userId}/assets/{type}/{md5_hash}.{ext}

示例:
users/sk-evZ7Ao43/assets/audio/8f3e2b1d9c4a5e6f.mp3
users/sk-evZ7Ao43/assets/image/a7d3c2f1e4b9.png
users/sk-evZ7Ao43/assets/video/f2e1d3c4b5a6.mp4
```

---

### 前端API (已实现)

**文件**: `src/api/assetMirror.ts`

**核心函数**:
```typescript
// 镜像单个URL
mirrorAssetToCOS(url: string): Promise<string>

// 批量镜像
mirrorAssetsToCOS(urls: string[]): Promise<Map<string, string>>

// Suno专用
mirrorSunoAudio(sunoMedia: any): Promise<any>

// MJ专用
mirrorMJImage(mjData: any): Promise<any>

// 视频专用
mirrorVideoUrl(videoData: any): Promise<any>
```

**特性**:
- 自动跳过已镜像的URL
- 失败时返回原URL,不影响用户体验
- 支持批量处理,提高效率

---

## ✅ 已完成的集成

### 1. Suno 音频镜像 ✅

**文件**: `src/api/suno.ts`

**集成点**: `FeedTask()` 轮询完成时

**代码**:
```typescript
if (item.status === "complete") {
    mirrorSunoAudio(item).then(mirroredItem => {
        // 保存镜像后的对象(URL已替换为COS)
        sunoS.save(mirroredItem);

        // 可选: 保存到数据库
        saveSunoAssetToDatabase(mirroredItem);
    });
}
```

**镜像内容**:
- `audio_url` - 音频文件
- `image_url` - 封面图(小)
- `image_large_url` - 封面图(大)

**效果**:
```
原URL: https://cdn.suno.ai/xxx.mp3
COS URL: https://cos.lsaigc.com/users/sk-evZ7Ao43/assets/audio/xxx.mp3
```

---

## 🔨 待完成的集成

### 2. Midjourney 图片镜像 ❌

**需要修改的文件**: `src/api/mjapi.ts` 或 MJ相关文件

**集成位置**: MJ图片生成完成回调

**参考代码**:
```typescript
import { mirrorMJImage } from './assetMirror';

// 在MJ图片完成时
if (mjResult.status === 'SUCCESS') {
    mirrorMJImage(mjResult).then(mirrored => {
        // 保存镜像后的数据
        saveMJData(mirrored);
    });
}
```

**需要镜像的字段**:
- `imageUrl` - 单张图片
- `images[]` - 图片数组
- `upscaled_image_url` - 放大后的图片

---

### 3. Vidu 视频镜像 ❌

**需要修改的文件**: Vidu相关API文件

**集成位置**: Vidu视频生成完成回调

**参考代码**:
```typescript
import { mirrorVideoUrl } from './assetMirror';

// 在Vidu视频完成时
if (viduResult.status === 'completed') {
    mirrorVideoUrl(viduResult).then(mirrored => {
        // 保存镜像后的数据
        saveViduData(mirrored);
    });
}
```

**需要镜像的字段**:
- `video_url` - 视频文件
- `videoUrls[]` - 视频数组
- `imageUrl` - 封面图

---

### 4. Luma 视频镜像 ❌

**需要修改的文件**: Luma相关API文件

**参考代码**: 同Vidu,使用 `mirrorVideoUrl()`

---

### 5. Runway 视频镜像 ❌

**需要修改的文件**: Runway相关API文件

**参考代码**: 同Vidu,使用 `mirrorVideoUrl()`

---

### 6. Kling 视频镜像 ❌

**需要修改的文件**: Kling相关API文件

**参考代码**: 同Vidu,使用 `mirrorVideoUrl()`

---

### 7. Udio 音频镜像 ❌

**需要修改的文件**: Udio相关API文件

**参考代码**: 类似Suno,使用 `mirrorAssetToCOS()`

---

## 🧪 测试方法

### 1. 测试单个镜像API

```bash
curl -X POST http://localhost:3002/api/asset-mirror/single \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://cdn.suno.ai/test-audio.mp3",
    "userId": "test-user"
  }'
```

**预期响应**:
```json
{
  "success": true,
  "originalUrl": "https://cdn.suno.ai/test-audio.mp3",
  "cosUrl": "https://cos.lsaigc.com/users/test-user/assets/audio/xxx.mp3",
  "type": "audio",
  "size": 2048576
}
```

---

### 2. 测试前端集成

**步骤**:
1. 启动前端: `pnpm dev`
2. 生成Suno音乐
3. 等待生成完成
4. 检查浏览器控制台日志:
   ```
   [Asset Mirror] 开始镜像资产: https://cdn.suno.ai/xxx.mp3
   [Asset Mirror] ✅ 镜像成功: ... → https://cos.lsaigc.com/...
   ```
5. 检查LocalStorage中的URL是否已替换为COS
6. 验证音乐播放正常

---

### 3. 验证COS文件

**腾讯云控制台**:
1. 登录腾讯云COS控制台
2. 进入存储桶: `lsjx-1354453097`
3. 查看 `users/` 目录
4. 确认文件已上传

**CLI验证**:
```bash
curl -I https://cos.lsaigc.com/users/test-user/assets/audio/xxx.mp3
# 应返回 HTTP 200
```

---

## 📊 存储结构示例

```
lsjx-1354453097 (COS存储桶)
├── users/
│   ├── sk-evZ7Ao43/  (基于API Key的用户目录)
│   │   ├── assets/
│   │   │   ├── audio/
│   │   │   │   ├── 8f3e2b1d9c4a5e6f.mp3  (Suno音频)
│   │   │   │   └── a7d3c2f1e4b9d6a8.mp3  (Udio音频)
│   │   │   ├── image/
│   │   │   │   ├── f2e1d3c4b5a6c7d8.png  (MJ图片)
│   │   │   │   └── c5b4a3d2e1f6g7h8.jpg  (封面图)
│   │   │   └── video/
│   │   │       ├── d4c3b2a1f5e6d7c8.mp4  (Vidu视频)
│   │   │       ├── e6d5c4b3a2f1g8h9.mp4  (Luma视频)
│   │   │       └── a2b3c4d5e6f7g8h9.mp4  (Runway视频)
│   │   ├── images/  (用户上传的图片)
│   │   └── videos/  (用户上传的视频)
│   └── anonymous/
│       └── assets/
└── {uuid}/  (对话历史等其他数据)
```

---

## ⚙️ 配置说明

### 必需环境变量

```bash
# 腾讯云COS (必需)
ENABLE_TENCENT_COS=true
COS_SECRET_ID=your-secret-id
COS_SECRET_KEY=your-secret-key
COS_BUCKET=lsjx-1354453097
COS_REGION=ap-beijing
COS_DOMAIN=https://cos.lsaigc.com

# 资产处理 (可选,默认true)
ENABLE_ASSET_PROCESSING=true
```

### 前端配置

前端无需额外配置,只需确保:
1. API Key 已配置 (`gptServerStore.myData.OPENAI_API_KEY`)
2. 网络可访问 `/api/asset-mirror`

---

## 🚨 注意事项

### 1. 失败降级策略

镜像失败时:
- ✅ 返回原URL,不影响用户体验
- ✅ 记录日志但不抛出错误
- ✅ 用户仍可正常使用功能

### 2. URL去重

- AssetProcessor内置URL缓存
- 相同URL只下载一次
- 使用MD5哈希避免重复

### 3. 用户隔离

- 基于API Key生成用户目录
- 不同用户资产分开存储
- 隐私保护(API Key MD5处理)

### 4. 性能考虑

- 镜像操作异步执行,不阻塞主流程
- 批量镜像支持,提高效率
- 失败重试机制(在AssetProcessor中)

---

## 📝 实施步骤

### Phase 1: Suno (已完成 ✅)
- [x] 创建后端API `/api/asset-mirror`
- [x] 创建前端封装 `assetMirror.ts`
- [x] 集成到 `suno.ts` FeedTask
- [x] 测试Suno音频镜像

### Phase 2: Midjourney (待实施)
- [ ] 定位MJ图片完成回调
- [ ] 调用 `mirrorMJImage()`
- [ ] 测试MJ图片镜像

### Phase 3: Vidu/Luma/Runway/Kling (待实施)
- [ ] 定位视频完成回调
- [ ] 调用 `mirrorVideoUrl()`
- [ ] 测试视频镜像

### Phase 4: 其他服务 (待实施)
- [ ] Udio音频
- [ ] Ideogram图片
- [ ] Flux图片
- [ ] Pika视频

---

## 🎯 预期效果

**用户视角**:
- 使用体验无变化
- 资产加载可能更快(COS国内CDN)
- 资产永久保存,不怕外部CDN失效

**开发视角**:
- 所有资产统一在COS管理
- 便于备份和迁移
- 便于数据分析和统计

**运营视角**:
- 资产持久化,降低依赖风险
- 统一存储,便于成本控制
- 可设置生命周期策略自动清理

---

## 🔗 相关文件

**后端**:
- `service/src/api/asset-mirror.ts` - 镜像API
- `service/src/storage/asset-processor.ts` - 资产处理器
- `service/src/storage/cos-client.ts` - COS客户端
- `service/src/index.ts` - 路由注册

**前端**:
- `src/api/assetMirror.ts` - 镜像API封装
- `src/api/suno.ts` - Suno集成示例

**文档**:
- `COS_MIGRATION_COMPLETE.md` - COS迁移报告
- `TEST_REPORT.md` - 功能测试报告

---

**创建日期**: 2025-11-28
**最后更新**: 2025-11-28
**状态**: Suno已完成,其他服务待集成
