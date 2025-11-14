<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NButtonGroup, NCard, NImage, NPopconfirm, NProgress, NTag, useMessage } from 'naive-ui'
import type { UnifiedModelTask } from '@/api/modelStore'
import { t } from '@/locales'

const props = defineProps<{ task: UnifiedModelTask }>()
const emit = defineEmits(['delete', 'refresh'])

const ms = useMessage()

const statusMap = computed(() => {
  switch (props.task.status) {
    case 'success':
      return { type: 'success', label: t('model.status.success') }
    case 'processing':
      return { type: 'warning', label: t('model.status.processing') }
    case 'pending':
      return { type: 'info', label: t('model.status.pending') }
    default:
      return { type: 'error', label: t('model.status.failed') }
  }
})

const downloads = computed(() => {
  return [
    { label: t('model.download.model'), url: props.task.modelUrl },
    { label: t('model.download.base'), url: props.task.baseModelUrl },
    { label: t('model.download.pbr'), url: props.task.pbrModelUrl },
  ].filter(item => !!item.url)
})

const createdAtText = computed(() => new Date(props.task.created_at).toLocaleString())

const sourceLabel = computed(() => props.task.sourceType === 'multiview_to_model'
  ? t('model.multiviewTab')
  : t('model.imageTab'))

const handleDelete = () => emit('delete', props.task.id)
const handleRefresh = () => emit('refresh', props.task.id)

const handleCopy = async () => {
  if (!props.task.modelUrl) {
    ms.warning(t('model.toast.noModel'))
    return
  }
  await navigator.clipboard.writeText(props.task.modelUrl)
  ms.success(t('model.toast.copied'))
}
</script>

<template>
  <NCard size="small" :title="`Tripo · ${sourceLabel}`" class="h-full flex flex-col">
    <template #header-extra>
      <NTag size="small" :type="statusMap.type as any">{{ statusMap.label }}</NTag>
    </template>

    <div class="space-y-3 flex-1">
      <div class="h-48 bg-gray-100 dark:bg-[#1f1f24] rounded flex items-center justify-center overflow-hidden">
        <NImage
          v-if="task.preview"
          :src="task.preview"
          class="w-full h-full object-cover"
          lazy
        />
        <div v-else class="text-xs text-gray-500">{{ t('model.previewPlaceholder') }}</div>
      </div>

      <div class="space-y-1 text-xs text-gray-600 dark:text-gray-400">
        <div>{{ t('model.versionLabel') }}：{{ task.modelVersion || '-' }}</div>
        <div v-if="task.notes">{{ t('model.noteLabel') }}：{{ task.notes }}</div>
        <div v-if="task.progress !== undefined && task.status !== 'success' && task.status !== 'failed'">
          <NProgress :percentage="task.progress || 0" type="line" :height="10" />
        </div>
        <div>{{ t('model.createdAt') }}：{{ createdAtText }}</div>
      </div>

      <div class="flex flex-wrap gap-2">
        <NButtonGroup v-if="downloads.length">
          <NButton
            v-for="item in downloads"
            :key="item.label"
            tag="a"
            target="_blank"
            :href="item.url"
            size="small"
          >
            {{ item.label }}
          </NButton>
        </NButtonGroup>
        <NButton v-if="task.modelUrl" size="small" tertiary @click="handleCopy">
          {{ t('model.download.copy') }}
        </NButton>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between">
        <NButton size="tiny" tertiary @click="handleRefresh">{{ t('model.actions.refresh') }}</NButton>
        <NPopconfirm :positive-text="t('mj.confirmDelete')" :negative-text="t('common.cancel')" @positive-click="handleDelete">
          <template #trigger>
            <NButton size="tiny" quaternary type="error">{{ t('model.actions.delete') }}</NButton>
          </template>
          {{ t('model.confirmDelete') }}
        </NPopconfirm>
      </div>
    </template>
  </NCard>
</template>
