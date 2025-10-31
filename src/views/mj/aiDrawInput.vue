<script setup lang="ts">
import { NTabs,NTabPane } from 'naive-ui';
import aiDrawInputItem from './aiDrawInputItem.vue'
import aiDall from './aiDall.vue'
import aiSeeDream from './aiSeeDream.vue'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { SvgIcon } from '@/components/common'
import { onMounted, ref, watch } from 'vue';
import { gptServerStore } from '@/store';
import { mlog } from '@/api';
import { useRoute } from 'vue-router'; 

const route = useRoute(); // 获取当前路由对象

const $emit=defineEmits(['drawSent','close']);
const drawSent=(d:any )=> $emit('drawSent',d);
const {isMobile}= useBasicLayout()

const st= ref({drawType:'draw',tab:''});

onMounted(()=>{
  //st.value.drawType='draw'
  if(gptServerStore.myData.DRAW_TYPE) st.value.drawType=gptServerStore.myData.DRAW_TYPE
})

// watch(()=>st.value.drawType, (n:string)=> {
//   mlog('st.value.drawType',n)
//   gptServerStore.setMyData({DRAW_TYPE:n})
// } )

const handleUpdateValue=(v:string)=>{
   //mlog("handleUpdateValue",v)
   gptServerStore.setMyData({DRAW_TYPE:v})
}
const initLoad=()=>{
    if(route.query.tab){
        st.value.tab= 'midjourney'//route.query.tab as string;
        let tt= (route.query.tab as string).toLocaleLowerCase();
        if( ['dall.e','seedream'].indexOf(tt)>-1 ){
           st.value.tab=tt;
        }
        handleUpdateValue(   st.value.tab )
    }
    else st.value.tab=( gptServerStore.myData.DRAW_TYPE?gptServerStore.myData.DRAW_TYPE:'midjourney')
}
initLoad();

</script>
<template>
<div class="overflow-y-auto bg-[#fafbfc] pt-2 dark:bg-[#18181c] h-full">
 
<n-tabs type="line" animated :default-value="st.tab" @update:value="handleUpdateValue" size="small" style="--n-tab-text-color-active: #445ff6;--n-bar-color: #445ff6;--n-tab-text-color-hover:#7f0df9;--n-tab-gap: 8px;--n-tab-padding: 8px 12px">
    <n-tab-pane name="start" tab=""> 

    </n-tab-pane>
    <n-tab-pane name="midjourney" tab="MJ工坊" >
      <aiDrawInputItem @draw-sent="drawSent" @close="$emit('close')"></aiDrawInputItem>
    </n-tab-pane>

    <n-tab-pane name="dall.e" tab="智能绘画">
     <div class="p-4"><aiDall  /></div>
    </n-tab-pane>

    <n-tab-pane name="seedream" tab="即梦绘图">
     <div class="p-4"><aiSeeDream /></div>
    </n-tab-pane>  
    


    <n-tab-pane name="Close" v-if="isMobile" >
      <template #tab>
      <div class=" text-center flex justify-center items-center"   @click="$emit('close')"  ><SvgIcon icon="ri:close-circle-line"></SvgIcon></div>
      </template>
      <div class="p-4"> 
        <div   @click="$emit('close')" class=" justify-center items-center flex">
            <SvgIcon icon="ri:close-circle-line"></SvgIcon> Close By Click me 
        </div>
      </div>
    </n-tab-pane>

</n-tabs>
</div>
</template>

<style scoped>
/* 优化标签页间距和外观 */
:deep(.n-tabs .n-tabs-nav) {
  padding: 0 8px;
  overflow-x: auto;
  flex-wrap: nowrap;
}

:deep(.n-tabs .n-tabs-nav .n-tabs-wrapper) {
  overflow-x: auto;
  flex-wrap: nowrap;
}

:deep(.n-tabs .n-tabs-tab) {
  margin-right: 4px;
  padding: 6px 10px !important;
  font-weight: 500;
  font-size: 13px;
  min-width: fit-content;
  white-space: nowrap;
  border-radius: 4px 4px 0 0;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

:deep(.n-tabs .n-tabs-tab:hover) {
  background-color: rgba(68, 95, 246, 0.1);
}

:deep(.n-tabs .n-tabs-tab--active) {
  font-weight: 600;
  color: #445ff6 !important;
}

/* 调整子标签页间距 */
:deep(.n-tabs-pane .n-tabs .n-tabs-tab) {
  margin-right: 4px;
  padding: 6px 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  :deep(.n-tabs .n-tabs-tab) {
    padding: 4px 8px !important;
    font-size: 12px;
  }
}
</style>
