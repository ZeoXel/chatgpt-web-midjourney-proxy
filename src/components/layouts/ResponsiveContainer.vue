<template>
  <div :class="containerClasses">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBasicLayout } from '@/hooks/useBasicLayout'

export interface ResponsiveContainerProps {
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full' | 'none'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  center?: boolean
  fluid?: boolean
}

const props = withDefaults(defineProps<ResponsiveContainerProps>(), {
  maxWidth: 'xl',
  padding: 'md',
  center: true,
  fluid: false,
})

const { isMobile, isTablet } = useBasicLayout()

const containerClasses = computed(() => {
  const classes = []

  // 最大宽度
  const maxWidthClasses = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    full: 'max-w-full',
    none: '',
  }

  if (!props.fluid) {
    classes.push(maxWidthClasses[props.maxWidth])
  } else {
    classes.push('w-full')
  }

  // 居中
  if (props.center) {
    classes.push('mx-auto')
  }

  // 内边距
  const paddingClasses = {
    none: '',
    sm: 'px-4 py-2',
    md: 'px-6 py-4',
    lg: 'px-8 py-6',
    xl: 'px-12 py-8',
  }

  // 响应式内边距调整
  if (props.padding !== 'none') {
    if (isMobile.value) {
      classes.push('px-4 py-2')
    } else if (isTablet.value) {
      classes.push('px-6 py-4')
    } else {
      classes.push(paddingClasses[props.padding])
    }
  }

  return classes.join(' ')
})
</script>