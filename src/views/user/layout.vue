<script setup lang='ts'>
import { computed } from 'vue'
import { NLayout, NLayoutContent, useMessage } from 'naive-ui'
import { useRouter, useRoute } from 'vue-router'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { homeStore, useAppStore } from '@/store'
import { aiSider, aiFooter } from '@/views/mj'
import aiMobileMenu from '@/views/mj/aiMobileMenu.vue'
import Sider from './sider/index.vue'

const router = useRouter()
const appStore = useAppStore()
const route = useRoute()
const ms = useMessage()

homeStore.setMyData({ local: 'User' })
const { isMobile } = useBasicLayout()

const collapsed = computed(() => appStore.siderCollapsed)

const getMobileClass = computed(() => {
  if (isMobile.value)
    return ['rounded-none', 'shadow-none']
  return ['shadow-md', 'dark:border-neutral-800']
})

const getContainerClass = computed(() => {
  return [
    'h-full',
    { 'abc': !isMobile.value && !collapsed.value },
  ]
})
</script>

<template>
  <div class="dark:bg-[#24272e] transition-all p-0" :class="[isMobile ? 'h55' : 'h-full']">
    <div class="h-full overflow-hidden" :class="getMobileClass">
      <NLayout class="z-40 transition" :class="getContainerClass" has-sider>
        <aiSider v-if="!isMobile" />
        <Sider />
        <NLayoutContent class="h-full">
          <RouterView v-slot="{ Component, route }">
            <component :is="Component" :key="route.fullPath" />
          </RouterView>
        </NLayoutContent>
      </NLayout>
    </div>
  </div>
  <aiMobileMenu v-if="isMobile" />
  <aiFooter />
</template>

<style>
.h55 {
  height: calc(100% - 55px);
}
</style>