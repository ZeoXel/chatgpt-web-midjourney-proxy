# COS服务配置指南

## 问题说明

如果你在使用本地调试时遇到以下错误：
```
[Chat State] ⚠️ COS无数据，使用本地数据
[Asset Restoration] ✅ MJ图片: 0 张
```

这说明COS服务未启用。

## 解决方案

### 1. 配置环境变量

在 `service/.env` 文件中添加以下配置：

```bash
# 腾讯云COS存储配置
ENABLE_TENCENT_COS=true
COS_SECRET_ID=你的SecretId
COS_SECRET_KEY=你的SecretKey
COS_BUCKET=你的Bucket名称
COS_REGION=ap-beijing
COS_DOMAIN=https://你的COS域名
```

### 2. 参考示例文件

项目提供了 `service/.env.example` 作为配置模板。复制并修改为你的实际配置：

```bash
cd service
cp .env.example .env
# 然后编辑 .env 填入你的真实配置
```

### 3. 重启后端服务

修改 `.env` 后，需要重启后端服务以加载新配置：

```bash
cd service
pnpm dev
```

你应该看到以下日志：
```
[COS Client] 初始化成功 { bucket: 'xxx', region: 'ap-beijing' }
```

### 4. 验证COS服务

访问健康检查端点：
```bash
curl http://localhost:3002/api/chat-storage/health
```

应该返回：
```json
{
  "status": "Success",
  "success": true,
  "message": "COS Chat Storage API is running"
}
```

### 5. 测试数据加载

刷新前端页面，检查浏览器控制台：

**成功**：
```
[COS Load] 🌐 开始从COS加载对话... { userUuid: 'xxx' }
[COS Load] ✅ 加载成功: 5 个对话
```

**失败**（需要检查配置）：
```
[COS Load] ⚠️ COS返回空数据
```

## 安全提示

⚠️ **重要：不要提交 `.env` 文件到 Git**

`.env` 文件包含敏感信息（API密钥、Secret等），已经在 `.gitignore` 中被忽略。

如果不小心提交了：
```bash
# 撤销上一次提交
git reset --soft HEAD~1

# 取消暂存 .env
git restore --staged service/.env

# 重新提交（不包含 .env）
git commit -m "你的提交信息"
git push
```

## 故障排查

### 问题1: "COS服务未启用"

**原因**: 缺少 `ENABLE_TENCENT_COS=true`

**解决**: 在 `service/.env` 中添加该配置并重启服务

### 问题2: "COS返回空数据"

**原因**: 
1. COS上确实没有数据（第一次使用）
2. Bucket名称或Region配置错误
3. 访问权限不足

**解决**:
1. 检查COS配置是否正确
2. 登录腾讯云控制台检查Bucket
3. 确认SecretId和SecretKey有访问权限

### 问题3: GitHub拦截推送

**错误信息**:
```
remote: error: GH013: Repository rule violations found
remote: - Push cannot contain secrets
```

**原因**: `.env` 文件被提交到Git

**解决**: 按照上面"安全提示"部分的步骤操作

## 相关文档

- COS删除集成: `COS_DELETE_INTEGRATION.md`
- 删除按钮集成: `COS_DELETE_BUTTONS_INTEGRATION.md`
- 画廊问题修复: `GALLERY_FIX_SUMMARY.md`
