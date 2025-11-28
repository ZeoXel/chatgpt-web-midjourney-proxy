# Vercel 部署环境变量配置指导

## 问题解决说明

**原因**: `.env` 文件包含敏感凭证(腾讯云SecretId)被提交到Git历史，触发GitHub Push Protection。

**解决方案**:
1. ✅ 已将 `.env` 添加到 `.gitignore`
2. ✅ 已清理Git历史中的敏感文件
3. ✅ 已成功推送到GitHub (不含敏感信息)

**重要**: `.env` 文件仅用于本地开发，生产环境使用Vercel环境变量。

---

## Vercel 环境变量配置步骤

### 1. 登录Vercel并进入项目设置

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择你的项目 `chatgpt-web-midjourney-proxy`
3. 点击顶部导航栏的 **Settings** 标签
4. 左侧菜单选择 **Environment Variables**

### 2. 添加环境变量

点击 **Add** 按钮，逐个添加以下环境变量：

---

## 必需环境变量列表

### 腾讯云 COS 配置 (核心存储)

```bash
# COS 基本配置
COS_SECRET_ID=你的腾讯云SecretId
COS_SECRET_KEY=你的腾讯云SecretKey
COS_BUCKET=你的存储桶名称-appid
COS_REGION=存储桶地域(如: ap-guangzhou)

# COS 可选配置
COS_DOMAIN=可选的自定义域名
```

**获取方法**:
- 登录 [腾讯云控制台](https://console.cloud.tencent.com/)
- 访问 **访问管理** > **API密钥管理**
- 创建或查看现有密钥获取 `SecretId` 和 `SecretKey`
- 访问 **对象存储COS** 获取 `Bucket名称` 和 `Region`

**安全注意**:
- 确保Bucket权限配置正确（建议私有读写+签名访问）
- 定期轮换API密钥
- 使用子账号密钥而非主账号密钥

---

### OpenAI API 配置

```bash
# OpenAI 核心配置
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_BASE_URL=https://api.openai.com

# 可选: 自定义模型
OPENAI_API_MODEL=gpt-4-turbo
```

---

### Midjourney 代理配置

```bash
# MJ 服务器配置
MJ_SERVER=你的Midjourney代理服务器地址
MJ_API_SECRET=你的Midjourney API密钥

# 可选配置
MJ_PROXY_ENDPOINT=自定义代理端点
```

---

### Suno 音乐生成配置

```bash
SUNO_SERVER=https://api.suno.cn
SUNO_KEY=你的Suno API密钥
```

---

### Luma 视频生成配置

```bash
LUMA_SERVER=https://api.luma.ai
LUMA_KEY=你的Luma API密钥
```

---

### Vidu 视频生成配置

```bash
VIDU_SERVER=https://api.vidu.cn
VIDU_KEY=你的Vidu API密钥
```

---

### 应用访问控制 (推荐)

```bash
# 访问密钥 (用于保护API端点)
AUTH_SECRET_KEY=你的自定义密钥(建议使用强随机字符串)

# 可选: 速率限制
RATE_LIMIT_PER_MINUTE=60
```

---

### 前端配置

```bash
# API 代理地址
VITE_GLOB_API_URL=/api

# 后端API基础URL (生产环境使用相对路径)
VITE_APP_API_BASE_URL=/api

# 可选功能开关
VITE_GLOB_OPEN_LONG_REPLY=false
VITE_GLOB_APP_PWA=true
```

---

## 3. 环境变量作用域设置

对于每个环境变量，选择适用的环境:

- ✅ **Production** - 必选（生产环境）
- ✅ **Preview** - 推荐（预览部署）
- ⚪ **Development** - 可选（本地开发使用 `.env` 文件）

---

## 4. Vercel 部署配置文件

创建或更新 `vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/service/src/index.ts"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

---

## 5. 部署检查清单

### 部署前
- [ ] 所有必需环境变量已添加到Vercel
- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] Git历史中无敏感信息
- [ ] `vercel.json` 配置正确

### 部署后
- [ ] 访问应用URL检查前端加载
- [ ] 测试 `/api/health` 端点检查后端
- [ ] 测试COS上传功能
- [ ] 测试各AI服务调用
- [ ] 查看Vercel日志排查错误

---

## 6. 常见问题排查

### 问题1: COS上传失败

**错误信息**: `NoSuchBucket` 或 `AccessDenied`

**解决方案**:
1. 检查 `COS_BUCKET` 格式是否正确(含appid)
2. 检查 `COS_REGION` 是否与Bucket地域一致
3. 验证 `COS_SECRET_ID` 和 `COS_SECRET_KEY` 是否有效
4. 确认Bucket权限策略允许当前密钥操作

### 问题2: API 调用 500 错误

**排查步骤**:
1. 访问Vercel Dashboard > Functions > Logs
2. 查找具体错误堆栈信息
3. 检查对应服务的环境变量是否配置
4. 验证API密钥是否过期

### 问题3: 环境变量未生效

**解决方案**:
1. 确认环境变量 **Environment** 选项已勾选 `Production`
2. 重新部署项目 (Vercel不会自动应用新变量)
3. 在Vercel Dashboard点击 **Redeploy** 按钮

---

## 7. 安全最佳实践

### API密钥管理
- ✅ 使用环境变量，禁止硬编码
- ✅ 定期轮换API密钥
- ✅ 为不同环境使用不同密钥
- ✅ 使用只读密钥（如适用）

### COS 安全配置
- ✅ Bucket设置为私有读写
- ✅ 使用预签名URL访问资源
- ✅ 配置防盗链白名单
- ✅ 启用访问日志审计

### 应用层安全
- ✅ 配置 `AUTH_SECRET_KEY` 保护API
- ✅ 实施速率限制防止滥用
- ✅ 使用HTTPS加密传输
- ✅ 定期审查Vercel访问日志

---

## 8. 快速参考

### 核心环境变量 (最小配置)

```bash
# 腾讯云COS (必需)
COS_SECRET_ID=
COS_SECRET_KEY=
COS_BUCKET=
COS_REGION=

# OpenAI (必需)
OPENAI_API_KEY=
OPENAI_API_BASE_URL=

# 应用安全 (推荐)
AUTH_SECRET_KEY=
```

### Vercel CLI 快速部署

```bash
# 安装Vercel CLI
npm install -g vercel

# 登录Vercel
vercel login

# 链接项目
vercel link

# 设置环境变量 (示例)
vercel env add COS_SECRET_ID production

# 部署到生产环境
vercel --prod
```

---

## 9. 技术支持

遇到部署问题时:

1. 查看 [Vercel文档](https://vercel.com/docs)
2. 检查项目 [GitHub Issues](https://github.com/your-repo/issues)
3. 审查Vercel Function Logs
4. 验证环境变量配置完整性

---

**最后更新**: 2025-11-28
**适用版本**: v2.0+ (COS存储系统)
