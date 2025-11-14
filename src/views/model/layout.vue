<script setup lang="ts">
import { computed } from 'vue'
import { NLayout, NLayoutContent } from 'naive-ui'
import { useRouter, useRoute } from 'vue-router'
import Permission from '../chat/layout/Permission.vue'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { homeStore, useAppStore, useAuthStore, useChatStore } from '@/store'
import { aiSider, aiFooter } from '@/views/mj'
import aiMobileMenu from '@/views/mj/aiMobileMenu.vue'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const chatStore = useChatStore()
const authStore = useAuthStore()

if (route.name !== 'model') {
  setTimeout(() => {
    router.replace({ name: route.name ?? 'model', params: { uuid: chatStore.active } })
  }, 0)
}

homeStore.setMyData({ local: route.name ?? 'model' })
const { isMobile } = useBasicLayout()

const collapsed = computed(() => appStore.siderCollapsed)
const needPermission = computed(() => !!authStore.session?.auth && !authStore.token)

const getMobileClass = computed(() => isMobile.value ? ['rounded-none', 'shadow-none'] : ['shadow-md', 'dark:border-neutral-800'])

const getContainerClass = computed(() => ['h-full', { abc: !isMobile.value && !collapsed.value }])
</script>

<template>
  <div class="dark:bg-[#24272e] transition-all p-0" :class="[isMobile ? 'h55' : 'h-full']">
    <div class="h-full overflow-hidden" :class="getMobileClass">
      <NLayout class="z-40 transition" :class="getContainerClass" has-sider :sider-placement="isMobile ? 'left' : 'right'">
        <aiSider v-if="!isMobile" />
        <NLayoutContent class="h-full">
          <RouterView v-slot="{ Component, route }">
            <component :is="Component" :key="route.fullPath" />
          </RouterView>
        </NLayoutContent>
      </NLayout>
    </div>
    <Permission :visible="needPermission" />
  </div>
  <aiMobileMenu v-if="isMobile" />
  <aiFooter />
</template>

<style>
.h55 {
  height: calc(100% - 55px);
}
</style>
