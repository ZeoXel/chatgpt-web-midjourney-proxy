# 后端代理实现模式

基于现有视频 API 代理实现的后端集成模式分析和 Vidu API 接入指南。

## 1. 代理架构模式

### 1.1 Express HTTP 代理模式
项目使用 `express-http-proxy` 库实现 API 代理，所有视频服务都遵循相同的代理模式。

### 1.2 核心代理实现 (myfun.ts)

#### 基础代理实现模板
```typescript
import proxy from "express-http-proxy"
import pkg from '../package.json'

const API_BASE_URL = isNotEmptyString(process.env.OPENAI_API_BASE_URL)
    ? process.env.OPENAI_API_BASE_URL
    : 'https://api.openai.com'

export const viduProxy = proxy(process.env.VIDU_SERVER ?? API_BASE_URL, {
  https: false, 
  limit: '10mb',
  
  // URL 路径解析器
  proxyReqPathResolver: function (req) {
    return req.originalUrl // 将原始 URL 直接传递
  },
  
  // 请求选项装饰器
  proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
    // 认证头部设置
    if (process.env.VIDU_KEY) {
        proxyReqOpts.headers['Authorization'] = 'Bearer ' + process.env.VIDU_KEY;
    } else {
        proxyReqOpts.headers['Authorization'] = 'Bearer ' + process.env.OPENAI_API_KEY;  
    }
    
    // 标准头部
    proxyReqOpts.headers['Content-Type'] = 'application/json';
    proxyReqOpts.headers['Mj-Version'] = pkg.version;
    
    return proxyReqOpts;
  },
});
```

## 2. 特殊路径处理模式

### 2.1 RunwayML 特殊处理示例
某些服务需要特殊的 URL 路径处理：

```typescript
export const viduProxy = proxy(process.env.VIDU_SERVER ?? API_BASE_URL, {
  https: false, 
  limit: '10mb',
  
  proxyReqPathResolver: function (req) {
    let url = req.originalUrl;
    let server = process.env.VIDU_SERVER ?? API_BASE_URL
    
    // 如果是官方服务器，需要移除路径前缀
    if (server.indexOf('vidu.com') > -1) {
        url = req.originalUrl.replace('/vidu', '')
    }
    return url
  },
  
  proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
    if (process.env.VIDU_KEY) {
        proxyReqOpts.headers['Authorization'] = 'Bearer ' + process.env.VIDU_KEY;
    } else {
        proxyReqOpts.headers['Authorization'] = 'Bearer ' + process.env.OPENAI_API_KEY;  
    }
    
    proxyReqOpts.headers['Content-Type'] = 'application/json';
    proxyReqOpts.headers['Mj-Version'] = pkg.version;
    
    // 如果需要特定的 API 版本头部
    proxyReqOpts.headers['X-Vidu-Version'] = '2024-12-01';
    
    return proxyReqOpts;
  },
});
```

## 3. 文件上传处理模式

### 3.1 文件上传代理函数
对于需要处理文件上传的服务（如图片转视频），参考 `ideoProxyFileDo` 实现：

```typescript
import axios from 'axios';
import FormData from 'form-data';
import { Request, Response, NextFunction } from 'express';

export const viduProxyFileDo = async (req: Request, res: Response, next?: NextFunction) => { 
    console.log('req.originalUrl', req.originalUrl);
    
    let API_BASE_URL = isNotEmptyString(process.env.OPENAI_API_BASE_URL)
        ? process.env.OPENAI_API_BASE_URL
        : 'https://api.openai.com'
    
    API_BASE_URL = process.env.VIDU_SERVER ?? API_BASE_URL
    
    if (req.file?.buffer) {
        const fileBuffer = req.file.buffer;
        const formData = new FormData();
        
        // 添加文件数据
        formData.append('image_file', fileBuffer, { 
            filename: req.file.originalname 
        });
        
        // 添加其他请求参数
        if (req.body.prompt) {
            formData.append('prompt', req.body.prompt);
        }
        if (req.body.options) {
            formData.append('options', req.body.options);
        }
        
        try {
            let url = `${API_BASE_URL}${req.originalUrl}`;
            let responseBody = await axios.post(url, formData, {
                headers: {
                    Authorization: 'Bearer ' + (process.env.VIDU_KEY ?? process.env.OPENAI_API_KEY),
                    'Content-Type': 'multipart/form-data',
                }
            });
            
            res.json(responseBody.data);
        } catch (e) { 
            res.status(400).json({ error: e });
        }
    } else {
        res.status(400).json({'error': 'uploader fail'});
    }
}
```

