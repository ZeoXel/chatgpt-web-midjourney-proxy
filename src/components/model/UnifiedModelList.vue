<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { NEmpty, useMessage } from 'naive-ui'
import UnifiedModelCard from './UnifiedModelCard.vue'
import { UnifiedModelStore } from '@/api/modelStore'
import { refreshTripoTask } from '@/api/tripo'
import { homeStore } from '@/store'
import { t } from '@/locales'

const store = new UnifiedModelStore()
const list = ref(store.getAll())
const ms = useMessage()

const refresh = () => {
  store.cleanup()
  list.value = store.getAll()
}

watch(() => homeStore.myData.act, (act) => {
  if (act === 'TripoFeed')
    refresh()
})

const handleDelete = (id: string) => {
  if (store.delete(id)) {
    ms.success(t('common.deleteSuccess'))
    refresh()
  }
}

const handleRefresh = async (id: string) => {
  try {
    await refreshTripoTask(id)
    ms.success(t('model.toast.refreshed'))
  }
  catch (error: any) {
    ms.error(error.message || error)
  }
  finally {
  }
}

onMounted(() => {
  refresh()
  homeStore.setMyData({ ms })
})
</script>

<template>
  <div v-if="list.length" class="p-4">
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      <UnifiedModelCard
        v-for="task in list"
        :key="task.id"
        :task="task"
        @delete="handleDelete(task.id)"
        @refresh="handleRefresh(task.id)"
      />
    </div>
  </div>
  <div v-else class="w-full h-full flex justify-center items-center">
    <NEmpty :description="t('model.empty')" />
  </div>
</template>
