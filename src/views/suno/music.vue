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
import { useRoute } from 'vue-router';
import { useBasicLayout } from '@/hooks/useBasicLayout'; 

const route = useRoute(); // 获取当前路由对象
const { isMobile } = useBasicLayout()
const st= ref({menu:'suno',tab:''});

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
  <div v-if="isMobile" class="flex flex-col w-full h-full">
    <!-- 顶部输入区域 -->
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
