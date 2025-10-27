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

// 思考内容折叠状态
const thinkingCollapsed = ref(true)

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

// 提取思考内容
const thinkingContent = computed(() => {
  const value = props.text ?? ''
  const match = value.match(/<think>([\s\S]*?)(?=<\/think>|$)/);
  return match ? match[1].trim() : ''
})

// 判断是否包含思考内容
const hasThinking = computed(() => {
  return thinkingContent.value !== ''
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

    // 移除思考内容标签，将在模板中单独处理
    value = value.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '');

    //mlog('replace', value)
    return mdi.render(value)
  }
  return value
})

// 切换思考内容折叠状态
const toggleThinking = () => {
  thinkingCollapsed.value = !thinkingCollapsed.value
}

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
          <!-- 思考内容折叠组件 -->
          <div v-if="hasThinking && !asRawText" class="thinking-wrapper mb-3">
            <div
              class="thinking-header"
              @click="toggleThinking"
            >
              <svg
                class="thinking-icon"
                :class="{ 'thinking-icon-expanded': !thinkingCollapsed }"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              <svg
                class="thinking-brain-icon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"></path>
                <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"></path>
                <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"></path>
                <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"></path>
                <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"></path>
                <path d="M3.477 10.896a4 4 0 0 1 .585-.396"></path>
                <path d="M19.938 10.5a4 4 0 0 1 .585.396"></path>
                <path d="M6 18a4 4 0 0 1-1.967-.516"></path>
                <path d="M19.967 17.484A4 4 0 0 1 18 18"></path>
              </svg>
              <span class="thinking-title">{{ thinkingCollapsed ? '思考过程' : '收起思考' }}</span>
              <span class="thinking-badge">{{ thinkingContent.split('\n').length }} 行</span>
            </div>
            <div v-show="!thinkingCollapsed" class="thinking-content">
              <pre class="thinking-text">{{ thinkingContent }}</pre>
            </div>
          </div>

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

/* 思考内容折叠组件样式 */
.thinking-wrapper {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
  transition: all 0.3s ease;
}

.dark .thinking-wrapper {
  border-color: #374151;
  background: linear-gradient(135deg, #1e293b 0%, #1a2332 100%);
}

.thinking-header {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  gap: 8px;
}

.thinking-header:hover {
  background: rgba(99, 102, 241, 0.08);
}

.dark .thinking-header:hover {
  background: rgba(99, 102, 241, 0.15);
}

.thinking-icon {
  width: 16px;
  height: 16px;
  color: #6366f1;
  transition: transform 0.3s ease;
  flex-shrink: 0;
}

.thinking-icon-expanded {
  transform: rotate(180deg);
}

.thinking-brain-icon {
  width: 18px;
  height: 18px;
  color: #8b5cf6;
  flex-shrink: 0;
}

.thinking-title {
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
  flex-grow: 1;
}

.dark .thinking-title {
  color: #9ca3af;
}

.thinking-badge {
  font-size: 12px;
  color: #6b7280;
  background: rgba(99, 102, 241, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.dark .thinking-badge {
  color: #9ca3af;
  background: rgba(99, 102, 241, 0.2);
}

.thinking-content {
  border-top: 1px solid #e5e7eb;
  padding: 12px 14px;
  background: #ffffff;
  animation: slideDown 0.3s ease;
}

.dark .thinking-content {
  border-top-color: #374151;
  background: #0f172a;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 2000px;
  }
}

.thinking-text {
  font-family: 'Courier New', Courier, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #374151;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.dark .thinking-text {
  color: #d1d5db;
}
</style>
