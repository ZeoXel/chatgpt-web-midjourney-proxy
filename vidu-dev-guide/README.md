# Vidu API 接入开发指南

这是基于现有 Kling 和 Luma API 实现模式，为 ChatGPT Web Midjourney Proxy 项目接入 Vidu API 的完整开发指南。

## 📋 目录结构

```
vidu-dev-guide/
├── README.md                           # 本文件 - 开发指南概览
├── 01-frontend-api-integration.md      # 前端 API 集成模式
├── 02-backend-proxy-implementation.md  # 后端代理实现模式
├── 03-environment-and-routing-config.md # 环境配置和路由配置
├── 04-implementation-checklist.md      # 实现检查清单
└── examples/                           # 示例代码
    ├── vidu.ts                        # 前端 API 客户端示例
    ├── viduStore.ts                   # 前端数据存储示例
    └── myfun-vidu-proxy.ts           # 后端代理实现示例
```

## 🎯 项目概述

Vidu 是一个视频生成 AI 服务，本指南将帮助你将 Vidu API 集成到现有的多模态 AI 应用中。

### 核心功能
- **文本转视频**: 根据文本描述生成视频
- **图片转视频**: 基于上传图片生成视频动画
- **任务管理**: 异步任务状态跟踪和轮询
- **本地存储**: 任务和结果的持久化存储

## 🏗️ 架构模式

### 整体架构
```
前端 (Vue.js) ──API调用──> 后端代理 (Express) ──HTTP代理──> Vidu API
     │                        │                         │
     │                        │                         │
 本地存储                  认证中间件                API认证
(viduStore)              (authV2)               (Bearer Token)
```

### 技术栈匹配
- **前端**: Vue 3 + TypeScript + Vite (与现有技术栈一致)
- **后端**: Node.js + Express + express-http-proxy (与现有实现一致)
- **存储**: LocalStorage (与 Luma/Kling 模式一致)
- **认证**: Bearer Token + 自定义认证中间件

## 📚 实现指南

### 第一步: 前端 API 集成
查看 [01-frontend-api-integration.md](./01-frontend-api-integration.md)

**关键要点**:
- 统一的 fetch 客户端实现
- 认证头部处理机制
- 本地存储数据管理
- 异步任务轮询策略

### 第二步: 后端代理实现
查看 [02-backend-proxy-implementation.md](./02-backend-proxy-implementation.md)

**关键要点**:
- Express HTTP 代理配置
- 认证中间件集成
- 文件上传处理机制
- 错误处理和日志记录

### 第三步: 环境配置和路由
查看 [03-environment-and-routing-config.md](./03-environment-and-routing-config.md)

**关键要点**:
- 环境变量配置方案
- Vite 开发代理设置
- 后端路由注册规则
- 生产环境部署配置

## 🚀 快速开始

### 1. 环境变量配置
```bash
# 后端 .env 文件
VIDU_SERVER=https://api.vidu.com
VIDU_KEY=your_vidu_api_key_here
OPENAI_API_KEY=fallback_key
AUTH_SECRET_KEY=your_secret_key
```

### 2. 安装依赖
```bash
# 后端依赖（应该已安装）
cd service && npm install

# 前端依赖（应该已安装）  
npm install
```

### 3. 创建核心文件
```bash
# 前端 API 文件
src/api/vidu.ts
src/api/viduStore.ts

# 后端代理更新
service/src/myfun.ts  # 添加 viduProxy
service/src/index.ts  # 添加路由注册
```

### 4. 更新配置文件
```bash
# 前端代理配置
vite.config.ts       # 添加 /vidu 代理

# Store 配置更新
src/store/           # 添加 Vidu 相关状态
```

## 📋 实现检查清单

### 前端实现 ✅
- [ ] 创建 `src/api/vidu.ts` 文件
- [ ] 创建 `src/api/viduStore.ts` 文件  
- [ ] 更新 `src/api/index.ts` 导出
- [ ] 在 store 中添加 Vidu 相关状态
- [ ] 在 `vite.config.ts` 中添加代理配置

