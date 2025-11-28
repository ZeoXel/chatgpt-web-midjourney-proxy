# 腾讯云COS配置指南

本文档指导你如何配置和测试腾讯云COS对象存储服务。

## 一、前置准备

### 1.1 创建腾讯云账号
访问 [腾讯云官网](https://cloud.tencent.com/) 注册账号

### 1.2 开通对象存储COS服务
1. 登录腾讯云控制台
2. 搜索 "对象存储 COS"
3. 点击"立即使用"开通服务

### 1.3 创建存储桶
1. 进入 COS 控制台
2. 点击"存储桶列表" → "创建存储桶"
3. 填写配置:
   - **名称**: 例如 `chatgpt-assets` (系统会自动添加APPID后缀)
   - **所属地域**: 选择就近地域(如 广州 `ap-guangzhou`)
   - **访问权限**: 建议选择"私有读写"
   - **存储桶标签**: 可选
4. 点击"创建"

**注意**: 创建后的完整存储桶名称格式为: `chatgpt-assets-1234567890` (后面的数字是你的APPID)

### 1.4 获取密钥
1. 进入 [访问密钥管理](https://console.cloud.tencent.com/cam/capi)
2. 点击"新建密钥"
3. 保存 `SecretId` 和 `SecretKey`

**安全建议**:
- 不要使用主账号密钥,建议创建子账号并分配最小权限
- 定期轮换密钥
- 不要将密钥提交到代码仓库

## 二、配置项目

### 2.1 配置环境变量

编辑 `service/.env` 文件,添加以下配置:

```env
# ===== 腾讯云COS配置 =====
ENABLE_TENCENT_COS=true

# 密钥信息(从访问密钥管理获取)
COS_SECRET_ID=AKIDxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
COS_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 存储桶配置
COS_BUCKET=chatgpt-assets-1234567890
COS_REGION=ap-guangzhou

# CDN加速域名(可选,如果配置了CDN)
COS_DOMAIN=https://your-cdn-domain.com
```

**参数说明**:
- `ENABLE_TENCENT_COS`: 是否启用COS服务 (true/false)
- `COS_SECRET_ID`: 腾讯云API密钥ID
- `COS_SECRET_KEY`: 腾讯云API密钥Key
- `COS_BUCKET`: 存储桶完整名称(包含APPID后缀)
- `COS_REGION`: 存储桶所属地域
- `COS_DOMAIN`: (可选) 自定义CDN域名

### 2.2 地域代码对照表

| 地域 | Region代码 |
|------|-----------|
| 广州 | ap-guangzhou |
| 上海 | ap-shanghai |
| 北京 | ap-beijing |
| 成都 | ap-chengdu |
| 重庆 | ap-chongqing |
| 深圳金融 | ap-shenzhen-fsi |
| 上海金融 | ap-shanghai-fsi |
| 北京金融 | ap-beijing-fsi |
| 中国香港 | ap-hongkong |
| 新加坡 | ap-singapore |
| 孟买 | ap-mumbai |
| 首尔 | ap-seoul |
| 曼谷 | ap-bangkok |
| 东京 | ap-tokyo |
| 硅谷 | na-siliconvalley |
| 弗吉尼亚 | na-ashburn |
| 多伦多 | na-toronto |
| 法兰克福 | eu-frankfurt |
| 莫斯科 | eu-moscow |

完整列表查看: [腾讯云地域列表](https://cloud.tencent.com/document/product/436/6224)

## 三、测试连接

### 3.1 运行测试脚本

```bash
cd service
pnpm test:cos
```

### 3.2 成功输出示例

```
========================================
腾讯云COS连接测试
========================================

1. 检查环境变量配置:
   ENABLE_TENCENT_COS: true
   COS_SECRET_ID: 已配置 ✓
   COS_SECRET_KEY: 已配置 ✓
   COS_BUCKET: chatgpt-assets-1234567890
   COS_REGION: ap-guangzhou
   COS_DOMAIN: 未配置（可选）

2. 初始化COS客户端...
   ✓ 客户端初始化成功

3. 测试连接...

========================================
测试结果:
========================================
✅ 连接成功!

存储桶信息:
  - 名称: chatgpt-assets-1234567890
  - 区域: ap-guangzhou
  - 文件数量: 0
  - 账号下存储桶总数: 1

🎉 腾讯云COS已成功配置并可以正常使用!
========================================
```

### 3.3 常见错误排查

#### 错误1: 存储桶不存在
```
❌ 连接失败
错误信息: 存储桶 "chatgpt-assets-1234567890" 不存在
```
**解决方案**:
- 检查存储桶名称是否包含APPID后缀
- 确认存储桶已在控制台创建成功

#### 错误2: 认证失败
```
❌ 连接失败
错误信息: SignatureDoesNotMatch
```
**解决方案**:
- 检查 `COS_SECRET_ID` 和 `COS_SECRET_KEY` 是否正确
- 确认密钥未过期或被删除

#### 错误3: 权限不足
```
❌ 连接失败
错误信息: AccessDenied
```
**解决方案**:
- 确认子账号有访问存储桶的权限
- 在CAM控制台为子账号分配 `QcloudCOSFullAccess` 策略

#### 错误4: 地域不匹配
```
❌ 连接失败
错误信息: NoSuchBucket
```
**解决方案**:
- 检查 `COS_REGION` 是否与存储桶创建时的地域一致
- 在COS控制台查看存储桶所属地域

## 四、配置CDN加速(可选)

### 4.1 开通CDN
1. 进入COS控制台 → 选择存储桶
2. 点击"域名与传输管理" → "自定义CDN加速域名"
3. 添加自定义域名并完成CNAME配置

### 4.2 配置CDN域名
编辑 `service/.env`:
```env
COS_DOMAIN=https://cdn.yourdomain.com
```

配置后,文件访问URL将使用CDN域名而非COS默认域名。

## 五、权限配置(推荐)

### 5.1 创建子账号
1. 进入 [访问管理CAM](https://console.cloud.tencent.com/cam)
2. 创建子用户
3. 生成访问密钥

### 5.2 配置存储桶策略
为子账号分配最小权限:
```json
{
  "version": "2.0",
  "statement": [
    {
      "effect": "allow",
      "action": [
        "name/cos:PutObject",
        "name/cos:GetObject",
        "name/cos:DeleteObject",
        "name/cos:ListParts",
        "name/cos:AbortMultipartUpload"
      ],
      "resource": "qcs::cos:ap-guangzhou:uid/1234567890:chatgpt-assets-1234567890/*"
    }
  ]
}
```

## 六、成本优化建议

### 6.1 生命周期管理
配置自动删除临时文件:
1. COS控制台 → 存储桶 → 生命周期
2. 添加规则:
   - 路径: `temp/`
   - 操作: 30天后删除

### 6.2 存储类型
- **标准存储**: 频繁访问的文件(用户生成内容)
- **低频存储**: 30天内访问<2次的文件
- **归档存储**: 长期归档,极少访问

### 6.3 监控费用
1. 进入 [费用中心](https://console.cloud.tencent.com/expense)
2. 设置费用告警
3. 定期查看COS账单

## 七、下一步

连接测试成功后,你可以:

1. **实现文件上传功能** - 参考 `service/src/storage/cos-client.ts`
2. **配置用户隔离策略** - 设计路径命名规范
3. **实现多平台同步** - 整合R2、Supabase等存储
4. **添加配额管理** - 限制用户存储空间

## 八、相关资源

- [腾讯云COS官方文档](https://cloud.tencent.com/document/product/436)
- [Node.js SDK文档](https://cloud.tencent.com/document/product/436/8629)
- [API文档](https://cloud.tencent.com/document/product/436/7751)
- [价格说明](https://cloud.tencent.com/document/product/436/6239)

## 九、技术支持

如遇问题:
1. 查看测试脚本输出的错误提示
2. 参考本文档的常见错误排查
3. 查阅腾讯云COS官方文档
4. 提交Issue到项目仓库
