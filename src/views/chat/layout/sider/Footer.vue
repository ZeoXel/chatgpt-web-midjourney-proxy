<script setup lang='ts'>
import { defineAsyncComponent, ref } from 'vue'
import { NButton, NTooltip } from 'naive-ui'
import { UserAvatar, UserBalance, UserInfo, SvgIcon } from '@/components/common'
import { useRouter } from 'vue-router'
import { isDisableMenu } from '@/api'
import { t } from '@/locales'

const Setting = defineAsyncComponent(() => import('@/components/common/Setting/index.vue'))

const show = ref(false)
const showUserInfo = ref(false)
const router = useRouter()

function handleUserClick() {
  showUserInfo.value = true
}

function navigateTo(path: string) {
  router.push(path)
}
</script>

<template>
  <footer class="flex flex-col min-w-0 overflow-hidden border-t dark:border-neutral-800">
    <!-- 功能导航菜单 -->
    <div class="px-2 py-2 border-b dark:border-neutral-700">
      <div class="flex justify-center gap-1">
        <!-- 绘画 -->
        <NTooltip v-if="!isDisableMenu('draws')" placement="top">
          <template #trigger>
            <NButton
              size="small"
              quaternary
              circle
              @click="navigateTo('/draw')"
              class="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <template #icon>
                <SvgIcon icon="ic:outline-palette" class="text-lg" />
              </template>
            </NButton>
          </template>
          {{ t('mjtab.drawinfo') }}
        </NTooltip>

        <!-- 音乐 -->
        <NTooltip v-if="!isDisableMenu('music')" placement="top">
          <template #trigger>
            <NButton
              size="small"
              quaternary
              circle
              @click="navigateTo('/music')"
              class="text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
            >
              <template #icon>
                <SvgIcon icon="arcticons:wynk-music" class="text-lg" />
              </template>
            </NButton>
          </template>
          {{ t('suno.menuinfo') }}
        </NTooltip>

        <!-- 视频 -->
        <NTooltip v-if="!isDisableMenu('video')" placement="top">
          <template #trigger>
            <NButton
              size="small"
              quaternary
              circle
              @click="navigateTo('/video')"
              class="text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
            >
              <template #icon>
                <SvgIcon icon="ri:video-on-line" class="text-lg" />
              </template>
            </NButton>
          </template>
          {{ t('video.menuinfo') }}
        </NTooltip>

        <!-- 设置 -->
        <NTooltip placement="top">
          <template #trigger>
            <NButton
              size="small"
              quaternary
              circle
              @click="show = true"
              class="text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/20"
            >
              <template #icon>
                <SvgIcon icon="ri:settings-4-line" class="text-lg" />
              </template>
            </NButton>
          </template>
          {{ t('setting.title') }}
        </NTooltip>
      </div>
    </div>
    
    <!-- 用户余额显示 -->
    <div class="px-4 pt-2">
      <UserBalance @click="handleUserClick" />
    </div>
    
    <!-- 用户头像和设置 -->
    <div class="flex items-center justify-between min-w-0 p-4 overflow-hidden">
      <div class="flex-1 flex-shrink-0 overflow-hidden">
        <UserAvatar />
      </div>

      <!-- 用户信息按钮 -->
      <div class="flex gap-2">
        <NButton 
          size="small" 
          quaternary 
          circle 
          @click="handleUserClick"
          title="用户信息"
        >
          <template #icon>
            <SvgIcon icon="ri:user-line" />
          </template>
        </NButton>
      </div>
    </div>

    <Setting v-if="show" v-model:visible="show" />
    <UserInfo v-model="showUserInfo" />
  </footer>
</template>
