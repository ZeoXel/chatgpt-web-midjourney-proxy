<script setup lang="ts"> 
import { NTabs, NTabPane } from 'naive-ui';
import LumaInput from './lumaInput.vue'
import RunwayInput from './runInput.vue'
import KlingInput from '../kling/kgInput.vue'
import PikaInput from './pikaInput.vue'
import ViduInput from './viduInput.vue'
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
        if( ['runway','pika','kling','runwayml','vidu'].indexOf(tt)>-1 ){
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
        <n-tab-pane name="pika" tab="Pika">
            <PikaInput />
        </n-tab-pane>
        <n-tab-pane name="kling" :tab="$t('mj.kling')">
            <KlingInput />
        </n-tab-pane>
    </n-tabs>
</div>
</template>

<style lang="css"  scoped>
.abc1234  {
    --n-tab-gap:20px  !important;
}
.abc1234 :deep(.n-tabs-nav) {
    justify-content: center !important;
    display: flex !important;
}
.abc1234 :deep(.n-tabs-nav-scroll-wrapper) {
    justify-content: center !important;
    display: flex !important;
    width: 100% !important;
}
.abc1234 :deep(.n-tabs-nav-scroll-content) {
    justify-content: center !important;
    display: flex !important;
    flex-wrap: nowrap !important;
}
.abc1234 :deep(.n-tabs-tab) {
    margin: 0 10px !important;
}
</style>
