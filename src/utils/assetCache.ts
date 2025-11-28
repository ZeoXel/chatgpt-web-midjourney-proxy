/**
 * 资产缓存管理
 *
 * 功能: 将COS加载的资产缓存到localStorage,减少重复请求
 */

const CACHE_KEYS = {
  MJ_IMAGES: 'cos-cache-mj-images',
  IMAGES: 'cos-cache-images',
  MUSIC: 'cos-cache-music',
  VIDEOS: 'cos-cache-videos',
  MODELS: 'cos-cache-models',
  CHAT_HISTORY: 'cos-cache-chat-history',
  TIMESTAMP: 'cos-cache-timestamp'
}

const CACHE_DURATION = 5 * 60 * 1000 // 缓存有效期: 5分钟

interface CacheData<T> {
  data: T
  timestamp: number
}

/**
 * 检查缓存是否有效
 */
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_DURATION
}

/**
 * 保存缓存
 */
export function setCache<T>(key: string, data: T): void {
  try {
    const cacheData: CacheData<T> = {
      data,
      timestamp: Date.now()
    }
    localStorage.setItem(key, JSON.stringify(cacheData))
  } catch (error) {
    console.warn('[Asset Cache] 保存缓存失败:', error)
  }
}

/**
 * 获取缓存
 */
export function getCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key)
    if (!cached) return null

    const cacheData: CacheData<T> = JSON.parse(cached)

    if (!isCacheValid(cacheData.timestamp)) {
      // 缓存过期,删除
      localStorage.removeItem(key)
      return null
    }

    return cacheData.data
  } catch (error) {
    console.warn('[Asset Cache] 读取缓存失败:', error)
    return null
  }
}

/**
 * 清除指定缓存
 */
export function clearCache(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.warn('[Asset Cache] 清除缓存失败:', error)
  }
}

/**
 * 清除所有资产缓存
 */
export function clearAllCache(): void {
  Object.values(CACHE_KEYS).forEach(key => clearCache(key))
  console.log('[Asset Cache] 🗑️ 已清除所有缓存')
}

// 导出缓存键常量
export { CACHE_KEYS }
