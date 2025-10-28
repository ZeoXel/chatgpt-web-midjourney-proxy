<script setup lang="ts">
import { ref } from 'vue';
import McInput from './mcInput.vue';
import mcList from './mcList.vue';
import mcplayer from './mcplayer.vue';
import { gptServerStore } from '@/store';

const st= ref({menu:'suno',tab:''});

const handleUpdateValue=(v:string)=>{
   //mlog("handleUpdateValue",v)
   gptServerStore.setMyData({TAB_MUSIC:v})
}

const initLoad=()=>{
    st.value.tab = 'suno';
    handleUpdateValue(st.value.tab);
}
initLoad();

</script>

<template>

<div class="flex w-full h-full   ">
    <div class="w-[300px] h-full  overflow-y-auto ">
        <McInput />
    </div>
    <div class=" flex-1  h-full bg-[#fafbfc] pt-2 dark:bg-[#18181c] overflow-y-auto " >
        <mcList />
    </div>
    <div class="w-[300px]  h-full overflow-y-auto ">
        <mcplayer/>
    </div>
</div>
</template>
