<script setup lang="ts">
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { NImage,NButton,NModal,useMessage } from 'naive-ui'
import { computed , ref,watch } from 'vue'
import {  isDallImageModel, localGet,mlog, url2base64 } from '@/api'
import { homeStore } from '@/store'
import { SvgIcon } from '@/components/common'
const { isMobile } = useBasicLayout()
const st = ref({isLoadImg:false,uri_base64:'', forceUpdateKey: 0})
const props = defineProps<{chat:Chat.Chat, loading?:boolean}>();
const chat = computed(() =>props.chat);

// 监听 props.chat 的变化，强制更新
watch(() => props.chat, (newChat) => {
    mlog('📢 [dallText] props.chat 变化:', {
        myid: newChat.myid,
        hasImageUrl: !!newChat.opt?.imageUrl,
        hasImageUrls: !!newChat.opt?.imageUrls,
        imageUrlsLength: newChat.opt?.imageUrls?.length
    });
    st.value.forceUpdateKey++;
}, { deep: true });

// 去重imageUrls，避免显示重复图片
const uniqueImageUrls = computed(() => {
    // 依赖 forceUpdateKey 以确保响应式更新
    const _ = st.value.forceUpdateKey;

    const imageUrls = chat.value.opt?.imageUrls;

    mlog('🖼️ [uniqueImageUrls] 计算中... (forceUpdateKey=' + _ + ')', {
        myid: chat.value.myid,
        hasImageUrls: !!imageUrls,
        isArray: Array.isArray(imageUrls),
        length: imageUrls?.length,
        imageUrls: imageUrls
    });

    if (!imageUrls || !Array.isArray(imageUrls)) {
        mlog('🖼️ [uniqueImageUrls] 无效数据，返回空数组');
        return [];
    }

    const seen = new Set();
    const result = imageUrls.filter((img: any) => {
        if (seen.has(img.url)) {
            return false;
        }
        seen.add(img.url);
        return true;
    });

    mlog('🖼️ [uniqueImageUrls] 去重后:', result.length, '张图片', result);
    return result;
});

const load = async ()=>{
     mlog('🖼️ [dallText] load-dall', {
         myid: chat.value.myid,
         imageUrl: chat.value.opt?.imageUrl,
         imageUrls: chat.value.opt?.imageUrls,
         imageUrlsLength: chat.value.opt?.imageUrls?.length
     });

     // 如果有多图，直接显示
     if(chat.value.opt?.imageUrls && chat.value.opt.imageUrls.length > 0){
         mlog(`🖼️ [dallText] 检测到多图：${chat.value.opt.imageUrls.length} 张`);
         st.value.isLoadImg=true;
         return;
     }

     // 单图处理
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
         mlog('🔄 [dallText] dallReload', {
             myid: actData.myid,
             imageUrl: chat.value.opt?.imageUrl,
             imageUrls: chat.value.opt?.imageUrls
         });
         st.value.isLoadImg=false;
         st.value.forceUpdateKey++;
         load();
        // if( !actData.noShow ) ms.success('图片刷新成功！');
    }

    if(n=='updateChat' && actData.myid == chat.value.myid) {
        mlog('🔄 [dallText] updateChat 收到更新！', {
            myid: actData.myid,
            imageUrl: actData.opt?.imageUrl,
            imageUrls: actData.opt?.imageUrls,
            imageUrlsLength: actData.opt?.imageUrls?.length
        });
        // 强制触发响应式更新
        st.value.forceUpdateKey++;
        st.value.isLoadImg = true;  // 直接标记为已加载
        mlog('🔄 [dallText] forceUpdateKey 已更新:', st.value.forceUpdateKey);
    }
})

load();
</script>
<template>
<div>
    <!-- DEBUG: 显示图片数量 -->
    <div v-if="uniqueImageUrls.length > 0" class="text-xs text-gray-400 mb-1">
        共 {{ uniqueImageUrls.length }} 张图片 (forceUpdateKey: {{ st.forceUpdateKey }})
    </div>

    <!-- 多图显示 - 优先检查 -->
    <div v-if="uniqueImageUrls.length > 0"
         :key="`images-${chat.myid}-${st.forceUpdateKey}`"
         :class="[
           uniqueImageUrls.length === 1 ? 'flex justify-center max-w-[400px]' : 'grid grid-cols-2 gap-1 max-w-[500px]',
           uniqueImageUrls.length === 4 ? 'grid-rows-2' : ''
         ]" >
         <div v-for="(v,k) in uniqueImageUrls" :key="`img-${chat.myid}-${k}-${v.url}`"
              :class="[
                'relative overflow-hidden rounded-sm',
                uniqueImageUrls.length === 1 ? 'w-full max-w-[400px] aspect-square' : 'aspect-square'
              ]" >
             <NImage  :src="v.url" class="w-full h-full object-cover"/>
            <a class="absolute top-[8px] right-[8px] cursor-pointer bg-white bg-opacity-50 rounded-full p-1 hover:bg-opacity-80"
               target="_blank" :href="v.url" :download="`image-${k+1}.jpg`">
                <SvgIcon icon="mdi:download" />
            </a>
        </div>
    </div>
    <!-- 单图显示（备用） -->
    <div v-else-if="st.isLoadImg && chat.opt?.imageUrl">
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