import { ref, watch, type Ref } from 'vue'

/**
 * 防抖 Hook
 */
export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): {
  debounced: T
  cancel: () => void
  flush: () => void
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    timeoutId = setTimeout(() => {
      fn.apply(null, args)
      timeoutId = null
    }, delay)
  }) as T

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  const flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      fn()
      timeoutId = null
    }
  }

  return {
    debounced,
    cancel,
    flush,
  }
}

/**
 * 防抖值 Hook
 */
export function useDebouncedValue<T>(
  value: Ref<T>,
  delay: number = 300
): Ref<T> {
  const debouncedValue = ref(value.value) as Ref<T>
  
  const { debounced } = useDebounce((newValue: T) => {
    debouncedValue.value = newValue
  }, delay)

  watch(value, (newValue) => {
    debounced(newValue)
  }, { immediate: true })

  return debouncedValue
}