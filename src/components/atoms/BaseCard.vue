<template>
  <div :class="cardClasses" v-bind="$attrs">
    <header v-if="$slots.header || title" class="card-header">
      <div v-if="title" class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ title }}
        </h3>
        <div v-if="$slots.actions" class="flex items-center gap-2">
          <slot name="actions" />
        </div>
      </div>
      <slot v-else name="header" />
    </header>
    
    <main :class="contentClasses">
      <slot />
    </main>
    
    <footer v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface BaseCardProps {
  title?: string
  variant?: 'default' | 'elevated' | 'outlined' | 'glass'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hoverable?: boolean
  clickable?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<BaseCardProps>(), {
  variant: 'default',
  padding: 'md',
  hoverable: false,
  clickable: false,
  loading: false,
})

const cardClasses = computed(() => {
  const baseClasses = [
    'rounded-lg transition-all duration-300',
    'overflow-hidden',
  ]

  // 变体样式
  const variantClasses = {
    default: [
      'bg-white dark:bg-gray-800',
      'border border-gray-200 dark:border-gray-700',
    ],
    elevated: [
      'bg-white dark:bg-gray-800',
      'shadow-card',
    ],
    outlined: [
      'bg-transparent',
      'border-2 border-gray-300 dark:border-gray-600',
    ],
    glass: [
      'glass backdrop-blur-md',
      'bg-white/80 dark:bg-gray-800/80',
    ],
  }

  // 交互样式
  const interactionClasses = []
  if (props.hoverable) {
    interactionClasses.push('hover-lift cursor-pointer')
  }
  if (props.clickable) {
    interactionClasses.push('cursor-pointer focus-ring')
  }

  // 加载状态
  if (props.loading) {
    interactionClasses.push('opacity-60 pointer-events-none')
  }

  return [
    ...baseClasses,
    ...variantClasses[props.variant],
    ...interactionClasses,
  ].join(' ')
})

const contentClasses = computed(() => {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }

  return paddingClasses[props.padding]
})
</script>

<style scoped>
.card-header {
  @apply px-6 py-4 border-b border-gray-200 dark:border-gray-700;
  @apply bg-gray-50 dark:bg-gray-900/50;
}

.card-footer {
  @apply px-6 py-4 border-t border-gray-200 dark:border-gray-700;
  @apply bg-gray-50 dark:bg-gray-900/50;
}
</style>