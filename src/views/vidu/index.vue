<script setup lang="ts">
import { ref } from 'vue'
import { NTabs, NTabPane } from 'naive-ui'
import ViduInput from './viduInput.vue'
import ViduList from './viduList.vue'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { useSwipeGesture } from '@/hooks/useSwipeGesture'
import { useRouter } from 'vue-router'
import { SvgIcon } from '@/components/common'

const { isMobile } = useBasicLayout()
const router = useRouter()
const activeTab = ref('input')
const containerRef = ref<HTMLElement | null>(null)

// 快速切换到聊天功能
function goToChat() {
  router.push('/chat')
}

// 定义可切换的tab列表
const tabList = ['input', 'result']

// 滑动切换功能
const switchToNextTab = () => {
  const currentIndex = tabList.indexOf(activeTab.value)
  const nextIndex = (currentIndex + 1) % tabList.length
  activeTab.value = tabList[nextIndex]
}

const switchToPrevTab = () => {
  const currentIndex = tabList.indexOf(activeTab.value)
  const prevIndex = (currentIndex - 1 + tabList.length) % tabList.length
  activeTab.value = tabList[prevIndex]
}

// 使用滑动手势（仅移动端）
if (isMobile) {
  useSwipeGesture(
    containerRef,
    switchToNextTab,  // 左滑切换到下一个tab
    switchToPrevTab   // 右滑切换到上一个tab
  )
}
</script>

<template>
  <!-- 移动端布局 -->
  <div v-if="isMobile" ref="containerRef" class="w-full h-full flex flex-col">
    <!-- 移动端顶部导航栏 -->
    <div class="flex items-center justify-between p-2 bg-white dark:bg-[#24272e] border-b border-gray-200 dark:border-gray-700">
      <button 
        @click="goToChat"
        class="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="返回聊天"
      >
        <SvgIcon icon="ri:chat-3-line" class="text-xl text-gray-600 dark:text-gray-300" />
      </button>
      <h1 class="text-lg font-medium text-gray-900 dark:text-white">Vidu视频</h1>
      <div class="w-10 h-10"></div> <!-- 占位符保持居中 -->
    </div>
    
    <n-tabs v-model:value="activeTab" type="line" animated class="flex-1" style="--n-tab-text-color-active: #445ff6;--n-bar-color: #445ff6;--n-tab-text-color-hover:#7f0df9;--n-tab-border-color:#445ff6">
      <n-tab-pane name="input" tab="创建视频" class="h-full">
        <div class="w-full h-full overflow-y-auto">
          <ViduInput />
        </div>
      </n-tab-pane>
      <n-tab-pane name="result" tab="视频列表" class="h-full">
        <div class="w-full h-full bg-[#fafbfc] dark:bg-[#18181c] overflow-y-auto">
          <ViduList />
        </div>
      </n-tab-pane>
    </n-tabs>
  </div>

  <!-- 桌面端布局（保持原样） -->
  <div v-else class="flex w-full h-full">
    <!-- 左侧输入区域 -->
    <div class="w-[300px] h-full overflow-y-auto border-r border-gray-200 dark:border-gray-700">
      <ViduInput />
    </div>
    
    <!-- 右侧结果列表区域 -->
    <div class="flex-1 h-full bg-[#fafbfc] dark:bg-[#18181c] overflow-y-auto">
      <ViduList />
    </div>
  </div>
</template>

<style scoped>
/* 确保滚动条样式一致 */
:deep(.n-scrollbar-rail) {
  right: 4px !important;
}
</style>