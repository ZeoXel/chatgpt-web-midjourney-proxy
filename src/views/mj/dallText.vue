<script setup lang="ts">
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { NImage,NButton,NModal,useMessage } from 'naive-ui'
import { computed , ref,watch } from 'vue'
import {  isDallImageModel, localGet,mlog, url2base64 } from '@/api'
import { homeStore } from '@/store'
const { isMobile } = useBasicLayout()
const st = ref({isLoadImg:false,uri_base64:''})
const props = defineProps<{chat:Chat.Chat, loading?:boolean}>();
const chat = computed(() =>props.chat);

const load = async ()=>{
     mlog('load-dall', chat.value.myid, chat.value.opt?.imageUrl );
     //if(chat.value.model!='dall-e-3' || !chat.value.myid || !chat.value.opt?.imageUrl ){
     if( !isDallImageModel(chat.value.model)  || !chat.value.myid || !chat.value.opt?.imageUrl ){
         st.value.isLoadImg=true;
      return ;
     }
     let key= 'dall:'+chat.value.myid;
    try {
        if(chat.value.opt?.imageUrl){
            //await loadImg(chat.value.opt?.imageUrl);
            let base64 = await localGet(key );  
            if(!base64) {
                const ubase64=  await url2base64(`https://wsrv.nl/?url=${encodeURIComponent(chat.value.opt?.imageUrl)}`  ,key );
                base64= ubase64.base64;
                mlog('图片已保存>>', ubase64.key )
            }
            st.value.uri_base64=base64;
        }
    } catch (error) {
        mlog('图片保存失败',error);
    }
    
    st.value.isLoadImg=true;

  
}




watch(()=>homeStore.myData.act,(n)=>{
    const actData :any= homeStore.myData.actData;
    
    if(n=='dallReload' &&  actData.myid== chat.value.myid  ){  //
         mlog('dallReload', actData.myid , chat.value.opt?.imageUrl);
         st.value.isLoadImg=false;
         load();
        // if( !actData.noShow ) ms.success('图片刷新成功！');
    }
})

load();
</script>
<template>
<div>
    <!-- 生成完成，显示图片 -->
    <div v-if="st.isLoadImg && chat.opt?.imageUrl">
        <NImage :src="st.uri_base64?st.uri_base64:chat.opt.imageUrl" class=" rounded-sm " :class="[isMobile?'':'!max-w-[500px]']"  />
    </div>
    <!-- 生成完成但图片加载中 -->
    <div v-else-if="chat.opt?.imageUrl" class="w-[200px] h-[150px] flex flex-col justify-center items-center" >
        <div class="p-4">{{ $t('mjchat.loading') }}</div>
        <NButton type="primary"  ><a :href="chat.opt?.imageUrl" target="_blank">{{ $t('mjchat.openurl') }}</a></NButton>
    </div>
    <!-- 生成过程中，显示loading状态 -->
    <div v-else-if="loading || chat.loading" class="w-[300px] h-[120px] flex flex-col justify-center items-center border border-gray-200 rounded-lg bg-gray-50" >
        <div class="flex items-center space-x-3 p-4">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <div class="text-sm text-gray-600">{{ chat.text || $t('mjchat.wait3') }}</div>
        </div>
        <div class="text-xs text-gray-400 px-4 text-center">{{ $t('mjchat.generateProgress') }}</div>
    </div>
    <!-- 纯文本消息（fallback） -->
    <div v-else class="markdown-body" v-html="chat.text" />
</div>
</template>