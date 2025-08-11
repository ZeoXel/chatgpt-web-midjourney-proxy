<script setup lang='ts'>
import { computed, onMounted, provide } from 'vue'
import { NLayout, NLayoutContent } from 'naive-ui'
import { useRouter, useRoute } from 'vue-router'
import Sider from '../chat/layout/sider/index.vue'
import Permission from '../chat/layout/Permission.vue'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { homeStore, useAppStore, useAuthStore, useChatStore } from '@/store'
import { aiSider, aiFooter } from '@/views/mj'
import aiMobileMenu from '@/views/mj/aiMobileMenu.vue'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const chatStore = useChatStore()
const authStore = useAuthStore()

const { isMobile, isTablet } = useBasicLayout()

// 初始化路由
onMounted(() => {
  router.replace({ name: 'draw', params: { uuid: chatStore.active } })
  homeStore.setMyData({ local: 'draw' })
})

// 响应式状态
const collapsed = computed(() => appStore.siderCollapsed)
const needPermission = computed(() => !!authStore.session?.auth && !authStore.token)

// 样式计算
const layoutClasses = computed(() => {
  const classes = [
    'min-h-screen',
    'bg-gradient-to-br from-gray-50 to-white',
    'dark:from-gray-900 dark:to-gray-900',
    'transition-all duration-300',
  ]

  if (isMobile.value) {
    classes.push('h-screen-mobile') // 使用自定义移动端高度
  }

  return classes.join(' ')
})

const containerClasses = computed(() => {
  const classes = [
    'h-full overflow-hidden',
    'transition-all duration-300',
  ]

  if (!isMobile.value) {
    classes.push('card shadow-float border-0')
  } else {
    classes.push('rounded-none shadow-none')
  }

  return classes.join(' ')
})

const layoutContentClasses = computed(() => {
  const classes = [
    'h-full relative',
    'bg-white dark:bg-gray-900',
    'transition-colors duration-300',
  ]

  return classes.join(' ')
})

const siderPlacement = computed(() => {
  return isMobile.value ? 'left' : 'right'
})

// 提供布局上下文
provide('mjLayout', {
  isMobile: isMobile.value,
  isTablet: isTablet.value,
  collapsed: collapsed.value,
})
</script>

<template>
  <div :class="layoutClasses">
    <div :class="containerClasses">
      <NLayout
        class="z-40 transition-all duration-300 relative"
        :class="{ 'layout-collapsed': !isMobile && !collapsed }"
        has-sider
        :sider-placement="siderPlacement"
      >
        <!-- 左侧工具栏 (桌面端) -->
        <aiSider v-if="!isMobile" class="layout-ai-sider" />
        
        <!-- 主要内容区域 -->
        <NLayoutContent :class="layoutContentClasses">
          <div class="relative h-full">
            <RouterView v-slot="{ Component, route }">
              <Transition
                :name="route.meta?.transition || 'slide-left'"
                mode="out-in"
                appear
              >
                <component :is="Component" :key="route.fullPath" />
              </Transition>
            </RouterView>
          </div>
        </NLayoutContent>
        
        <!-- 右侧边栏 -->
        <Sider class="layout-main-sider" />
      </NLayout>
    </div>
    
    <!-- 权限弹窗 -->
    <Permission :visible="needPermission" />
    
    <!-- 移动端菜单 -->
    <aiMobileMenu v-if="isMobile" class="layout-mobile-menu" />
    
    <!-- 底部组件 -->
    <aiFooter class="layout-footer" />
  </div>
</template>

<style scoped>
/* 移动端高度适配 */
.h-screen-mobile {
  height: calc(100vh - 55px);
  height: calc(var(--vh, 1vh) * 100 - 55px);
}

/* 布局组件样式 */
.layout-ai-sider {
  @apply border-r border-gray-200 dark:border-gray-700;
  @apply bg-white dark:bg-gray-800;
  @apply transition-all duration-300;
}

.layout-main-sider {
  @apply border-l border-gray-200 dark:border-gray-700;
  @apply bg-white dark:bg-gray-800;
  @apply transition-all duration-300;
}

.layout-mobile-menu {
  @apply fixed bottom-0 left-0 right-0 z-50;
  padding-bottom: env(safe-area-inset-bottom);
}

.layout-footer {
  @apply relative z-10;
}

.layout-collapsed {
  @apply shadow-xl;
}

/* 响应式优化 */
@media (max-width: 768px) {
  .layout-ai-sider,
  .layout-main-sider {
    @apply fixed inset-y-0 z-50;
    @apply transform transition-transform duration-300;
  }
}

/* 加载状态 */
.layout-loading {
  @apply opacity-70 pointer-events-none;
}

/* 过渡效果优化 */
.slide-left-enter-active {
  animation: slideUp 0.3s ease-out forwards;
}

.slide-left-leave-active {
  animation: fadeIn 0.3s ease-out forwards;
}
</style>
