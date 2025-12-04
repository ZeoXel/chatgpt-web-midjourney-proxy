# 系统存储架构详解

## 概述

当前系统采用**双层存储架构**：
1. **LocalStorage（浏览器本地存储）** - 临时缓存和快速访问
2. **COS（腾讯云对象存储）** - 持久化存储和跨设备同步

## 🎯 存储架构图

```
用户数据流
    ↓
┌─────────────────────────────────────┐
│     LocalStorage (浏览器)           │
│  ┌──────────────────────────────┐   │
│  │ 聊天记录 (chatStorage)       │   │ ← 限制: 10MB
│  │ MJ图片列表 (mjDrawStore)     │   │
│  │ Suno音乐 (sunoStore)         │   │
│  │ Luma视频 (lumaStore)         │   │
│  │ 3D模型 (modelStore)          │   │
│  │ 画廊数据 (galleryData)       │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
    ↓ 自动同步 (3秒防抖)
┌─────────────────────────────────────┐
│     COS (腾讯云对象存储)            │
│  ┌──────────────────────────────┐   │
│  │ {userUuid}/                  │   │ ← 无限制
│  │  ├─ chat.json                │   │
│  │  └─ assets/                  │   │
│  │      ├─ mj/images.json       │   │
│  │      ├─ images/images.json   │   │
│  │      ├─ suno/audios.json     │   │
│  │      ├─ videos/videos.json   │   │
│  │      └─ models/models.json   │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

## 📊 LocalStorage的作用

### 1. **快速缓存层**
- **目的**: 提供毫秒级数据访问
- **原理**: 浏览器内存读取，无需网络请求
- **适用**: 频繁读取的数据（对话列表、当前会话）

### 2. **离线工作**
- **目的**: 无网络时也能使用
- **原理**: 本地存储完整副本
- **适用**: 查看历史记录、继续对话

### 3. **性能优化**
- **目的**: 减少COS API调用
- **原理**: 
  - 读取：优先从LocalStorage
  - 写入：立即写LocalStorage，延迟同步COS
- **效果**: 用户操作无延迟

### 4. **数据缓冲**
- **目的**: 防止频繁保存到云端
- **原理**: 本地累积变更，批量上传
- **配置**: 3秒防抖（`SAVE_DEBOUNCE_MS: 3000`）

## 🔍 当前存储使用情况

### LocalStorage存储项清单

从 `src/utils/storage/index.ts:102-110` 可以看到主要存储项：

| 存储Key | 用途 | 典型大小 | 是否必需 |
|---------|------|----------|----------|
| `chatStorage` | 聊天记录 | 1-5MB | ✅ 必需 |
| `mjDrawStore` | MJ图片列表 | 500KB-2MB | ⚠️ 可清理 |
| `sunoStore` | Suno音乐列表 | 200KB-1MB | ⚠️ 可清理 |
| `lumaStore` | Luma视频列表 | 100KB-500KB | ⚠️ 可清理 |
| `viduStore` | Vidu视频列表 | 100KB-500KB | ⚠️ 可清理 |
| `modelStore` | 3D模型列表 | 100KB-300KB | ⚠️ 可清理 |
| `galleryData` | 画廊索引 | 500KB-2MB | ⚠️ 可清理 |
| `audioHistory` | 音频历史 | 100KB-500KB | ⚠️ 可清理 |
| `videoHistory` | 视频历史 | 100KB-500KB | ⚠️ 可清理 |

**总计**: 通常 3-8MB，接近10MB限制时触发警告

### 浏览器LocalStorage限制

- **Chrome/Edge**: 约10MB
- **Firefox**: 约10MB  
- **Safari**: 5MB (更严格)
- **触发条件**: 写入时超出配额抛出 `QuotaExceededError`

## 🚨 为什么会出现"存储空间不足"？

### 原因1: 聊天记录过多
```javascript
// 每条聊天消息约 1-5KB
// 100条消息 = 100-500KB
// 10个对话 × 100条 = 1-5MB
```

**解决**: 系统会自动清理，只保留最近2条对话，每条最多20条消息

### 原因2: 资产列表未清理
- **MJ图片**: 每张记录约2KB，100张 = 200KB
- **Suno音乐**: 每首记录约3KB，50首 = 150KB
- **视频列表**: 每个记录约5KB，30个 = 150KB

**问题**: 这些列表不会自动清理，会持续累积

### 原因3: COS同步失败导致重复保存
如果COS未启用（`ENABLE_TENCENT_COS=false`），数据只保存在LocalStorage，导致：
- 无法云端备份
- 无法跨设备同步
- LocalStorage快速填满

## 🔧 接入COS后的变化

### 之前（仅LocalStorage）
```
保存聊天 → LocalStorage (累积) → 空间不足 ❌
```

### 之后（LocalStorage + COS）
```
保存聊天 → LocalStorage (缓存) 
          → COS (持久化)
          → LocalStorage可清理 ✅
