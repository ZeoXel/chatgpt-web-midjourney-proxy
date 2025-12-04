# 画廊显示问题诊断指南

## 问题现象

根据截图分析，画廊存在以下问题：

1. ❌ **图片重复** - 同一张图片（狗在树枝上）显示了两次
2. ❌ **加载失败** - 有图片显示"加载失败..."
3. ❌ **持续加载** - 底部一直显示加载旋转图标

## 诊断步骤

### 步骤1: 检查浏览器控制台日志

打开浏览器开发者工具（F12），查看以下日志：

#### 查找MJ保存日志
```
搜索关键词: "[MJ Asset Save]" 或 "[MJ Storage]"

正常日志应该是:
[MJ Asset Save] MJ URL已持久化,保存到COS JSON文件
[MJ Storage] ✅ 保存成功: 50 张图片

异常情况:
❌ 同一个ID出现多次保存
❌ 保存失败的错误信息
```

#### 查找重复保存
```bash
# 在控制台运行:
console.log('检查重复...')

# 搜索日志中同一个 imageId 出现的次数
# 如果同一个ID保存了2次，说明有重复调用
```

### 步骤2: 检查后端API日志

```bash
cd service

# 查看实时日志
pnpm dev

# 或查看历史日志
tail -f logs/app.log | grep "MJ Storage"
```

**查找以下内容：**
```
[MJ Storage] 保存图片: { userUuid: 'xxx', imageId: 'yyy' }
[MJ Storage] 更新现有图片  # 如果是更新
[MJ Storage] 添加新图片     # 如果是新增
```

**异常模式：**
```
# 同一个 imageId 出现多次
[MJ Storage] 添加新图片: abc-123
[MJ Storage] 添加新图片: abc-123  # ❌ 重复！
```

### 步骤3: 检查JSON文件内容

使用COS工具或后端脚本检查实际存储的JSON：

```bash
cd service

# 运行检查脚本
npx tsx inspect-cos-data.ts
```

**查找重复：**
```json
{
  "images": [
    {"id": "abc-123", "image_url": "https://..."},
    {"id": "abc-123", "image_url": "https://..."}  // ❌ 重复ID
  ]
}
```

### 步骤4: 检查图片URL有效性

对于"加载失败"的图片，检查URL：

```bash
# 在浏览器控制台运行
const failedImages = document.querySelectorAll('img[alt*="加载失败"]');
failedImages.forEach(img => {
  console.log('Failed URL:', img.src);

  // 测试URL是否可访问
  fetch(img.src, {method: 'HEAD'})
    .then(r => console.log('URL状态:', r.status))
    .catch(e => console.error('URL错误:', e));
});
```

## 可能的原因和解决方案

### 问题1: 图片重复显示

#### 原因A: 前端重复调用保存API

**检查:** `src/api/mjapi.ts` line 299

```typescript
// 当前逻辑 - 每次任务完成都保存
if(ts.status === 'SUCCESS' && ts.progress === '100%' && ts.imageUrl) {
    saveMJImageToCOS({...})  // 可能被多次调用
}
```

**解决方案：**
添加保存标记，防止重复保存

```typescript
// 在 chat 对象中添加标记
if(ts.status === 'SUCCESS' && ts.progress === '100%' && ts.imageUrl) {
    // 检查是否已保存
    if (!chat.opt?.savedToCOS) {
        saveMJImageToCOS({...}).then(() => {
            // 标记为已保存
            chat.opt = chat.opt || {};
            chat.opt.savedToCOS = true;
        });
    }
}
```

#### 原因B: ID不唯一

**检查:** MJ任务的ID是否唯一

```bash
# 在浏览器控制台
const allImages = await fetch('/api/mj-storage/list?userUuid=YOUR_UUID')
  .then(r => r.json());

// 检查重复ID
const ids = allImages.images.map(img => img.id);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
console.log('重复ID:', duplicates);
```

**解决方案：**
确保ID使用 `mjID` 或 `task_id`，而不是随机生成

### 问题2: 加载失败

#### 原因A: URL过期

MJ的图片URL可能有时效性

**解决方案：**
使用COS镜像功能（已有AssetProcessor）

#### 原因B: 网络问题

**检查:**
```bash
# 测试图片URL
curl -I "图片URL"
```

**解决方案：**
添加重试机制

```typescript
// 在图片组件中添加重试
<img
  :src="imageUrl"
  @error="handleImageError"
/>

const retryCount = ref(0);
const handleImageError = () => {
  if (retryCount.value < 3) {
    retryCount.value++;
    setTimeout(() => {
      // 重新加载
      imageUrl.value = imageUrl.value + '?retry=' + retryCount.value;
    }, 1000 * retryCount.value);
  }
};
```

