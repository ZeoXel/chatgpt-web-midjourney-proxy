 <script setup lang="ts">
 import VoInput from './voInput.vue';
 //import VoInput from './lumaInput.vue';
 import VoList from './voList.vue';
 import RunwayList from './runwayList.vue';
 import PikaList from './pikaList.vue';
 import KlingList from '../kling/kgList.vue';
 import RunmlList from './runmlList.vue';
 import PixList from './pixList.vue';
import { gptServerStore, useAppStore } from '@/store';
import { useBasicLayout } from '@/hooks/useBasicLayout';
import { useRouter } from 'vue-router';
import { SvgIcon } from '@/components/common';

const { isMobile } = useBasicLayout()
const router = useRouter()
const appStore = useAppStore()

// 快速切换到聊天功能
function goToChat() {
  router.push('/chat')
}
 </script>
<template>
  <!-- 移动端布局 -->
  <div v-if="isMobile" class="flex flex-col w-full h-full">
    <!-- 移动端顶部导航栏 -->
    <div class="flex items-center justify-between p-2 bg-white dark:bg-[#24272e] border-b border-gray-200 dark:border-gray-700">
      <button 
        @click="goToChat"
        class="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="返回聊天"
      >
        <SvgIcon icon="ri:chat-3-line" class="text-xl text-gray-600 dark:text-gray-300" />
      </button>
      <h1 class="text-lg font-medium text-gray-900 dark:text-white">视频生成</h1>
      <div class="w-10 h-10"></div> <!-- 占位符保持居中 -->
    </div>
    
    <!-- 输入区域 -->
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