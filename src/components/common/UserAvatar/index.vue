<script setup lang='ts'>
import { computed, defineAsyncComponent, ref } from 'vue'
import { NAvatar } from 'naive-ui'
import { useUserStore } from '@/store'
import { SvgIcon } from '@/components/common'
import defaultAvatar from '@/assets/avatar.jpg'
import { isString } from '@/utils/is'

const Setting = defineAsyncComponent(() => import('@/components/common/Setting/index.vue'))

const userStore = useUserStore()
const showSetting = ref(false)

const userInfo = computed(() => userStore.userInfo)

function openSettings() {
  showSetting.value = true
}
</script>

<template>
  <div class="flex items-center overflow-hidden">
    <div class="w-10 h-10 overflow-hidden rounded-full shrink-0">
      <template v-if="isString(userInfo.avatar) && userInfo.avatar.length > 0">
        <NAvatar
          size="large"
          round
          :src="userInfo.avatar"
          :fallback-src="defaultAvatar"
        />
      </template>
      <template v-else>
        <NAvatar size="large" round :src="defaultAvatar" />
      </template>
    </div>
    <div class="flex-1 min-w-0 ml-2">
      <h2 class="overflow-hidden font-bold text-md text-ellipsis whitespace-nowrap">
        {{ userInfo.name ?? 'AI绘图' }}
      </h2>
      <p class="overflow-hidden text-xs text-gray-500 text-ellipsis whitespace-nowrap">
        <span
          v-if="isString(userInfo.description) && userInfo.description !== ''"
          v-html="userInfo.description"
        />
        <span v-else>零素觉醒AI工具平台</span>
      </p>
    </div>
    <!-- 设置按钮 -->
    <div class="flex-shrink-0 ml-2">
      <button
        @click="openSettings"
        class="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="设置"
      >
        <SvgIcon icon="ri:settings-3-line" class="text-lg text-gray-600 dark:text-gray-400" />
      </button>
    </div>
  </div>

  <!-- 设置弹窗 -->
  <Setting v-if="showSetting" v-model:visible="showSetting" />
</template>
