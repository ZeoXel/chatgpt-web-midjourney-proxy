<script setup lang='ts'>
import type { CSSProperties } from 'vue'
import { computed, ref, watch, provide } from 'vue'
import { NButton, NLayoutSider, useDialog } from 'naive-ui'
import List from './List.vue'
import Footer from './Footer.vue'
import { useAppStore, useChatStore } from '@/store'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { PromptStore, SvgIcon } from '@/components/common'
import { t } from '@/locales'

const appStore = useAppStore()
const chatStore = useChatStore()

const dialog = useDialog()

const { isMobile } = useBasicLayout()
const show = ref(false)

// 批量删除相关状态
const isBatchDeleteMode = ref(false)
const selectedItems = ref<Set<number>>(new Set())

const collapsed = computed(() => appStore.siderCollapsed)

function handleAdd() {
  chatStore.addHistory({ title: 'New Chat', uuid: Date.now(), isEdit: false })
  if (isMobile.value)
    appStore.setSiderCollapsed(true)
}

function handleUpdateCollapsed() {
  appStore.setSiderCollapsed(!collapsed.value)
}

// 新的批量删除处理函数
function handleBatchDelete() {
  if (!isBatchDeleteMode.value) {
    // 进入批量删除模式
    isBatchDeleteMode.value = true
    selectedItems.value.clear()
  } else {
    // 执行批量删除
    if (selectedItems.value.size === 0) {
      // 如果没有选择任何项，退出批量删除模式
      isBatchDeleteMode.value = false
      return
    }

    // 删除选中的对话
    const sortedIndexes = Array.from(selectedItems.value)
      .map(uuid => chatStore.history.findIndex(item => item.uuid === uuid))
      .filter(index => index !== -1)
      .sort((a, b) => b - a) // 从后往前删除，避免索引错乱

    sortedIndexes.forEach(index => {
      chatStore.deleteHistory(index)
    })

    // 退出批量删除模式
    isBatchDeleteMode.value = false
    selectedItems.value.clear()

    if (isMobile.value)
      appStore.setSiderCollapsed(true)
  }
}

// 保留原有的清空所有对话功能（备用）
function handleClearAll() {
  dialog.warning({
    title: t('chat.deleteMessage'),
    content: t('chat.clearHistoryConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.clearHistory()
      if (isMobile.value)
        appStore.setSiderCollapsed(true)
    },
  })
}

const getMobileClass = computed<CSSProperties>(() => {
  if (isMobile.value) {
    return {
      position: 'fixed',
      zIndex: 50,
      height: '100%',
    }
  }
  return {}
})

const mobileSafeArea = computed(() => {
  if (isMobile.value) {
    return {
      paddingBottom: 'env(safe-area-inset-bottom)',
    }
  }
  return {}
})

// 提供状态给子组件
provide('batchDeleteMode', isBatchDeleteMode)
provide('selectedItems', selectedItems)

watch(
  isMobile,
  (val) => {
    appStore.setSiderCollapsed(val)
  },
  {
    immediate: true,
    flush: 'post',
  },
)
</script>

<template>
  <NLayoutSider
    :collapsed="collapsed"
    :collapsed-width="0"
    :width="260"
    :show-trigger="isMobile ? false : 'arrow-circle'"
    collapse-mode="transform"
    
    bordered
    :style="getMobileClass"
    @update-collapsed="handleUpdateCollapsed"
  >
    <div class="flex flex-col h-full" :style="mobileSafeArea">
      <main class="flex flex-col flex-1 min-h-0">
        <div class="p-4">
          <NButton dashed block @click="handleAdd">
            {{ $t('chat.newChatButton') }}
          </NButton>
        </div>
        <div class="flex-1 min-h-0 pb-4 overflow-hidden">
          <List />
        </div>
        <div class="flex items-center p-4 space-x-4">
          <div class="flex-1">
            <NButton block @click="show = true">
              {{ $t('store.siderButton') }}
            </NButton>
          </div>
          <NButton
            @click="handleBatchDelete"
            :type="isBatchDeleteMode ? 'error' : 'default'"
            :style="{ backgroundColor: isBatchDeleteMode ? '#f56565' : undefined }"
          >
            <SvgIcon icon="ri:close-circle-line" size="md" />
          </NButton>
        </div>
      </main>
      <Footer />
    </div>
  </NLayoutSider>
  <template v-if="isMobile">
    <div v-show="!collapsed" class="fixed inset-0 z-40 w-full h-full bg-black/40" @click="handleUpdateCollapsed" />
  </template>
  <PromptStore v-model:visible="show" />
</template>
