<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { NButton, NCollapseTransition, NDivider, NForm, NFormItem, NInput, NSelect, NSwitch, NTabs, NTabPane, useMessage } from 'naive-ui'
import { createImageToModelTask, createMultiviewToModelTask, tripoFeed, tripoUploadImage } from '@/api/tripo'
import { gptServerStore, homeStore } from '@/store'
import { t } from '@/locales'

// 单图生模型支持的版本
const imageVersionOptions = [
  { label: 'Turbo-v1.0-20250506', value: 'Turbo-v1.0-20250506' },
  { label: 'v3.0-20250812', value: 'v3.0-20250812' },
  { label: 'v2.5-20250123', value: 'v2.5-20250123' },
  { label: 'v2.0-20240919', value: 'v2.0-20240919' },
]

// 多视角生模型支持的版本（v3.0 不支持 multiview）
const multiviewVersionOptions = [
  { label: 'Turbo-v1.0-20250506', value: 'Turbo-v1.0-20250506' },
  { label: 'v2.5-20250123', value: 'v2.5-20250123' },
  { label: 'v2.0-20240919', value: 'v2.0-20240919' },
]

const ms = useMessage()
homeStore.setMyData({ ms })

const activeTab = ref(gptServerStore.myData.TAB_MODEL || 'image')

const singleFileInput = ref<HTMLInputElement | null>(null)
const multiFileInputs = ref<Record<string, HTMLInputElement | null>>({})
const showImageAdvanced = ref(false)
const showMultiviewAdvanced = ref(false)

const imageForm = reactive({
  modelVersion: 'v2.5-20250123',
  texture: true,
  pbr: true,
  quad: false,
  autoSize: false,
  smartLowPoly: false,
  modelSeed: '',
  textureSeed: '',
  textureAlignment: 'original_image',
  style: '',
  note: '',
  uploading: false,
  submitting: false,
  source: {
    fileToken: '',
    url: '',
    fileType: '',
    preview: '' as string | undefined,
  },
})

type ViewSlot = 'front' | 'left' | 'back' | 'right'

const multiviewForm = reactive({
  modelVersion: 'v2.5-20250123',
  texture: true,
  pbr: true,
  quad: false,
  smartLowPoly: false,
  faceLimit: '',
  textureSeed: '',
  textureAlignment: 'original_image',
  note: '',
  submitting: false,
  files: (['front', 'left', 'back', 'right'] as ViewSlot[]).map((key) => ({
    key,
    fileToken: '',
    url: '',
    fileType: '',
    preview: '' as string | undefined,
    uploading: false,
  })),
})

const viewLabel = (key: ViewSlot) => {
  switch (key) {
    case 'front': return t('model.views.front')
    case 'left': return t('model.views.left')
    case 'back': return t('model.views.back')
    case 'right': return t('model.views.right')
  }
}

const handleTabChange = (value: string) => {
  activeTab.value = value
  gptServerStore.setMyData({ TAB_MODEL: value })
}

const triggerSingleUpload = () => singleFileInput.value?.click()

const revokePreview = (url?: string) => {
  if (url && url.startsWith('blob:'))
    URL.revokeObjectURL(url)
}

const onSingleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  imageForm.uploading = true
  try {
    // tripoUploadImage 返回 Supabase URL
    const url = await tripoUploadImage(file)
    revokePreview(imageForm.source.preview)
    imageForm.source.preview = URL.createObjectURL(file)
    imageForm.source.url = url  // 存储 Supabase URL
    imageForm.source.fileToken = ''  // 清空 token
    imageForm.source.fileType = file.type
    ms.success(t('model.toast.uploadSuccess'))
  }
  catch (error: any) {
    ms.error(error.message || error)
  }
  finally {
    imageForm.uploading = false
    target.value = ''
  }
}

const onMultiviewFileChange = async (event: Event, view: ViewSlot) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const slot = multiviewForm.files.find(item => item.key === view)
  if (!slot) return
  slot.uploading = true
  try {
    // tripoUploadImage 返回 Supabase URL
    const url = await tripoUploadImage(file)
    revokePreview(slot.preview)
    slot.preview = URL.createObjectURL(file)
    slot.url = url  // 存储 Supabase URL
    slot.fileToken = ''  // 清空 token
    slot.fileType = file.type
    ms.success(`${viewLabel(view)} ${t('model.toast.uploadSuccess')}`)
  }
  catch (error: any) {
    ms.error(error.message || error)
  }
  finally {
    slot.uploading = false
    target.value = ''
  }
}

const buildSinglePayload = () => {
  if (!imageForm.source.url) {
    throw new Error(t('model.toast.imageRequired'))
  }
  return {
    model_version: imageForm.modelVersion,
    texture: imageForm.texture,
    pbr: imageForm.pbr,
    quad: imageForm.quad,
    auto_size: imageForm.autoSize,
    smart_low_poly: imageForm.smartLowPoly,
    model_seed: imageForm.modelSeed ? Number(imageForm.modelSeed) : undefined,
    texture_seed: imageForm.textureSeed ? Number(imageForm.textureSeed) : undefined,
    texture_alignment: imageForm.textureAlignment,
    style: imageForm.style || undefined,
    note: imageForm.note,
    file: {
      url: imageForm.source.url,  // 使用 Supabase URL
      type: imageForm.source.fileType?.split('/')[1] || 'jpeg',  // 简化格式: image/jpeg → jpeg
    },
  }
}

