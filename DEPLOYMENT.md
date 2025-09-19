# 生产环境部署指南

## CORS和图片代理解决方案

### 1. 推荐部署架构

#### 方案A：单域名部署（推荐）
```
domain.com/           # 前端静态文件
domain.com/api/       # 后端API
```

**Nginx配置示例：**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端API代理
    location /api/ {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 方案B：分离部署
如果前后端必须分离部署，需要在后端添加CORS配置：

```javascript
// service/src/index.ts
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})
```

### 2. 环境变量配置

创建 `.env.production` 文件：
```env
# 前端URL（用于CORS配置）
FRONTEND_URL=https://your-frontend-domain.com

# 图片代理配置
IMAGE_PROXY_TIMEOUT=30000
IMAGE_PROXY_CACHE_TTL=86400

# 允许的图片域名（逗号分隔）
ALLOWED_IMAGE_DOMAINS=mj-oss.oss-cn-shanghai.aliyuncs.com,cdn.discordapp.com
```

### 3. Docker部署示例

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制package.json和安装依赖
COPY package*.json ./
COPY service/package*.json ./service/
RUN npm install && cd service && npm install

# 复制源码
COPY . .

# 构建前端
RUN npm run build

# 构建后端
RUN cd service && npm run build

EXPOSE 3002

CMD ["node", "service/dist/index.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - FRONTEND_URL=https://your-domain.com
    restart: unless-stopped
```

### 4. 性能优化建议

#### CDN配置
如果使用CDN，建议配置缓存规则：
```
/api/proxy-image/* - 缓存24小时
静态资源 - 缓存30天
```

#### 负载均衡
如果有多个实例，图片代理是无状态的，可以安全地进行负载均衡。

### 5. 监控和日志

生产环境建议添加监控：
```javascript
// 图片代理访问日志
router.get('/proxy-image', async (req, res) => {
  const startTime = Date.now()
  try {
    // ... 代理逻辑
    console.log(`图片代理成功: ${url} - ${Date.now() - startTime}ms`)
  } catch (error) {
    console.error(`图片代理失败: ${url} - ${error.message}`)
  }
})
```

### 6. 故障排查

#### 常见问题
1. **图片仍然无法显示**
   - 检查 `/api/proxy-image` 端点是否可访问
   - 确认域名在 `allowedDomains` 列表中

2. **性能问题**
   - 调整 `timeout` 和缓存时间
   - 考虑添加图片缓存层

3. **安全问题**
   - 限制允许的图片域名
   - 添加访问频率限制