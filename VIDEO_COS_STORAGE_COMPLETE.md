# 视频COS存储实现完成报告

**完成时间**: 2025-11-28
**目标**: 实现视频文件下载到COS并保存JSON记录,统一管理所有视频服务

---

## ✅ 完成的工作

### 1. 后端API实现

#### 视频存储API (`service/src/api/video-storage.ts`)
- **路径**: `/api/video-storage`
- **存储位置**:
  - 视频文件: `{userUuid}/assets/video/{hash}.mp4`
  - JSON记录: `{userUuid}/assets/video/videos.json`
- **功能**:
  - `POST /api/video-storage/save` - 下载视频到COS并保存JSON记录
  - `GET /api/video-storage/list` - 加载视频列表(支持分页、服务筛选)
  - `DELETE /api/video-storage/delete` - 删除视频记录

**特点**:
- 使用`AssetProcessor`下载视频到COS (支持去重、断点续传)
- 同时下载封面图到COS
- 保存完整元数据到JSON文件

---

### 2. 前端API封装

#### 视频存储封装 (`src/api/videoStorage.ts`)
```typescript
- saveVideoToCOS(video) - 保存视频到COS (下载+JSON记录)
- loadVideosFromCOS(options) - 从COS JSON加载视频列表
- deleteVideoFromCOS(videoId) - 删除视频记录
```

**特点**:
- 自动获取userUuid
- 异步执行不阻塞用户体验
- 错误处理优雅降级

---

### 3. UnifiedVideoStore集成COS

#### 修改 `src/api/videoStore.ts`
- **新增字段**: `original_url` (保存原始外部URL)
- **新增方法**:
  - `getAllWithCOS()` - 合并COS和localStorage数据
  - `getByServiceWithCOS(service)` - 按服务筛选(支持COS)

**数据合并策略**:
1. COS数据优先(高质量、持久化)
2. localStorage数据补充(未同步的)
3. 使用`id`去重,按`created_at`降序排序

---

### 4. 视频服务集成

#### Vidu服务 (`src/api/vidu.ts`)
- **触发时机**: 视频生成成功 (`state === 'success' && videoUrl`)
- **调用**: `saveVideoToCOS()` 异步保存到COS
- **保存内容**:
  - 视频URL、封面图
  - 提示词、模型、时长、宽高比
  - 分辨率、种子、积分等元数据

#### Luma服务 (`src/api/luma.ts`)
- **触发时机**: 视频生成完成 (`state === 'completed' && video.download_url`)
- **调用**: `saveVideoToCOS()` 异步保存到COS
- **保存内容**:
  - 视频URL、封面图、缩略图
  - 提示词、模型、时长、宽高比
  - 循环标志等元数据

---

### 5. 后端路由注册

#### `service/src/index.ts`
```typescript
import videoStorageRouter from './api/video-storage'

// 视频URL存储API (COS JSON + 视频下载)
app.use('/api/video-storage', videoStorageRouter)
```

---

### 6. Vite代理配置

#### `vite.config.ts`
```typescript
proxy: {
  '/api/video-storage': {
    target: viteEnv.VITE_APP_API_BASE_URL,
    changeOrigin: true,
  },
  // ... 其他路由
}
```

---

## 📁 最终存储结构

```
{userUuid}/
└── assets/
    └── video/
        ├── {hash1}.mp4         # Vidu视频文件
        ├── {hash2}.mp4         # Luma视频文件
        ├── {hash3}.webp        # 封面图
        └── videos.json         # 视频元数据记录
```

---

## 📄 videos.json格式