const buildMultiviewPayload = () => {
  const filled = multiviewForm.files.filter(item => item.url)
  if (!filled.length || !filled.some(item => item.key === 'front'))
    throw new Error(t('model.toast.multiviewFront'))
  if (filled.length < 2)
    throw new Error(t('model.toast.multiviewMin'))

  // Tripo API 要求 files 是 4 元素数组: [front, left, back, right]
  // 需要传递所有视角信息，包括 view 字段用于后端识别顺序
  return {
    model_version: multiviewForm.modelVersion,
    texture: multiviewForm.texture,
    pbr: multiviewForm.pbr,
    quad: multiviewForm.quad,
    smart_low_poly: multiviewForm.smartLowPoly,
    face_limit: multiviewForm.faceLimit ? Number(multiviewForm.faceLimit) : undefined,
    texture_seed: multiviewForm.textureSeed ? Number(multiviewForm.textureSeed) : undefined,
    texture_alignment: multiviewForm.textureAlignment,
    note: multiviewForm.note,
    files: multiviewForm.files.map(item => ({
      view: item.key,  // 保留 view 用于后端重排序
      url: item.url || '',  // 空字符串表示缺失的视角
      type: item.fileType?.split('/')[1] || 'jpeg',
    })),
  }
}

const submitImageTask = async () => {
  try {
    imageForm.submitting = true
    const payload = buildSinglePayload()
    const taskId = await createImageToModelTask(payload)
    ms.success(t('model.toast.submitted'))
    await tripoFeed(taskId, {
      sourceType: 'image_to_model',
      note: imageForm.note,
      modelVersion: imageForm.modelVersion,
      inputs: [
        {
          label: 'image',
          token: '',
          url: imageForm.source.url,
          preview: imageForm.source.preview,
        },
      ],
    })
  }
  catch (error: any) {
    ms.error(error.message || error)
  }
  finally {
    imageForm.submitting = false
  }
}

const submitMultiviewTask = async () => {
  try {
    multiviewForm.submitting = true
    const payload = buildMultiviewPayload()
    const taskId = await createMultiviewToModelTask(payload)
    ms.success(t('model.toast.submitted'))
    await tripoFeed(taskId, {
      sourceType: 'multiview_to_model',
      note: multiviewForm.note,
      modelVersion: multiviewForm.modelVersion,
      inputs: multiviewForm.files
        .filter(item => item.url)
        .map(item => ({
          label: item.key,
          token: '',
          url: item.url,
          preview: item.preview,
        })),
    })
  }
  catch (error: any) {
    ms.error(error.message || error)
  }
  finally {
    multiviewForm.submitting = false
  }
}

const setMultiInputRef = (key: string, el: HTMLInputElement | null) => {
  multiFileInputs.value[key] = el
}

const triggerMultiviewUpload = (key: string) => {
  multiFileInputs.value[key]?.click()
}
</script>

