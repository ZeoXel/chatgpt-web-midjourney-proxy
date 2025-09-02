import { onMounted, onUnmounted, Ref } from 'vue'

export interface SwipeOptions {
  threshold?: number // 最小滑动距离
  velocityThreshold?: number // 最小滑动速度
  preventScroll?: boolean // 是否阻止默认滚动
}

export function useSwipeGesture(
  element: Ref<HTMLElement | null>,
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  options: SwipeOptions = {}
) {
  const {
    threshold = 50,
    velocityThreshold = 0.3,
    preventScroll = false
  } = options

  let startX = 0
  let startY = 0
  let startTime = 0
  let isScrolling = false

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    startX = touch.clientX
    startY = touch.clientY
    startTime = Date.now()
    isScrolling = false
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!startX || !startY) return

    const touch = e.touches[0]
    const diffX = touch.clientX - startX
    const diffY = touch.clientY - startY

    // 判断是否为垂直滚动
    if (Math.abs(diffY) > Math.abs(diffX)) {
      isScrolling = true
      return
    }

    // 如果是水平滑动且设置了阻止滚动
    if (preventScroll && Math.abs(diffX) > Math.abs(diffY)) {
      e.preventDefault()
    }
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (!startX || !startY || isScrolling) {
      startX = 0
      startY = 0
      return
    }

    const touch = e.changedTouches[0]
    const diffX = touch.clientX - startX
    const diffY = touch.clientY - startY
    const diffTime = Date.now() - startTime
    const velocity = Math.abs(diffX) / diffTime

    // 检查是否满足滑动条件
    if (Math.abs(diffX) > threshold && Math.abs(diffX) > Math.abs(diffY)) {
      if (velocity > velocityThreshold) {
        if (diffX > 0) {
          onSwipeRight()
        } else {
          onSwipeLeft()
        }
      }
    }

    startX = 0
    startY = 0
  }

  onMounted(() => {
    const el = element.value
    if (!el) return

    el.addEventListener('touchstart', handleTouchStart, { passive: false })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: false })
  })

  onUnmounted(() => {
    const el = element.value
    if (!el) return

    el.removeEventListener('touchstart', handleTouchStart)
    el.removeEventListener('touchmove', handleTouchMove)
    el.removeEventListener('touchend', handleTouchEnd)
  })
}