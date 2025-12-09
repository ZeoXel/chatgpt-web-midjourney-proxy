# 对话区域图片生成功能集成指南

## 概述

已成功将图片生成功能（nano-banana、dall-e-3等）集成到对话界面中。用户现在可以直接在对话中选择图片生成模型，输入描述文字即可生成图片。

## 功能特性

### ✅ 已实现功能

1. **智能模型识别**
   - 自动检测用户选择的模型类型
   - 图片生成模型（nano-banana、dall-e-3等）自动路由到图片生成API
   - 文本模型正常进行对话

2. **支持的图片生成模型**
   - `nano-banana` - 基础版本
   - `nano-banana-2` - Pro版本（默认推荐）
   - `dall-e-3` - OpenAI DALL-E 3
   - `flux` 系列
   - `ideogram` 系列
   - `seedream` 系列

3. **图片编辑功能**
   - 支持上传参考图片
   - 基于参考图生成变体
   - 多图参考支持

4. **对话流程集成**
   - 用户输入显示在对话中
   - 生成过程显示"思考中..."状态
   - 生成的图片直接展示在对话流中
   - 支持多图生成（多图会以数组形式展示）

## 使用方法

### 基础用法

1. **打开对话页面**
   - 进入任意对话会话

2. **选择图片生成模型**
   - 点击设置（或模型选择器）
   - 从下拉列表选择图片生成模型：
     - `nano-banana` - 基础版
     - `nano-banana-2` - Pro版（推荐）
     - `dall-e-3` - DALL-E 3

3. **输入生成描述**
   - 在输入框输入图片描述
   - 例如："一只可爱的橙色小猫在阳光下玩耍"
   - 按回车或点击发送

4. **查看生成结果**
   - 系统会显示"思考中..."
   - 生成完成后图片直接显示在对话中
   - 可以点击图片查看大图

### 高级用法：图片编辑

1. **上传参考图**
   - 点击输入框左侧的附件图标📎
   - 选择一张或多张参考图片
   - 图片会显示在输入框上方

2. **输入编辑指令**
   - 例如："将这张图片改成卡通风格"
   - 或："基于这张图，生成一个夜晚版本"

3. **生成结果**
   - 系统会基于参考图和描述生成新图片
   - 支持多种编辑操作

## 技术实现

### 修改的文件

1. **`src/views/mj/aiGpt.vue`**
   - 添加了 `isDallImageModel` 和 `subGPT` 导入
   - 在 `gpt.submit` 事件处理中添加图片生成模型检测逻辑
   - 当检测到图片生成模型时，构建图片生成请求并调用 `subGPT` API

2. **`src/views/mj/aiModel.vue`**
   - 在模型配置列表中添加了图片生成模型选项
   - 用户可直接从下拉菜单选择

### 关键代码逻辑

```typescript
// 检测是否为图片生成模型
if (isDallImageModel(model)) {
    // 构建图片生成请求
    let imageData = {
        model: model,
        prompt: dd.prompt,
        size: '1024x1024',
        quality: 'medium',
        n: 1
    };

    // 如果有参考图，添加到请求
    if (dd.fileBase64 && dd.fileBase64.length > 0) {
        imageData.base64Array = dd.fileBase64.map(base64 => ({
            base64: base64,
            file: null
        }));
    }

    // 调用图片生成API
    await subGPT({
        action: 'gpt.dall-e-3',
        data: imageData
    }, outMsg);
}
```

## API 兼容性

本功能完全兼容 OpenAI Chat Completions API 格式：

```bash
POST /v1/chat/completions
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "model": "nano-banana",
  "messages": [
    {
      "role": "user",
      "content": "画一只猫"
    }
  ],
  "stream": false
}
```

响应格式：
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "生成的图片描述和URL"
    },
    "finish_reason": "stop"
  }]
}
```

## 配置说明

### 默认配置

- **默认模型**: nano-banana-2
- **默认尺寸**: 1024x1024 (将自动转换为 aspect_ratio)
- **默认画质**: medium
- **生成数量**: 1张

### 尺寸映射（nano-banana系列）

系统会自动将传统尺寸转换为 aspect_ratio：

- `1024x1024` → `1:1`
- `1792x1024` → `16:9`
- `1024x1792` → `9:16`
- `1536x1024` → `3:2`
- `1024x1536` → `2:3`

### 画质设置（nano-banana-2）

- `high` → 4K
- `medium` → 2K (默认)
- `low` → 1K

## 故障排除

### 问题：图片生成失败

**可能原因**：
1. API Key 余额不足
2. 模型渠道不可用
3. 参数组合不支持

**解决方案**：
1. 检查 API Key 余额
2. 尝试使用其他模型
3. 调整尺寸或画质设置

### 问题：参考图上传失败

**可能原因**：
1. 图片格式不支持
2. 图片过大
3. 网络问题

**解决方案**：
1. 使用 PNG、JPG 格式
2. 压缩图片到合理大小
3. 检查网络连接

## 未来优化建议

1. **UI 增强**
   - 添加尺寸/画质选择器到输入框
   - 生成参数可视化调整
   - 历史生成记录快速访问

2. **功能扩展**
   - 批量生成支持
   - 图片编辑高级选项
   - 风格模板预设

3. **性能优化**
   - 图片预加载
   - 缓存优化
   - 加载状态优化

## 相关文档

- [nano-banana API 文档](根据您提供的 OpenAPI 规范)
- [现有 DALL-E 组件](src/views/mj/aiDall.vue)
- [图片生成 API](src/api/openapi.ts)

## 测试建议

### 基础测试

1. **文本到图片**
   ```
   模型: nano-banana-2
   输入: "一只可爱的橙色小猫"
   预期: 生成猫的图片
   ```

2. **图片编辑**
   ```
   模型: nano-banana-2
   上传: 一张风景图
   输入: "改成夜晚"
   预期: 生成夜晚版本
   ```

3. **模型切换**
   ```
   步骤1: 使用 gpt-5.1 正常对话
   步骤2: 切换到 nano-banana-2
   步骤3: 输入图片描述
   预期: 正确生成图片而非文字回复
   ```

### 边界测试

1. 空提示词处理
2. 超长提示词处理
3. 特殊字符处理
4. 多图同时生成
5. 网络中断恢复

## 更新日志

### 2025-12-05

- ✅ 集成图片生成功能到对话界面
- ✅ 添加智能模型检测
- ✅ 支持 nano-banana、nano-banana-2、dall-e-3
- ✅ 实现参考图上传和编辑功能
- ✅ 添加模型配置选项

---

**开发者**: Claude Code
**日期**: 2025-12-05
**版本**: 1.0.0
