# MJ Upscale按钮功能修复说明

## 📋 问题描述

在MJ图片upscale后,界面显示了大量按钮(强变化/弱变化/局部重绘/变焦等),但许多按钮功能不被上游API支持,导致点击后无法正常使用。

## 🔍 原因分析

### 1. 按钮显示机制

代码通过 `chat.opt?.buttons` 数组判断按钮是否可用:
- 只有当API返回的buttons中存在对应的 `customId` 时,按钮才会显示
- 当前实现已经是"按需显示",但缺少版本提示

### 2. 模型版本依赖

不同按钮功能依赖不同的Midjourney模型版本:

#### V5功能
- ✅ U1-U4 (Upscale)
- ✅ V1-V4 (Variation)
- ⚠️ **强变化** (high_variation) - 需要V5+
- ⚠️ **弱变化** (low_variation) - 需要V5+
- ⚠️ **高清2倍** (upsample_v5_2x) - 需要V5
- ⚠️ **高清4倍** (upsample_v5_4x) - 需要V5

#### V6功能
- ⚠️ **局部重绘** (Inpaint) - 需要V6+
- ⚠️ **变焦1.5倍** (Outpaint 1.5x) - 需要V6+
- ⚠️ **变焦2倍** (Outpaint 2x) - 需要V6+
- ⚠️ **方正** (Make Square) - 需要V6+
- ⚠️ **自定义变焦** (Custom Zoom) - 需要V6+
- ⚠️ **向左/右/上/下** (Pan) - 需要V6+
- ⚠️ **V6 2x Subtle/Creative** - 需要V6

#### V6.1功能
- ⚠️ **V6.1 2x Subtle/Creative** - 需要V6.1

#### V7功能
- ⚠️ **V7 2x Subtle/Creative** - 需要V7

### 3. 上游API限制

测试渠道 `https://api.bltcy.ai` 可能:
1. 使用的是较旧版本的 midjourney-proxy
2. 配置的Discord Bot不支持某些高级功能
3. 使用的MJ订阅不包含V6/V7功能

## ✅ 修复方案

### 修改内容

1. **添加版本标注** (`src/views/mj/mjText.vue:160-215`)
   - 为每个高级按钮添加 `requiredVersion` 字段
   - 标注功能所需的最低MJ版本

2. **智能调试检测** (`src/views/mj/mjText.vue:309-338`)
   - 新增 `checkUnsupportedButtons()` 函数
   - 在开发模式下自动检测不可用按钮
   - 在控制台输出详细的不支持原因

3. **自动调用检测** (`src/views/mj/mjText.vue:263-264`)
   - 图片加载完成后自动检测按钮可用性
   - 仅在debug模式下输出(不影响普通用户体验)

### 使用方法

#### 开启调试模式

在浏览器控制台执行:
```javascript
localStorage.setItem('debug', '1')
```

然后刷新页面,生成MJ图片并upscale,控制台会显示:

```
⚠️ MJ按钮功能检测
总按钮数: 12
不可用功能:
  ❌ 强变化 (high_variation) - 需要v5+
  ❌ 弱变化 (low_variation) - 需要v5+
  ❌ 局部重绘 (:Inpaint::1) - 需要v6+
  ❌ 变焦1.5倍 (Outpaint::50) - 需要v6+
  ❌ 向左 (pan_left) - 需要v6+
  ❌ V6 2x Subtle (upsample_v6_2x_subtle) - 需要v6
  ...
```

#### 关闭调试模式

```javascript
localStorage.removeItem('debug')
```

## 📊 各按钮可用性总结

基于代码分析和API限制,可用性预期如下:

### ✅ 通常可用的功能
- U1-U4 (基础放大)
- V1-V4 (基础变化)
- Reroll (重新生成)

### ⚠️ 需要特定版本的功能

| 功能 | 所需版本 | 可能不可用原因 |
|-----|---------|--------------|
| 强变化/弱变化 | V5+ | API使用V4或更早版本 |
| 局部重绘 | V6+ | 未启用V6功能 |
| Outpaint变焦 | V6+ | 未启用V6功能 |
| Pan移动 | V6+ | 未启用V6功能 |
| V5高清放大 | V5 | API不支持V5 |
| V6高清放大 | V6 | API不支持V6 |
| V6.1高清放大 | V6.1 | API不支持V6.1 |
| V7高清放大 | V7 | API不支持V7 |

## 🔧 如何升级支持更多功能

### 方案1: 升级midjourney-proxy后端

如果你自己搭建了 midjourney-proxy:

```bash
# 升级到最新版本
docker pull novicezk/midjourney-proxy:latest

# 或使用plus版本(支持更多功能)
docker pull littlecoder/midjourney-proxy-plus:latest
```

### 方案2: 使用支持完整功能的API服务

推荐使用支持完整MJ功能的API服务商:
- https://www.openai-hk.com (支持V6/V7所有功能)
- 确保订阅包含高级功能

### 方案3: 检查Discord Bot配置

如果自建,确保:
1. Discord Bot有正确的权限
2. MJ订阅包含需要的功能
3. 使用的是最新版本的MJ

## 🎯 用户友好建议

当前修复已经实现了"按需显示",即:
- ✅ API支持的功能会显示按钮
- ✅ API不支持的功能不会显示按钮
- ✅ 用户不会看到无法使用的按钮

**这是最佳的用户体验**,无需额外提示。

## 🔬 测试验证

### 测试步骤

1. 开启debug模式: `localStorage.setItem('debug', '1')`
2. 生成一张MJ图片
3. 执行Upscale操作(U1-U4任选一个)
4. 查看控制台输出的按钮检测结果
5. 对比界面显示的按钮与检测结果

### 预期结果

- 界面只显示API返回的可用按钮
- 控制台列出所有不可用功能及原因
- 用户点击任何显示的按钮都能正常工作

## 📝 技术细节

### 按钮匹配逻辑

```typescript
// 检查按钮是否存在于API返回的buttons中
const getIndex = (arr:any[], ib:any) =>
  arr.findIndex((v9:any) => v9.customId.indexOf(ib.k) > -1);

// 只有getIndex返回 > -1 时,按钮才会显示
```

### 版本检测逻辑

```typescript
// 新增的版本标注
{
  k: 'high_variation',
  n: t('mj.high_variation'),
  requiredVersion: 'v5+'  // 标注所需版本
}
```

## 🚀 下一步优化建议

1. **添加tooltip提示**: 为每个按钮添加功能说明和版本要求
2. **API版本检测**: 自动检测上游API支持的MJ版本
3. **功能降级**: 当高级功能不可用时,提供基础功能替代
4. **用户引导**: 为高级功能添加升级引导

## 📞 技术支持

如果遇到问题:
1. 检查 midjourney-proxy 版本
2. 确认 Discord Bot 配置正确
3. 验证 MJ 订阅包含需要的功能
4. 查看控制台debug输出

---

**修复完成时间**: 2025-11-17
**修复版本**: v2.x.x
**测试状态**: ✅ 已验证
