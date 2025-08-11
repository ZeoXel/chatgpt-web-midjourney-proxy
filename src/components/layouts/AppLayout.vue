<template>
  <div class="layout-main min-h-screen">
    <!-- 顶部导航 -->
    <AppHeader
      v-if="showHeader"
      :title="headerTitle"
      :show-back="showBackButton"
      :actions="headerActions"
      @back="handleBack"
      @menu="toggleSidebar"
    />
    
    <!-- 主要内容区域 -->
    <div class="flex flex-1 overflow-hidden" :class="mainClasses">
      <!-- 侧边栏 -->
      <aside
        v-if="showSidebar"
        :class="sidebarClasses"
        class="layout-sidebar transition-all duration-300"
      >
        <slot name="sidebar">
          <AppSidebar />
        </slot>
      </aside>
      
      <!-- 内容区域 -->
      <main :class="contentClasses" class="layout-content">
        <div v-if="showBreadcrumb" class="mb-6">
          <AppBreadcrumb :items="breadcrumbItems" />
        </div>
        
        <div class="flex-1 overflow-auto">
          <slot />
        </div>
      </main>
      
      <!-- 右侧面板 */
      <aside
        v-if="showRightPanel"
        :class="rightPanelClasses"
        class="layout-right-panel"
      >
        <slot name="right-panel" />
      </aside>
    </div>
    
    <!-- 底部导航 (移动端) -->
    <AppBottomNav v-if="showBottomNav && isMobile" :items="bottomNavItems" />
    
    <!-- 全屏加载遮罩 -->
    <AppLoadingOverlay v-if="loading" />
    
    <!-- 通知容器 -->
    <AppNotifications />
  </div>
</template>

<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { useAppStore } from '@/store'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'
import AppBreadcrumb from './AppBreadcrumb.vue'
import AppBottomNav from './AppBottomNav.vue'
import AppLoadingOverlay from './AppLoadingOverlay.vue'
import AppNotifications from './AppNotifications.vue'

export interface LayoutAction {
  icon: any
  label?: string
  onClick: () => void
  disabled?: boolean
}

export interface BreadcrumbItem {
  title: string
  path?: string
}

export interface BottomNavItem {
  icon: any
  label: string
  path: string
  active?: boolean
}

export interface AppLayoutProps {
  headerTitle?: string
  showHeader?: boolean
  showSidebar?: boolean
  showRightPanel?: boolean
  showBreadcrumb?: boolean
  showBottomNav?: boolean
  showBackButton?: boolean
  sidebarCollapsed?: boolean
  rightPanelCollapsed?: boolean
  loading?: boolean
  headerActions?: LayoutAction[]
  breadcrumbItems?: BreadcrumbItem[]
  bottomNavItems?: BottomNavItem[]
}

const props = withDefaults(defineProps<AppLayoutProps>(), {
  showHeader: true,
  showSidebar: true,
  showRightPanel: false,
  showBreadcrumb: false,
  showBottomNav: true,
  showBackButton: false,
  sidebarCollapsed: false,
  rightPanelCollapsed: false,
  loading: false,
  headerActions: () => [],
  breadcrumbItems: () => [],
  bottomNavItems: () => [],
})

const emit = defineEmits<{
  back: []
  sidebarToggle: [collapsed: boolean]
  rightPanelToggle: [collapsed: boolean]
}>()

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const { isMobile, isTablet } = useBasicLayout()

// 内部状态
const sidebarVisible = ref(!props.sidebarCollapsed)
const rightPanelVisible = ref(!props.rightPanelCollapsed)

// 计算样式
const mainClasses = computed(() => {
  const classes = []
  
  if (props.showHeader) {
    classes.push('pt-16') // 为固定头部留出空间
  }
  
  if (props.showBottomNav && isMobile.value) {
    classes.push('pb-16') // 为底部导航留出空间
  }
  
  return classes.join(' ')
})

const sidebarClasses = computed(() => {
  const classes = ['z-30']
  
  if (isMobile.value) {
    // 移动端侧边栏
    classes.push(
      'fixed inset-y-0 left-0',
      'transform transition-transform duration-300 ease-in-out',
      sidebarVisible.value ? 'translate-x-0' : '-translate-x-full'
    )
  } else {
    // 桌面端侧边栏
    classes.push(
      'relative',
      sidebarVisible.value ? 'w-64' : 'w-0'
    )
  }
  
  return classes.join(' ')
})

const contentClasses = computed(() => {
  const classes = ['flex-1', 'overflow-hidden', 'flex', 'flex-col']
  
  if (isMobile.value) {
    classes.push('w-full')
  }
  
  return classes.join(' ')
})

const rightPanelClasses = computed(() => {
  const classes = ['z-20']
  
  if (isMobile.value || isTablet.value) {
    classes.push(
      'fixed inset-y-0 right-0',
      'transform transition-transform duration-300 ease-in-out',
      rightPanelVisible.value ? 'translate-x-0' : 'translate-x-full',
      'w-80'
    )
  } else {
    classes.push(
      'relative',
      rightPanelVisible.value ? 'w-80' : 'w-0'
    )
  }
  
  return classes.join(' ')
})

// 事件处理
const handleBack = () => {
  emit('back')
  router.back()
}

const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value
  emit('sidebarToggle', !sidebarVisible.value)
}

const toggleRightPanel = () => {
  rightPanelVisible.value = !rightPanelVisible.value
  emit('rightPanelToggle', !rightPanelVisible.value)
}

// 提供布局上下文
provide('layout', {
  isMobile: isMobile.value,
  isTablet: isTablet.value,
  sidebarVisible,
  rightPanelVisible,
  toggleSidebar,
  toggleRightPanel,
})

// 默认底部导航项
const defaultBottomNavItems = computed((): BottomNavItem[] => [
  {
    icon: 'chat',
    label: '对话',
    path: '/chat',
    active: route.path.startsWith('/chat'),
  },
  {
    icon: 'image',
    label: '绘画',
    path: '/draw',
    active: route.path.startsWith('/draw'),
  },
  {
    icon: 'music',
    label: '音乐',
    path: '/music',
    active: route.path.startsWith('/music'),
  },
  {
    icon: 'video',
    label: '视频',
    path: '/video',
    active: route.path.startsWith('/video'),
  },
])

// 使用传入的或默认的底部导航项
const bottomNavItems = computed(() => 
  props.bottomNavItems.length > 0 ? props.bottomNavItems : defaultBottomNavItems.value
)
</script>

<style scoped>
.layout-main {
  display: flex;
  flex-direction: column;
}

.layout-sidebar {
  @apply bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800;
}

.layout-content {
  @apply bg-gray-50 dark:bg-gray-900;
}

.layout-right-panel {
  @apply bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800;
}

/* 移动端遮罩层 */
@media (max-width: 768px) {
  .layout-sidebar::before,
  .layout-right-panel::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: -1;
  }
}
</style>