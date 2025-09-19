# Vercel 部署配置指南

## 🚀 快速部署步骤

### 1. Vercel Dashboard 环境变量配置

访问你的 Vercel 项目设置页面，添加以下环境变量：

#### 必需配置
```bash
# OpenAI API
OPENAI_API_KEY=sk-your-openai-key
OPENAI_API_BASE_URL=https://api.openai.com

# Midjourney (如果使用)
MJ_SERVER=https://your-mj-server.com
MJ_API_SECRET=your-mj-secret

# 核心认证密钥（可选，建议生产环境配置）
AUTH_SECRET_KEY=your-secret-key-here
```

#### 视频/音频服务配置（按需添加）
```bash
# Vidu 视频生成
VIDU_SERVER=https://api.vidu.cn
VIDU_KEY=your-vidu-key

# Suno 音乐生成
SUNO_SERVER=https://your-suno-server.com
SUNO_KEY=your-suno-key

# Luma 视频生成
LUMA_SERVER=https://your-luma-server.com
LUMA_KEY=your-luma-key
```

### 2. 部署验证

部署完成后，访问以下端点验证：

1. **主页**: `https://www.lsaigc.chat/`
2. **API健康检查**: `https://www.lsaigc.chat/api/config`
3. **图片代理测试**: `https://www.lsaigc.chat/api/proxy-image?url=https://example.com/test.jpg`

### 3. 图片代理功能说明

#### 支持的图片域名
- `mj-oss.oss-cn-shanghai.aliyuncs.com` (Midjourney OSS)
- `cdn.discordapp.com` (Discord CDN)
- `attachments.discord.com` (Discord 附件)

#### 使用方式
```javascript
// 前端调用示例
const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(originalImageUrl)}`;
```

#### 安全特性
- 域名白名单限制
- 请求超时保护 (25秒)
- 核心密钥验证
- 流式传输优化

### 4. 前端请求头配置

如果配置了 `AUTH_SECRET_KEY`，前端需要在请求中包含认证头：

```javascript
// 在 API 请求中添加认证头
const headers = {
  'x-ptoken': 'your-auth-secret-key'
};
```

### 5. CORS 问题解决

Vercel 部署的优势是前后端在同一域名下，自动解决 CORS 问题：

```
✅ 前端: https://www.lsaigc.chat/
✅ API: https://www.lsaigc.chat/api/*
✅ 图片代理: https://www.lsaigc.chat/api/proxy-image
```

### 6. 性能优化

#### 缓存策略
- 图片代理：24小时缓存
- 静态资源：Vercel 自动优化

#### 函数超时
- Vercel 免费版：10秒超时
- Pro版：60秒超时
- 图片代理已优化为25秒内完成

### 7. 故障排查

#### 常见问题

**1. 图片无法显示**
```bash
# 检查图片代理端点
curl "https://www.lsaigc.chat/api/proxy-image?url=https://mj-oss.oss-cn-shanghai.aliyuncs.com/test.jpg"
```

**2. API 403 错误**
- 检查 `AUTH_SECRET_KEY` 环境变量
- 确认前端请求包含正确的 `x-ptoken` 头

**3. 函数超时**
- 检查 Vercel 函数日志
- 考虑升级到 Pro 版本

#### 调试方法

1. **查看 Vercel 函数日志**
   - 访问 Vercel Dashboard
   - 进入项目 > Functions 页面
   - 查看实时日志

2. **测试图片代理**
```bash
# 测试命令
curl -H "x-ptoken: your-secret-key" \
     "https://www.lsaigc.chat/api/proxy-image?url=https://example.com/test.jpg"
```

### 8. 安全建议

1. **设置 AUTH_SECRET_KEY**
```bash
# 生成强密钥
openssl rand -base64 32
```

2. **定期轮换密钥**
- 在 Vercel Dashboard 更新环境变量
- 重新部署项目

3. **监控使用情况**
- 检查 Vercel 使用统计
- 关注图片代理流量

### 9. 升级和维护

#### 代码更新
```bash
# 推送到主分支自动部署
git push origin add-vidu
```

#### 环境变量更新
1. 在 Vercel Dashboard 修改
2. 触发重新部署

#### 版本回滚
- 在 Vercel Dashboard 选择历史部署版本
- 一键回滚

## ✅ 完成检查清单

- [ ] 环境变量已配置
- [ ] 域名解析正常
- [ ] 图片代理功能正常
- [ ] 前端应用可访问
- [ ] API 端点响应正常
- [ ] CORS 问题已解决
- [ ] 性能监控已启用

部署完成后，你的画廊图片显示问题将彻底解决！