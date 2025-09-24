<script lang="ts" setup>
import { computed, onMounted, onUnmounted, onUpdated, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import mdKatex from '@traptitech/markdown-it-katex'
import mila from 'markdown-it-link-attributes'
import hljs from 'highlight.js'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { t } from '@/locales'
import { copyToClip } from '@/utils/copy'

import mjText from '@/views/mj/mjText.vue'
import dallText from '@/views/mj/dallText.vue'
import ttsText from '@/views/mj/ttsText.vue'
import whisperText from '@/views/mj/whisperText.vue'
import MjTextAttr from '@/views/mj/mjTextAttr.vue'
import aiTextSetting from '@/views/mj/aiTextSetting.vue'
import aiSetAuth from '@/views/mj/aiSetAuth.vue'
import { isApikeyError, isAuthSessionError, isDallImageModel, isTTS, mlog } from '@/api'

interface Props {
  inversion?: boolean
  error?: boolean
  text?: string
  loading?: boolean
  asRawText?: boolean
  chat:Chat.Chat
}

const props = defineProps<Props>()

const { isMobile } = useBasicLayout()

const textRef = ref<HTMLElement>()

const mdi = new MarkdownIt({
  html: false,
  linkify: true,
  highlight(code, language) {
    const validLang = !!(language && hljs.getLanguage(language))
    if (validLang) {
      const lang = language ?? ''
      return highlightBlock(hljs.highlight(code, { language: lang }).value, lang)
    }
    return highlightBlock(hljs.highlightAuto(code).value, '')
  },
})

mdi.use(mila, { attrs: { target: '_blank', rel: 'noopener' } })
mdi.use(mdKatex, { blockClass: 'katexmath-block rounded-md p-[10px]', errorColor: ' #cc0000' })

const wrapClass = computed(() => {
  return [
    'text-wrap',
    'min-w-[20px]','max-w-[810px]',
    'rounded-md',
    isMobile.value ? 'p-2' : 'px-3 py-2',
    props.inversion ? 'bg-[#d2f9d1]' : 'bg-[#f4f6f8]',
    props.inversion ? 'dark:bg-[#a1dc95]' : 'dark:bg-[#1e1e20]',
    props.inversion ? 'message-request' : 'message-reply',
    { 'text-red-500': props.error },
  ]
})

const text = computed(() => {
  let value = props.text ?? ''
  if (!props.asRawText){
    value = value.replace(/\\\( *(.*?) *\\\)/g, '$$$1$$');
    //value = value.replace(/\\\((.*?)\\\)/g, '$$$1$$');
    value = value.replace(/\\\[ *(.*?) *\\\]/g, '$$$$$1$$$$');
    //
    value= value.replaceAll('\\[',"$$$$")
    value= value.replaceAll('\\]',"$$$$")   

    //思考过程处理
    //value= value.replace(/<think>([\s\S]*?)<\/think>/g, (match: string, content: string) => { 
    value= value.replace(/<think>([\s\S]*?)(?=<\/think>|$)/g, (match: string, content: string) => { 
      const processedContent: string = content
        .split('\n')
        .map(line => line.trim() ? '>' + line : line)  
        .join('\n').replace(/(\r?\n)+/g, '\n>\n');
       
      return ">Thinking..."+(processedContent) ;
    });
    value= value.replaceAll('</think>','')
    //mlog('replace', value)
    return mdi.render(value) 
  }
  return value
})

function highlightBlock(str: string, lang?: string) {
  return `<pre class="code-block-wrapper"><div class="code-block-header"><span class="code-block-header__lang">${lang}</span><span class="code-block-header__copy">${t('chat.copyCode')}</span></div><code class="hljs code-block-body ${lang}">${str}</code></pre>`
}

function addCopyEvents() {
  if (textRef.value) {
    const copyBtn = textRef.value.querySelectorAll('.code-block-header__copy')
    copyBtn.forEach((btn) => {
      btn.addEventListener('click', () => {
        const code = btn.parentElement?.nextElementSibling?.textContent
        if (code) {
          copyToClip(code).then(() => {
            btn.textContent = '复制成功'
            setTimeout(() => {
              btn.textContent = '复制代码'
            }, 1000)
          })
        }
      })
    })
  }
}

function removeCopyEvents() {
  if (textRef.value) {
    const copyBtn = textRef.value.querySelectorAll('.code-block-header__copy')
    copyBtn.forEach((btn) => {
      btn.removeEventListener('click', () => {})
    })
  }
}

onMounted(() => {
  addCopyEvents()
})

onUpdated(() => {
  addCopyEvents()
})

onUnmounted(() => {
  removeCopyEvents()
})

const isDall=(chat: Chat.Chat)=>{
  if( isDallImageModel( chat.model ) ){
    return true
  }
  if(chat.opt?.imageUrl){
    return true
  }
  return false
}
</script>

<template>
  <div class="text-black" :class="wrapClass">
    <div ref="textRef" class="leading-relaxed break-words">
      <div v-if="!inversion">
        <aiTextSetting v-if="!inversion && isApikeyError(text)"/>
        <aiSetAuth v-if="!inversion && isAuthSessionError(text)" />
          
        <!-- 修复：确保MJ任务只被mjText处理，防止dallText重复渲染 -->
        <mjText v-if="chat.mjID" class="whitespace-pre-wrap" :chat="chat" :mdi="mdi" :key="`mjtext-${chat.mjID}`"></mjText>
        <dallText :chat="chat" :loading="loading" v-else-if="chat.model && chat.model?.indexOf('chat') == -1 && (isDall(chat) || isDallImageModel(chat.model))" class="whitespace-pre-wrap" />
        <ttsText v-else-if="chat.model && isTTS(chat.model) && chat.text=='ok'" :chat="chat"/>
        <template v-else>
          <div v-if="!asRawText" class="markdown-body" :class="{ 'markdown-body-generate': loading }" v-html="text" />
          <div v-else class="whitespace-pre-wrap" v-text="text" />
        </template>
      </div>
      <whisperText v-else-if="text=='whisper' && chat.opt?.lkey "  :chat="chat" />
      <div v-else-if="asRawText" class="whitespace-pre-wrap" v-text="text" />
      <div v-else>
        <!-- 用户输入消息：显示文本 + 参考图片 -->
        <div class="markdown-body" style="--color-fg-default:#24292f" v-html="text" />

        <!-- 显示参考图片（仅在有originalConfig且有base64Array时显示） -->
        <div v-if="chat.originalConfig && chat.originalConfig.base64Array && chat.originalConfig.base64Array.length > 0"
             class="mt-2 flex flex-wrap gap-2">
          <div class="text-xs text-gray-500 w-full mb-1">{{ $t('mjchat.referenceImages') }}</div>
          <div v-for="(img, index) in chat.originalConfig.base64Array"
               :key="index"
               class="w-16 h-16 rounded overflow-hidden border border-gray-200 hover:border-gray-400 transition-colors cursor-pointer"
               @click="$emit('previewImage', img.base64)">
            <img :src="img.base64"
                 class="w-full h-full object-cover"
                 :alt="`参考图片 ${index + 1}`">
          </div>
        </div>
      </div>
      <!-- <div v-else class="whitespace-pre-wrap" v-text="text" /> -->
      <!-- 移除MjTextAttr渲染 - mjID场景已由mjText.vue处理 -->
      <!-- <MjTextAttr :image="chat.opt?.images[0]" v-if="chat.opt?.images && !chat.mjID"></MjTextAttr> -->
      <whisperText v-if="chat.model && chat.model.indexOf('whisper')>-1 && chat.opt?.lkey " :isW="true"  :chat="chat" class="w-full" />
      <ttsText v-if="!inversion && chat.opt?.duration && chat.opt?.duration>0 && chat.opt?.lkey " :isW="true"  :chat="chat" class="w-full" />

      

    </div>
  </div>
</template>

<style lang="less">
@import url(./style.less);
</style>
