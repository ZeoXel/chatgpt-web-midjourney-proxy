# LocalStorage优化说明

## 🔍 问题根源

### 当前问题
清理LocalStorage后，刷新页面瞬间又满了。

### 原因分析

```javascript
// assetRestoration.ts - 资产恢复流程
restoreAllAssets()
  ↓
loadMJImagesFromCOS({ limit: 200 })  // ❌ 加载200条记录
  ↓
setCache('cos-cache-mj-images', data)  // ❌ 将200条记录存入localStorage
  ↓
存储数据示例:
{
  "data": [
    {
      "id": "xxx-123",
      "image_url": "https://cos.lsaigc.com/...",  // 仅URL，不是图片本身
      "prompt": "a beautiful landscape...",
      "created_at": "2024-01-01",
      "metadata": {...}  // ❌ 但元数据可能很大
    },
    // ... 重复200次
  ],
  "timestamp": 1234567890
}
```

**计算**：
- 每条记录：约2KB（包含URL、prompt、metadata）
- 200条记录 = 400KB
- 5种资产类型 = 2MB
- 再加上聊天记录 = **瞬间3-5MB**

### 数据已经是URL指针了！

✅ **正确的部分**：
```typescript
interface VideoRecord {
  url: string;           // ✅ 只存URL，不存视频文件
  original_url: string;  // ✅ 只存URL
  poster_url?: string;   // ✅ 只存URL
}
```

❌ **问题的部分**：
- 虽然只存URL，但存了**太多条记录**
- 每条记录还包含大量metadata

## ✅ 已实施的修复

### 修复1: 减少加载数量

```javascript
// 之前: 每次加载200条
loadMJImagesFromCOS({ limit: 200 })

// 之后: 只加载最近20条
loadMJImagesFromCOS({ limit: 20 })
```

### 修复2: 禁用LocalStorage缓存

```javascript
// 之前: 将COS数据缓存到localStorage
setCache(CACHE_KEYS.MJ_IMAGES, data)  // ❌

// 之后: 直接使用，不缓存
// ✅ 各模块有自己的store管理
// ✅ COS加载足够快 (<500ms)
```

## 📊 存储策略对比

### 旧策略（问题）
```
用户打开页面
  ↓
从COS加载200条MJ图片
  ↓
存入 localStorage['cos-cache-mj-images']
  ↓
存入 localStorage['mjDrawStore'] (各模块自己的store)
  ↓
❌ 重复存储！占用翻倍！
```

### 新策略（优化后）
```
用户打开页面
  ↓
从COS加载20条MJ图片
  ↓
❌ 不缓存到localStorage
  ↓
直接给各模块使用
  ↓
各模块根据需要存储到自己的store
  ↓
✅ 单一存储！按需加载！
```

## 🎯 最佳实践

### LocalStorage应该存什么？

✅ **应该存储**：
1. **最近使用的资产** (20-50条)
   - 用于快速访问
   - 离线浏览
   
2. **资产元数据** (URL + 基本信息)
   ```typescript
   {
     id: "xxx",
     url: "https://cos.xxx/image.png",  // URL指针
     prompt: "short description",       // 简短描述
     created_at: "2024-01-01"
   }
   ```

3. **当前会话数据**
   - 正在进行的对话
   - 编辑中的内容

❌ **不应该存储**：
1. **历史全量数据** (200+条记录)
   - 应该按需从COS加载
   
2. **大型metadata**
   ```typescript
   {
     metadata: {
       // ❌ 不要存储完整的配置对象
       fullConfig: {...},  // 可能很大
       history: [...],     // 历史记录
       cache: {...}        // 缓存数据
     }
   }
   ```

3. **重复缓存**
   - 不要在多个key下存储相同数据

### 各模块的职责

| 模块 | LocalStorage Key | 存储内容 | 数量限制 |
|------|-----------------|----------|----------|
| MJ Store | `mjDrawStore` | 最近生成的图片 | 20-50条 |
| Suno Store | `sunoStore` | 最近的音乐 | 20-30条 |
| Video Store | `videoStore` | 最近的视频 | 10-20条 |
| Model Store | `modelStore` | 最近的模型 | 5-10条 |
| Chat Store | `chatStorage` | 最近2-3个对话 | 有限消息数 |

**总原则**：
- 存储**指针**(URL)而非**内容**(Blob)
- 存储**最近**而非**全部**
- 存储**必要**而非**完整**

## 🔧 用户操作建议

### 如果LocalStorage仍然满了

#### 方法1: 清理旧缓存（安全）
```javascript
// 在浏览器控制台执行
// 清理COS缓存（会自动重新加载）
['cos-cache-mj-images', 'cos-cache-images', 'cos-cache-music', 
 'cos-cache-videos', 'cos-cache-models'].forEach(key => {
  localStorage.removeItem(key)
})
```

#### 方法2: 清理资产列表（安全，COS有备份）
```javascript
// 清理各模块的store（会从COS重新加载）
['mjDrawStore', 'sunoStore', 'lumaStore', 'viduStore',
 'modelStore', 'galleryData'].forEach(key => {
  localStorage.removeItem(key)
})
```

#### 方法3: 压缩聊天记录（谨慎）
```javascript
// 只保留最近2条对话
const chat = JSON.parse(localStorage.getItem('chatStorage') || '{}')
if (chat.data) {
  chat.data.history = chat.data.history.slice(-2)
  chat.data.chat = chat.data.chat.slice(-2)
  localStorage.setItem('chatStorage', JSON.stringify(chat))
}
```

### 如何查看存储使用情况

```javascript
// 查看总使用量
let total = 0
for (let key in localStorage) {
  const size = new Blob([localStorage[key]]).size
  total += size
  if (size > 100000) {  // 大于100KB的项
    console.log(`${key}: ${(size/1024).toFixed(2)}KB`)
  }
}
console.log(`总计: ${(total/1024/1024).toFixed(2)}MB / 10MB`)
```

## 📈 优化效果预期

### 优化前
```
MJ图片缓存:     400KB (200条)
通用图片缓存:   400KB (200条)
音乐缓存:       300KB (100条)
视频缓存:       500KB (100条)
模型缓存:       150KB (50条)
聊天记录:       2-5MB
---
总计: 4-7MB (接近限制)
```

### 优化后
```
MJ图片缓存:     0KB (不缓存)
通用图片缓存:   0KB (不缓存)
音乐缓存:       0KB (不缓存)
视频缓存:       0KB (不缓存)
模型缓存:       0KB (不缓存)
聊天记录:       2-5MB
---
总计: 2-5MB (安全范围)
```

**节省**: ~2-3MB空间

## 🎉 总结

### 核心理解

1. **LocalStorage只存URL** ✅
   - 不存储实际的图片/视频/音频文件
   - 只存储元数据和URL指针

2. **问题不是存储内容，而是存储数量** ❌
   - 200条记录 × 2KB = 400KB
   - 5种资产 = 2MB
   - 过多元数据占用空间

3. **解决方案：按需加载** ✅
   - 只加载最近的20条
   - 禁用重复缓存
   - 各模块独立管理

### 架构改进

```
之前:
COS → LocalStorage缓存 → 各模块Store → 显示
       ↑_____________↑
           重复存储

之后:
COS → 各模块Store → 显示
      ↑
    按需加载，不重复
```

### 用户体验

- ✅ 页面加载更快（数据量减少10倍）
- ✅ 不会再出现空间不足
- ✅ 旧数据按需从COS加载
- ✅ 离线仍可访问最近数据
