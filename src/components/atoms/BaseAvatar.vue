<template>
  <div :class="avatarClasses" v-bind="$attrs">
    <img
      v-if="src && !imageError"
      :src="src"
      :alt="alt"
      class="w-full h-full object-cover"
      @error="handleImageError"
      @load="handleImageLoad"
    />
    <div
      v-else-if="name"
      class="w-full h-full flex items-center justify-center font-medium text-white"
      :style="{ backgroundColor: avatarColor }"
    >
      {{ initials }}
    </div>
    <div v-else class="w-full h-full flex items-center justify-center bg-gray-300 dark:bg-gray-600">
      <NIcon :component="UserIcon" :size="sizeMap[size] * 0.5" class="text-gray-500 dark:text-gray-400" />
    </div>
    
    <!-- 状态指示器 -->
    <div
      v-if="status"
      :class="statusClasses"
      class="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white dark:border-gray-800"
    />
    
    <!-- 加载状态 -->
    <div
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-full"
    >
      <NSpin :size="sizeMap[size] * 0.3" class="text-white" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NIcon, NSpin } from 'naive-ui'
import { UserOutlined as UserIcon } from '@vicons/antd'

export interface BaseAvatarProps {
  src?: string
  alt?: string
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  shape?: 'circle' | 'square'
  status?: 'online' | 'offline' | 'away' | 'busy'
  loading?: boolean
  clickable?: boolean
}

const props = withDefaults(defineProps<BaseAvatarProps>(), {
  alt: 'Avatar',
  size: 'md',
  shape: 'circle',
  loading: false,
  clickable: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
  imageError: []
  imageLoad: []
}>()

const imageError = ref(false)

// 尺寸映射
const sizeMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 56,
  '2xl': 64,
}

const avatarClasses = computed(() => {
  const size = sizeMap[props.size]
  const baseClasses = [
    'relative inline-flex items-center justify-center',
    'overflow-hidden select-none',
    'transition-all duration-fast',
    `w-${size/4} h-${size/4}`,
  ]

  // 形状样式
  const shapeClasses = {
    circle: 'rounded-full',
    square: 'rounded-md',
  }

  // 交互样式
  const interactionClasses = []
  if (props.clickable) {
    interactionClasses.push(
      'cursor-pointer hover:scale-105 hover:shadow-md focus-ring'
    )
  }

  return [
    ...baseClasses,
    shapeClasses[props.shape],
    ...interactionClasses,
  ].join(' ')
})

const statusClasses = computed(() => {
  const size = sizeMap[props.size]
  const statusSize = Math.max(8, size * 0.25)
  
  const statusColors = {
    online: 'bg-semantic-success-500',
    offline: 'bg-gray-400',
    away: 'bg-semantic-warning-500',
    busy: 'bg-semantic-error-500',
  }

  return [
    `w-${statusSize/4} h-${statusSize/4}`,
    statusColors[props.status!],
  ].join(' ')
})

// 生成头像颜色
const avatarColor = computed(() => {
  if (!props.name) return '#9CA3AF'
  
  const colors = [
    '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4',
    '#10B981', '#F97316', '#6366F1', '#EC4899',
  ]
  
  let hash = 0
  for (let i = 0; i < props.name.length; i++) {
    hash = props.name.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  return colors[Math.abs(hash) % colors.length]
})

// 生成姓名首字母
const initials = computed(() => {
  if (!props.name) return ''
  
  return props.name
    .split(' ')
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join('')
})

const handleImageError = () => {
  imageError.value = true
  emit('imageError')
}

const handleImageLoad = () => {
  imageError.value = false
  emit('imageLoad')
}

const handleClick = (event: MouseEvent) => {
  if (props.clickable) {
    emit('click', event)
  }
}
</script>

<style scoped>
/* 动态尺寸样式 */
.w-6 { width: 1.5rem; }
.h-6 { height: 1.5rem; }
.w-8 { width: 2rem; }
.h-8 { height: 2rem; }
.w-10 { width: 2.5rem; }
.h-10 { height: 2.5rem; }
.w-12 { width: 3rem; }
.h-12 { height: 3rem; }
.w-14 { width: 3.5rem; }
.h-14 { height: 3.5rem; }
.w-16 { width: 4rem; }
.h-16 { height: 4rem; }
.w-2 { width: 0.5rem; }
.h-2 { height: 0.5rem; }
.w-3 { width: 0.75rem; }
.h-3 { height: 0.75rem; }
</style>