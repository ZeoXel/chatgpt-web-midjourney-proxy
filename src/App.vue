<script setup lang="ts">
import { onMounted, provide } from 'vue'
import { NConfigProvider, darkTheme, lightTheme } from 'naive-ui'
import { NaiveProvider } from '@/components/common'
import { useTheme } from '@/hooks/useTheme'
import { useLanguage } from '@/hooks/useLanguage'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import aiOther from "@/views/mj/aiOther.vue"

const { theme, themeOverrides } = useTheme()
const { language } = useLanguage()
const { isMobile, isTablet } = useBasicLayout()

// 提供全局响应式状态
provide('responsive', {
  isMobile,
  isTablet,
})

// 应用初始化
onMounted(() => {
  // 设置CSS变量用于动态样式
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
  
  // 监听视窗大小变化
  window.addEventListener('resize', () => {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
  })
})
</script>

<template>
  <NConfigProvider
    class="min-h-screen transition-colors duration-300"
    :class="{
      'h-screen': isMobile,
      'bg-gray-50 dark:bg-gray-900': true
    }"
    :theme="theme"
    :theme-overrides="themeOverrides"
    :locale="language"
  >
    <NaiveProvider>
      <div class="app-container">
        <RouterView v-slot="{ Component, route }">
          <Transition
            :name="route.meta?.transition || 'fade'"
            mode="out-in"
            appear
          >
            <component :is="Component" :key="route.fullPath" />
          </Transition>
        </RouterView>
        
        <!-- 全局共享组件 -->
        <aiOther />
      </div>
    </NaiveProvider>
  </NConfigProvider>
</template>

<style scoped>
/* 应用容器样式 */
.app-container {
  min-height: calc(var(--vh, 1vh) * 100);
  transition: all 0.3s ease;
}
</style>

<style>
/* 全局页面过渡效果 */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease-out;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(1rem);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-1rem);
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s ease-out;
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(2rem);
}

.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-2rem);
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s ease-out;
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-2rem);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(2rem);
}

/* 全局优化样式 */
html {
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

@media (min-width: 640px) {
  html {
    font-size: 16px;
  }
}

body {
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}

/* 聚焦样式 */
*:focus {
  outline: none;
}

*:focus-visible {
  outline: 2px solid #445ff6;
  outline-offset: 2px;
  border-radius: 4px;
}

/* 触摸优化 */
button, 
a, 
[role="button"] {
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

/* 滚动条样式 */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
}

*::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 20px;
}

*::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.7);
}
</style>
