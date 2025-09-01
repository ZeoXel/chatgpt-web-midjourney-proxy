 <script setup lang="ts">
 import VoInput from './voInput.vue';
 //import VoInput from './lumaInput.vue';
 import VoList from './voList.vue';
 import RunwayList from './runwayList.vue';
 import PikaList from './pikaList.vue';
 import KlingList from '../kling/kgList.vue';
 import RunmlList from './runmlList.vue';
 import PixList from './pixList.vue';
import { gptServerStore } from '@/store';
import { useBasicLayout } from '@/hooks/useBasicLayout';

const { isMobile } = useBasicLayout()
 </script>
<template>
  <!-- 移动端布局 -->
  <div v-if="isMobile" class="flex flex-col w-full h-full">
    <!-- 顶部输入区域 -->
    <div class="w-full h-auto max-h-[50%] overflow-y-auto border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#24272e]">
      <VoInput/>
    </div>
    
    <!-- 下方视频列表区域 -->
    <div class="flex-1 w-full bg-[#fafbfc] pt-2 dark:bg-[#18181c] overflow-y-auto">
      <RunwayList v-if="gptServerStore.myData.TAB_VIDEO=='runway'"/>
      <KlingList v-else-if="gptServerStore.myData.TAB_VIDEO=='kling'"/>
      <PikaList v-else-if="gptServerStore.myData.TAB_VIDEO=='pika'"/>
      <RunmlList v-else-if="gptServerStore.myData.TAB_VIDEO=='runwayml'"/>
      <PixList v-else-if="gptServerStore.myData.TAB_VIDEO=='pixverse'"/>
      <VoList v-else/>
    </div>
  </div>

  <!-- 桌面端布局（保持原样） -->
  <div v-else class="flex w-full h-full">
    <div class="w-[300px] h-full overflow-y-auto">
      <VoInput/>
    </div>
    <div class="flex-1 h-full bg-[#fafbfc] pt-2 dark:bg-[#18181c] overflow-y-auto">
      <RunwayList v-if="gptServerStore.myData.TAB_VIDEO=='runway'"/>
      <KlingList v-else-if="gptServerStore.myData.TAB_VIDEO=='kling'"/>
      <PikaList v-else-if="gptServerStore.myData.TAB_VIDEO=='pika'"/>
      <RunmlList v-else-if="gptServerStore.myData.TAB_VIDEO=='runwayml'"/>
      <PixList v-else-if="gptServerStore.myData.TAB_VIDEO=='pixverse'"/>
      <VoList v-else/>
    </div>
  </div>
</template> 