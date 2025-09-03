<template>
  <span class="animated-number">{{ formattedValue }}</span>
</template>

<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue'

interface Props {
  value: number
  duration?: number
}

const props = withDefaults(defineProps<Props>(), {
  duration: 800
})

const displayValue = ref(0)
const animationId = ref<number | null>(null)

const formattedValue = computed(() => {
  return Math.round(displayValue.value).toLocaleString('zh-CN')
})

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

const animateToValue = (startValue: number, endValue: number) => {
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
  }

  const startTime = Date.now()
  const difference = endValue - startValue

  const animate = () => {
    const currentTime = Date.now()
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / props.duration, 1)
    const easedProgress = easeOutCubic(progress)

    displayValue.value = startValue + difference * easedProgress

    if (progress < 1) {
      animationId.value = requestAnimationFrame(animate)
    } else {
      displayValue.value = endValue
      animationId.value = null
    }
  }

  animationId.value = requestAnimationFrame(animate)
}

watch(() => props.value, (newValue, oldValue) => {
  const startValue = oldValue !== undefined ? displayValue.value : 0
  
  if (Math.abs(newValue - startValue) > 1) {
    animateToValue(startValue, newValue)
  } else {
    displayValue.value = newValue
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
  }
})
</script>

<style scoped>
.animated-number {
  font-weight: 600;
  color: var(--primary-color);
  transition: color 0.3s ease;
}
</style>