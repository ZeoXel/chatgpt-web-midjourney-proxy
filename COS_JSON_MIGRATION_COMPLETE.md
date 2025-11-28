# COS JSON存储迁移完成报告

**完成时间**: 2025-11-28
**目标**: 将MJ和Suno的URL记录从Supabase PostgreSQL迁移到COS JSON文件

---

## ✅ 完成的工作

### 1. 后端API实现

#### MJ图片存储API (`service/src/api/mj-storage.ts`)
- **路径**: `/api/mj-storage`
- **存储位置**: `{userUuid}/assets/mj/images.json`
- **功能**:
  - `POST /api/mj-storage/save` - 保存单张MJ图片URL
  - `GET /api/mj-storage/list` - 加载MJ图片列表(支持分页)
  - `DELETE /api/mj-storage/delete` - 删除指定图片

#### Suno音频存储API (`service/src/api/suno-storage.ts`)
- **路径**: `/api/suno-storage`
- **存储位置**: `{userUuid}/assets/suno/audios.json`
- **功能**:
  - `POST /api/suno-storage/save` - 保存单首Suno音频URL
  - `GET /api/suno-storage/list` - 加载Suno音频列表(支持分页)
  - `DELETE /api/suno-storage/delete` - 删除指定音频

---

### 2. 前端API封装

#### MJ存储封装 (`src/api/mjStorage.ts`)
```typescript
- saveMJImageToCOS(image) - 保存MJ图片到COS JSON
- loadMJImagesFromCOS(options) - 从COS JSON加载图片列表
- deleteMJImageFromCOS(imageId) - 删除MJ图片
```

#### Suno存储封装 (`src/api/sunoStorage.ts`)
```typescript
- saveSunoAudioToCOS(audio) - 保存Suno音频到COS JSON
- loadSunoAudiosFromCOS(options) - 从COS JSON加载音频列表
- deleteSunoAudioFromCOS(audioId) - 删除Suno音频
```

---

### 3. 前端调用修改

#### `src/api/mjapi.ts`
- **移除**: `saveMJAssetToDatabase()` 函数(旧的数据库存储)
- **移除**: `getMJAssetsFromDatabase()` 函数(旧的数据库读取)
- **新增**: 调用 `saveMJImageToCOS()` 保存MJ图片URL到COS JSON
- **时机**: 当MJ生成完成时 (`SUCCESS` + `100%` + 有图片URL)

#### `src/api/suno.ts`
- **移除**: `saveSunoAssetToDatabase()` 函数(旧的数据库存储)
- **移除**: `getSunoAssetsFromDatabase()` 函数(旧的数据库读取)
- **新增**: 调用 `saveSunoAudioToCOS()` 保存Suno音频URL到COS JSON
- **时机**: 当Suno生成完成时 (`status === 'complete'`)

---

### 4. 后端路由注册

#### `service/src/index.ts`
```typescript
import mjStorageRouter from './api/mj-storage'
import sunoStorageRouter from './api/suno-storage'

app.use('/api/mj-storage', mjStorageRouter)
app.use('/api/suno-storage', sunoStorageRouter)
```

---

### 5. Vite代理配置

#### `vite.config.ts`
```typescript
proxy: {
  '/api/mj-storage': {
    target: viteEnv.VITE_APP_API_BASE_URL,
    changeOrigin: true,
  },
  '/api/suno-storage': {
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
├── chat/
│   └── conversations.json.gz          # 对话历史 (已实现)
└── assets/
    ├── mj/
    │   └── images.json                # MJ图片URL记录 ✅ 新增
    ├── suno/
    │   └── audios.json                # Suno音频URL记录 ✅ 新增
    └── video/
        ├── {hash}.mp4                 # Vidu/Luma镜像的实际文件
        └── videos.json                # 视频URL记录(未来)
```

---

## 📄 JSON文件格式

### MJ图片记录
```json
{
  "version": "1.0",
  "updated_at": "2025-11-28T08:00:00Z",
  "images": [
    {
      "id": "1764315338798733",
      "task_id": "1764315338798733",
      "prompt": "小狗 --v 7.0",
      "image_url": "https://railway.lsaigc.com/mj/image/1764315338798733",
      "action": "IMAGINE",
      "status": "SUCCESS",
      "created_at": "2025-11-28T07:30:00Z",
      "metadata": { ... }
    }
  ]
}
```

### Suno音频记录
```json
{
  "version": "1.0",
  "updated_at": "2025-11-28T08:00:00Z",
  "audios": [
    {
      "id": "5102ab18-e9a8-4769-a2f8-0d98c645f879",
      "task_id": "5102ab18-e9a8-4769-a2f8-0d98c645f879",
      "title": "我的歌曲",
      "audio_url": "https://cdn1.suno.ai/5102ab18.mp3",
      "image_url": "https://cdn2.suno.ai/image_5102ab18.webp",
      "lyric": "歌词内容...",
      "prompt": "快乐的流行歌",
      "duration": 180,
      "status": "complete",
      "created_at": "2025-11-28T07:30:00Z"
    }
  ]
}
```

---

## 🔄 数据流程

