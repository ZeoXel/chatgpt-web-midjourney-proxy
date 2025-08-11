<template>
  <div class="search-input-container">
    <BaseInput
      ref="inputRef"
      v-model="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :loading="loading"
      :size="size"
      :prefix-icon="SearchIcon"
      :suffix-icon="loading ? undefined : (modelValue ? CloseIcon : undefined)"
      clearable
      class="search-input"
      @input="handleInput"
      @keydown.enter="handleSearch"
      @clear="handleClear"
    />
    
    <!-- 搜索建议下拉框 -->
    <Teleport to="body">
      <div
        v-if="showSuggestions && suggestions.length > 0"
        ref="suggestionsRef"
        class="search-suggestions"
        :style="suggestionsStyle"
      >
        <div class="suggestions-list scrollbar-thin">
          <div
            v-for="(suggestion, index) in suggestions"
            :key="index"
            class="suggestion-item"
            :class="{
              'suggestion-active': index === activeSuggestionIndex
            }"
            @click="selectSuggestion(suggestion)"
            @mouseenter="activeSuggestionIndex = index"
          >
            <div class="flex items-center gap-3">
              <NIcon :component="suggestion.icon || SearchIcon" :size="16" class="text-gray-400" />
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ suggestion.title }}
                </div>
                <div v-if="suggestion.description" class="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {{ suggestion.description }}
                </div>
              </div>
              <div v-if="suggestion.category" class="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {{ suggestion.category }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- 快捷操作 -->
        <div v-if="quickActions.length > 0" class="suggestions-footer">
          <div class="flex gap-2">
            <button
              v-for="action in quickActions"
              :key="action.key"
              class="btn-ghost btn-xs"
              @click="action.handler"
            >
              <NIcon :component="action.icon" :size="12" />
              {{ action.label }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import { NIcon } from 'naive-ui'
import { SearchOutlined as SearchIcon, CloseOutlined as CloseIcon } from '@vicons/antd'
import { BaseInput } from '@/components/atoms'
import { useDebounce } from '@/hooks/useDebounce'

export interface SearchSuggestion {
  title: string
  description?: string
  category?: string
  icon?: Component
  value?: string
  data?: any
}

export interface QuickAction {
  key: string
  label: string
  icon: Component
  handler: () => void
}

export interface SearchInputProps {
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  suggestions?: SearchSuggestion[]
  quickActions?: QuickAction[]
  searchOnInput?: boolean
  debounceMs?: number
  maxSuggestions?: number
}

const props = withDefaults(defineProps<SearchInputProps>(), {
  placeholder: '搜索...',
  disabled: false,
  loading: false,
  size: 'md',
  suggestions: () => [],
  quickActions: () => [],
  searchOnInput: true,
  debounceMs: 300,
  maxSuggestions: 8,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: [value: string]
  select: [suggestion: SearchSuggestion]
  input: [value: string]
  clear: []
}>()

const inputRef = ref()
const suggestionsRef = ref()
const showSuggestions = ref(false)
const activeSuggestionIndex = ref(-1)

// 防抖搜索
const { debounced: debouncedSearch } = useDebounce((value: string) => {
  if (props.searchOnInput && value.trim()) {
    emit('search', value.trim())
  }
}, props.debounceMs)

// 限制建议数量
const limitedSuggestions = computed(() => 
  props.suggestions.slice(0, props.maxSuggestions)
)

// 建议框位置
const suggestionsStyle = ref({})

// 计算建议框位置
const updateSuggestionsPosition = async () => {
  await nextTick()
  if (!inputRef.value?.$el || !suggestionsRef.value) return
  
  const inputRect = inputRef.value.$el.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const suggestionsHeight = Math.min(400, limitedSuggestions.value.length * 60 + 80)
  
  const spaceBelow = viewportHeight - inputRect.bottom - 10
  const spaceAbove = inputRect.top - 10
  
  const showAbove = spaceBelow < suggestionsHeight && spaceAbove > spaceBelow
  
  suggestionsStyle.value = {
    position: 'fixed',
    left: `${inputRect.left}px`,
    width: `${inputRect.width}px`,
    maxHeight: `${Math.min(400, showAbove ? spaceAbove : spaceBelow)}px`,
    top: showAbove ? 'auto' : `${inputRect.bottom + 4}px`,
    bottom: showAbove ? `${viewportHeight - inputRect.top + 4}px` : 'auto',
    zIndex: 1000,
  }
}

// 事件处理
const handleInput = (value: string) => {
  emit('update:modelValue', value)
  emit('input', value)
  
  if (value.trim()) {
    showSuggestions.value = true
    updateSuggestionsPosition()
    debouncedSearch(value)
  } else {
    showSuggestions.value = false
  }
  
  activeSuggestionIndex.value = -1
}

const handleSearch = () => {
  const value = props.modelValue?.trim() || ''
  if (value) {
    emit('search', value)
    showSuggestions.value = false
  }
}

const handleClear = () => {
  emit('update:modelValue', '')
  emit('clear')
  showSuggestions.value = false
}

const selectSuggestion = (suggestion: SearchSuggestion) => {
  const value = suggestion.value || suggestion.title
  emit('update:modelValue', value)
  emit('select', suggestion)
  showSuggestions.value = false
  inputRef.value?.blur()
}

// 键盘导航
const handleKeydown = (event: KeyboardEvent) => {
  if (!showSuggestions.value || limitedSuggestions.value.length === 0) return
  
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      activeSuggestionIndex.value = Math.min(
        activeSuggestionIndex.value + 1,
        limitedSuggestions.value.length - 1
      )
      break
    case 'ArrowUp':
      event.preventDefault()
      activeSuggestionIndex.value = Math.max(activeSuggestionIndex.value - 1, -1)
      break
    case 'Enter':
      if (activeSuggestionIndex.value >= 0) {
        event.preventDefault()
        selectSuggestion(limitedSuggestions.value[activeSuggestionIndex.value])
      }
      break
    case 'Escape':
      showSuggestions.value = false
      activeSuggestionIndex.value = -1
      break
  }
}

// 点击外部关闭
const handleClickOutside = (event: Event) => {
  if (
    !inputRef.value?.$el?.contains(event.target) &&
    !suggestionsRef.value?.contains(event.target)
  ) {
    showSuggestions.value = false
  }
}

// 监听建议变化
watch(() => props.suggestions, () => {
  if (showSuggestions.value) {
    updateSuggestionsPosition()
  }
})

// 生命周期
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', updateSuggestionsPosition)
  window.addEventListener('scroll', updateSuggestionsPosition)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', updateSuggestionsPosition)
  window.removeEventListener('scroll', updateSuggestionsPosition)
})
</script>

<style scoped>
.search-input-container {
  @apply relative;
}

.search-suggestions {
  @apply card shadow-float border;
  @apply animate-scale-in;
}

.suggestions-list {
  @apply max-h-80 overflow-y-auto;
}

.suggestion-item {
  @apply px-4 py-3 cursor-pointer transition-colors;
  @apply hover:bg-gray-50 dark:hover:bg-gray-800;
  @apply border-b border-gray-100 dark:border-gray-700 last:border-b-0;
}

.suggestion-active {
  @apply bg-primary-50 dark:bg-primary-900/20;
}

.suggestions-footer {
  @apply p-3 border-t border-gray-100 dark:border-gray-700;
  @apply bg-gray-50 dark:bg-gray-800/50;
}
</style>