# COS JSON存储方案设计

**目标**: 将MJ和Suno的URL信息从Supabase PostgreSQL迁移到COS JSON文件

---

## 📁 COS存储结构

```
{userUuid}/
├── chat/
│   └── conversations.json.gz          # 对话历史 (已实现)
├── assets/
│   ├── mj/
│   │   └── images.json               # MJ图片URL记录
│   ├── suno/
│   │   └── audios.json               # Suno音频URL记录
│   └── video/
│       ├── {hash}.mp4                # Vidu/Luma镜像的实际文件
│       └── videos.json               # 视频URL记录
```

---

## 📄 JSON文件格式

### MJ图片记录: `{userUuid}/assets/mj/images.json`
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
      "metadata": {
        "model": "midjourney",
        "progress": "100%"
      }
    }
  ]
}
```

### Suno音频记录: `{userUuid}/assets/suno/audios.json`
```json
{
  "version": "1.0",
  "updated_at": "2025-11-28T08:00:00Z",
  "audios": [
    {
      "id": "5102ab18-e9a8-4769-a2f8-0d98c645f879",
      "task_id": "5102ab18-e9a8-4769-a2f8-0d98c645f879",
      "title": "我的歌曲",
      "audio_url": "https://cdn1.suno.ai/5102ab18-e9a8-4769-a2f8-0d98c645f879.mp3",
      "image_url": "https://cdn2.suno.ai/image_5102ab18.webp",
      "image_large_url": "https://cdn2.suno.ai/image_large_5102ab18.webp",
      "lyric": "歌词内容...",
      "prompt": "快乐的流行歌",
      "duration": 180,
      "status": "complete",
      "created_at": "2025-11-28T07:30:00Z"
    }
  ]
}
```

### 视频记录: `{userUuid}/assets/video/videos.json`
```json
{
  "version": "1.0",
  "updated_at": "2025-11-28T08:00:00Z",
  "videos": [
    {
      "id": "vidu-xxx",
      "service": "vidu",
      "task_id": "xxx",
      "prompt": "飞翔的鸟",
      "video_url": "https://cos.lsaigc.com/{userUuid}/assets/video/{hash}.mp4",
      "original_url": "https://s3.amazonaws.com/vidu/xxx.mp4",
      "thumbnail_url": "...",
      "duration": 5,
      "status": "success",
      "created_at": "2025-11-28T07:30:00Z"
    }
  ]
}
```

---

## 🔄 API设计

### 后端API

#### 1. MJ图片存储
```typescript
// service/src/api/mj-storage.ts

POST /api/mj-storage/save
{
  "userUuid": "90b3b85c-...",
  "image": {
    "id": "xxx",
    "prompt": "小狗",
    "image_url": "https://railway.lsaigc.com/mj/image/xxx",
    ...
  }
}

GET /api/mj-storage/list?userUuid=xxx
Response: { images: [...] }
```

#### 2. Suno音频存储
```typescript
// service/src/api/suno-storage.ts

POST /api/suno-storage/save
{
  "userUuid": "90b3b85c-...",
  "audio": {
    "id": "xxx",
    "audio_url": "https://cdn1.suno.ai/xxx.mp3",
    ...
  }
}

GET /api/suno-storage/list?userUuid=xxx
Response: { audios: [...] }
```

---

## 📝 实现步骤

### Phase 1: 创建后端存储API
1. 创建 `service/src/api/mj-storage.ts`
2. 创建 `service/src/api/suno-storage.ts`
3. 实现读取/写入COS JSON文件的逻辑

### Phase 2: 修改前端调用
1. 修改 `src/api/mjapi.ts` - 调用新的MJ存储API
2. 修改 `src/api/suno.ts` - 调用新的Suno存储API
3. 移除所有Supabase数据库调用

### Phase 3: 数据迁移
1. 从Supabase导出现有数据
2. 转换为JSON格式
3. 上传到COS对应的用户目录

### Phase 4: 清理
1. 移除 `service/src/api/assets.ts` (Supabase存储)
2. 移除前端对 `/api/assets` 的调用
3. 更新环境变量,禁用数据库

---

## ✅ 优势

1. **完全去中心化**: 不依赖Supabase数据库
2. **用户数据隔离**: 每个用户独立的JSON文件
3. **易于备份**: 直接下载JSON文件即可
4. **版本控制**: JSON文件可以添加版本字段
5. **成本降低**: 不需要数据库维护成本

---

## 🚀 下一步

需要我开始实施这个方案吗? 我将:
1. 创建后端MJ/Suno存储API
2. 修改前端调用
3. 移除Supabase依赖

---

**创建时间**: 2025-11-28
**状态**: 设计中,等待确认