### 后端实现 ✅
- [ ] 在 `service/src/myfun.ts` 添加 `viduProxy`
- [ ] 在 `service/src/myfun.ts` 添加 `viduProxyFileDo` (如需要)
- [ ] 在 `service/src/index.ts` 注册路由
- [ ] 更新 `/session` 端点添加 Vidu 配置
- [ ] 配置环境变量

### 测试验证 ✅
- [ ] 环境变量配置验证
- [ ] API 连通性测试
- [ ] 文件上传功能测试 (如需要)
- [ ] 前端界面集成测试
- [ ] 错误处理测试

## 🔍 与现有服务对比

| 服务 | 认证方式 | 文件上传 | Pro版本 | 特殊处理 |
|------|----------|----------|---------|----------|
| **Luma** | Bearer Token | ❌ | ✅ Pro路径 | HK服务器检测 |
| **Kling** | Bearer Token | ❌ | ❌ | 任务分类处理 |
| **Vidu** | Bearer Token | ✅ 图转视频 | ? 待定 | 待 API 文档确认 |
| **Ideogram** | Bearer Token | ✅ 图片处理 | ❌ | 专用文件上传函数 |

## 🛠️ 开发最佳实践

### 1. 代码复用
- 复用现有的认证机制
- 沿用统一的错误处理模式
- 保持与其他视频服务的接口一致性

### 2. 错误处理
- 网络错误统一处理
- API 限流和重试机制  
- 友好的用户错误提示

### 3. 性能优化
- 合理的轮询间隔设置
- 本地缓存策略
- 资源清理机制

### 4. 测试策略
- 单元测试覆盖核心逻辑
- 集成测试验证 API 交互
- 用户界面测试确保体验

## 📖 参考资源

### 项目内参考
- `src/api/luma.ts` - Luma API 实现参考
- `src/api/kling.ts` - Kling API 实现参考
- `service/src/myfun.ts` - 后端代理实现参考
- `vite.config.ts` - 前端代理配置参考

### 外部文档
- [Vidu API 文档](https://docs.vidu.com) *(需要根据实际情况更新)*
- [Express HTTP Proxy 文档](https://github.com/villadora/express-http-proxy)
- [Vue 3 文档](https://vuejs.org/)
- [Vite 代理配置](https://vitejs.dev/config/server-options.html#server-proxy)

## 🔄 开发流程

### 开发阶段
1. **准备阶段**: 阅读本指南，准备 API 密钥
2. **实现阶段**: 按照指南逐步实现各个模块
3. **测试阶段**: 单独测试每个功能模块
4. **集成阶段**: 集成到主项目并进行整体测试

### 测试流程
1. **单元测试**: 测试 API 客户端、存储管理等核心模块
2. **接口测试**: 验证后端代理和 API 调用
3. **集成测试**: 前后端完整流程测试
4. **用户测试**: UI 交互和用户体验测试

### 部署流程  
1. **环境配置**: 配置生产环境变量
2. **构建测试**: 验证生产构建
3. **部署验证**: 部署后功能验证
4. **监控设置**: 设置错误监控和性能监控

## 🤝 贡献指南

### 代码规范
- 遵循项目现有的代码风格
- 使用 TypeScript 进行类型定义
- 添加适当的注释和文档
- 保持与现有 API 的一致性

### 提交规范
- 使用清晰的提交信息
- 每个功能点单独提交
- 包含必要的测试用例
- 更新相关文档

## 📞 支持与问题

### 常见问题
- API 认证失败 → 检查环境变量配置
- 跨域错误 → 检查 Vite 代理配置
- 文件上传失败 → 检查文件大小和格式限制
- 任务轮询异常 → 检查 API 响应格式

### 获取帮助
1. 查看本指南相关章节
2. 参考现有 Luma/Kling 实现
3. 检查浏览器开发者工具
4. 查看后端服务日志

---

**注意**: 本指南基于项目现有的 Luma 和 Kling API 实现模式制作。在实际实现时，请根据 Vidu API 的具体文档和规范进行必要的调整。