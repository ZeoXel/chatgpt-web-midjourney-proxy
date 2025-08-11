<template>
  <div :class="gridClasses">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBasicLayout } from '@/hooks/useBasicLayout'

export interface ResponsiveGridProps {
  cols?: {
    xs?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
  } | number
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
  autoFit?: boolean
  autoFill?: boolean
  minItemWidth?: string
}

const props = withDefaults(defineProps<ResponsiveGridProps>(), {
  cols: 1,
  gap: 'md',
  align: 'stretch',
  justify: 'start',
  autoFit: false,
  autoFill: false,
  minItemWidth: '280px',
})

const { isMobile, isTablet } = useBasicLayout()

const gridClasses = computed(() => {
  const classes = ['grid']

  // 列数设置
  if (props.autoFit || props.autoFill) {
    const repeatType = props.autoFit ? 'auto-fit' : 'auto-fill'
    classes.push(`grid-cols-[repeat(${repeatType},minmax(${props.minItemWidth},1fr))]`)
  } else if (typeof props.cols === 'number') {
    // 简单列数
    const colsClass = getColsClass(props.cols)
    classes.push(colsClass)
  } else {
    // 响应式列数
    const breakpoints = props.cols
    
    // 基础列数 (xs)
    const baseColumns = breakpoints.xs || 1
    classes.push(getColsClass(baseColumns))
    
    // 响应式断点
    if (breakpoints.sm) classes.push(`sm:${getColsClass(breakpoints.sm)}`)
    if (breakpoints.md) classes.push(`md:${getColsClass(breakpoints.md)}`)
    if (breakpoints.lg) classes.push(`lg:${getColsClass(breakpoints.lg)}`)
    if (breakpoints.xl) classes.push(`xl:${getColsClass(breakpoints.xl)}`)
  }

  // 间距
  const gapClasses = {
    none: 'gap-0',
    xs: 'gap-2',
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
    xl: 'gap-12',
  }
  classes.push(gapClasses[props.gap])

  // 对齐
  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  }
  classes.push(alignClasses[props.align])

  // 分布
  const justifyClasses = {
    start: 'justify-items-start',
    center: 'justify-items-center',
    end: 'justify-items-end',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly',
  }
  classes.push(justifyClasses[props.justify])

  return classes.join(' ')
})

// 获取列数类名
const getColsClass = (cols: number): string => {
  const colsMap: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
    7: 'grid-cols-7',
    8: 'grid-cols-8',
    9: 'grid-cols-9',
    10: 'grid-cols-10',
    11: 'grid-cols-11',
    12: 'grid-cols-12',
  }
  
  return colsMap[cols] || 'grid-cols-1'
}
</script>

<style scoped>
/* 自定义网格列类 */
.grid-cols-auto-fit {
  grid-template-columns: repeat(auto-fit, minmax(var(--min-item-width, 280px), 1fr));
}

.grid-cols-auto-fill {
  grid-template-columns: repeat(auto-fill, minmax(var(--min-item-width, 280px), 1fr));
}
</style>