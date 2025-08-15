<script lang="ts" setup>
import RunmlInput from './runmlInput.vue'
import { gptServerStore } from '@/store';
import { mlog } from '@/api';
import { onMounted } from 'vue'; 

// 确保TAB_VIDEO设置为runwayml（API选项）
const initLoad = () => {
    mlog("runInput: Setting TAB_VIDEO to runwayml")
    gptServerStore.setMyData({TAB_VIDEO: 'runwayml'})
}

onMounted(() => {
    initLoad();
});
</script>
<template>
<div class="px-2">
    <!-- 直接显示API接口，移除WebSite选项 -->
    <RunmlInput/>
</div>
</template>
