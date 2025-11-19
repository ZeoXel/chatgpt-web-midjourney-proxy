<script setup lang='ts'>
import { computed } from 'vue'
import { NLayout, NLayoutContent,useMessage } from 'naive-ui'
import { useRouter ,useRoute } from 'vue-router'
import Sider from './sider/index.vue'
import Permission from './Permission.vue'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { gptConfigStore, homeStore, useAppStore, useAuthStore, useChatStore } from '@/store'
import { aiSider,aiFooter} from '@/views/mj'
import aiMobileMenu from '@/views/mj/aiMobileMenu.vue';
import { t } from '@/locales'
import { mlog, openaiSetting } from '@/api'
import { isObject } from '@/utils/is'
import { getLastChatUuid } from '@/store/modules/chat/helper'
import { BalanceWarning } from '@/components/common'

const router = useRouter()
const appStore = useAppStore()
const chatStore = useChatStore()
const authStore = useAuthStore()

const rt = useRoute();
const ms = useMessage();
openaiSetting( rt.query, ms )
if(rt.name =='GPTs'){
  let model= `gpt-4-gizmo-${rt.params.gid.toString()}`  ;
  gptConfigStore.setMyData({model:model});
  ms.success(`GPTs ${t('mj.modleSuccess')}`);
}else if(rt.name=='Setting'){
  openaiSetting( rt.query,ms );
  if(isObject( rt.query ))  ms.success( t('mj.setingSuccess') );
}else if(rt.name=='Model'){
  let model= `${rt.params.gid.toString()}`  ;
  gptConfigStore.setMyData({model:model});
  ms.success( t('mj.modleSuccess') );
}

// 智能路由跳转逻辑：优先恢复用户的最后聊天状态
if (rt.name === 'Root' || (rt.name === 'Chat' && !rt.params.uuid)) {
  // 优先使用保存的最后聊天uuid，如果没有则使用当前active
  const lastChatUuid = getLastChatUuid()
  const targetUuid = lastChatUuid || chatStore.active

  // 确保目标uuid对应的聊天记录存在
  const chatExists = chatStore.history.find(h => h.uuid === targetUuid)
  if (chatExists) {
    router.replace({ name: 'Chat', params: { uuid: targetUuid } })
  } else {
    // 如果目标聊天不存在，使用当前active或创建新的
    router.replace({ name: 'Chat', params: { uuid: chatStore.active } })
  }
}
homeStore.setMyData({local:'Chat'});
const { isMobile } = useBasicLayout()


const collapsed = computed(() => appStore.siderCollapsed)

const needPermission = computed(() => {
//mlog( 'Layout token',  authStore.token   )

 return  !!authStore.session?.auth && !authStore.token
})

const getMobileClass = computed(() => {
  if (isMobile.value)
    return ['rounded-none', 'shadow-none']
  return [ 'shadow-md', 'dark:border-neutral-800'] //'border', 'rounded-md',
})

const getContainerClass = computed(() => {
  return [
    'h-full',
    { 'abc': !isMobile.value && !collapsed.value },
  ]
})
</script>

<template>
  <div class="  dark:bg-[#24272e] transition-all p-0"  :class="[isMobile ? 'h55' : 'h-full' ]">
    <div class="h-full overflow-hidden" :class="getMobileClass">
      <NLayout class="z-40 transition" :class="getContainerClass" has-sider>
        <aiSider v-if="!isMobile"/>
        <Sider />
        <NLayoutContent class="h-full">
          <RouterView v-slot="{ Component, route }">
            <component :is="Component" :key="route.fullPath" />
          </RouterView>
        </NLayoutContent>
      </NLayout>
    </div>
    <Permission :visible="needPermission" />
  </div>
   <aiMobileMenu v-if="isMobile"   />

  <!-- 余额警告悬浮窗 -->
  <BalanceWarning />

  <aiFooter/>
</template>

<style  >
.h55{
  height: calc(100% - 55px);
}
</style>