## 4. 路由注册模式 (index.ts)

### 4.1 标准代理路由
```typescript
import { authV2 } from './middleware/auth'
import { viduProxy, viduProxyFileDo } from './myfun'

// 标准 API 代理
app.use('/vidu', authV2, viduProxy);

// 如果支持 Pro 版本
app.use('/pro/vidu', authV2, viduProxy);
```

### 4.2 文件上传路由
```typescript
import multer from "multer"

// 文件上传配置
const upload2 = multer({
    limits: {
        fileSize: 1024 * 1024 * 10  // 10MB limit
    }
});

// 文件上传路由
app.use('/vidu/image2video', 
    authV2,  
    upload2.single('image_file'), 
    viduProxyFileDo
);
```

## 5. 环境变量和配置

### 5.1 必需的环境变量
```bash
# Vidu API 配置
VIDU_SERVER=https://api.vidu.com  # Vidu API 服务器地址
VIDU_KEY=your_vidu_api_key        # Vidu API 密钥

# 后备配置
OPENAI_API_KEY=fallback_key       # 后备 API 密钥
OPENAI_API_BASE_URL=https://api.openai.com  # 后备服务器
```

### 5.2 Session 配置集成
在 `index.ts` 的 `/session` 路由中添加 Vidu 配置：

```typescript
router.post('/session', async (req, res) => {
  try {
    // ... 其他配置
    
    const viduServer = process.env.VIDU_SERVER ?? "";
    const viduKey = process.env.VIDU_KEY ?? "";
    
    res.send({ 
        success: true,
        data: {
            // ... 其他数据
            viduServer,
            hasViduKey: isNotEmptyString(viduKey),
            // 其他 Vidu 相关配置
        }
    })
  } catch (error) {
    res.send(error)
  }
})
```

## 6. 中间件集成

### 6.1 认证中间件
所有 API 路由都使用 `authV2` 中间件进行认证：

```typescript
import { authV2 } from './middleware/auth'

// 应用认证中间件
app.use('/vidu', authV2, viduProxy);
```

### 6.2 限流中间件 (可选)
如果需要限流，可以添加 `limiter` 中间件：

```typescript
import { limiter } from './middleware/limiter'

app.use('/vidu', [authV2, limiter], viduProxy);
```

## 7. 错误处理

### 7.1 代理错误处理
`express-http-proxy` 自动处理大部分代理错误，但可以添加自定义错误处理：

```typescript
export const viduProxy = proxy(process.env.VIDU_SERVER ?? API_BASE_URL, {
  https: false, 
  limit: '10mb',
  
  proxyReqPathResolver: function (req) {
    return req.originalUrl
  },
  
  proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
    // ... 头部设置
    return proxyReqOpts;
  },
  
  // 自定义错误处理
  proxyErrorHandler: function (err, res, next) {
    console.error('Vidu proxy error:', err);
    
    res.status(500).json({
      error: 'Vidu service unavailable',
      message: err.message
    });
  }
});
```

## 8. 日志和监控

### 8.1 请求日志
```typescript
proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
    console.log(`Vidu API Request: ${srcReq.method} ${srcReq.originalUrl}`);
    
    // ... 头部设置
    
    return proxyReqOpts;
}
```

### 8.2 响应监控
```typescript
export const viduProxy = proxy(process.env.VIDU_SERVER ?? API_BASE_URL, {
  // ... 其他配置
  
  userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
    console.log(`Vidu API Response: ${userReq.originalUrl} - ${proxyRes.statusCode}`);
    
    return proxyResData;
  }
});
```

## 9. 完整实现示例

### 9.1 myfun.ts 中的完整代理实现
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

### 9.2 index.ts 中的路由注册
```typescript
import { viduProxy, viduProxyFileDo } from './myfun'

// 标准代理路由
app.use('/vidu', authV2, viduProxy);
app.use('/pro/vidu', authV2, viduProxy);

// 文件上传路由
app.use('/vidu/upload', 
    authV2,  
    upload2.single('image_file'), 
    viduProxyFileDo
);
```

## 10. 测试和验证

### 10.1 代理功能测试
1. 检查环境变量设置
2. 验证认证头部传递
3. 测试标准 API 调用
4. 测试文件上传功能
5. 验证错误处理

### 10.2 性能考虑
1. 适当设置文件大小限制
2. 监控代理响应时间
3. 考虑缓存策略
4. 实现健康检查