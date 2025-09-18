<script setup lang='ts'>
import { computed, useAttrs } from 'vue'
import { Icon } from '@iconify/vue'
import { getIconComponent, getStandardSize } from '@/utils/iconMappings'

interface Props {
  icon?: string
  size?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  size: '1em'
})

const attrs = useAttrs()

const bindAttrs = computed<{ class: string; style: string }>(() => ({
  class: (attrs.class as string) || '',
  style: (attrs.style as string) || '',
}))

// 获取标准化后的尺寸
const normalizedSize = computed(() => getStandardSize(props.size))
</script>

<template>
  <component
    v-if="getIconComponent(icon)"
    :is="getIconComponent(icon)"
    :style="{
      width: normalizedSize,
      height: normalizedSize,
      fontSize: normalizedSize,
      ...bindAttrs.style
    }"
    :class="bindAttrs.class"
  />
  <Icon
    v-else
    :icon="icon"
    v-bind="bindAttrs"
    :style="{ fontSize: normalizedSize, ...bindAttrs.style }"
  />
</template>
