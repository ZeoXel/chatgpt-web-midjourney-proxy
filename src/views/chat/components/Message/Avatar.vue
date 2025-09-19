<script lang="ts" setup>
import { computed } from 'vue'
import { NAvatar } from 'naive-ui'
import { useUserStore } from '@/store'
import { isString } from '@/utils/is'
import { SvgIcon } from '@/components/common'
import defaultAvatar from '@/assets/avatar.jpg'

interface Props {
  image?: boolean
  logo?:string
}
defineProps<Props>()

const userStore = useUserStore()

const avatar = computed(() => userStore.userInfo.avatar)
</script>

<template>
  
   <NAvatar v-if="logo"     :src="logo" />
  <template v-else-if="image">
    <div class="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white">
      <SvgIcon icon="ri:user-line" size="18" />
    </div>
  </template>
  <div v-else class="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white">
    <SvgIcon icon="ri:robot-line" size="18" />
  </div>
</template>
