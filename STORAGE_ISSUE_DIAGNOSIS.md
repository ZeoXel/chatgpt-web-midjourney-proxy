# 存储混乱问题诊断报告

**生成时间**: 2025-11-28
**问题类型**: 存储路径混乱 + MJ URL镜像失败

---

## 🔴 发现的问题

### 1. **API路径错误** ✅ 已修复
**问题**: 前端调用 `/api/api/asset-mirror/single` (重复`/api`)
**原因**: `assetMirror.ts:18` 开发环境判断逻辑错误
**修复**: 统一使用 `/api/asset-mirror` 路径

```typescript
// 修复前
function getAssetMirrorApiPath(): string {
  const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';
  return isDev ? '/api/api/asset-mirror' : '/api/asset-mirror'; // ❌ 错误
}

// 修复后
function getAssetMirrorApiPath(): string {
  return '/api/asset-mirror'; // ✅ 统一路径
}
```

---

### 2. **MJ图片URL无法镜像** 🔴 核心问题
**现象**:
```
[MJ Mirror] 开始镜像图片到COS...
POST /api/asset-mirror/single 500 (Internal Server Error)
[MJ Mirror] ✅ 图片镜像成功，已更新URL: https://railway.lsaigc.com/mj/image/1764315338798733
```

**问题分析**:

#### 2.1 MJ代理URL特殊性
```
URL: https://railway.lsaigc.com/mj/image/1764315338798733
     ^^^^^^^^^^^^^^^^^^^^^^^^
     这是您的MJ代理服务器,不是公开CDN
```

**测试结果**:
```bash
$ curl https://railway.lsaigc.com/mj/image/1764315338798733
# SSL_ERROR_SYSCALL - 连接失败

$ curl http://localhost:3002/api/asset-mirror/single \
  -d '{"url":"https://railway.lsaigc.com/mj/image/1764315338798733"}'
# {"success":false,"error":"下载失败: Client network socket disconnected"}
```

#### 2.2 根本原因
1. **MJ代理URL不可直接访问**: `railway.lsaigc.com` 可能需要:
   - 特殊的认证headers
   - 代理转发
   - SSL证书配置问题
   - 或者这只是一个路由端点,不是实际图片URL

2. **真实的图片URL在哪里?**
   - MJ API返回的数据中应该有真实的Discord CDN URL
   - 需要检查 `chat.opt` 中是否有其他URL字段

#### 2.3 误导性的成功消息
```typescript
mirrorMJImage(ts).then(mirroredTs => {
    console.log('[MJ Mirror] ✅ 图片镜像成功，已更新URL:', mirroredTs.imageUrl);
    // ❌ 即使镜像失败,mirrorAssetToCOS仍然返回原URL,导致then被调用
})
```

**原因**: `mirrorAssetToCOS` 函数在失败时返回原URL而不是reject:
```typescript
catch (error: any) {
    mlog(`[Asset Mirror] ❌ 镜像失败,使用原URL: ${url}`, error.message);
    return url; // ❌ 返回原URL,Promise仍然resolve
}
```

---

### 3. **存储路径混乱** 🟡 待统一

您观察到的存储路径:

#### 3.1 对话存储
```
COS路径: {userUuid}/chat/conversations.json.gz
示例: 90b3b85c-0bfb-444d-a5e7-b7fb5a2bef15/chat/conversations.json.gz
```

**来源**: `src/store/modules/chat/helper.ts` 的COS保存逻辑
**用户标识**: `userUuid` (从浏览器生成的UUID)

#### 3.2 资产镜像存储 (新系统)
```
COS路径: {userId}/assets/{type}/{hash}.{ext}
示例: test-mj-user/assets/other/d1bc4dc5883372de54d314909ebe484a.jpg
```

**来源**: `service/src/storage/asset-processor.ts`
**用户标识**: `userId` (从API Key生成)

```typescript
// assetMirror.ts:24
function getUserId(): string {
  const apiKey = gptServerStore.myData.OPENAI_API_KEY;
  if (!apiKey) return 'anonymous';

  // 使用API Key的前16位作为用户标识
  return apiKey.substring(0, 16).replace(/[^a-zA-Z0-9]/g, '');
}
```

#### 3.3 冲突点

| 数据类型 | 路径格式 | 用户标识来源 | 示例 |
|---------|---------|------------|------|
| 对话历史 | `{userUuid}/chat/` | 浏览器UUID | `90b3b85c-.../chat/` |
| 镜像资产 | `{userId}/assets/` | API Key | `sk-evZ7Ao43Tgq8/assets/` |

**问题**:
- 同一用户的对话和资产存储在不同目录
- 无法通过路径关联用户的对话和资产
- API Key可能会更换,导致userId变化

---

## 🎯 解决方案

### 方案1: 统一使用UserUUID (推荐)

**优点**:
- 用户标识不变 (浏览器持久化)
- 对话和资产在同一目录
- 便于数据管理和查询

**实施**:

```typescript
// assetMirror.ts
import { useAuthStore } from '@/store';

function getUserId(): string {
  // 优先使用持久化的UserUUID
  const authStore = useAuthStore();
  if (authStore.userInfo?.uuid) {
    return authStore.userInfo.uuid;
  }

  // 降级:从localStorage获取
  const localUuid = localStorage.getItem('userUuid');
  if (localUuid) return localUuid;

  // 最后降级:使用API Key
  const apiKey = gptServerStore.myData.OPENAI_API_KEY;
  if (!apiKey) return 'anonymous';
  return apiKey.substring(0, 16).replace(/[^a-zA-Z0-9]/g, '');
}
```

