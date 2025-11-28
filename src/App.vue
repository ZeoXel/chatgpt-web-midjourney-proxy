<script setup lang="ts">
import { onMounted } from 'vue'
import { NConfigProvider } from 'naive-ui'
import { NaiveProvider } from '@/components/common'
import { useTheme } from '@/hooks/useTheme'
import { useLanguage } from '@/hooks/useLanguage'
import aiOther from "@/views/mj/aiOther.vue"
import { useChatStore, useAuthStore } from '@/store'
import { checkAndMigrate } from '@/utils/videoMigration'
import { restoreAllAssets, getRestorationSummary } from '@/utils/assetRestoration'
import '@/styles/color-override.css'

const { theme, themeOverrides } = useTheme()
const { language } = useLanguage()
const chatStore = useChatStore()
const authStore = useAuthStore()

// 跨平台资产复原系统
onMounted(async () => {
  console.log('[App] 🚀 应用启动...')

  // 0. 先加载session配置 (必须在最前面)
  console.log('[App] 🔧 加载session配置...')
  await authStore.getSession()
  console.log('[App] ✅ Session配置加载完成')

  // 1. 加载对话历史 (从COS)
  console.log('[App] 📚 加载对话历史...')
  await chatStore.loadFromDatabase()
  console.log('[App] ✅ 对话历史加载完成')

  // 2. 复原所有资产 (MJ图片、通用图片、音乐、视频、模型)
  console.log('[App] 🎨 复原资产数据...')
  const assetResult = await restoreAllAssets()
  const summary = getRestorationSummary(assetResult)
  console.log('[App] ✅ 资产复原完成:', summary)

  if (assetResult.errors.length > 0) {
    console.warn('[App] ⚠️ 部分资产复原失败:', assetResult.errors)
  }

  // 3. 视频数据迁移 (一次性执行)
  checkAndMigrate()

  console.log('[App] 🎉 应用初始化完成')
})
</script>

<template>
  <NConfigProvider
    class="h-full"
    :theme="theme"
    :theme-overrides="themeOverrides"
    :locale="language"
  >
    <NaiveProvider>
      <RouterView />
    </NaiveProvider>
  </NConfigProvider>
  <!-- 处理一下chat 与draw 共有的事情 -->
  <aiOther/>
</template>
