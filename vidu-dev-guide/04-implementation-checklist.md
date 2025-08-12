# Vidu API 实现检查清单

完整的 Vidu API 接入实现步骤和验证清单。

## 📋 实现步骤清单

### 第一阶段: 基础准备 ✅

#### 1.1 环境准备
- [ ] 获取 Vidu API 密钥
- [ ] 确认 Vidu API 文档和端点
- [ ] 设置开发环境变量
- [ ] 备份当前项目代码

#### 1.2 依赖检查
- [ ] 确认 express-http-proxy 版本
- [ ] 确认 multer 版本（如需文件上传）
- [ ] 确认 axios 版本
- [ ] 确认 TypeScript 配置

### 第二阶段: 后端实现 ✅

#### 2.1 代理实现 (service/src/myfun.ts)
- [ ] 添加 viduProxy 基础实现
```typescript
export const viduProxy = proxy(process.env.VIDU_SERVER ?? API_BASE_URL, {
  https: false, 
  limit: '10mb',
  proxyReqPathResolver: function (req) {
    return req.originalUrl
  },
  proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
    if (process.env.VIDU_KEY) {
        proxyReqOpts.headers['Authorization'] = 'Bearer ' + process.env.VIDU_KEY;
    } else {
        proxyReqOpts.headers['Authorization'] = 'Bearer ' + process.env.OPENAI_API_KEY;  
    }
    proxyReqOpts.headers['Content-Type'] = 'application/json';
    proxyReqOpts.headers['Mj-Version'] = pkg.version;
    return proxyReqOpts;
  },
});
```

- [ ] 添加 viduProxyFileDo 文件上传处理（如需要）
```typescript
export const viduProxyFileDo = async (req: Request, res: Response, next?: NextFunction) => {
    // 文件上传处理逻辑
}
```

#### 2.2 路由注册 (service/src/index.ts)
- [ ] 导入 viduProxy 和相关函数
```typescript
import { viduProxy, viduProxyFileDo } from './myfun'
```

- [ ] 注册基础 API 路由
```typescript
app.use('/vidu', authV2, viduProxy);
```

- [ ] 注册 Pro 路由（如需要）
```typescript
app.use('/pro/vidu', authV2, viduProxy);
```

- [ ] 注册文件上传路由（如需要）
```typescript
app.use('/vidu/image2video', authV2, upload2.single('image_file'), viduProxyFileDo);
```

#### 2.3 Session 配置更新
- [ ] 在 /session 端点添加 Vidu 配置
```typescript
const viduServer = process.env.VIDU_SERVER ?? "";
const viduKey = process.env.VIDU_KEY ?? "";

res.send({ 
    success: true,
    data: {
        // ... 其他数据
        viduServer,
        hasViduKey: isNotEmptyString(viduKey),
        viduAvailable: isNotEmptyString(viduServer) && isNotEmptyString(viduKey),
    }
})
```

### 第三阶段: 前端实现 ✅

#### 3.1 API 客户端 (src/api/vidu.ts)
- [ ] 创建认证头部处理函数
```typescript
function getHeaderAuthorization() {
    // 认证逻辑实现
}
```

- [ ] 创建 URL 处理函数
```typescript
const getUrl = (url: string) => {
    // URL 处理逻辑
}
```

- [ ] 创建统一请求函数
```typescript
export const viduFetch = (url: string, data?: any, opt2?: any) => {
    // 请求处理逻辑
}
```

- [ ] 创建任务轮询函数
```typescript
export const FeedViduTask = async (id: string) => {
    // 轮询逻辑实现
}
```

#### 3.2 数据存储 (src/api/viduStore.ts)
- [ ] 定义数据接口
```typescript
export interface ViduTask {
    id: string;
    prompt: string;
    state: string;
    // ... 其他字段
}
```

- [ ] 实现存储管理类
```typescript
export class viduStore {
    private localKey = 'vidu-store';
    
    public save(obj: ViduTask) { }
    public getObjs(): ViduTask[] { }
    public getOneById(id: string): ViduTask | null { }
    public delete(obj: ViduTask) { }
}
```

#### 3.3 API 导出 (src/api/index.ts)
- [ ] 添加 Vidu API 导出
```typescript
export * from './vidu'
export * from './viduStore'
```

### 第四阶段: 配置更新 ✅

#### 4.1 前端代理配置 (vite.config.ts)
- [ ] 添加 Vidu 代理配置
```typescript
'/vidu': {
  target: viteEnv.VITE_APP_API_BASE_URL,
  changeOrigin: true,
},
'/pro/vidu': {
  target: viteEnv.VITE_APP_API_BASE_URL,
  changeOrigin: true,
},
```

#### 4.2 Store 配置更新
- [ ] 在 gptServerStore 中添加 Vidu 配置
```typescript
VIDU_SERVER: '',
VIDU_KEY: '',
```

- [ ] 在 homeStore 中添加 Vidu 状态（如需要）
```typescript
viduTasks: [] as ViduTask[],
activeViduTask: null as ViduTask | null,
```

#### 4.3 环境变量配置
- [ ] 后端 .env 文件
```bash
VIDU_SERVER=https://api.vidu.com
VIDU_KEY=your_vidu_api_key_here
```

- [ ] 前端 .env.local 文件
```bash
VITE_APP_API_BASE_URL=http://localhost:3002
```

### 第五阶段: UI 集成 ✅