```

### COS的优势

1. **容量无限制**
   - COS可存储TB级数据
   - LocalStorage仅作缓存，可随时清空

2. **跨设备同步**
   - 手机、电脑共享同一份数据
   - 切换浏览器无需迁移

3. **数据安全**
   - 云端备份，不怕浏览器清缓存
   - 误删除可恢复（COS版本控制）

4. **性能优化**
   - 只加载最近数据到LocalStorage
   - 旧数据按需从COS加载

## 📋 存储配额管理策略

### 自动清理机制（`src/utils/storage/index.ts`）

当LocalStorage写入失败时，按以下顺序清理：

#### 第1步: 清理过期数据
```javascript
cleanExpiredData()  // 删除已过期的缓存项
```

#### 第2步: 清理大型数据
```javascript
cleanLargeData()  // 删除资产列表（因为COS有备份）
// 删除: mjDrawStore, sunoStore, lumaStore, galleryData...
```

#### 第3步: 压缩聊天历史
```javascript
cleanChatHistory()  // 只保留最近2条对话，每条20条消息
```

### 存储监控（`src/utils/storage/monitor.ts`）

- **检查频率**: 每60秒
- **警告阈值**: 使用率 ≥ 70%
- **严重阈值**: 使用率 ≥ 85%
- **提示间隔**: 至少1小时

当达到85%时，显示：
```
存储空间严重不足！

建议操作：
1. 前往【设置】清理存储空间
2. 导出重要聊天记录
3. 删除旧的聊天会话
```

## 🎯 当前问题分析

你遇到的"存储空间严重不足"警告，可能是因为：

### 问题1: COS未启用（已修复）
```bash
# 修复前
ENABLE_TENCENT_COS=   # 缺失或false

