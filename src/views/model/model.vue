<script setup lang="ts">
import TripoInput from './tripoInput.vue'
import UnifiedModelList from '@/components/model/UnifiedModelList.vue'
</script>

<template>
  <div class="flex w-full h-full">
    <div class="w-[300px] h-full overflow-y-auto border-r border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-[#1b1b1f]">
      <TripoInput />
    </div>
    <div class="flex-1 h-full bg-[#fafbfc] dark:bg-[#18181c] overflow-y-auto">
      <UnifiedModelList />
    </div>
  </div>
</template>
