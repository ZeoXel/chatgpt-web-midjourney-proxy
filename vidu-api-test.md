# Vidu API 实现验证

## OpenAPI 规范对照检查

### ✅ API 端点
- **规范要求**: `POST /vidu/ent/v2/reference2video`
- **实现**: ✅ `createViduV2ReferenceToVideo()` 调用 `/ent/v2/reference2video`

### ✅ 必需参数
- **规范要求**: `model`, `images`, `prompt`
- **实现**: ✅ 在 `ViduV2Request` 接口中正确定义，并在函数中验证

### ✅ 可选参数
- **规范要求**: `duration`, `seed`, `aspect_ratio`, `resolution`, `movement_amplitude`
- **实现**: ✅ 在 `ViduV2Request` 接口中定义为可选字段

### ✅ 认证方式
- **规范要求**: `Authorization: Bearer {{YOUR_API_KEY}}`
- **实现**: ✅ 通过 `getHeaderAuthorization()` 正确设置 Bearer token

### ✅ 请求内容类型
- **规范要求**: `Content-Type: application/json`
- **实现**: ✅ 在 `viduFetch()` 中正确设置

### ✅ 响应结构
- **规范要求**: 包含 `id`, `state`, `model`, `input`, `output_params` 等字段
- **实现**: ✅ `ViduV2Response` 接口完整匹配 OpenAPI 规范

## 示例请求验证

根据 OpenAPI 规范提供的示例：

```json
{
  "model": "vidu2.0",
  "images": [
    "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-1.png",
    "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-2.png",
    "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-3.png"
  ],
  "prompt": "Santa Claus and the bear hug by the lakeside.",
  "duration": 4,
  "seed": "0",
  "aspect_ratio": "16:9",
  "resolution": "720p",
  "movement_amplitude": "auto"
}
```

**验证**: ✅ 我们的实现完全支持此请求格式。

## 使用示例

```typescript
import { createViduV2ReferenceToVideo } from '@/api/vidu';

// 调用示例
const result = await createViduV2ReferenceToVideo({
  model: "vidu2.0",
  images: [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  prompt: "A beautiful sunset over the mountains",
  duration: 4,
  aspect_ratio: "16:9",
  resolution: "720p",
  movement_amplitude: "auto"
});
```

## 环境变量配置

```bash
# 基础配置
VIDU_SERVER=https://api.302ai.cn
VIDU_KEY=your_api_key_here

# 可选：Pro 版本配置
VIDU_PRO_SERVER=https://api.302ai.cn
VIDU_PRO_KEY=your_pro_api_key_here
```

## 功能特性

### ✅ 完整实现的功能
1. **参考主体生成视频**: 根据 OpenAPI 规范实现
2. **任务状态轮询**: 自动检查任务完成状态
3. **本地存储管理**: 完整的任务历史记录
4. **错误处理**: 网络错误、API 错误的完善处理
5. **模型配置**: 支持所有 Vidu 模型版本
6. **价格计算**: 基于积分的价格估算
7. **多区域支持**: 支持香港等特殊区域服务器

### ✅ 兼容性
- ✅ 与现有项目架构完全兼容
- ✅ 遵循项目的认证和代理模式
- ✅ 统一的错误处理和日志记录
- ✅ 响应式状态管理

## 结论

✅ **实现完全符合 OpenAPI 规范要求**，包括：
- 正确的 API 端点和参数结构
- 完整的认证机制
- 标准的 HTTP 头部设置
- 完整的响应处理
- 错误处理和状态管理

该实现已可投入生产使用。