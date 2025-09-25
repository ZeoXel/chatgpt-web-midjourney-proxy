# 🎬 Vidu API 测试工具

简洁的 Vidu API 测试套件，支持视频生成功能测试。

## 📁 项目结构

```
vidu-test/
├── frontend/           # Web 测试界面
│   ├── index.html     # 完整的交互式测试页面
│   └── script.js      # 前端交互逻辑
├── backend/           # 后端测试脚本
│   └── test.mjs       # Node.js 交互式测试脚本
├── docs/             # 文档
│   └── api-examples.md    # API 调用示例
└── README.md         # 项目说明
```

## 🚀 快速开始

### 方式1: Web 界面测试 (推荐)
```bash
# 在浏览器中打开
open frontend/index.html
```

特性：
- 4种生成模式选择
- 拖拽式图片上传
- 实时状态轮询
- 视频播放预览

### 方式2: 命令行测试
```bash
# 运行交互式测试脚本
node backend/test.mjs
```

## 🎯 支持的生成模式

1. **📝 文生视频** - 纯文本描述生成视频
2. **🖼️ 图生视频** - 单张图片生成动画
3. **🎞️ 首尾帧生视频** - 两张图片生成过渡动画
4. **📚 参考图生视频** - 多张参考图生成风格化视频

## 📋 API 端点

- **提交任务**: `POST /v1/video/generations`
- **查询状态**: `GET /v1/video/generations/{task_id}`

## 🔧 配置要求

- New API 服务运行在 `http://localhost:3000`
- 有效的 API Token
- 已配置 Vidu 渠道

## 📖 使用说明

详细的 API 调用示例请参考 `docs/api-examples.md`。

## ⚡ 快速测试

1. 启动 New API 服务
2. 获取 API Token
3. 选择测试方式 (Web界面/命令行)
4. 输入配置信息开始测试