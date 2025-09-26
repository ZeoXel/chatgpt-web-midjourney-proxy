<script setup lang="ts">
import { ref,onMounted,onUnmounted,computed } from "vue";
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { NImage,NButton,useMessage,NInput,NSelect } from 'naive-ui'
import { mlog } from "@/api";
import { homeStore } from "@/store";

const pp= defineProps<{chat?:Chat.Chat,img:string}>() 
const { isMobile } = useBasicLayout()

const f= ref({motion:'low',prompt:'','image':pp.img,"base64":pp.img,mode:'FAST'});
const st= ref({'isLoading':false});
const emits = defineEmits(['success']);
const ms = useMessage();

const modeOption=[{label:'Mode: Fast',value: 'FAST'},{label:'Mode: Relax',value: 'RELAX'} ,{label:'Mode: Turbo',value: 'TURBO'} ]
const motionOpt=[{label:'Motion: Low',value: 'low'},{label:'Motion: High',value: 'high'}]

const isDisabled = computed(() => {
    if (f.value.prompt === '') {
        return true;
    }
    if (!homeStore.myData.hasBalance) {
        return true;
    }
    if (st.value.isLoading) {
        return true;
    }
    return false;
});

const generate=()=>{
    if (!homeStore.myData.hasBalance) {
        ms.info('账户余额不足，无法使用视频编辑功能');
        return;
    }

    st.value.isLoading=true
     let obj={
        action:'mj.edit.video',
        version:1,
        data:f.value,

    }
    mlog('mj.edit.video', obj );
    homeStore.setMyData({act:'draw',actData:obj});
    st.value.isLoading=false
    emits('success'  );

}
</script>
<template>
    <div :class="!isMobile?['flex', 'flex-row','justify-between']:''  ">
        <section> 
            <NImage  :src="pp.img" class=" rounded-sm " :class="[isMobile?'':'!max-w-[450px]']"  /> 
        </section>
        <section class="min-w-[270px]">
            <div class="pt-1" >
                <n-input v-model:value="f.prompt" 
                            :placeholder="$t('video.descpls')"  type="textarea"  size="small"   
                            :autosize="{ minRows: 3, maxRows: 12  }"  />
            </div>
            <div  class="pt-1">
                <n-select v-model:value="f.mode" :options="modeOption" size="small" />
            </div>
             <div  class="pt-1">
                <n-select v-model:value="f.motion" :options="motionOpt" size="small" />
            </div>
            <div class="pt-4 text-right">
                <NButton type="primary" @click="generate()" :disabled="isDisabled"  :loading="st.isLoading">{{ $t('video.generate') }}</NButton>
            </div>
        </section>
    </div>
</template>