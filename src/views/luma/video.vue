<script setup lang="ts">
import { ref } from 'vue';
import VoInput from './voInput.vue';

// 统一组件
import UnifiedVideoList from '@/components/video/UnifiedVideoList.vue';

// 旧组件 (保留作为备份)
//import VoInput from './lumaInput.vue';
import VoList from './voList.vue';
import RunwayList from './runwayList.vue';
import PikaList from './pikaList.vue';
import KlingList from '../kling/kgList.vue';
import RunmlList from './runmlList.vue';
import ViduList from './viduList.vue';

import { gptServerStore } from '@/store';

// 功能开关 - 随时可以切换回旧组件
const useUnifiedList = ref(true);
</script>

<template>
<div class="flex w-full h-full">
    <!-- 左侧输入区 (保持不变) -->
    <div class="w-[300px] h-full overflow-y-auto">
         <VoInput/>
    </div>

    <!-- 右侧列表区 - 统一容器显示所有服务的任务 -->
    <div class="flex-1 h-full bg-[#fafbfc] pt-2 dark:bg-[#18181c] overflow-y-auto">

        <!-- 新版统一列表 - 不传service参数,显示所有任务 -->
        <template v-if="useUnifiedList">
            <UnifiedVideoList />
        </template>

        <!-- 旧版列表 (备份,随时可恢复) -->
        <template v-else>
            <ViduList v-if="gptServerStore.myData.TAB_VIDEO === 'vidu'"/>
            <RunwayList v-else-if="gptServerStore.myData.TAB_VIDEO === 'runway'"/>
            <KlingList v-else-if="gptServerStore.myData.TAB_VIDEO === 'kling'"/>
            <PikaList v-else-if="gptServerStore.myData.TAB_VIDEO === 'pika'"/>
            <RunmlList v-else-if="gptServerStore.myData.TAB_VIDEO === 'runwayml'"/>
            <!-- <VoList v-else-if="gptServerStore.myData.TAB_VIDEO === 'luma'"/> -->
            <ViduList v-else/>
        </template>
    </div>
</div>
</template> 