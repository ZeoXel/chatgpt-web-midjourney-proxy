<script setup lang="ts">
import { ref } from 'vue'
import { NTabs, NTabPane } from 'naive-ui'
import ViduInput from './viduInput.vue'
import ViduList from './viduList.vue'
import { useBasicLayout } from '@/hooks/useBasicLayout'

const { isMobile } = useBasicLayout()
const activeTab = ref('input')
</script>

<template>
  <!-- 移动端布局 -->
  <div v-if="isMobile" class="w-full h-full">
    <n-tabs v-model:value="activeTab" type="line" animated class="h-full" style="--n-tab-text-color-active: #445ff6;--n-bar-color: #445ff6;--n-tab-text-color-hover:#7f0df9;--n-tab-border-color:#445ff6">
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