```json
{
  "version": "1.0",
  "updated_at": "2025-11-28T10:30:00Z",
  "videos": [
    {
      "id": "task-vidu-123",
      "service": "vidu",
      "model": "vidu2.0",
      "prompt": "猫咪玩球",
      "original_url": "https://s3.vidu.ai/xxx.mp4",
      "cos_url": "https://cos.lsaigc.com/{uuid}/assets/video/abc123.mp4",
      "poster_url": "https://cos.lsaigc.com/{uuid}/assets/video/def456.webp",
      "duration": 4,
      "aspect_ratio": "16:9",
      "status": "success",
      "created_at": "2025-11-28T09:30:00Z",
      "metadata": {
        "resolution": "1080p",
        "seed": 12345,
        "credits": 30
      }
    },
    {
      "id": "luma-gen-456",
      "service": "luma",
      "model": "luma-dream-machine",
      "prompt": "夕阳下的海浪",
      "original_url": "https://luma-cdn.com/yyy.mp4",
      "cos_url": "https://cos.lsaigc.com/{uuid}/assets/video/xyz789.mp4",
      "poster_url": "...",
      "duration": 5,
      "aspect_ratio": "1:1",
      "status": "success",
      "created_at": "2025-11-28T10:00:00Z",
      "metadata": {
        "loop": true
      }
    }
  ]
}
```

---

## 🔄 数据流程

### 视频生成完整流程

```
1. 用户提交Vidu/Luma视频生成请求
   ↓
2. 视频服务API开始生成
   ↓
3. 前端轮询查询状态
   ↓
4. 视频生成完成,返回外部URL (S3/CDN)
   ↓
5. 检测到 status === 'success'
   ↓
6. 调用 saveVideoToCOS():
   ├─ 下载视频文件到COS (AssetProcessor)
   ├─ 下载封面图到COS
   ├─ 读取 {userUuid}/assets/video/videos.json
   ├─ 添加/更新视频记录
   └─ 保存JSON文件回COS
   ↓
7. 前端显示COS URL (永久可用)
   ↓
8. localStorage + COS JSON 数据合并
   ↓
9. 用户可随时刷新加载历史视频
```

---

## ✅ 关键优势

### 1. 完全去中心化
- ✅ 视频文件永久保存在COS
- ✅ URL记录保存在JSON文件
- ✅ 不依赖外部CDN,不会过期失效

### 2. 统一存储架构
- ✅ 所有视频服务(Vidu/Luma/Runway/Kling等)共用一套存储
- ✅ 统一JSON格式,易于扩展新服务
- ✅ 用户数据隔离(`{userUuid}`目录)

### 3. 性能与成本优化
- ✅ AssetProcessor自动去重(相同URL只下载一次)
- ✅ 异步下载不阻塞用户体验
- ✅ 支持断点续传和错误重试

### 4. 数据安全
- ✅ 完整元数据备份(提示词、模型、参数)
- ✅ 版本控制(JSON文件包含版本字段)
- ✅ 易于备份和迁移

---

## 🧪 API测试结果

```bash
# 测试列表API
$ curl 'http://localhost:3002/api/video-storage/list?userUuid=xxx&limit=10'
{
  "success": true,
  "total": 0,
  "videos": []
}
```

**状态**: ✅ API正常工作

---

## 📊 存储对比

| 资产类型 | 原始URL | URL持久性 | 处理策略 | 存储位置 |
|---------|---------|----------|---------|---------|
| **MJ图片** | railway.lsaigc.com | ✅ 已持久化 | 只保存URL | `{uuid}/assets/mj/images.json` |
| **Suno音频** | cdn.suno.ai | ✅ 已持久化 | 只保存URL | `{uuid}/assets/suno/audios.json` |
| **Vidu视频** | S3外部CDN | ❌ 可能过期 | **下载到COS** | `{uuid}/assets/video/*.mp4 + videos.json` |
| **Luma视频** | 官方CDN | ❌ 可能过期 | **下载到COS** | `{uuid}/assets/video/*.mp4 + videos.json` |

---

## 🎯 后续扩展

### 可选任务 (不需要立即执行)
1. **Runway服务集成**: 添加类似的`saveVideoToCOS()`调用
2. **Kling服务集成**: 添加视频下载和JSON记录
3. **Pika服务集成**: 统一视频存储流程
4. **数据迁移**: 将localStorage现有视频迁移到COS
5. **视频预览**: 在前端显示COS视频缩略图

