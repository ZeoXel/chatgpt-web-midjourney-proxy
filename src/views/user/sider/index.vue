<script setup lang='ts'>
import type { CSSProperties } from 'vue'
import { computed, ref, watch, h } from 'vue'
import { NLayoutSider, NMenu } from 'naive-ui'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '@/store'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { SvgIcon } from '@/components/common'
import { t } from '@/locales'

const appStore = useAppStore()
const router = useRouter()
const route = useRoute()

const { isMobile } = useBasicLayout()

const collapsed = computed(() => appStore.siderCollapsed)

function handleUpdateCollapsed() {
  appStore.setSiderCollapsed(!collapsed.value)
}

const getMobileClass = computed<CSSProperties>(() => {
  if (isMobile.value) {
    return {
      position: 'fixed',
      zIndex: 50,
      height: '100%',
    }
  }
  return {}
})

const mobileSafeArea = computed(() => {
  if (isMobile.value) {
    return {
      paddingBottom: 'env(safe-area-inset-bottom)',
    }
  }
  return {}
})

// 菜单选项
const menuOptions = computed(() => [
  {
    label: '个人信息',
    key: 'profile',
    icon: () => h(SvgIcon, { icon: "ri:user-line" }),
  },
  {
    label: '用量监控',
    key: 'usage',
    icon: () => h(SvgIcon, { icon: "ri:bar-chart-line" }),
  },
  {
    label: '账单管理',
    key: 'billing',
    icon: () => h(SvgIcon, { icon: "ri:bill-line" }),
  },
  {
    label: '充值中心',
    key: 'recharge',
    icon: () => h(SvgIcon, { icon: "ri:money-dollar-circle-line" }),
  },
  {
    label: '使用记录',
    key: 'history',
    icon: () => h(SvgIcon, { icon: "ri:history-line" }),
  },
  {
    label: '设置',
    key: 'settings',
    icon: () => h(SvgIcon, { icon: "ri:settings-line" }),
  },
])

const selectedKey = computed(() => {
  const path = route.path
  if (path.includes('/user/profile')) return 'profile'
  if (path.includes('/user/usage')) return 'usage'
  if (path.includes('/user/billing')) return 'billing'
  if (path.includes('/user/recharge')) return 'recharge'
  if (path.includes('/user/history')) return 'history'
  if (path.includes('/user/settings')) return 'settings'
  return 'profile'
})

function handleMenuSelect(key: string) {
  const routes = {
    'profile': '/user/profile',
    'usage': '/user/usage',
    'billing': '/user/billing',
    'recharge': '/user/recharge',
    'history': '/user/history',
    'settings': '/user/settings',
  }
  
  const targetRoute = routes[key as keyof typeof routes]
  if (targetRoute) {
    router.push(targetRoute)
    if (isMobile.value) {
      appStore.setSiderCollapsed(true)
    }
  }
}

watch(
  isMobile,
  (val) => {
    appStore.setSiderCollapsed(val)
  },
  {
    immediate: true,
    flush: 'post',
  },
)
</script>

<template>
  <NLayoutSider
    :collapsed="collapsed"
    :collapsed-width="0"
    :width="260"
    :show-trigger="isMobile ? false : 'arrow-circle'"
    collapse-mode="transform"
    bordered
    :style="getMobileClass"
    @update-collapsed="handleUpdateCollapsed"
  >
    <div class="flex flex-col h-full" :style="mobileSafeArea">
      <main class="flex flex-col flex-1 min-h-0">
        <div class="p-4">
          <div class="flex items-center space-x-2 mb-4">
            <SvgIcon icon="ri:user-settings-line" class="text-2xl" />
            <span class="font-medium text-lg">{{ $t('user.center') }}</span>
          </div>
        </div>
        
        <div class="flex-1 min-h-0 pb-4 overflow-hidden">
          <NMenu
            :options="menuOptions"
            :value="selectedKey"
            :collapsed="collapsed"
            :collapsed-width="64"
            @update:value="handleMenuSelect"
          />
        </div>
      </main>
    </div>
  </NLayoutSider>
  
  <template v-if="isMobile">
    <div 
      v-show="!collapsed" 
      class="fixed inset-0 z-40 w-full h-full bg-black/40" 
      @click="handleUpdateCollapsed" 
    />
  </template>
</template>