#### 5.1 组件创建
- [ ] 创建视频生成组件
- [ ] 创建任务列表组件
- [ ] 创建状态显示组件
- [ ] 集成到现有页面

#### 5.2 路由配置
- [ ] 添加 Vidu 相关路由
- [ ] 更新导航菜单
- [ ] 配置路由权限

## 🧪 测试验证清单

### 基础功能测试

#### 6.1 后端 API 测试
- [ ] 环境变量配置验证
```bash
curl -X GET "http://localhost:3002/session" | jq '.data.viduAvailable'
```

- [ ] 代理连通性测试
```bash
curl -X POST "http://localhost:3002/vidu/test" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

- [ ] 认证中间件测试
```bash
# 无认证请求应该返回 401
curl -X POST "http://localhost:3002/vidu/test"
```

#### 6.2 前端 API 测试
- [ ] 打开浏览器开发者工具
- [ ] 测试 viduFetch 函数调用
```javascript
// 在浏览器控制台执行
import { viduFetch } from '@/api/vidu'
viduFetch('/test').then(console.log).catch(console.error)
```

- [ ] 测试本地存储功能
```javascript
// 测试 viduStore
import { viduStore } from '@/api/viduStore'
const store = new viduStore()
store.save({id: 'test', prompt: 'test', state: 'pending'})
console.log(store.getObjs())
```

### 功能集成测试

#### 6.3 完整流程测试
- [ ] 文本转视频功能测试
    - [ ] 输入文本描述
    - [ ] 提交生成请求
    - [ ] 检查任务创建
    - [ ] 验证轮询机制
    - [ ] 确认结果显示

- [ ] 图片转视频功能测试（如支持）
    - [ ] 上传图片文件
    - [ ] 输入描述文本
    - [ ] 提交转换请求
    - [ ] 检查文件上传
    - [ ] 验证处理流程

#### 6.4 错误处理测试
- [ ] 网络错误处理
    - [ ] 断网情况测试
    - [ ] 服务器错误响应测试
    - [ ] 超时处理测试

- [ ] 业务错误处理
    - [ ] 无效 API 密钥测试
    - [ ] 请求参数错误测试
    - [ ] 任务失败处理测试

### 性能和稳定性测试

#### 6.5 性能测试
- [ ] API 响应时间测试
- [ ] 并发请求处理测试
- [ ] 内存使用情况监控
- [ ] 文件上传性能测试

#### 6.6 稳定性测试
- [ ] 长时间运行测试
- [ ] 大量任务处理测试
- [ ] 异常恢复测试
- [ ] 资源清理测试

## 🚀 部署验证清单

### 生产环境准备

#### 7.1 环境配置检查
- [ ] 生产环境变量设置
- [ ] SSL 证书配置（如需要）
- [ ] 域名和 DNS 配置
- [ ] 防火墙规则配置

#### 7.2 构建和部署
- [ ] 前端构建成功
```bash
npm run build
```

- [ ] 后端构建成功
```bash
cd service && npm run build
```

- [ ] Docker 镜像构建（如使用）
```bash
docker build -t chatgpt-web-midjourney-proxy .
```

#### 7.3 生产环境测试
- [ ] 生产环境 API 连通性测试
- [ ] HTTPS 访问测试
- [ ] 跨域配置验证
- [ ] 文件上传限制测试

### 监控和日志

#### 7.4 监控设置
- [ ] API 响应时间监控
- [ ] 错误率监控
- [ ] 资源使用监控
- [ ] 用户访问统计

#### 7.5 日志配置
- [ ] 访问日志记录
- [ ] 错误日志记录
- [ ] 性能日志记录
- [ ] 安全事件记录

## 📊 质量检查清单

### 代码质量

#### 8.1 代码规范
- [ ] TypeScript 类型定义完整
- [ ] 代码格式符合项目规范
- [ ] 注释和文档完整
- [ ] 无 ESLint 警告和错误

#### 8.2 安全检查
- [ ] API 密钥安全存储
- [ ] 输入参数验证
- [ ] 文件上传安全检查
- [ ] CORS 配置正确

### 用户体验

#### 8.3 界面体验
- [ ] 加载状态显示
- [ ] 错误信息友好
- [ ] 操作反馈及时
- [ ] 响应式设计适配

#### 8.4 功能完整性
- [ ] 所有功能正常工作
- [ ] 边界情况处理
- [ ] 异常情况恢复
- [ ] 数据持久化正常

## ✅ 最终验收标准

### 功能验收
- [ ] 所有 API 端点正常工作
- [ ] 文件上传功能正常（如支持）
- [ ] 任务状态轮询正常
- [ ] 本地存储功能正常
- [ ] 错误处理机制完善

### 性能验收
- [ ] API 响应时间 < 5秒
- [ ] 文件上传速度合理
- [ ] 内存使用稳定
- [ ] 无明显性能瓶颈

### 兼容性验收
- [ ] 与现有服务无冲突
- [ ] 浏览器兼容性良好
- [ ] 移动端访问正常
- [ ] 不同环境运行正常

---

## 📝 实现记录模板

### 实现日志
```
日期: ____
实现者: ____
实现内容: ____
遇到问题: ____
解决方案: ____
测试结果: ____
```

### 问题记录
```
问题描述: ____
出现环境: ____
错误信息: ____
解决方案: ____
预防措施: ____
```

使用此清单确保 Vidu API 接入的完整性和质量，每个步骤完成后请打勾确认。