# ChatGPT Web Midjourney Proxy

[English](./README_EN.md) | [Русский язык](./README_RU.md) | [Français](./README_FR.md) | [한국어](./README_KR.md) | [Tiếng Việt](./README_VN.md) | [Türkçe](./README_TR.md)

## 项目简介
- ChatGPT Web Midjourney Proxy 来源于 [ChenZhaoYu/chatgpt-web](https://github.com/Chanzhaoyu/chatgpt-web)，并融合 [midjourney-proxy](https://github.com/novicezk/midjourney-proxy)、Suno-API、[Luma-API](https://github.com/LumaAI-API/Luma-API) 等多模态中转能力，提供聊天、绘图、音频、视频在内的生成式 AI 体验。
- 项目仍然遵循 MIT 协议，仅发布于 GitHub，禁止任何倒卖或私下付费服务。可通过 https://vercel.ddaiai.com 体验线上示例。
- 目标是让个人开发者和小团队以统一界面管理不同模型的调用，支持自定义 API Key、模型路由、多模态上传与回调等扩展。

![cover](./docs/mj2a1.jpg)

## 技术栈与模块
- **前端（`src/`）**：Vue 3 + Vite + Pinia + Tailwind，界面位于 `views/`，共享组件在 `components/`，业务逻辑抽离至 `hooks/`，全局状态在 `store/`，静态资源落在 `src/assets/`。
- **服务层（`service/`）**：基于 Express 的 Node 中转，`service/src/` 聚合 OpenAI、Midjourney、Suno、Luma、Runway、Viggle 等上游 API 的鉴权、队列与转发逻辑；`service/build/` 用于部署产物。
- **自动化与文档**：`scripts/` 提供批量运维脚本，`doc/`、`docs/`、`docker-compose/`、`kubernetes/`、`VERCEL_DEPLOYMENT*.md` 记录各环境部署策略与调试手册。
- **质量保证**：依赖 `pnpm lint`、`pnpm type-check` 与 `pnpm --filter service lint` 等命令维持前后端一致性，`PHASE1_TEST_GUIDE.md`、`TEST_RESULTS.md`、`FIX_FRONTEND_PROXY.md` 汇总人工验证与常见问题。

## 核心功能矩阵
- **聊天与智能体**：原生 ChatGPT Web 功能、自定义模型/上下文/回复条数、GPTs/Gizmo 多模态、TTS & Whisper、实时语音识别、超链模型切换（one-api/new-api）。
- **绘图与图像**：Midjourney 全量能力（文生图、垫图、变换、局部重绘、延展、高清、混图、种子、不同机器人）、Flux、DALL·E、Ideogram、InsightFace 人脸替换、本地 localforage 图像缓存。
- **音频创作**：Suno 独立模块（歌词、曲风、音频二次创作）、Udio 文生音乐、Suno 音频换音频、Riffusion 等多模态拓展。
- **视频与动画**：Runway、Luma、Pika、Kling、Viggle 等文生/图生视频方案，覆盖舞蹈、延展、高清放大、动画制作；并支持 Kling 绘图、视频编辑。
- **系统与配置**：自定义 API Key/ Base URL、R2/API/Container/MyUrl 上传能力、菜单开关、系统通知、统计埋点、主题切换、Vision 模型选择与 GPTs 多模态对话。

## 典型使用场景
- **多模态创作工作站**：在单一界面完成文本、图像、音频、视频互转，适合创意设计、营销内容、音乐制作团队。
- **自托管智能体门户**：通过自定义模型与 API Key，将 ChatGPT、GPTs、Midjourney、Suno 等资源统一出口，方便企业私有部署或代理运营。
- **素材协作与演示**：结合本地缓存、上传策略、系统通知功能，让运营团队快速同步生成进度，并通过 Demo 站点向客户演示成果。

## 补充说明
- 项目不会提供任何形式的卖号、付费群或私下服务，如遇此类信息请提高警惕。
- 建议在部署前阅读 `DEPLOYMENT.md`、`VERCEL_DEPLOYMENT_GUIDE.md` 等指南，根据所需模型开启对应服务。
- 欢迎通过 Issue/PR 参与共建，提交前请运行 `pnpm lint`、`pnpm type-check` 及相关服务脚本确保质量。
