<script setup lang="ts">
import { ref } from 'vue'
import { NTabs, NTabPane } from 'naive-ui'
import ViduInput from '@/views/vidu/viduInput.vue'
import ViduList from '@/views/vidu/viduList.vue'
import RunwayInput from '@/views/luma/runwayInput.vue'
import RunwayList from '@/views/luma/runwayList.vue'
import KgInputVideo from '@/views/kling/kgInputVideo.vue'
import KgList from '@/views/kling/kgList.vue'
import { gptServerStore } from '@/store'
import { useRoute } from 'vue-router'

const route = useRoute()
const st = ref({ tab: '' })

const handleUpdateValue = (v: string) => {
  gptServerStore.setMyData({ TAB_VIDEO: v })
}

const initLoad = () => {
  if (route.query.tab) {
    st.value.tab = 'vidu'
    let tt = (route.query.tab as string).toLowerCase()
    if (['vidu', 'runway', 'kling'].indexOf(tt) > -1) {
      st.value.tab = tt
    }
    handleUpdateValue(st.value.tab)
  } else {
    st.value.tab = (gptServerStore.myData.TAB_VIDEO ? gptServerStore.myData.TAB_VIDEO : 'vidu')
  }
}
initLoad()
</script>

<template>
  <div class="flex w-full h-full">
    <div class="w-[300px] h-full overflow-y-auto border-r border-gray-200 dark:border-gray-700">
      <n-tabs 
        type="line" 
        animated 
        :default-value="gptServerStore.myData.TAB_VIDEO ?? 'vidu'" 
        @update:value="handleUpdateValue"
        style="--n-tab-text-color-active: #445ff6;--n-bar-color: #445ff6;--n-tab-text-color-hover:#7f0df9;--n-tab-border-color:#445ff6"
      >
        <n-tab-pane name="vidu" tab="Vidu">
          <ViduInput />
        </n-tab-pane>
        <n-tab-pane name="runway" tab="Runway">
          <RunwayInput />
        </n-tab-pane>
        <n-tab-pane name="kling" tab="Kling">
          <KgInputVideo />
        </n-tab-pane>
      </n-tabs>
    </div>
    
    <!-- 右侧结果列表区域 -->
    <div class="flex-1 h-full bg-[#fafbfc] dark:bg-[#18181c] overflow-y-auto">
      <RunwayList v-if="gptServerStore.myData.TAB_VIDEO === 'runway'" />
      <KgList v-else-if="gptServerStore.myData.TAB_VIDEO === 'kling'" />
      <ViduList v-else />
    </div>
  </div>
</template>

<style scoped>
/* 确保滚动条样式一致 */
:deep(.n-scrollbar-rail) {
  right: 4px !important;
}
</style>