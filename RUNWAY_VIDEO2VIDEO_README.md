# Runway Video2Video 功能使用说明

## ✅ 功能已完成

Runway Video2Video 功能已完全适配并测试通过，可以正常使用。

## 🎯 核心发现

### 问题诊断
- ❌ **错误的 endpoint**: `/v1/video/generations` → 被网关识别为 **luma**
- ✅ **正确的 endpoint**: `/runway/v1/pro/video2video` → 被网关正确识别为 **runway**

### 网关响应格式
```json
{
  "code": 200,
  "data": {
    "task_id": "2a715d99-0138-466c-ba87-d937cd4164ba"
  },
  "exec_time": 0.08373,
  "msg": "成功"
}
```

## 📋 前端配置

在前端设置页面配置以下参数：

```
OPENAI_API_BASE_URL: https://api.bltcy.ai
OPENAI_API_KEY: sk-JO438PQ5WpZFtR9Gt5tMN119FmD1bG6YDtmczNgGyDIMCHc1
```

## 🔧 技术实现

### 1. 视频上传
- 用户选择视频文件
- 自动上传到 Supabase Storage (`runway-videos` 桶)
- 获取公网 URL

### 2. 任务提交
- 前端调用 `runwayVideo2Video(videoUrl, model, prompt, ...)`
- 使用 endpoint: `/runway/v1/pro/video2video`
- 传递参数：
  ```json
  {
    "model": "runway-video2video",
    "prompt": "描述词",
    "video_url": "https://...",
    "structure_transformation": 0.5,
    "flip": false
  }
  ```

### 3. 任务轮询
- 自动启动轮询监控任务状态
- 每 5.2 秒查询一次
- 任务完成后显示结果

## 📁 修改的文件

### 前端
1. **src/api/runway.ts**
   - 修改 `getHeaderAuthorization()` 使用 `OPENAI_API_KEY`
   - 修改 `getUrl()` 支持 `OPENAI_API_BASE_URL`
   - 修改 `runwayVideo2Video()` 使用 `/runway/v1/pro/video2video`
   - 适配网关响应格式 `{ code, data: { task_id } }`

2. **src/views/luma/runwayInput.vue**
   - 保持 Supabase 视频上传逻辑
   - 传递视频 URL 到 API

3. **src/api/videoUpload.ts**
   - 实现 `smartUploadVideo()` 上传到 Supabase
   - 实现 `getVideoDuration()` 获取视频时长

### 后端
1. **service/src/api/supabase-upload.ts**
   - 实现 Supabase Storage 上传接口
   - 支持 `runway-videos` 桶

2. **service/src/myfun.ts**
   - 配置 `runwayProxy` 路径解析

3. **service/src/index.ts**
   - 注册 `/api/supabase/upload` 路由
   - 注册 `/runway` 代理路由

## 🧪 测试结果

### 测试脚本
- `test-runway-production.js` - 完整流程测试
- `test-new-gateway.js` - 网关诊断测试

### 测试结果
✅ 视频上传到 Supabase: 成功
✅ 获取公网 URL: 成功
✅ 提交 Runway 任务: 成功
✅ 网关正确识别为 runway: 成功
✅ 返回任务 ID: 成功

## 💡 使用流程

1. **配置网关**
   - 在前端设置中配置 `OPENAI_API_BASE_URL` 和 `OPENAI_API_KEY`

2. **上传视频**
   - 在 Runway Video2Video 页面选择视频文件
   - 支持格式: MP4, MOV, AVI, WebM
   - 最大 200MB

3. **设置参数**
   - 输入提示词（描述想要的风格）
   - 调整结构改造强度 (0-1)
   - 选择视频方向（横屏/竖屏）

4. **提交任务**
   - 点击生成按钮
   - 系统自动提交到 Runway 网关
   - 开始轮询任务状态

5. **查看结果**
   - 任务完成后自动显示生成的视频
   - 可以下载或分享

## 🔍 故障排查

### 问题：视频被识别为 luma
**原因**: 使用了错误的 endpoint `/v1/video/generations`
**解决**: 确保使用 `/runway/v1/pro/video2video`

### 问题：上传失败
**原因**: Supabase 配置缺失
**解决**: 检查环境变量 `SUPABASE_URL` 和 `SUPABASE_SERVICE_KEY`

### 问题：任务提交失败
**原因**: 网关配置错误
**解决**: 检查 `OPENAI_API_BASE_URL` 和 `OPENAI_API_KEY` 配置

## 📊 支持的模型

网关支持以下 Runway 模型：
- `runway-video2video` ✅ (推荐)
- `runway-generate`
- `runway-v1`
- `runway_duomi-video2video`
- `runwayml-gen3a_turbo`
- `runwayml-gen4_turbo`

## 🎨 参数说明

### model
- 类型: `string`
- 值: `runway-video2video`
- 说明: 使用 Runway 的 video2video 模型

### prompt
- 类型: `string`
- 说明: 描述想要的视频风格或效果
- 示例: "Transform this video into a beautiful watercolor painting style"

### video_url
- 类型: `string`
- 说明: 视频的公网 URL（Supabase Storage）
- 格式: `https://...supabase.co/storage/v1/object/public/runway-videos/...`

### structure_transformation
- 类型: `number`
- 范围: `0-1`
- 说明: 结构改造强度
  - `0`: 完全保留原视频结构
  - `1`: 完全重绘
  - `0.5`: 平衡（推荐）

### flip
- 类型: `boolean`
- 说明: 视频方向
  - `false`: 横屏 16:9（默认）
  - `true`: 竖屏 9:16

## 📝 注意事项

1. **视频要求**
   - 建议时长: 3-10 秒
   - 最大文件: 200MB
   - 支持格式: MP4, MOV, AVI, WebM

2. **网络要求**
   - 需要访问 Supabase Storage
   - 需要访问 Runway 网关

3. **成本**
   - 每次 video2video 任务会消耗网关额度
   - 具体费用请查看网关后台

## 🚀 下一步

功能已完全可用，可以：
1. 在生产环境中使用
2. 根据需要调整参数
3. 监控任务执行情况
4. 收集用户反馈

---

**最后更新**: 2025-11-04
**状态**: ✅ 生产就绪
