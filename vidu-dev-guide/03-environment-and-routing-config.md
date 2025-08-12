# 环境配置和路由配置

Vidu API 接入的完整环境配置和路由配置指南。

## 1. 环境变量配置

### 1.1 后端环境变量 (.env 文件)
```bash
# ===========================================
# Vidu API 配置
# ===========================================

# Vidu 服务器地址
VIDU_SERVER=https://api.vidu.com
# 或使用自定义代理服务器
# VIDU_SERVER=https://your-proxy-server.com

# Vidu API 密钥
VIDU_KEY=your_vidu_api_key_here

# 可选：Vidu Pro 服务配置
VIDU_PRO_SERVER=https://pro.vidu.com
VIDU_PRO_KEY=your_vidu_pro_key_here

# ===========================================
# 其他必需的环境变量
# ===========================================

# 后备 API 配置（当 Vidu 服务不可用时使用）
OPENAI_API_KEY=your_openai_api_key
OPENAI_API_BASE_URL=https://api.openai.com

# 应用认证密钥
AUTH_SECRET_KEY=your_secret_key_here

# 文件上传配置
UPLOAD_IMG_SIZE=10  # 最大上传文件大小（MB）
```

### 1.2 前端环境变量 (.env.local 文件)
```bash
# 开发环境 API 基础地址
VITE_APP_API_BASE_URL=http://localhost:3002

# 生产环境 API 基础地址
# VITE_APP_API_BASE_URL=https://your-production-domain.com
```

## 2. 前端代理配置 (vite.config.ts)

### 2.1 添加 Vidu 代理配置
在 `vite.config.ts` 的 `server.proxy` 部分添加：

```typescript
export default defineConfig((env) => {
  const viteEnv = loadEnv(env.mode, process.cwd()) as unknown as ImportMetaEnv

  return {
    // ... 其他配置
    server: {
      host: '0.0.0.0',
      port: 1002,
      open: false,
      proxy: {
        // ... 现有代理配置
        
        // Vidu API 代理
        '/vidu': {
          target: viteEnv.VITE_APP_API_BASE_URL,
          changeOrigin: true, // 允许跨域
          // rewrite: path => path.replace('/vidu/', '/vidu/'),
        },
        
        // Vidu Pro API 代理（如果需要）
        '/pro/vidu': {
          target: viteEnv.VITE_APP_API_BASE_URL,
          changeOrigin: true, // 允许跨域
        },
        
        // Kling 代理（参考现有配置）
        '/kling': {
          target: viteEnv.VITE_APP_API_BASE_URL,
          changeOrigin: true, // 允许跨域
        },
        
        // Luma 代理（参考现有配置）
        '/luma': {
          target: viteEnv.VITE_APP_API_BASE_URL,
          changeOrigin: true, // 允许跨域
        },
      },
    },
    // ... 其他配置
  }
})
```

## 3. 后端路由配置 (service/src/index.ts)

### 3.1 导入代理模块
```typescript
import { 
  viduProxy, 
  viduProxyFileDo, 
  lumaProxy, 
  klingProxy,
  // ... 其他代理
} from './myfun'
```

### 3.2 注册 API 路由
```typescript
// ===========================================
// Vidu API 路由配置
// ===========================================

// 标准 Vidu API 代理
app.use('/vidu', authV2, viduProxy);

// Vidu Pro API 代理（如果支持）
app.use('/pro/vidu', authV2, viduProxy);

// Vidu 文件上传路由（图片转视频等）
app.use('/vidu/image2video', 
    authV2,  
    upload2.single('image_file'), 
    viduProxyFileDo
);

// 其他可能的文件上传路由
app.use('/vidu/remix', 
    authV2,  
    upload2.single('image_file'), 
    viduProxyFileDo
);

// ===========================================
// 现有视频服务路由（参考）
// ===========================================

// Luma API 路由
app.use('/luma', authV2, lumaProxy);
app.use('/pro/luma', authV2, lumaProxy);

// Kling API 路由  
app.use('/kling', authV2, klingProxy);

// 文件上传路由示例
app.use('/ideogram/remix', authV2, upload2.single('image_file'), ideoProxyFileDo);
```

## 4. Session 配置集成

### 4.1 在 /session 端点添加 Vidu 配置
```typescript
router.post('/session', async (req, res) => {
  try {
    // ... 现有配置获取逻辑
    
    // Vidu 相关配置
    const viduServer = process.env.VIDU_SERVER ?? "";
    const viduKey = process.env.VIDU_KEY ?? "";
    const viduProServer = process.env.VIDU_PRO_SERVER ?? "";
    const viduProKey = process.env.VIDU_PRO_KEY ?? "";
    
    // 其他现有配置...
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
    const hasAuth = isNotEmptyString(AUTH_SECRET_KEY)
    const isUpload = isNotEmptyString(process.env.API_UPLOADER)
    // ... 其他配置

    res.send({
      success: true,
      data: {
        // ... 现有数据
        
        // Vidu 配置
        viduServer,
        hasViduKey: isNotEmptyString(viduKey),
        viduProServer,
        hasViduProKey: isNotEmptyString(viduProKey),
        
        // 标记 Vidu 服务可用性
        viduAvailable: isNotEmptyString(viduServer) && isNotEmptyString(viduKey),
        viduProAvailable: isNotEmptyString(viduProServer) && isNotEmptyString(viduProKey),
        
        // 其他现有配置
        auth: hasAuth,
        isUpload,
        // ...
      }
    })
  } catch (error) {
    res.send(error)
  }
})
```

## 5. 文件上传配置