<template>
  <div class="p-4 space-y-4">
    <div>
      <div class="text-base font-semibold mb-1">{{ t('model.menu') }}</div>
      <p class="text-xs text-gray-500">Tripo3D · {{ t('model.subtitle') }}</p>
    </div>

    <NTabs type="line" :default-value="activeTab" @update:value="handleTabChange" animated>
      <NTabPane :name="'image'" :tab="t('model.imageTab')">
        <NForm label-placement="top" size="small" class="space-y-2">
          <NFormItem :label="t('model.modelVersion')">
            <NSelect v-model:value="imageForm.modelVersion" :options="imageVersionOptions" />
          </NFormItem>
          <NFormItem :label="t('model.texture')">
            <div class="flex items-center justify-between w-full">
              <NSwitch v-model:value="imageForm.texture" size="small" />
              <span class="text-[11px] text-gray-500 ml-3">{{ t('model.tips.texture') }}</span>
            </div>
          </NFormItem>
          <NButton size="tiny" tertiary block @click="showImageAdvanced = !showImageAdvanced">
            {{ showImageAdvanced ? t('model.advancedHide') : t('model.advancedShow') }}
          </NButton>
          <NCollapseTransition :show="showImageAdvanced">
            <div class="mt-2 space-y-3 rounded border border-gray-200/60 dark:border-gray-700/60 p-3 bg-gray-50 dark:bg-[#1c1c23]">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-xs font-medium">{{ t('model.pbr') }}</div>
                  <p class="text-[11px] text-gray-500">{{ t('model.tips.pbr') }}</p>
                </div>
                <NSwitch v-model:value="imageForm.pbr" size="small" />
              </div>
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-xs font-medium">{{ t('model.quad') }}</div>
                  <p class="text-[11px] text-gray-500">{{ t('model.tips.quad') }}</p>
                </div>
                <NSwitch v-model:value="imageForm.quad" size="small" />
              </div>
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-xs font-medium">{{ t('model.smartLowPoly') }}</div>
                  <p class="text-[11px] text-gray-500">{{ t('model.tips.smartLowPoly') }}</p>
                </div>
                <NSwitch v-model:value="imageForm.smartLowPoly" size="small" />
              </div>
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-xs font-medium">{{ t('model.autoSize') }}</div>
                  <p class="text-[11px] text-gray-500">{{ t('model.tips.autoSize') }}</p>
                </div>
                <NSwitch v-model:value="imageForm.autoSize" size="small" />
              </div>
            </div>
          </NCollapseTransition>
          <NFormItem :label="t('model.noteLabel')">
            <NInput v-model:value="imageForm.note" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" :placeholder="t('model.notePlaceholder')" />
          </NFormItem>
          <NFormItem :label="t('model.imageInput')">
            <div class="space-y-2 w-full">
              <div class="h-[150px] border border-dashed border-gray-300 rounded flex flex-col items-center justify-center cursor-pointer" @click="triggerSingleUpload">
                <div v-if="imageForm.source.preview" class="w-full h-full">
                  <img :src="imageForm.source.preview" class="w-full h-full object-cover rounded" alt="preview" />
                </div>
                <div v-else class="text-xs text-gray-500">{{ t('model.uploadPlaceholder') }}</div>
              </div>
              <input ref="singleFileInput" type="file" class="hidden" accept="image/*" @change="onSingleFileChange" />
            </div>
          </NFormItem>
          <NButton type="primary" block :loading="imageForm.submitting" @click="submitImageTask">
            {{ t('model.actions.submit') }}
          </NButton>
        </NForm>
      </NTabPane>

      <NTabPane :name="'multiview'" :tab="t('model.multiviewTab')">
        <NForm label-placement="top" size="small" class="space-y-2">
          <NFormItem :label="t('model.modelVersion')">
            <NSelect v-model:value="multiviewForm.modelVersion" :options="multiviewVersionOptions" />
            <div class="mt-1 text-[11px] text-orange-500">
              {{ t('model.tips.multiviewVersion') }}
            </div>
          </NFormItem>
          <NFormItem :label="t('model.texture')">
            <div class="flex items-center justify-between w-full">
              <NSwitch v-model:value="multiviewForm.texture" size="small" />
              <span class="text-[11px] text-gray-500 ml-3">{{ t('model.tips.texture') }}</span>
            </div>
          </NFormItem>
          <NButton size="tiny" tertiary block @click="showMultiviewAdvanced = !showMultiviewAdvanced">
            {{ showMultiviewAdvanced ? t('model.advancedHide') : t('model.advancedShow') }}
          </NButton>
          <NCollapseTransition :show="showMultiviewAdvanced">
            <div class="mt-2 space-y-3 rounded border border-gray-200/60 dark:border-gray-700/60 p-3 bg-gray-50 dark:bg-[#1c1c23]">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-xs font-medium">{{ t('model.pbr') }}</div>
                  <p class="text-[11px] text-gray-500">{{ t('model.tips.pbr') }}</p>
                </div>
                <NSwitch v-model:value="multiviewForm.pbr" size="small" />
              </div>
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-xs font-medium">{{ t('model.quad') }}</div>
                  <p class="text-[11px] text-gray-500">{{ t('model.tips.quad') }}</p>
                </div>
                <NSwitch v-model:value="multiviewForm.quad" size="small" />
              </div>
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-xs font-medium">{{ t('model.smartLowPoly') }}</div>
                  <p class="text-[11px] text-gray-500">{{ t('model.tips.smartLowPoly') }}</p>
                </div>
                <NSwitch v-model:value="multiviewForm.smartLowPoly" size="small" />
              </div>
            </div>
          </NCollapseTransition>
          <NFormItem :label="t('model.noteLabel')">
            <NInput v-model:value="multiviewForm.note" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" :placeholder="t('model.notePlaceholder')" />
          </NFormItem>

          <NDivider title-placement="left">{{ t('model.multiviewHint') }}</NDivider>
          <div class="grid grid-cols-2 gap-2">
            <div v-for="view in multiviewForm.files" :key="view.key" class="space-y-1">
              <div class="text-xs font-medium">{{ viewLabel(view.key as ViewSlot) }}</div>
              <div class="h-[120px] border border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer" @click="triggerMultiviewUpload(view.key)">
                <img v-if="view.preview" :src="view.preview" class="w-full h-full object-cover rounded" alt="preview" />
                <span v-else class="text-xs text-gray-500">{{ t('model.uploadPlaceholder') }}</span>
              </div>
              <input :ref="el => setMultiInputRef(view.key, el as HTMLInputElement | null)" type="file" class="hidden" accept="image/*" @change="(e) => onMultiviewFileChange(e, view.key as ViewSlot)" />
            </div>
          </div>
          <NButton type="primary" block :loading="multiviewForm.submitting" @click="submitMultiviewTask">
            {{ t('model.actions.submit') }}
          </NButton>
        </NForm>
      </NTabPane>
    </NTabs>
  </div>
</template>
