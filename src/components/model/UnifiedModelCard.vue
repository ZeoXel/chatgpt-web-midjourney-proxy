<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NButtonGroup, NCard, NImage, NPopconfirm, NProgress, NTag, useMessage, NTooltip } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import type { UnifiedModelTask } from '@/api/modelStore'
import { t } from '@/locales'

const props = defineProps<{ task: UnifiedModelTask }>()
const emit = defineEmits(['delete', 'refresh', 'convert'])

const ms = useMessage()

// 是否可以转换（成功状态 且 不是转换任务 且 还没有 STL）
const canConvert = computed(() => {
  return props.task.status === 'success'
    && props.task.sourceType !== 'convert_model'
    && !props.task.stlModelUrl
})

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
  const items = [
    { label: t('model.download.model'), url: props.task.modelUrl },
    { label: t('model.download.base'), url: props.task.baseModelUrl },
    { label: t('model.download.pbr'), url: props.task.pbrModelUrl },
  ]

  // 如果有 STL URL，添加到下载列表
  if (props.task.stlModelUrl) {
    items.push({ label: 'STL', url: props.task.stlModelUrl })
  }

  return items.filter(item => !!item.url)
})

const createdAtText = computed(() => new Date(props.task.created_at).toLocaleString())

const sourceLabel = computed(() => props.task.sourceType === 'multiview_to_model'
  ? t('model.multiviewTab')
  : t('model.imageTab'))

const handleDelete = () => emit('delete', props.task.id)
const handleRefresh = () => emit('refresh', props.task.id)
const handleConvert = () => emit('convert', props.task.id)

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
  <NCard size="small" class="h-full flex flex-col">

    <div class="space-y-3 flex-1">
      <div class="relative flex items-center justify-center bg-white bg-opacity-10 rounded-[16px] overflow-hidden aspect-[16/8.85]">
        <NImage
          v-if="task.preview"
          :src="task.preview"
          class="w-full h-full object-cover"
          lazy
        />
        <div v-else class="text-xs text-gray-500">{{ t('model.previewPlaceholder') }}</div>
      </div>

      <!-- 信息栏：左侧服务/状态/来源，右侧操作按钮组 -->
      <div class="flex justify-between items-center mt-2">
        <section class="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          <span
            class="text-xs px-2 py-0.5 rounded"
            style="background-color: rgba(68,95,246,0.12); color: #445ff6;"
          >
            Tripo3D
          </span>
          <NTag v-if="task.status !== 'success'" size="small" :type="statusMap.type as any">{{ statusMap.label }}</NTag>
          <span class="text-xs text-gray-400 truncate">{{ sourceLabel }}</span>
        </section>

        <section class="flex justify-end items-center flex-shrink-0">
          <NButtonGroup size="tiny">
            <!-- 多个下载项：图标 + 悬停提示 -->
            <template v-for="item in downloads" :key="item.label">
              <NTooltip trigger="hover" placement="bottom">
                <template #trigger>
                  <NButton tag="a" target="_blank" :href="item.url" size="tiny" round ghost>
                    <SvgIcon icon="mdi:download" size="xs" />
                  </NButton>
                </template>
                <span>{{ item.label }}</span>
              </NTooltip>
            </template>

            <!-- 复制链接 -->
            <NTooltip v-if="task.modelUrl" trigger="hover" placement="bottom">
              <template #trigger>
                <NButton size="tiny" round ghost @click="handleCopy">
                  <SvgIcon icon="mdi:content-copy" size="xs" />
                </NButton>
              </template>
              <span>{{ t('model.download.copy') }}</span>
            </NTooltip>

            <!-- 转换为 STL -->
            <NTooltip v-if="canConvert" trigger="hover" placement="bottom">
              <template #trigger>
                <NButton size="tiny" round ghost @click="handleConvert">
                  <SvgIcon icon="mdi:file-sync" size="xs" />
                </NButton>
              </template>
              <span>转换为 STL</span>
            </NTooltip>

            <!-- 刷新 -->
            <NTooltip trigger="hover" placement="bottom">
              <template #trigger>
                <NButton size="tiny" round ghost @click="handleRefresh">
                  <SvgIcon icon="mdi:refresh" size="xs" />
                </NButton>
              </template>
              <span>{{ t('model.actions.refresh') }}</span>
            </NTooltip>

            <!-- 删除（确认） -->
            <NPopconfirm :positive-text="t('mj.confirmDelete')" :negative-text="t('common.cancel')" @positive-click="handleDelete">
              <template #trigger>
                <NTooltip trigger="hover" placement="bottom">
                  <template #trigger>
                    <NButton size="tiny" round ghost class="hover:text-red-500">
                      <SvgIcon icon="mdi:delete" size="xs" />
                    </NButton>
                  </template>
                  <span>{{ t('model.actions.delete') }}</span>
                </NTooltip>
              </template>
              {{ t('model.confirmDelete') }}
            </NPopconfirm>
          </NButtonGroup>
        </section>
      </div>

      <div class="space-y-1 text-xs text-gray-600 dark:text-gray-400">
        <div>{{ t('model.versionLabel') }}：{{ task.modelVersion || '-' }}</div>
        <div v-if="task.notes">{{ t('model.noteLabel') }}：{{ task.notes }}</div>
        <div v-if="task.progress !== undefined && task.status !== 'success' && task.status !== 'failed'">
          <NProgress :percentage="task.progress || 0" type="line" :height="10" />
        </div>
        <div>{{ t('model.createdAt') }}：{{ createdAtText }}</div>
      </div>
    </div>
  </NCard>
</template>