### 5.1 Multer 配置
```typescript
import multer from "multer"

// 文件上传配置
const upload2 = multer({
    limits: {
        fileSize: 1024 * 1024 * (parseInt(process.env.UPLOAD_IMG_SIZE) || 10) // 可配置的文件大小限制
    },
    fileFilter: (req, file, cb) => {
        // 检查文件类型
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传图片和视频文件'));
        }
    }
});
```

## 6. 前端Store配置

### 6.1 gptServerStore 配置更新
在前端的 store 中添加 Vidu 配置：

```typescript
// src/store/modules/gptServerStore.ts
export const useGptServerStore = defineStore('gpt-server-store', {
  state: (): GptServerState => ({
    myData: {
      // ... 现有配置
      
      // Vidu 配置
      VIDU_SERVER: '',
      VIDU_KEY: '',
      VIDU_PRO_SERVER: '',
      VIDU_PRO_KEY: '',
      
      // 其他现有配置
      LUMA_SERVER: '',
      LUMA_KEY: '',
      KLING_SERVER: '',
      KLING_KEY: '',
      // ...
    }
  }),
  // ... actions 和 getters
})
```

## 7. API 端点映射

### 7.1 Vidu API 端点配置
```typescript
// Vidu API 端点常量
export const VIDU_ENDPOINTS = {
  // 文本转视频
  TEXT_TO_VIDEO: '/v1/videos/text2video',
  
  // 图片转视频  
  IMAGE_TO_VIDEO: '/v1/videos/image2video',
  
  // 获取任务状态
  GET_TASK: '/v1/tasks/',
  
  // 获取任务列表
  LIST_TASKS: '/v1/tasks',
  
  // 删除任务
  DELETE_TASK: '/v1/tasks/',
} as const;
```

### 7.2 API 路径映射规则
```typescript
// 前端请求路径到后端代理路径的映射
const API_PATH_MAPPING = {
  // 前端调用: /vidu/v1/videos/text2video
  // 后端代理到: {VIDU_SERVER}/v1/videos/text2video
  
  // 前端调用: /vidu/image2video (文件上传)
  // 后端处理: viduProxyFileDo 函数
  
  // Pro 版本
  // 前端调用: /pro/vidu/v1/videos/text2video  
  // 后端代理到: {VIDU_PRO_SERVER}/v1/videos/text2video
}
```

## 8. 开发环境配置

### 8.1 Docker Compose 配置 (docker-compose.yml)
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3002:3002"
    environment:
      # ... 现有环境变量
      
      # Vidu 配置
      - VIDU_SERVER=https://api.vidu.com
      - VIDU_KEY=${VIDU_KEY}
      - VIDU_PRO_SERVER=https://pro.vidu.com
      - VIDU_PRO_KEY=${VIDU_PRO_KEY}
      
      # 其他配置
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - AUTH_SECRET_KEY=${AUTH_SECRET_KEY}
    volumes:
      - ./uploads:/app/uploads
```

### 8.2 开发环境启动脚本
```bash
#!/bin/bash
# start-dev.sh

# 检查必需的环境变量
check_env_var() {
    if [ -z "${!1}" ]; then
        echo "错误: 环境变量 $1 未设置"
        exit 1
    fi
}

echo "检查 Vidu 环境配置..."
check_env_var "VIDU_SERVER"
check_env_var "VIDU_KEY"

echo "启动后端服务..."
cd service && npm run dev &

echo "启动前端服务..."
npm run dev &

echo "开发环境启动完成!"
echo "前端: http://localhost:1002"
echo "后端: http://localhost:3002"
```

## 9. 生产环境配置

### 9.1 Nginx 配置示例
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 前端静态文件
    location / {
        root /var/www/chatgpt-web-midjourney-proxy/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # API 代理
    location /api/ {
        proxy_pass http://localhost:3002/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Vidu API 代理
    location /vidu/ {
        proxy_pass http://localhost:3002/vidu/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 增加上传文件大小限制
        client_max_body_size 50M;
    }
}
```

## 10. 配置验证

### 10.1 配置检查脚本
```typescript
// config-check.ts
export const checkViduConfig = () => {
    const errors: string[] = [];
    
    // 检查必需的环境变量
    if (!process.env.VIDU_SERVER) {
        errors.push('VIDU_SERVER 未配置');
    }
    
    if (!process.env.VIDU_KEY) {
        errors.push('VIDU_KEY 未配置');
    }
    
    // 检查 URL 格式
    if (process.env.VIDU_SERVER && !process.env.VIDU_SERVER.startsWith('http')) {
        errors.push('VIDU_SERVER 必须以 http:// 或 https:// 开头');
    }
    
    if (errors.length > 0) {
        console.error('Vidu 配置错误:', errors);
        return false;
    }
    
    console.log('Vidu 配置检查通过');
    return true;
};
```

### 10.2 健康检查端点
```typescript
router.get('/health/vidu', async (req, res) => {
    try {
        // 检查 Vidu 服务可用性
        const viduServerAvailable = !!process.env.VIDU_SERVER && !!process.env.VIDU_KEY;
        
        res.json({
            service: 'vidu',
            status: viduServerAvailable ? 'available' : 'unavailable',
            config: {
                hasServer: !!process.env.VIDU_SERVER,
                hasKey: !!process.env.VIDU_KEY,
                hasPro: !!process.env.VIDU_PRO_SERVER && !!process.env.VIDU_PRO_KEY,
            }
        });
    } catch (error) {
        res.status(500).json({
            service: 'vidu',
            status: 'error',
            error: error.message
        });
    }
});
```