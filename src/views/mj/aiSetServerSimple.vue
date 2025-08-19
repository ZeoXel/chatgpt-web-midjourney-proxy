<script setup lang="ts">
import { NButton, NDivider, NInput, useMessage } from 'naive-ui'
import { watch } from 'vue'
import { gptServerStore } from '@/store'
import { blurClean } from '@/api'
import { t } from '@/locales'

const emit = defineEmits(['close'])
const ms = useMessage()

const defaultUrl = 'https://api.lsaigc.com'

const save = () => {
  gptServerStore.setMyData(gptServerStore.myData)
  ms.success(t('mjchat.success'))
  emit('close')
}

// 初始化默认URL
const initializeDefaultUrl = () => {
  if (!gptServerStore.myData.OPENAI_API_BASE_URL) {
    gptServerStore.myData.OPENAI_API_BASE_URL = defaultUrl
    // 同步到其他服务
    syncSettings()
  }
}

// 同步设置到所有服务
const syncSettings = () => {
  const baseUrl = gptServerStore.myData.OPENAI_API_BASE_URL || defaultUrl
  const apiKey = gptServerStore.myData.OPENAI_API_KEY

  // 同步URL到所有服务
  gptServerStore.myData.MJ_SERVER = baseUrl
  gptServerStore.myData.SUNO_SERVER = baseUrl
  gptServerStore.myData.LUMA_SERVER = baseUrl
  gptServerStore.myData.VIGGLE_SERVER = baseUrl
  gptServerStore.myData.RUNWAY_SERVER = baseUrl
  gptServerStore.myData.IDEO_SERVER = baseUrl
  gptServerStore.myData.KLING_SERVER = baseUrl
  gptServerStore.myData.PIKA_SERVER = baseUrl
  gptServerStore.myData.PIXVERSE_SERVER = baseUrl
  gptServerStore.myData.UDIO_SERVER = baseUrl
  gptServerStore.myData.RIFF_SERVER = baseUrl
  gptServerStore.myData.VIDU_SERVER = baseUrl

  // 同步密钥到所有服务（如果有密钥）
  if (apiKey) {
    gptServerStore.myData.MJ_API_SECRET = apiKey
    gptServerStore.myData.SUNO_KEY = apiKey
    gptServerStore.myData.LUMA_KEY = apiKey
    gptServerStore.myData.VIGGLE_KEY = apiKey
    gptServerStore.myData.RUNWAY_KEY = apiKey
    gptServerStore.myData.IDEO_KEY = apiKey
    gptServerStore.myData.KLING_KEY = apiKey
    gptServerStore.myData.PIKA_KEY = apiKey
    gptServerStore.myData.PIXVERSE_KEY = apiKey
    gptServerStore.myData.UDIO_KEY = apiKey
    gptServerStore.myData.RIFF_KEY = apiKey
    gptServerStore.myData.VIDU_KEY = apiKey
  }
}

// 监听URL变化，自动同步
watch(() => gptServerStore.myData.OPENAI_API_BASE_URL, () => {
  syncSettings()
})

// 监听密钥变化，自动同步
watch(() => gptServerStore.myData.OPENAI_API_KEY, () => {
  syncSettings()
})

// 组件初始化
initializeDefaultUrl()
</script>

<template>
  <div id="setserver-simple">
    <div class="w-full max-h-[400px] overflow-y-auto overflow-x-hidden">
      <div class="p-4 space-y-6">
        <div class="text-center text-lg font-medium mb-4">
          {{ $t('mj.setOpen') }} - 简化配置
        </div>

        <div class="text-sm text-gray-500 mb-4">
          通过一站式中转站统一管理所有AI模型，简化配置流程。配置后将自动应用到所有支持的AI服务。
        </div>

        <!-- 核心密钥配置 -->
        <section class="space-y-4">
          <NDivider title-placement="left">
            <span class="text-blue-600 font-medium">核心配置</span>
          </NDivider>

          <div>
            <label class="block text-sm font-medium mb-2">
              <span class="text-red-500">*</span> API 密钥
            </label>
            <NInput
              v-model:value="gptServerStore.myData.OPENAI_API_KEY"
              type="password"
              placeholder="请输入您的API密钥"
              show-password-on="click"
              clearable
              class="w-full"
              @blur="blurClean"
            />
            <div class="text-xs text-gray-400 mt-1">
              此密钥将自动应用到所有AI服务（OpenAI、Claude、Midjourney、Luma、Runway、Kling、Pika、Suno、Vidu等）
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">
              服务端URL（可选）
            </label>
            <NInput
              v-model:value="gptServerStore.myData.OPENAI_API_BASE_URL"
              :placeholder="`留空将使用默认URL: ${defaultUrl}`"
              clearable
              class="w-full"
              @blur="blurClean"
            />
            <div class="text-xs text-gray-400 mt-1">
              自定义服务端地址，留空将使用默认配置
            </div>
          </div>
        </section>

        <!-- 支持的服务列表 -->
        <section>
          <NDivider title-placement="left">
            <span class="text-green-600 font-medium">支持的AI服务</span>
          </NDivider>

          <div class="grid grid-cols-3 gap-2 text-sm">
            <div class="flex items-center space-x-1">
              <span class="w-2 h-2 bg-green-500 rounded-full" />
              <span>OpenAI GPT</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="w-2 h-2 bg-green-500 rounded-full" />
              <span>Claude</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="w-2 h-2 bg-green-500 rounded-full" />
              <span>Midjourney</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="w-2 h-2 bg-green-500 rounded-full" />
              <span>Luma</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="w-2 h-2 bg-green-500 rounded-full" />
              <span>Runway</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="w-2 h-2 bg-green-500 rounded-full" />
              <span>Kling</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="w-2 h-2 bg-green-500 rounded-full" />
              <span>Pika</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="w-2 h-2 bg-green-500 rounded-full" />
              <span>Suno</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="w-2 h-2 bg-green-500 rounded-full" />
              <span>Vidu</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="w-2 h-2 bg-green-500 rounded-full" />
              <span>Pixverse</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="w-2 h-2 bg-green-500 rounded-full" />
              <span>Udio</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="w-2 h-2 bg-green-500 rounded-full" />
              <span>Ideogram</span>
            </div>
          </div>
        </section>
      </div>
    </div>

    <section class="text-right flex justify-end space-x-2 pt-4 border-t">
      <NButton @click="gptServerStore.setInit()">
        {{ $t('mj.setBtBack') }}
      </NButton>
      <NButton type="primary" @click="save">
        {{ $t('mj.setBtSave') }}
      </NButton>
    </section>
  </div>
</template>

<style>
#setserver-simple .n-input .n-input__input-el {
    text-align: left;
}
</style>
