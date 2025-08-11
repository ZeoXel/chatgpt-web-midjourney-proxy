<template>
  <div class="base-input-wrapper">
    <label v-if="label" :for="inputId" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {{ label }}
      <span v-if="required" class="text-semantic-error-500 ml-1">*</span>
    </label>
    
    <div class="relative">
      <div v-if="prefixIcon" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
        <NIcon :component="prefixIcon" :size="16" />
      </div>
      
      <input
        :id="inputId"
        v-model="modelValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :maxlength="maxlength"
        :class="inputClasses"
        v-bind="$attrs"
        @input="handleInput"
        @change="handleChange"
        @focus="handleFocus"
        @blur="handleBlur"
      />
      
      <div v-if="suffixIcon || clearable" class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
        <button
          v-if="clearable && modelValue"
          type="button"
          class="text-gray-400 hover:text-gray-600 transition-colors"
          @click="clearValue"
        >
          <NIcon :component="CloseIcon" :size="16" />
        </button>
        <NIcon v-if="suffixIcon" :component="suffixIcon" :size="16" class="text-gray-400" />
      </div>
    </div>
    
    <div v-if="error || hint" class="mt-1 text-xs">
      <div v-if="error" class="text-semantic-error-500 flex items-center gap-1">
        <NIcon :component="AlertIcon" :size="12" />
        {{ error }}
      </div>
      <div v-else-if="hint" class="text-gray-500 dark:text-gray-400">
        {{ hint }}
      </div>
    </div>
    
    <div v-if="showCount && maxlength" class="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
      {{ modelValue?.length || 0 }}/{{ maxlength }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { NIcon } from 'naive-ui'
import { CloseOutlined as CloseIcon, ExclamationCircleOutlined as AlertIcon } from '@vicons/antd'

export interface BaseInputProps {
  modelValue?: string | number
  type?: string
  label?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  error?: string
  hint?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'outlined' | 'filled'
  prefixIcon?: Component
  suffixIcon?: Component
  clearable?: boolean
  showCount?: boolean
  maxlength?: number
}

const props = withDefaults(defineProps<BaseInputProps>(), {
  type: 'text',
  size: 'md',
  variant: 'outlined',
  disabled: false,
  readonly: false,
  required: false,
  clearable: false,
  showCount: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  input: [event: Event]
  change: [event: Event]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

const inputId = ref(`input-${Math.random().toString(36).substr(2, 9)}`)
const isFocused = ref(false)

const inputClasses = computed(() => {
  const baseClasses = [
    'w-full transition-all duration-fast',
    'placeholder:text-gray-500 dark:placeholder:text-gray-400',
    'focus:outline-none',
  ]

  // 尺寸样式
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-3 py-2 text-base',
    lg: 'px-4 py-3 text-lg',
  }

  // 变体样式
  const variantClasses = {
    default: [
      'border-0 border-b-2 bg-transparent',
      'border-gray-300 dark:border-gray-600',
      'focus:border-primary-500',
    ],
    outlined: [
      'border rounded-md',
      'bg-white dark:bg-gray-800',
      'border-gray-300 dark:border-gray-600',
      'focus:border-primary-500 focus:ring-1 focus:ring-primary-500',
    ],
    filled: [
      'border-0 rounded-md',
      'bg-gray-100 dark:bg-gray-700',
      'focus:bg-white dark:focus:bg-gray-800',
      'focus:ring-2 focus:ring-primary-500',
    ],
  }

  // 状态样式
  const stateClasses = []
  if (props.error) {
    stateClasses.push('border-semantic-error-500 focus:border-semantic-error-500 focus:ring-semantic-error-500')
  }
  if (props.disabled) {
    stateClasses.push('opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900')
  }
  if (props.readonly) {
    stateClasses.push('bg-gray-50 dark:bg-gray-900')
  }

  // 图标间距
  const paddingClasses = []
  if (props.prefixIcon) paddingClasses.push('pl-10')
  if (props.suffixIcon || props.clearable) paddingClasses.push('pr-10')

  return [
    ...baseClasses,
    sizeClasses[props.size],
    ...variantClasses[props.variant],
    ...stateClasses,
    ...paddingClasses,
    'text-gray-900 dark:text-gray-100',
  ].join(' ')
})

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
  emit('input', event)
}

const handleChange = (event: Event) => {
  emit('change', event)
}

const handleFocus = (event: FocusEvent) => {
  isFocused.value = true
  emit('focus', event)
}

const handleBlur = (event: FocusEvent) => {
  isFocused.value = false
  emit('blur', event)
}

const clearValue = () => {
  emit('update:modelValue', '')
}
</script>