**最终路径结构**:
```
{userUuid}/
├── chat/
│   └── conversations.json.gz        # 对话历史
└── assets/
    ├── audio/
    │   └── {hash}.mp3              # Suno音频
    ├── image/
    │   └── {hash}.png              # MJ图片
    └── video/
        └── {hash}.mp4              # Vidu/Luma视频
```

---

### 方案2: 修复MJ URL镜像

#### 选项A: 使用真实的Discord CDN URL

检查MJ API返回数据中是否有Discord CDN URL:

```typescript
// 可能的字段:
chat.opt.uri           // Discord CDN直接链接
chat.opt.proxy_url     // Discord代理URL
chat.opt.attachments   // 附件数组
```

**实施步骤**:
1. 检查MJ API完整返回数据
2. 找到真实的图片CDN URL字段
3. 优先镜像CDN URL而不是代理URL

#### 选项B: 配置MJ代理URL认证

如果必须使用 `railway.lsaigc.com`,需要:

```typescript
// service/src/storage/asset-processor.ts
private async downloadAsset(url: string): Promise<DownloadResult> {
  // 检测MJ代理URL
  if (url.includes('railway.lsaigc.com/mj/')) {
    // 添加必要的认证headers
    const headers = {
      'Authorization': `Bearer ${process.env.MJ_API_SECRET}`,
      // 或其他必需的headers
    };

    const response = await axios.get(url, {
      headers,
      responseType: 'arraybuffer',
      httpsAgent: new https.Agent({ rejectUnauthorized: false }) // 如果SSL有问题
    });
    //...
  }
}
```

#### 选项C: 跳过MJ代理URL镜像

如果MJ代理URL本身就是持久化的,可以跳过镜像:

```typescript
// assetMirror.ts
export async function mirrorAssetToCOS(url: string): Promise<string> {
  if (!url) return url;

  // 跳过已经是COS的URL
  if (url.includes('cos.lsaigc.com') || url.includes('cos.') && url.includes('.myqcloud.com')) {
    return url;
  }

  // ✅ 新增:跳过MJ代理URL (如果它们是持久化的)
  if (url.includes('railway.lsaigc.com/mj/image/') || url.includes('your-mj-proxy.com')) {
    mlog('[Asset Mirror] 跳过MJ代理URL (已持久化):', url);
    return url;
  }

  // ...镜像逻辑
}
```

---

## 🔧 立即修复步骤

### Step 1: 修复误导性的成功消息 ✅

```typescript
// assetMirror.ts
export async function mirrorAssetToCOS(url: string): Promise<string> {
  // ...

  try {
    const response = await fetch(`${apiPath}/single`, {...});

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // ✅ 修复:检查是否真正成功
    if (!data.success || !data.cosUrl) {
      throw new Error(data.error || '镜像失败');
    }

    // ✅ 修复:验证URL已改变
    if (data.cosUrl === url) {
      mlog(`[Asset Mirror] ⚠️ URL未改变,可能镜像失败: ${url}`);
      throw new Error('镜像后URL未变更');
    }

    mlog(`[Asset Mirror] ✅ 镜像成功: ${url} → ${data.cosUrl}`);
    return data.cosUrl;

  } catch (error: any) {
    mlog(`[Asset Mirror] ❌ 镜像失败,使用原URL: ${url}`, error.message);
    // ❌ 改为 throw 而不是返回原URL
    throw error;
  }
}
```

### Step 2: 统一存储路径

参考方案1实施。

### Step 3: 检查MJ真实图片URL

```bash
# 在MJ生成完成时,查看完整的 chat.opt 对象
console.log('[MJ Debug] 完整数据:', JSON.stringify(chat.opt, null, 2));
```

寻找可能的字段:
- `uri` / `url` / `image_url`
- `proxy_url` / `cdn_url`
- `attachments[]`

---

## 📊 当前状态总结

| 项目 | 状态 | 说明 |
|-----|------|------|
| API路径错误 | ✅ 已修复 | 统一使用 `/api/asset-mirror` |
| 前端构建 | ✅ 完成 | 新代码已编译 |
| 后端重启 | ✅ 完成 | 端口3002运行中 |
| Suno镜像 | ✅ 已集成 | 等待实际测试 |
| Vidu镜像 | ✅ 已集成 | 等待实际测试 |
| Luma镜像 | ✅ 已集成 | 等待实际测试 |
| MJ镜像 | 🔴 失败 | URL无法下载 |
| 存储路径 | 🟡 混乱 | 对话vs资产路径不一致 |

---

## 🚀 建议的下一步

1. **立即**: 检查MJ API返回的完整数据,找到真实图片URL
2. **短期**: 统一存储路径为`{userUuid}`体系
3. **长期**: 考虑是否需要镜像MJ代理URL (如果它们已经持久化)

---

**创建时间**: 2025-11-28
**严重程度**: 中 (功能可用,但体验受影响)
**影响范围**: MJ图片镜像失败,存储路径不统一
