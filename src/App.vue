<script setup lang="ts">
import { onMounted } from 'vue'
import { NConfigProvider } from 'naive-ui'
import { NaiveProvider } from '@/components/common'
import { useTheme } from '@/hooks/useTheme'
import { useLanguage } from '@/hooks/useLanguage'
import aiOther from "@/views/mj/aiOther.vue"
import { useChatStore } from '@/store'
import { checkAndMigrate } from '@/utils/videoMigration'
import '@/styles/color-override.css'

const { theme, themeOverrides } = useTheme()
const { language } = useLanguage()
const chatStore = useChatStore()

// Phase 2: 应用启动时从数据库加载对话历史
onMounted(async () => {
  console.log('[App] 🚀 应用启动，开始加载对话历史...')
  await chatStore.loadFromDatabase()
  console.log('[App] ✅ 对话历史加载完成')

  // ✅ 新增: 视频数据迁移 (一次性执行)
  checkAndMigrate()
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