### 问题3: 持续加载

#### 原因: 加载状态未清除

**检查:** 画廊组件的加载状态

```typescript
// 查找类似代码
const loading = ref(true);

// 确保在数据加载完成后设置为 false
loading.value = false;
```

**解决方案：**
在 `loadMJImagesFromCOS` 之后清除加载状态

## 快速修复建议

### 修复1: 添加保存去重（推荐）

修改 `src/api/mjapi.ts` line 292-310:

```typescript
// 如果是成功完成,保存URL到COS JSON文件(不下载图片)
if(ts.status === 'SUCCESS' && ts.progress === '100%' && ts.imageUrl) {
    // 检查是否已保存到COS
    const alreadySaved = chat.opt?.savedToCOS === true;

    if (!alreadySaved) {
        console.log('[MJ Asset Save] MJ URL已持久化,保存到COS JSON文件', {
            action: ts.action,
            imageUrl: ts.imageUrl
        });

        // 保存到COS JSON文件（不阻塞，异步执行）
        saveMJImageToCOS({
            id: chat.mjID || '',
            task_id: chat.mjID || '',
            prompt: chat.opt?.prompt || chat.opt?.promptEn || chat.requestOptions?.prompt || '',
            image_url: ts.imageUrl,
            action: ts.action,
            status: ts.status,
            created_at: new Date().toISOString(),
            metadata: chat.opt,
        }).then(() => {
            // 标记为已保存
            chat.opt = chat.opt || {};
            chat.opt.savedToCOS = true;
            console.log('[MJ Asset Save] ✅ 已标记为保存完成');
        }).catch(err => {
            console.warn('[MJ Asset Save] ⚠️ 保存失败（不影响用户体验）:', err);
        });
    } else {
        console.log('[MJ Asset Save] ⏭️ 跳过重复保存:', chat.mjID);
    }
}
```

### 修复2: 后端增强去重

修改 `service/src/api/mj-storage.ts` line 119:

```typescript
// 查找是否已存在（检查ID或URL）
const existingIndex = images.findIndex(img =>
  img.id === image.id ||
  (img.image_url && img.image_url === newImage.image_url)
);
```

### 修复3: 清理重复数据

创建清理脚本 `service/cleanup-duplicate-images.ts`:

```typescript
import { TencentCOSClient } from './src/storage/cos-client';

const cosClient = new TencentCOSClient();

async function cleanupDuplicates(userUuid: string) {
  const key = `${userUuid}/assets/mj/images.json`;

  try {
    const buffer = await cosClient.downloadFile(key);
    const data = JSON.parse(buffer.toString('utf-8'));

    // 去重：保留第一个出现的ID
    const seen = new Set();
    const uniqueImages = data.images.filter((img: any) => {
      if (seen.has(img.id)) {
        console.log('移除重复:', img.id);
        return false;
      }
      seen.add(img.id);
      return true;
    });

    console.log(`原始: ${data.images.length}, 去重后: ${uniqueImages.length}`);

    // 保存回COS
    data.images = uniqueImages;
    await cosClient.uploadFile(
      Buffer.from(JSON.stringify(data, null, 2)),
      key,
      'application/json'
    );

    console.log('✅ 清理完成');
  } catch (error) {
    console.error('清理失败:', error);
  }
}

// 使用你的 userUuid
cleanupDuplicates('YOUR_USER_UUID').then(() => process.exit(0));
```

运行清理：
```bash
cd service
npx tsx cleanup-duplicate-images.ts
```

## 实时监控

添加实时监控代码到浏览器控制台：

```javascript
// 监控保存调用
const originalFetch = window.fetch;
window.fetch = function(...args) {
  if (args[0].includes('/api/mj-storage/save')) {
    console.log('🔍 [Monitor] MJ保存调用:', new Date().toISOString());
    console.log('  Body:', args[1]?.body);
  }
  return originalFetch.apply(this, args);
};

// 监控画廊刷新
let refreshCount = 0;
const observer = new MutationObserver(() => {
  refreshCount++;
  console.log(`🔄 [Monitor] 画廊刷新次数: ${refreshCount}`);
});

const gallery = document.querySelector('.gallery-container');
if (gallery) {
  observer.observe(gallery, { childList: true, subtree: true });
}
```

## 总结

最可能的原因是 **前端重复调用保存API**，建议：

1. ✅ **立即修复**: 添加 `savedToCOS` 标记（修复1）
2. ✅ **增强防护**: 后端URL去重（修复2）
3. ✅ **清理数据**: 运行清理脚本（修复3）

修复后重新测试，应该不会再出现重复图片的问题。
