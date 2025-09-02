<script setup lang="ts">
import { ref } from 'vue';
import McInput from './mcInput.vue';
import mcList from './mcList.vue';
import mcplayer from './mcplayer.vue';
import { NTabs,NTabPane} from "naive-ui"

import RiffInput from './riffInput.vue';
import RiffList from './riffList.vue';
import udioInput from './udioInput.vue';
import udioList from './udioList.vue';
import { gptServerStore } from '@/store';
import { useRoute, useRouter } from 'vue-router';
import { useBasicLayout } from '@/hooks/useBasicLayout';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { SvgIcon } from '@/components/common';
import { useAppStore } from '@/store'; 

const route = useRoute(); // 获取当前路由对象
const router = useRouter()
const appStore = useAppStore()
const { isMobile } = useBasicLayout()
const st= ref({menu:'suno',tab:''});
const containerRef = ref<HTMLElement | null>(null)

// 快速切换到聊天功能
function goToChat() {
  router.push('/chat')
}

// 定义可切换的tab列表
const tabList = ['suno', 'riff', 'udio']

// 滑动切换功能
const switchToNextTab = () => {
  const currentTab = gptServerStore.myData.TAB_MUSIC || 'suno'
  const currentIndex = tabList.indexOf(currentTab)
  const nextIndex = (currentIndex + 1) % tabList.length
  const nextTab = tabList[nextIndex]
  handleUpdateValue(nextTab)
}

const switchToPrevTab = () => {
  const currentTab = gptServerStore.myData.TAB_MUSIC || 'suno'
  const currentIndex = tabList.indexOf(currentTab)
  const prevIndex = (currentIndex - 1 + tabList.length) % tabList.length
  const prevTab = tabList[prevIndex]
  handleUpdateValue(prevTab)
}

// 使用滑动手势（仅移动端）
if (isMobile) {
  useSwipeGesture(
    containerRef,
    switchToNextTab,  // 左滑切换到下一个tab
    switchToPrevTab   // 右滑切换到上一个tab
  )
}

const handleUpdateValue=(v:string)=>{
   //mlog("handleUpdateValue",v)
   gptServerStore.setMyData({TAB_MUSIC:v})
}

const initLoad=()=>{
    if(route.query.tab){ 
        st.value.tab= 'suno' 
        let tt= (route.query.tab as string).toLocaleLowerCase();
        if( ['suno','udio','riff'].indexOf(tt)>-1 ){
           st.value.tab=tt;
        }

        handleUpdateValue(  st.value.tab )
    }
    else st.value.tab=( gptServerStore.myData.TAB_MUSIC?gptServerStore.myData.TAB_MUSIC:'suno')
}
initLoad();

</script>

<template>
  <!-- 移动端布局 -->
  <div v-if="isMobile" ref="containerRef" class="flex flex-col w-full h-full">
    <!-- 移动端顶部导航栏 -->
    <div class="flex items-center justify-between p-2 bg-white dark:bg-[#24272e] border-b border-gray-200 dark:border-gray-700">
      <button 
        @click="goToChat"
        class="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="返回聊天"
      >
        <SvgIcon icon="ri:chat-3-line" class="text-xl text-gray-600 dark:text-gray-300" />
      </button>
      <h1 class="text-lg font-medium text-gray-900 dark:text-white">音乐生成</h1>
      <div class="w-10 h-10"></div> <!-- 占位符保持居中 -->
    </div>
    
    <!-- 输入区域 -->
    <div class="w-full h-auto max-h-[40%] overflow-y-auto border-b border-gray-200 dark:border-gray-700">
      <n-tabs type="line" animated :default-value="gptServerStore.myData.TAB_MUSIC??'suno'" @update:value="handleUpdateValue" style="--n-tab-text-color-active: #445ff6;--n-bar-color: #445ff6;--n-tab-text-color-hover:#7f0df9;--n-tab-border-color:#445ff6">
        <n-tab-pane name="start" tab=""> 
          <McInput /> 
        </n-tab-pane>
        <n-tab-pane name="suno" tab="Suno"> 
          <McInput /> 
        </n-tab-pane>
        <n-tab-pane name="riff" tab="Riffusion"> 
          <RiffInput/>
        </n-tab-pane>
        <n-tab-pane name="udio" tab="Udio"> 
          <udioInput/>
        </n-tab-pane>
      </n-tabs>
    </div>
    
    <!-- 中间列表区域 -->
    <div class="flex-1 w-full bg-[#fafbfc] pt-2 dark:bg-[#18181c] overflow-y-auto">
      <udioList v-if="gptServerStore.myData.TAB_MUSIC=='udio'"/>
      <RiffList v-else-if="gptServerStore.myData.TAB_MUSIC=='riff'" />
      <mcList v-else />
    </div>
    
    <!-- 底部播放器区域 -->
    <div class="w-full h-auto max-h-[30%] border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#24272e] overflow-y-auto">
      <mcplayer/>
    </div>
  </div>

  <!-- 桌面端布局（保持原样） -->
  <div v-else class="flex w-full h-full">
    <div class="w-[300px] h-full overflow-y-auto">
      <n-tabs type="line" animated :default-value="gptServerStore.myData.TAB_MUSIC??'suno'" @update:value="handleUpdateValue" style="--n-tab-text-color-active: #445ff6;--n-bar-color: #445ff6;--n-tab-text-color-hover:#7f0df9;--n-tab-border-color:#445ff6">
        <n-tab-pane name="start" tab=""> 
          <McInput /> 
        </n-tab-pane>
        <n-tab-pane name="suno" tab="Suno"> 
          <McInput /> 
        </n-tab-pane>
        <n-tab-pane name="riff" tab="Riffusion"> 
          <RiffInput/>
        </n-tab-pane>
        <n-tab-pane name="udio" tab="Udio"> 
          <udioInput/>
        </n-tab-pane>
      </n-tabs>
    </div>
    <div class="flex-1 h-full bg-[#fafbfc] pt-2 dark:bg-[#18181c] overflow-y-auto">
      <udioList v-if="gptServerStore.myData.TAB_MUSIC=='udio'"/>
      <RiffList v-else-if="gptServerStore.myData.TAB_MUSIC=='riff'" />
      <mcList v-else />
    </div>
    <div class="w-[300px] h-full overflow-y-auto">
      <mcplayer/>
    </div>
  </div>
</template>
