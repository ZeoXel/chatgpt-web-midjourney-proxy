<script setup lang="ts">
import { NTabs, NTabPane } from 'naive-ui';
import LumaInput from './lumaInput.vue'
import RunwayInput from './runwayInput.vue'
import KlingInput from '../kling/kgInput.vue'
import Sora2Input from './sora2Input.vue'
import ViduInput from './viduInput.vue'
import MinimaxInput from './minimaxInput.vue'
import { mlog } from '@/api';
import { gptServerStore } from '@/store';
import {  ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute(); // 获取当前路由对象

const st= ref({tab:''});
const handleUpdateValue=(v:string)=>{
   mlog("handleUpdateValue",v)
   gptServerStore.setMyData({TAB_VIDEO:v})
}

const initLoad=()=>{
    if(route.query.tab){
        //st.value.tab=route.query.tab as string;
        st.value.tab= 'runway'
        let tt= (route.query.tab as string).toLocaleLowerCase();
        if( ['runway','sora2','kling','runwayml','vidu','minimax'].indexOf(tt)>-1 ){
           st.value.tab=tt;
        }
        handleUpdateValue(  st.value.tab )
    }
    else st.value.tab=( gptServerStore.myData.TAB_VIDEO && gptServerStore.myData.TAB_VIDEO !== 'luma' ? gptServerStore.myData.TAB_VIDEO:'vidu')
    if( st.value.tab=='runwayml') st.value.tab='runway'
    if( st.value.tab=='luma') st.value.tab='vidu'
    if( st.value.tab=='pixverse') st.value.tab='vidu'
}
initLoad();
</script>

<template>
<div  >
    <n-tabs type="line"  :tabs-padding="1" class="abc1234" animated :default-value="st.tab"  @update:value="handleUpdateValue" style="--n-tab-text-color-active: #445ff6;--n-bar-color: #445ff6;--n-tab-text-color-hover:#7f0df9;--n-tab-border-color:#445ff6">
        <!-- <n-tab-pane name="" tab="">
        </n-tab-pane> -->
        <!-- <n-tab-pane name="luma" tab="Luma">
            <LumaInput />
        </n-tab-pane> -->
        <n-tab-pane name="vidu" tab="Vidu" style="--n-tab-gap:10px">
            <ViduInput />
        </n-tab-pane>
        <n-tab-pane name="runway" tab="Runway">
            <RunwayInput />
        </n-tab-pane>
        <n-tab-pane name="sora2" tab="Sora">
            <Sora2Input />
        </n-tab-pane>
        <n-tab-pane name="kling" :tab="$t('mj.kling')">
            <KlingInput />
        </n-tab-pane>
        <n-tab-pane name="minimax" tab="海螺">
            <MinimaxInput />
        </n-tab-pane>
    </n-tabs>
</div>
</template>

<style lang="css"  scoped>
.abc1234  {
    --n-tab-gap:10px  !important;
}
.abc1234 :deep(.n-tabs-nav) {
    display: flex !important;
    flex-wrap: wrap !important;
    justify-content: center !important;
    padding: 4px 0 !important;
}
.abc1234 :deep(.n-tabs-nav-scroll-wrapper) {
    overflow: visible !important;
}
.abc1234 :deep(.n-tabs-nav-scroll-content) {
    display: flex !important;
    flex-wrap: wrap !important;
    justify-content: center !important;
    width: 100% !important;
}
.abc1234 :deep(.n-tabs-tab-wrapper) {
    flex: 1 1 calc(50% - 12px) !important;
    margin: 4px 6px !important;
}
.abc1234 :deep(.n-tabs-tab) {
    width: 100% !important;
    justify-content: center !important;
    position: relative !important;
    border-bottom: 2px solid transparent !important;
}
.abc1234 :deep(.n-tabs-tab--active) {
    border-bottom-color: #445ff6 !important;
}
.abc1234 :deep(.n-tabs-bar) {
    display: none !important;
}
</style>