### MJ图片生成流程
```
1. 用户提交MJ绘图请求
   ↓
2. MJ API生成图片
   ↓
3. 返回 railway.lsaigc.com/mj/image/xxx (持久化URL)
   ↓
4. 前端检测生成完成 (SUCCESS + 100%)
   ↓
5. 调用 saveMJImageToCOS() 保存URL到COS JSON
   ↓
6. 后端读取 {userUuid}/assets/mj/images.json
   ↓
7. 添加新图片记录(或更新现有记录)
   ↓
8. 保存JSON文件回COS
   ↓
9. 前端直接显示MJ URL
```

### Suno音乐生成流程
```
1. 用户提交Suno音乐生成请求
   ↓
2. Suno API生成音乐
   ↓
3. 轮询查询状态 (FeedTask)
   ↓
4. 返回 cdn.suno.ai/xxx.mp3 (持久化URL)
   ↓
5. 前端检测生成完成 (status === 'complete')
   ↓
6. 调用 saveSunoAudioToCOS() 保存URL到COS JSON
   ↓
7. 后端读取 {userUuid}/assets/suno/audios.json
   ↓
8. 添加新音频记录(或更新现有记录)
   ↓
9. 保存JSON文件回COS
   ↓
10. 前端直接播放Suno URL
```

---

## ✅ 优势

1. **完全去中心化**: 不依赖Supabase PostgreSQL数据库
2. **用户数据隔离**: 每个用户独立的JSON文件,存储在各自的`{userUuid}`目录下
3. **统一存储路径**: 对话、图片、音频、视频都在同一个用户目录
4. **易于备份**: 直接下载JSON文件即可
5. **版本控制**: JSON文件包含版本字段,便于未来升级
6. **成本降低**: 不需要数据库维护成本
7. **性能提升**: 不下载MJ/Suno文件,节省流量和存储

---

## 🚨 注意事项

### Supabase数据库状态
- **旧的`/api/assets`路由**: 仍保留以便兼容,但新数据不再使用
- **`service/src/api/assets.ts`**: 文件保留但不再被新代码调用
- **环境变量**: `ENABLE_DATABASE` 可以设为 `false` 禁用数据库

### 数据迁移
- **现有数据**: Supabase中已有的MJ/Suno记录不会自动迁移
- **新数据**: 从现在开始,所有新生成的MJ图片和Suno音乐都会保存到COS JSON
- **历史数据**: 如需迁移历史数据,需要编写迁移脚本

---

## 🔧 后端启动状态

```
[COS Client] 初始化成功 { bucket: 'lsjx-1354453097', region: 'ap-beijing' }
[COS Client] 初始化成功 { bucket: 'lsjx-1354453097', region: 'ap-beijing' }
[COS Client] 初始化成功 { bucket: 'lsjx-1354453097', region: 'ap-beijing' }
[COS Client] 初始化成功 { bucket: 'lsjx-1354453097', region: 'ap-beijing' }
Server is running on port 3002
```

**说明**: 4个COS Client分别对应:
1. `mj-storage.ts` - MJ图片存储
2. `suno-storage.ts` - Suno音频存储
3. `asset-mirror.ts` - 资产镜像(Vidu/Luma)
4. `cos-upload.ts` - 通用COS上传

---

## 📊 各服务URL处理策略

| 服务 | URL来源 | 持久性 | 处理策略 | 存储位置 |
|-----|---------|--------|---------|---------|
| **MJ** | railway.lsaigc.com | ✅ 已持久化 | 只保存URL | `{userUuid}/assets/mj/images.json` |
| **Suno** | cdn.suno.ai | ✅ 已持久化 | 只保存URL | `{userUuid}/assets/suno/audios.json` |
| **Vidu** | S3外部CDN | ❓ 不确定 | 镜像到COS | `{userUuid}/assets/video/{hash}.mp4` |
| **Luma** | 官方CDN | ❓ 不确定 | 镜像到COS | `{userUuid}/assets/video/{hash}.mp4` |

---

## 🎯 下一步建议

### 可选任务
1. **数据迁移脚本**: 将Supabase现有数据迁移到COS JSON
2. **视频URL存储**: 为Vidu/Luma创建类似的JSON存储
3. **完全移除Supabase**: 删除`service/src/api/assets.ts`和相关依赖
4. **测试新流程**: 生成新的MJ图片和Suno音乐,验证保存到COS JSON

### 推荐优先级
1. **立即测试**: 生成一张MJ图片,检查是否保存到`{userUuid}/assets/mj/images.json`
2. **立即测试**: 生成一首Suno音乐,检查是否保存到`{userUuid}/assets/suno/audios.json`
3. **可选**: 编写数据迁移脚本(如果需要保留历史数据)

---

**创建时间**: 2025-11-28
**版本**: v1.0
**状态**: ✅ 完成并已启动后端

---

## 📝 修改文件清单

### 新建文件
1. `service/src/api/mj-storage.ts` - MJ图片COS JSON存储API
2. `service/src/api/suno-storage.ts` - Suno音频COS JSON存储API
3. `src/api/mjStorage.ts` - 前端MJ存储API封装
4. `src/api/sunoStorage.ts` - 前端Suno存储API封装

### 修改文件
1. `service/src/index.ts` - 注册新路由
2. `src/api/mjapi.ts` - 移除数据库存储,改用COS JSON
3. `src/api/suno.ts` - 移除数据库存储,改用COS JSON
4. `vite.config.ts` - 添加代理路由

### 保留文件(兼容)
1. `service/src/api/assets.ts` - 旧的Supabase数据库API(保留但不使用)
