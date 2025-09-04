<template>
  <div class="relative">
    <div class="flex items-center space-x-2 relative z-10">
      <!-- Input field -->
      <div class="flex-1">
        <input
          ref="inputRef"
          v-model="inputText"
          type="text"
          :placeholder="placeholder"
          class="block w-full h-10 rounded-full bg-white px-4 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 hover:outline-gray-400 hover:shadow-sm focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 focus:shadow-md sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:hover:outline-white/20 dark:focus:outline-indigo-500 transition-all duration-300 ease-out transform hover:scale-[1.005] focus:scale-[1.01]"
          @keypress="handleKeyPress"
          @input="handleInput"
        />
      </div>
      
      <!-- Send button with integrated model selector -->
      <Listbox as="div" v-model="selectedModelOption">
        <div class="relative">
          <div class="inline-flex rounded-full outline-none">
            <!-- Send button part -->
            <button
              :disabled="!canSubmit"
              @click="handleSubmit"
              :class="[
                'inline-flex items-center rounded-l-full px-3 py-2 text-white h-10 transition-all duration-300 ease-out transform shadow-sm',
                !canSubmit
                  ? 'bg-gray-400 cursor-not-allowed dark:bg-gray-600 scale-100'
                  : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.05] hover:shadow-md active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-400'
              ]"
            >
              <SvgIcon icon="ri:send-plane-fill" class="h-4 w-4" />
            </button>
            <!-- Model name display with gradient fade -->
            <div :class="[
              'relative inline-flex items-center py-2 text-white text-sm font-medium h-10 w-20 transition-all duration-300 ease-out transform',
              !canSubmit
                ? 'bg-gray-400 dark:bg-gray-600'
                : 'bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-400 hover:scale-[1.02]'
            ]">
              <div class="px-2 truncate w-full">
                {{ selectedModelOption.title }}
              </div>
              <!-- Gradient overlay for text fade effect -->
              <div :class="[
                'absolute right-0 top-0 bottom-0 w-4 pointer-events-none transition-all duration-200 ease-in-out',
                !canSubmit
                  ? 'bg-gradient-to-l from-gray-400 dark:from-gray-600'
                  : 'bg-gradient-to-l from-indigo-600 dark:from-indigo-500'
              ]"></div>
            </div>
            <!-- Model selector dropdown button -->
            <ListboxButton :class="[
              'inline-flex items-center rounded-r-full px-2 py-2 h-10 transition-all duration-300 ease-out transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 shadow-sm',
              !canSubmit
                ? 'bg-gray-400 cursor-not-allowed dark:bg-gray-600'
                : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.05] hover:shadow-md active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-400'
            ]">
              <span class="sr-only">Change model</span>
              <ChevronUpIcon class="h-4 w-4 text-white forced-colors:text-[Highlight] transition-transform duration-200 ease-in-out" aria-hidden="true" />
            </ListboxButton>
          </div>

          <transition 
            enter-active-class="transition ease-out duration-100" 
            enter-from-class="transform opacity-0 scale-95" 
            enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75" 
            leave-from-class="transform opacity-100 scale-100" 
            leave-to-class="transform opacity-0 scale-95"
          >
            <ListboxOptions class="fixed bottom-16 right-4 z-50 w-64 origin-bottom-right divide-y divide-gray-200 overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 dark:divide-white/10 dark:bg-gray-800 dark:ring-white/10">
              <ListboxOption 
                as="template" 
                v-for="option in modelOptions" 
                :key="option.value" 
                :value="option" 
                v-slot="{ active, selected }"
              >
                <li :class="[active ? 'bg-indigo-600 text-white dark:bg-indigo-500' : 'text-gray-900 dark:text-white', 'cursor-default select-none p-3 text-sm']">
                  <div class="flex justify-between items-start">
                    <div class="flex-1 min-w-0">
                      <p :class="[selected ? 'font-semibold' : 'font-normal', 'truncate']">{{ option.title }}</p>
                      <p :class="[active ? 'text-indigo-200 dark:text-indigo-100' : 'text-gray-500 dark:text-gray-400', 'mt-1 text-xs truncate']">{{ option.description }}</p>
                    </div>
                    <span v-if="selected" :class="active ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'">
                      <CheckIcon class="h-4 w-4 ml-2 flex-shrink-0" aria-hidden="true" />
                    </span>
                  </div>
                </li>
              </ListboxOption>
            </ListboxOptions>
          </transition>
        </div>
      </Listbox>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/vue'
import { CheckIcon, ChevronUpIcon } from '@heroicons/vue/20/solid'
import { SvgIcon } from '@/components/common'
import { gptConfigStore, homeStore } from '@/store'
import { chatSetting } from '@/api'
import { useChatStore } from '@/store'