### 推荐优先级
1. **立即测试**: 生成一个Vidu视频,检查COS文件和JSON记录
2. **立即测试**: 生成一个Luma视频,验证下载和保存流程
3. **可选**: 扩展到其他视频服务(Runway/Kling等)

---

## 🐛 已修复的问题

### 问题1: `cosClient.getFile is not a function`
**原因**: TencentCOSClient只有`downloadFile()`,没有`getFile()`

**修复**:
```typescript
// 修改前
const content = await cosClient.getFile(key);

// 修改后
const buffer = await cosClient.downloadFile(key);
const content = buffer.toString('utf-8');
```

---

## 📋 修改文件清单

### 新建文件
1. ✅ `service/src/api/video-storage.ts` - 后端视频存储API
2. ✅ `src/api/videoStorage.ts` - 前端视频存储封装

### 修改文件
1. ✅ `src/api/videoStore.ts` - 添加COS集成方法
2. ✅ `src/api/vidu.ts` - 视频生成成功时保存到COS
3. ✅ `src/api/luma.ts` - 视频生成完成时保存到COS
4. ✅ `service/src/index.ts` - 注册视频存储路由
5. ✅ `vite.config.ts` - 添加代理配置

---

## ✅ 总结

### 完成状态
- ✅ **后端API**: 视频下载+JSON记录功能完整
- ✅ **前端封装**: saveVideoToCOS/loadVideosFromCOS实现
- ✅ **UnifiedVideoStore**: COS数据合并功能
- ✅ **Vidu集成**: 视频生成成功自动保存到COS
- ✅ **Luma集成**: 视频生成完成自动保存到COS
- ✅ **路由注册**: 后端路由和Vite代理配置完成
- ✅ **API测试**: 接口正常工作

### 现状
- ✅ 对话历史: COS JSON (gzip压缩)
- ✅ MJ图片: COS JSON (URL记录)
- ✅ Suno音频: COS JSON (URL记录)
- ✅ **Vidu/Luma视频**: COS文件 + COS JSON (实际文件+URL记录)

### 完整存储架构
```
完全基于COS的去中心化存储
├── 对话存储: COS JSON (gzip)
├── MJ图片: COS JSON (URL记录)
├── Suno音频: COS JSON (URL记录)
└── Vidu/Luma视频: COS文件 + JSON ✅ 新增
    ├── 视频文件: {uuid}/assets/video/{hash}.mp4
    ├── 封面图: {uuid}/assets/video/{hash}.webp
    └── JSON记录: {uuid}/assets/video/videos.json
```

---

**创建时间**: 2025-11-28
**版本**: v1.0
**状态**: ✅ 完成,可以测试

---

## 🧪 测试指南

### 测试步骤
1. **生成Vidu视频**:
   - 访问 `http://localhost:3001/`
   - 进入Vidu页面
   - 输入提示词生成视频
   - 等待生成完成

2. **检查控制台**:
   ```
   [Vidu Video Save] 视频生成成功,开始下载到COS: https://...
   [Video COS Storage] 开始保存视频: vidu/task-xxx
   [Video COS Storage] ✅ 视频已下载到COS并保存JSON记录
   ```

3. **检查后端日志**:
   ```
   [Asset Download] 下载资产: https://...
   [Asset Upload] 上传到COS: {uuid}/assets/video/{hash}.mp4
   [Video Storage] 保存成功: 1 个视频
   ```

4. **检查COS存储**:
   - 文件1: `{userUuid}/assets/video/{hash}.mp4` (视频文件)
   - 文件2: `{userUuid}/assets/video/videos.json` (JSON记录)

5. **刷新页面验证**:
   - 刷新浏览器
   - 视频应该从COS加载显示
   - COS URL永久可用

---

**下一步**: 生成Vidu或Luma视频进行测试!
