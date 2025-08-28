<script setup lang="ts">
import ViduInput from './viduInput.vue'
import ViduList from './viduList.vue'
</script>

<template>
  <div class="flex w-full h-full">
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