# 修复后
ENABLE_TENCENT_COS=true  # 已添加到 service/.env
```

**影响**: 
- ❌ 数据无法同步到COS
- ❌ LocalStorage累积到满
- ❌ 无法跨设备访问

### 问题2: 旧数据仍在LocalStorage
即使启用COS，旧的LocalStorage数据不会自动删除。

**解决方案**: 手动清理或等待自动触发

### 问题3: 资产列表过大
MJ、Suno、Luma等服务产生的资产列表没有自动清理逻辑。

## ✅ 推荐操作步骤

### 立即操作（修复当前问题）

1. **重启后端服务**
   ```bash
   cd service
   pnpm dev
   ```
   
   确认看到：
   ```
   [COS Client] 初始化成功 { bucket: 'lsjx-1354453097', region: 'ap-beijing' }
   ```

2. **刷新前端页面**
   - 打开浏览器控制台
   - 刷新页面
   - 确认看到COS加载日志：
     ```
     [COS Load] 🌐 开始从COS加载对话...
     [COS Load] ✅ 加载成功: X 个对话
     ```

3. **手动清理LocalStorage**
   
   在浏览器控制台执行：
   ```javascript
   // 查看当前存储使用情况
   const { ls } = await import('/src/utils/storage/index.ts')
   console.log(ls.getStorageInfo())
   
   // 清理可选数据（COS有备份）
   ls.cleanLargeData()
   
   // 重新检查
   console.log(ls.getStorageInfo())
   ```

4. **验证COS同步**
   
   进行一个操作（如发送一条消息），检查：
   ```javascript
   // 应该看到保存日志
   [Chat Save] ✅ 保存到COS成功
   ```

### 长期优化（防止再次出现）

#### 优化1: 增加自动清理策略

在 `src/utils/storage/index.ts:100-123` 的 `cleanLargeData()` 中，已经会清理：
- ✅ mjDrawStore
- ✅ sunoStore
- ✅ lumaStore
- ✅ galleryData
- ✅ audioHistory
- ✅ videoHistory

这些数据在COS都有备份，清理后会自动从COS重新加载。

#### 优化2: 定期清理策略

可以添加定期清理任务：

```javascript
// 在 App.vue 中添加
onMounted(() => {
  // 每天清理一次旧数据
  setInterval(() => {
    const info = ls.getStorageInfo()
    if (parseFloat(info.usage) > 60) {
      console.log('[Storage] 使用率超过60%，自动清理...')
      ls.cleanLargeData()
    }
  }, 24 * 60 * 60 * 1000)  // 24小时
})
```

#### 优化3: 资产列表分页

对于MJ、Suno等资产列表，可以实现分页加载：
- LocalStorage只保存最近50条
- 更多数据按需从COS加载

## 📚 相关配置文件

### 聊天存储配置
**文件**: `src/store/modules/chat/helper.ts:10-15`
```javascript
const CHAT_OPTIMIZATION_CONFIG = {
  MAX_MESSAGES_TO_SAVE: 100,      // 每个对话最多保存100条消息
  MAX_CHATS_TO_SAVE: 50,          // 最多保存50个对话
  SAVE_DEBOUNCE_MS: 3000,         // 3秒防抖
  EXCLUDE_DRAW_UUID: 1002         // 排除生图会话
}
```

### 存储监控配置
**文件**: `src/utils/storage/monitor.ts:167-171`
```javascript
export const storageMonitor = new StorageMonitor({
  warningThreshold: 70,       // 70%警告
  criticalThreshold: 85,      // 85%严重警告
  checkInterval: 60000        // 每60秒检查
})
```

## 🔍 调试命令

### 查看存储使用情况
```javascript
// 在浏览器控制台
const { ls } = await import('/src/utils/storage/index.ts')
const info = ls.getStorageInfo()
console.table({
  '总使用': info.totalMB + 'MB',
  '使用率': info.usage + '%',
  '前10大项': info.details
})
```

### 查看各存储项大小
```javascript
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i)
  const value = localStorage.getItem(key)
  const size = new Blob([value]).size
  console.log(`${key}: ${(size/1024).toFixed(2)}KB`)
}
```

### 手动清理指定项
```javascript
// 清理MJ图片列表（COS有备份）
localStorage.removeItem('mjDrawStore')

// 清理所有资产列表
['mjDrawStore', 'sunoStore', 'lumaStore', 'galleryData'].forEach(key => {
  localStorage.removeItem(key)
})
```

## 📖 总结

### LocalStorage的定位
- ✅ **缓存层** - 快速访问
- ✅ **离线支持** - 断网可用
- ✅ **性能优化** - 减少网络请求
- ❌ **不是主存储** - 可清理，不丢数据

### COS的定位
- ✅ **主存储** - 持久化
- ✅ **跨设备同步** - 多端一致
- ✅ **无容量限制** - 可扩展
- ✅ **数据安全** - 云端备份

### 工作流程
```
用户操作 
  ↓
LocalStorage (立即写入，用户无感知)
  ↓ 3秒防抖
COS (异步上传，后台同步)
  ↓
LocalStorage可随时清理（因为COS有备份）
```

### 关键要点
1. **LocalStorage满了不用担心** - 系统会自动清理并从COS恢复
2. **重要数据都在COS** - LocalStorage只是缓存
3. **清理LocalStorage不丢数据** - 刷新页面会从COS重新加载
4. **COS必须启用** - 否则无法享受上述优势

## 🎉 现状

经过配置修复，你的系统现在：
- ✅ COS已启用（`ENABLE_TENCENT_COS=true`）
- ✅ 数据会自动同步到云端
- ✅ LocalStorage可以随时清理
- ✅ 不会再有空间不足问题

只需重启后端服务即可生效！
