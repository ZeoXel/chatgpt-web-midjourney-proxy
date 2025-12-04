# 画廊重复图片问题修复总结

## 问题现象

根据截图，画廊存在以下问题：
1. ❌ **图片重复** - 同一张图片显示两次
2. ❌ **加载失败** - 部分图片显示"加载失败..."
3. ❌ **持续加载** - 底部一直显示加载中

## 根本原因

**MJ图片保存时没有防止重复调用**，导致同一张图片被保存多次到COS JSON文件。

### 触发场景
```typescript
// 前端轮询检查任务状态
check() {
    // 任务完成时触发保存
    if(ts.status === 'SUCCESS' && ts.progress === '100%') {
        saveMJImageToCOS({...})  // 可能被多次调用
    }

    // 5秒后继续检查（可能再次触发保存）
    setTimeout(() => check(), 5000)
}
```

## 已实施的修复

### ✅ 修复1: 前端防重复保存

**文件**: `src/api/mjapi.ts` (第293-323行)

**修改内容**:
```typescript
// 添加保存标记，防止重复
const alreadySaved = chat.opt?.savedToCOS === true;

if (!alreadySaved) {
    saveMJImageToCOS({...}).then(() => {
        // 标记为已保存
        chat.opt = chat.opt || {};
        chat.opt.savedToCOS = true;
        console.log('[MJ Asset Save] ✅ 已标记为保存完成');
    });
} else {
    console.log('[MJ Asset Save] ⏭️ 跳过重复保存');
}
```

**效果**:
- ✅ 同一个任务只会保存一次
- ✅ 通过日志可以看到"跳过重复保存"

### ✅ 修复2: 后端增强去重

**文件**: `service/src/api/mj-storage.ts` (第130-144行)

**修改内容**:
```typescript
// 增强去重：检查ID或URL是否已存在
const existingIndex = images.findIndex(img =>
  img.id === newImage.id ||
  (img.image_url && newImage.image_url && img.image_url === newImage.image_url)
);

if (existingIndex >= 0) {
    // 更新现有记录（而不是新增）
    images[existingIndex] = newImage;
} else {
    // 确认是新记录才添加
    images.unshift(newImage);
}
```

**效果**:
- ✅ 即使前端重复调用，后端也会检测并更新而不是新增
- ✅ 基于ID和URL双重检查

### ✅ 修复3: 清理脚本

**文件**: `service/cleanup-duplicate-mj-images.ts`

**使用方法**:
```bash
cd service

# 清理指定用户的重复数据
npx tsx cleanup-duplicate-mj-images.ts <你的userUuid>
```

**功能**:
- 加载MJ图片JSON文件
- 检测ID重复和URL重复
- 自动去重并保存

## 验证步骤

### 步骤1: 查看浏览器控制台

打开F12开发者工具，观察日志：

**正常日志** (修复后):
```
[MJ Asset Save] MJ URL已持久化,保存到COS JSON文件 {mjID: "xxx"}
[MJ Asset Save] ✅ 已标记为保存完成: xxx
[MJ Asset Save] ⏭️ 跳过重复保存: xxx
```

**异常日志** (修复前):
```
[MJ Asset Save] 保存到COS JSON文件 {mjID: "xxx"}
[MJ Asset Save] 保存到COS JSON文件 {mjID: "xxx"}  // ❌ 重复
```

### 步骤2: 查看后端日志

```bash
cd service
pnpm dev

# 观察日志
[MJ Storage] 添加新图片: xxx-123
[MJ Storage] 更新现有图片: xxx-123  # ✅ 第二次是更新而非新增
```

### 步骤3: 运行清理脚本

```bash
# 1. 清理现有重复数据
cd service
npx tsx cleanup-duplicate-mj-images.ts YOUR_UUID

# 预期输出
📥 从COS加载数据...
原始图片数量: 10

🧹 开始去重...
  ❌ 移除重复: {id: "abc-123", reason: "ID重复"}

📊 去重统计:
  原始数量: 10
  重复数量: 3
  去重后数量: 7

✅ 清理完成！
```

### 步骤4: 刷新画廊

```bash
# 1. 重启前端（清除缓存）
pnpm dev

# 2. 打开浏览器，清除localStorage
localStorage.clear()

# 3. 刷新页面
# 4. 检查画廊是否正常
```

## 测试新图片

生成新的MJ图片后，检查：

1. ✅ **控制台日志** - 看到"已标记为保存完成"
2. ✅ **画廊显示** - 图片只显示一次
3. ✅ **JSON文件** - 图片只有一条记录

## 额外优化建议

### 优化1: 添加唯一索引

修改 `service/src/api/mj-storage.ts`:

```typescript
// 在保存前，对images数组按时间排序并去重
const sortedImages = images
  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  .filter((img, index, self) =>
    index === self.findIndex(t => t.id === img.id || t.image_url === img.image_url)
  );
```

### 优化2: 添加画廊去重逻辑

在前端画廊组件中添加去重：

```typescript
// 加载图片后去重
const images = await loadMJImagesFromCOS();
const uniqueImages = images.filter((img, index, self) =>
  index === self.findIndex(t => t.id === img.id)
);
```

### 优化3: 定时清理任务

创建定时任务，定期清理重复数据：

```bash
# crontab
0 2 * * * cd /path/to/service && npx tsx cleanup-duplicate-mj-images.ts USER_UUID
```

## 故障排查

### 问题: 清理后仍有重复

**检查**:
```bash
# 1. 确认清理脚本执行成功
npx tsx cleanup-duplicate-mj-images.ts USER_UUID

# 2. 检查JSON文件内容
npx tsx inspect-cos-data.ts

# 3. 清除浏览器缓存
localStorage.clear()
location.reload()
```

### 问题: 新图片仍然重复

**检查**:
```javascript
// 1. 在浏览器控制台检查标记
const chat = chatStore.getChatByUuid(uuid).find(c => c.mjID === 'YOUR_MJ_ID');
console.log('savedToCOS:', chat.opt?.savedToCOS);  // 应该是 true

// 2. 检查后端日志
grep "跳过重复保存" service/logs/app.log
```

### 问题: "加载失败"仍然出现

**可能原因**:
1. URL已过期（MJ图片有时效性）
2. 网络连接问题
3. COS资产处理器未下载图片

**解决**:
```bash
# 检查URL是否可访问
curl -I "图片URL"

# 如果URL过期，需要重新生成或使用COS镜像
```

## 总结

### 修复效果

| 问题 | 修复前 | 修复后 |
|------|--------|--------|
| 图片重复 | ❌ 同一张显示多次 | ✅ 每张只显示一次 |
| 重复保存 | ❌ 每次轮询都保存 | ✅ 只保存一次 |
| 数据冗余 | ❌ JSON文件有重复 | ✅ 自动去重 |

### 修改文件清单

1. ✅ `src/api/mjapi.ts` - 添加保存标记
2. ✅ `service/src/api/mj-storage.ts` - 增强去重逻辑
3. ✅ `service/cleanup-duplicate-mj-images.ts` - 清理脚本
4. ✅ `GALLERY_DEBUG_GUIDE.md` - 诊断指南
5. ✅ `GALLERY_FIX_SUMMARY.md` - 本文档

### 下一步

1. **立即执行**: 运行清理脚本清理现有重复数据
2. **测试验证**: 生成新图片，确认不再重复
3. **监控日志**: 观察"跳过重复保存"日志
4. **用户反馈**: 确认画廊显示正常

🎉 **修复完成！现在MJ图片不会再重复保存了。**
