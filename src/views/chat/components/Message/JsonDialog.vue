<template>
  <NModal
    v-model:show="showModal"
    preset="card"
    :title="t('chat.jsonInfo')"
    :bordered="false"
    style="width: 90%; max-width: 800px"
    class="json-dialog"
  >
    <div class="json-content">
      <NScrollbar style="max-height: 60vh">
        <NCode
          :code="formattedJson"
          language="json"
          show-line-numbers
          word-wrap
        />
      </NScrollbar>
      
      <div class="json-actions">
        <NSpace justify="end">
          <NButton @click="copyJson" type="primary">
            <template #icon>
              <SvgIcon icon="ri:file-copy-2-line" />
            </template>
            {{ t('common.copy') }}
          </NButton>
          <NButton @click="downloadJson" type="info">
            <template #icon>
              <SvgIcon icon="ri:download-2-line" />
            </template>
            {{ t('common.download') }}
          </NButton>
          <NButton @click="showModal = false">
            {{ t('common.close') }}
          </NButton>
        </NSpace>
      </div>
    </div>
  </NModal>
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue'
import { NModal, NCode, NScrollbar, NButton, NSpace, useMessage } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { t } from '@/locales'
import { copyToClip } from '@/utils/copy'

interface Props {
  visible: boolean
  jsonData: any
}

const props = defineProps<Props>()
const emit = defineEmits(['update:visible'])
const message = useMessage()

const showModal = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const formattedJson = computed(() => {
  try {
    // 构建完整的JSON信息对象
    const fullJsonData = {
      // 基本消息信息
      message: {
        dateTime: props.jsonData?.dateTime,
        text: props.jsonData?.text,
        inversion: props.jsonData?.inversion,
        error: props.jsonData?.error,
        loading: props.jsonData?.loading,
        model: props.jsonData?.model,
      },
      // 请求信息
      request: props.jsonData?.requestOptions,
      // 响应数据（如果有）
      response: props.jsonData?.responseData || props.jsonData?.conversationOptions,
      // MJ相关信息（如果有）
      mjInfo: props.jsonData?.mjID ? {
        mjID: props.jsonData?.mjID,
        opt: props.jsonData?.opt,
      } : undefined,
      // 其他元数据
      metadata: {
        uuid: props.jsonData?.uuid,
        index: props.jsonData?.index,
        myid: props.jsonData?.myid,
        logo: props.jsonData?.logo,
      }
    }
    
    // 移除undefined的字段
    const cleanData = JSON.parse(JSON.stringify(fullJsonData))
    
    return JSON.stringify(cleanData, null, 2)
  } catch (error) {
    return '{}'
  }
})

const copyJson = async () => {
  try {
    await copyToClip(formattedJson.value)
    message.success(t('common.copySuccess'))
  } catch (error) {
    message.error(t('common.copyFailed'))
  }
}

const downloadJson = () => {
  const blob = new Blob([formattedJson.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `chat-response-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  message.success(t('common.downloadSuccess'))
}
</script>

<style scoped>
.json-dialog {
  .json-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .json-actions {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--n-border-color);
  }
}
</style>