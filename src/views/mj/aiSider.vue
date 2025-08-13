<script setup lang="ts">
import { computed,defineAsyncComponent ,ref} from "vue";
import { SvgIcon ,HoverButton} from '@/components/common'
import { useBasicLayout } from '@/hooks/useBasicLayout'
const { isMobile } = useBasicLayout()
import { NAvatar,NTooltip } from 'naive-ui'
import { homeStore, useUserStore,useChatStore } from '@/store'
import defaultAvatar from '@/assets/avatar.jpg'
import { router } from '@/router'
import { isDisableMenu } from "@/api";
import { useRouter } from "vue-router";

//import gallery from '@/views/gallery/index.vue'

const chatStore = useChatStore()
const Setting = defineAsyncComponent(() => import('@/components/common/Setting/index.vue'))
const userStore = useUserStore()

const st= ref({'show':false,showImg:false, menu:[],active:'chat'})


const userInfo = computed(() => userStore.userInfo)

const urouter = useRouter() //
 
const goHome =computed(  () => {
  //router.push('/')
  return router.currentRoute.value.name
});
// const go=(n:string)=>{
//   if('chat'==n){
//         router.push('/chat/'+ chatStore.active??'1002')
//     }
//     if('draw'==n){
//         router.push('/draw/'+ chatStore.active??'1002')
//         st.value.show=true;
//     }
// }
//mlog('g', goHome() );
const chatId= computed(()=>chatStore.active??'1002' );
</script>
<template>
<div class="flex-shrink-0 w-[60px] z-[1000]  h-full" v-if="!isMobile" data-tauri-drag-region>
    <div class="flex h-full select-none flex-col items-center justify-between bg-[#e8eaf1] px-2 pt-4 pb-8 dark:bg-[#25272d]">
        <div class="flex flex-col space-y-4 flex-1 " :class="{ 'pt-5': homeStore.myData.isClient }" data-tauri-drag-region>
            <div class="flex items-center justify-center pb-2">
                <img src="/logo1.png" alt="logo" class="w-10 h-10 object-contain" />
            </div>
            <!-- 对话 -->
            <a      @click="st.active='chat'; urouter.push(`/chat`)" class="router-link-active router-link-exact-active h-12 w-12 cursor-pointer rounded-xl duration-300 hover:bg-white dark:hover:bg-[#34373c]" :class="{ 'bg-white dark:bg-[#34373c]': goHome === 'Chat' }">
                <n-tooltip placement="right" trigger="hover">
                  <template #trigger>
                    <div  class="flex h-full justify-center items-center py-1 flex-col " :class="[ goHome =='Chat' ? 'text-[#445ff6]' : '']">
                    <SvgIcon icon="ri:wechat-line" class="text-3xl  flex-1"></SvgIcon>
                     <span class="text-[10px]">{{$t('mjtab.chat')}}</span>
                    </div>
                 </template>
                AI Chat
                </n-tooltip>
            </a>

            <!-- 绘画 -->
            <a v-if="!isDisableMenu ( 'draws')"  @click="st.active='draw'; urouter.push(`/draw`)" class=" router-link-exact-active h-12 w-12 cursor-pointer rounded-xl duration-300 hover:bg-white dark:hover:bg-[#34373c]" :class="{ 'bg-white dark:bg-[#34373c]': goHome === 'draw' }">
                <n-tooltip placement="right" trigger="hover">
                  <template #trigger>
                    <div  class="flex h-full justify-center items-center   py-1 flex-col" :class="[goHome=='draw' ? 'text-[#445ff6]' : '']">
                    <SvgIcon icon="ic:outline-palette" class="text-3xl flex-1"></SvgIcon>
                     <span class="text-[10px]">{{$t('mjtab.draw')}}</span>
                    </div>
                  </template>
                    {{$t('mjtab.drawinfo')}}
                </n-tooltip>
            </a>

            <!-- 音乐 -->
            <a v-if="!isDisableMenu ( 'music')"      @click="st.active='music'; urouter.push('/music')" class=" router-link-exact-active h-12 w-12 cursor-pointer rounded-xl duration-300 hover:bg-white dark:hover:bg-[#34373c]" :class="{ 'bg-white dark:bg-[#34373c]': goHome === 'music' }"
             >
                <n-tooltip placement="right" trigger="hover">
                  <template #trigger>
                    <div  class="flex  h-full justify-center items-center py-1 flex-col " :class="[ goHome =='music' ? 'text-[#445ff6]' : '']">
                      <SvgIcon icon="arcticons:wynk-music" class="text-3xl flex-1"></SvgIcon>
                      <span class="text-[10px]">{{ $t('suno.menu') }}</span>
                    </div>
                  </template>
                    {{ $t('suno.menuinfo') }}
                </n-tooltip>
            </a>

            <!-- 视频 -->
            <a v-if="!isDisableMenu ( 'video')"      @click="st.active='video'; urouter.push('/video')"
                class=" router-link-exact-active h-12 w-12 cursor-pointer rounded-xl duration-300 hover:bg-white dark:hover:bg-[#34373c]" :class="{ 'bg-white dark:bg-[#34373c]': goHome === 'video' }">
                <n-tooltip placement="right" trigger="hover">
                  <template #trigger>
                    <div  class="flex  h-full justify-center items-center py-1 flex-col " :class="[ goHome =='video' ? 'text-[#445ff6]' : '']">
                      <SvgIcon icon="ri:video-on-line" class="text-3xl flex-1"></SvgIcon>
                      <span class="text-[10px]">{{ $t('video.menu') }}</span>
                    </div>
                  </template>
                    {{ $t('video.menuinfo') }}
                </n-tooltip>
            </a>

            <!-- 画廊 -->
             <a  v-if="!isDisableMenu ( 'gallery')"  @click="homeStore.setMyData({act:'gallery'}) " class=" router-link-exact-active h-12 w-12 cursor-pointer rounded-xl duration-300 hover:bg-white dark:hover:bg-[#34373c]" :class="{ 'bg-white dark:bg-[#34373c]': homeStore.myData.act === 'gallery' }">
                <n-tooltip placement="right" trigger="hover">
                  <template #trigger> 
                    <div  class="flex h-full justify-center items-center   py-1 flex-col" >
                    <SvgIcon icon="material-symbols:imagesmode-outline" class="text-3xl flex-1"></SvgIcon>
                     <span class="text-[10px]">{{$t('mjtab.gallery')}}</span>
                    </div> 
                  </template>
                    {{ $t('mjtab.galleryInfo') }}
                </n-tooltip>
            </a>

            <!-- GPTs -->
            <a  v-if="!isDisableMenu ( 'gpts')"   @click="homeStore.setMyData({act:'showgpts'}) " class=" router-link-exact-active h-12 w-12 cursor-pointer rounded-xl duration-300 hover:bg-white dark:hover:bg-[#34373c]" :class="{ 'bg-white dark:bg-[#34373c]': homeStore.myData.act === 'showgpts' }">
                <n-tooltip placement="right" trigger="hover">
                  <template #trigger> 
                    <div  class="flex h-full justify-center items-center   py-1 flex-col" >
                    <SvgIcon icon="ri:apps-fill" class="text-3xl flex-1"></SvgIcon>
                     <span class="text-[10px]">GPTs</span>
                    </div> 
                  </template>
                    ChatGPT Store 
                </n-tooltip>
            </a>

            

             

        </div>
        <div class="flex flex-col  space-y-2 "> 
            <HoverButton>
                <div class="text-xl text-[#4f555e] dark:text-white flex h-full justify-center items-center "  @click="st.show = true">
                    <SvgIcon icon="ri:settings-4-line" />
                </div>
            </HoverButton>
        </div>
    </div>
</div>
 <Setting v-if="st.show" v-model:visible="st.show" />

 <!-- <n-drawer v-model:show="st.showImg" :placement="isMobile?'bottom':'right'"  :class="isMobile?['!h-[90vh]']: ['!w-[80vw]']" style="--n-body-padding:0">
    <n-drawer-content title="GPT store" closable>
      sdsd 
    </n-drawer-content>
</n-drawer> -->
</template>