interface Props {
  placeholder?: string
  disabled?: boolean
  options?: Array<{ label: string; value: string }>
}

interface Emits {
  (e: 'submit', text: string): void
  (e: 'input', text: string): void
  (e: 'focus'): void
  (e: 'blur'): void
  (e: 'update:modelValue', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Type your message...',
  disabled: false,
  options: () => []
})

const emit = defineEmits<Emits>()

// Chat store and model management
const chatStore = useChatStore()
const uuid = chatStore.active
const chatSet = new chatSetting(uuid == null ? 1002 : uuid)

const inputText = ref('')
const inputRef = ref<HTMLInputElement>()

// Model selection logic (based on aiModel.vue)
const nGptStore = ref(chatSet.getGptConfig())
if (nGptStore.value.model === 'gpt-3.5-turbo')
  nGptStore.value.model = 'gpt-5'

const config = ref({
  model: ['gpt-5', 'gpt-4o', 'gpt-4.5', 'o1', 'deepseek-r1', 'deepseek-v3', 'gemini-2.5-pro', 'claude-sonnet-4-20250514', 'grok-3', 'grok-4'],
})

// Model descriptions for better UX
const modelDescriptions: Record<string, string> = {
  'gpt-5': 'Advanced reasoning and complex tasks',
  'gpt-4o': 'Multimodal capabilities with vision',
  'gpt-4.5': 'Enhanced performance and accuracy',
  'o1': 'Specialized reasoning model',
  'deepseek-r1': 'DeepSeek reasoning model',
  'deepseek-v3': 'DeepSeek latest generation',
  'gemini-2.5-pro': 'Google\'s professional model',
  'claude-sonnet-4-20250514': 'Anthropic\'s balanced model',
  'grok-3': 'X.AI\'s conversational model',
  'grok-4': 'X.AI\'s latest generation'
}

const modelList = computed(() => {
  let rz = []
  for (const o of config.value.model)
    rz.push({ label: o, value: o })

  if (gptConfigStore.myData.userModel) {
    const arr = gptConfigStore.myData.userModel.split(/[ ,]+/ig)
    for (const o of arr)
      o && rz.push({ label: o, value: o })
  }
  
  // 服务端的 CUSTOM_MODELS 设置
  if (homeStore.myData.session.cmodels) {
    const delModel: string[] = []
    const addModel: string[] = []
    let isDelAll = false
    homeStore.myData.session.cmodels.split(/[ ,]+/ig).map((v: string) => {
      if (v.indexOf('-') === 0) {
        delModel.push(v.substring(1))
        if (v === '-all')
          isDelAll = true
      }
      else {
        addModel.push(v)
      }
    })
    if (isDelAll)
      rz = []
    rz = rz.filter(v => !delModel.includes(v.value))
    addModel.map(o => rz.push({ label: o, value: o }))
    if (rz.length === 0)
      rz.push({ label: 'gpt-3.5-turbo', value: 'gpt-3.5-turbo' })
  }

  const uniqueArray: { label: string; value: string }[] = Array.from(
    new Map(rz.map(item => [JSON.stringify(item), item]))
      .values(),
  )
  return uniqueArray
})

// Transform model list to option format for new UI
const modelOptions = computed(() => {
  return modelList.value.map(model => ({
    value: model.value,
    title: model.label,
    description: modelDescriptions[model.value] || 'AI language model'
  }))
})

const selectedModel = ref(nGptStore.value.model)

// Selected model option for the new UI
const selectedModelOption = computed({
  get: () => {
    const found = modelOptions.value.find(option => option.value === selectedModel.value)
    return found || modelOptions.value[0]
  },
  set: (option) => {
    selectedModel.value = option.value
  }
})

// Computed property for button state
const canSubmit = computed(() => {
  const textLength = inputText.value.trim().length
  const isDisabled = props.disabled
  const result = textLength > 0 && !isDisabled
  return result
})

// Handle input
const handleInput = () => {
  emit('input', inputText.value)
}

const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    handleSubmit()
  }
}

const handleSubmit = () => {
  if (!canSubmit.value) {
    return
  }
  
  const text = inputText.value.trim()
  if (!text) {
    return
  }
  
  emit('submit', text)
  inputText.value = ''
  emit('input', '') // Also emit empty input to update parent prompt
}

// Watch for model changes and save to store
watch(selectedModel, (newModel) => {
  nGptStore.value.model = newModel
  chatSet.save(nGptStore.value)
  gptConfigStore.setMyData(nGptStore.value)
  homeStore.setMyData({ act: 'saveChat' })
})

// Focus method
const focus = () => {
  nextTick(() => {
    inputRef.value?.focus()
  })
}

defineExpose({
  focus
})
</script>