<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { NEmpty, useMessage } from 'naive-ui'
import UnifiedModelCard from './UnifiedModelCard.vue'
import { UnifiedModelStore } from '@/api/modelStore'
import { convertModel, fetchTripoTaskStatus, refreshTripoTask } from '@/api/tripo'
import { homeStore } from '@/store'
import { t } from '@/locales'

const store = new UnifiedModelStore()
const list = ref<any[]>([])
const ms = useMessage()

// ✅ 修改为异步函数,从COS和localStorage合并加载
const refresh = async () => {
  console.log('🔄 [UnifiedModelList] Refreshing from COS + localStorage...')

  try {
    // ✅ 使用 getAllWithCOS() 合并COS和本地数据
    const allModels = await store.getAllWithCOS()
    list.value = allModels

    console.log('📦 [UnifiedModelList] Total models:', allModels.length)

    // 输出数据来源统计
    if (allModels.length > 0) {
      const sourceCount: Record<string, number> = { cos: 0, local: 0 }
      allModels.forEach(model => {
        const source = model.extra?.source || 'unknown'
        if (source === 'cos' || source === 'local') {
          sourceCount[source]++
        }
      })
      console.log(`  📊 数据来源: COS ${sourceCount.cos}个, 本地 ${sourceCount.local}个`)
    }
  } catch (error) {
    console.error('[UnifiedModelList] ❌ 刷新失败:', error)
    // 降级到仅使用本地数据
    list.value = store.getAll()
  }
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

const handleConvert = async (id: string) => {
  const originalTask = store.getAll().find(t => t.id === id)
  if (!originalTask) {
    ms.error('找不到原始任务')
    return
  }

  try {
    ms.info('开始转换为 STL 格式...')
    const stlTaskId = await convertModel({
      original_model_task_id: id,
      format: 'STL',
      pivot_to_center_bottom: true,
    })

    ms.success('STL 转换任务已创建，正在处理...')

    // 轮询 STL 转换任务，成功后更新原任务
    const pollInterval = setInterval(async () => {
      try {
        const stlTask = await fetchTripoTaskStatus(stlTaskId)

        if (stlTask.status === 'success') {
          clearInterval(pollInterval)
          // 将 STL URL 添加到原任务
          store.save({
            ...originalTask,
            stlModelUrl: stlTask.output?.model,
          })
          refresh()
          ms.success('STL 转换完成！')
        }
        else if (stlTask.status === 'failed') {
          clearInterval(pollInterval)
          ms.error('STL 转换失败')
        }
      }
      catch (error) {
        clearInterval(pollInterval)
        ms.error('查询转换状态失败')
      }
    }, 3000)

    // 30秒超时
    setTimeout(() => {
      clearInterval(pollInterval)
    }, 30000)
  }
  catch (error: any) {
    ms.error(`转换失败: ${error.message || error}`)
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
        @convert="handleConvert(task.id)"
      />
    </div>
  </div>
  <div v-else class="w-full h-full flex justify-center items-center">
    <NEmpty :description="t('model.empty')" />
  </div>
</template>
