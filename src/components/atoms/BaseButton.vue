<template>
  <component
    :is="tag"
    :class="buttonClasses"
    :disabled="disabled || loading"
    v-bind="$attrs"
    @click="handleClick"
  >
    <div class="flex items-center justify-center gap-2">
      <NIcon v-if="iconLeft && !loading" :component="iconLeft" />
      <NSpin v-if="loading" :size="16" />
      <slot v-if="!loading || showTextOnLoading" />
      <NIcon v-if="iconRight && !loading" :component="iconRight" />
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { NIcon, NSpin } from 'naive-ui'

export interface BaseButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  disabled?: boolean
  loading?: boolean
  block?: boolean
  round?: boolean
  iconLeft?: Component
  iconRight?: Component
  tag?: string
  showTextOnLoading?: boolean
}

const props = withDefaults(defineProps<BaseButtonProps>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  block: false,
  round: false,
  tag: 'button',
  showTextOnLoading: true,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const buttonClasses = computed(() => {
  const baseClasses = [
    'inline-flex items-center justify-center font-medium',
    'transition-all duration-fast',
    'focus-ring',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'select-none',
  ]

  // 变体样式
  const variantClasses = {
    primary: [
      'bg-gradient-primary text-white shadow-md',
      'hover:shadow-glow hover:scale-105',
      'active:scale-95',
    ],
    secondary: [
      'bg-gray-100 dark:bg-gray-700',
      'text-gray-900 dark:text-gray-100',
      'border border-gray-300 dark:border-gray-600',
      'hover:bg-gray-200 dark:hover:bg-gray-600',
    ],
    ghost: [
      'bg-transparent text-gray-700 dark:text-gray-300',
      'hover:bg-gray-100 dark:hover:bg-gray-800',
    ],
    danger: [
      'bg-semantic-error-500 text-white shadow-md',
      'hover:bg-semantic-error-600 hover:shadow-lg',
    ],
    success: [
      'bg-semantic-success-500 text-white shadow-md',
      'hover:bg-semantic-success-600 hover:shadow-lg',
    ],
  }

  // 尺寸样式
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs rounded-sm',
    sm: 'px-3 py-1.5 text-sm rounded-md',
    md: 'px-4 py-2 text-base rounded-md',
    lg: 'px-6 py-3 text-lg rounded-lg',
    xl: 'px-8 py-4 text-xl rounded-lg',
  }

  // 附加样式
  const additionalClasses = []
  if (props.block) additionalClasses.push('w-full')
  if (props.round) additionalClasses.push('rounded-full')
  if (props.loading) additionalClasses.push('btn-loading')

  return [
    ...baseClasses,
    ...variantClasses[props.variant],
    sizeClasses[props.size],
    ...additionalClasses,
  ].join(' ')
})

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>