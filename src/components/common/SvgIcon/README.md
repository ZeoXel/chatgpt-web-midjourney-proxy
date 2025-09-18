# SvgIcon 组件使用指南

## 概述

SvgIcon 组件已升级为支持 `@vicons/ionicons5` 图标库，提供统一的图标使用体验和标准化的尺寸管理。

## 基本用法

```vue
<template>
  <!-- 基本使用 -->
  <SvgIcon icon="material-symbols:home" />

  <!-- 指定尺寸 -->
  <SvgIcon icon="material-symbols:settings" size="lg" />

  <!-- 自定义样式 -->
  <SvgIcon icon="material-symbols:search" class="text-blue-500" />
</template>
```

## 支持的尺寸

组件支持以下标准尺寸：

| 尺寸名称 | 像素值 | 使用场景 |
|---------|--------|----------|
| `xs`    | 12px   | 很小的图标，如状态指示器 |
| `sm`    | 16px   | 小图标，如表单标签旁的图标 |
| `md`    | 20px   | 中等图标，默认大小 |
| `lg`    | 24px   | 大图标，如按钮中的图标 |
| `xl`    | 28px   | 特大图标 |
| `2xl`   | 32px   | 超大图标，如主要操作按钮 |
| `3xl`   | 36px   | 极大图标 |
| `4xl`   | 40px   | 巨大图标，如错误状态显示 |
| `5xl`   | 48px   | 超巨大图标 |
| `6xl`   | 56px   | 最大图标，如空状态显示 |

也可以使用数字（像素值）或任何有效的 CSS 尺寸值：

```vue
<SvgIcon icon="material-symbols:home" size="16" />
<SvgIcon icon="material-symbols:home" size="1.5rem" />
<SvgIcon icon="material-symbols:home" size="2em" />
```

## 图标映射

组件自动将常用的 iconify 图标映射到 ionicons5：

### Material Symbols
```vue
<SvgIcon icon="material-symbols:home" />           <!-- → HomeOutline -->
<SvgIcon icon="material-symbols:settings" />       <!-- → SettingsOutline -->
<SvgIcon icon="material-symbols:search" />         <!-- → SearchOutline -->
<SvgIcon icon="material-symbols:person" />         <!-- → PersonOutline -->
<SvgIcon icon="material-symbols:download" />       <!-- → DownloadOutline -->
```

### Remix Icons
```vue
<SvgIcon icon="ri:home-line" />                    <!-- → HomeOutline -->
<SvgIcon icon="ri:settings-line" />                <!-- → SettingsOutline -->
<SvgIcon icon="ri:user-line" />                    <!-- → PersonOutline -->
```

### 直接使用 ionicons5
```vue
<SvgIcon icon="ion:HomeOutline" />
<SvgIcon icon="HomeOutline" />
```

## 实际使用示例

### 表单标签
```vue
<label class="block text-sm font-medium mb-2">
  <SvgIcon icon="material-symbols:edit-note" size="sm" class="inline mr-1" />
  输入描述
</label>
```

### 按钮
```vue
<NButton>
  <SvgIcon icon="material-symbols:download" size="md" />
  下载
</NButton>
```

### 空状态显示
```vue
<div class="text-center py-8">
  <SvgIcon icon="material-symbols:video-library-outline" size="6xl" class="text-gray-400 mb-4" />
  <p class="text-gray-500">暂无视频</p>
</div>
```

### 操作按钮
```vue
<NButton size="small" type="error">
  <SvgIcon icon="material-symbols:delete" size="sm" />
  删除
</NButton>
```

## 兼容性

- ✅ 优先使用 ionicons5 映射图标
- ✅ 自动降级到原始 iconify 图标
- ✅ 保持现有代码兼容性
- ✅ 统一的尺寸管理
- ✅ 支持所有 CSS 自定义属性

## 图标搜索

### ionicons5 图标库
访问 [ionicons.com](https://ionicons.com/) 查看所有可用图标。

### 在代码中使用
```vue
<!-- 推荐：使用映射的 material-symbols -->
<SvgIcon icon="material-symbols:favorite" />

<!-- 直接使用 ionicons5 -->
<SvgIcon icon="ion:HeartOutline" />
<SvgIcon icon="HeartOutline" />

<!-- 兜底：原始 iconify 图标 -->
<SvgIcon icon="mdi:heart" />
```

## 最佳实践

1. **优先使用标准尺寸**：使用 `sm`、`md`、`lg` 等预定义尺寸
2. **语义化命名**：选择描述功能的图标名称
3. **保持一致性**：在同一功能区域使用相同尺寸的图标
4. **适当的对比度**：确保图标在背景上可见
5. **可访问性**：为重要图标添加 `aria-label` 或文字说明

```vue
<!-- 好的例子 -->
<SvgIcon icon="material-symbols:download" size="md" aria-label="下载文件" />

<!-- 更好的例子：有文字说明 -->
<NButton>
  <SvgIcon icon="material-symbols:download" size="sm" />
  下载
</NButton>
```