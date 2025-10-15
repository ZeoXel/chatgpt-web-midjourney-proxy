interface StorageData<T = any> {
  data: T
  expire: number | null
}

export function createLocalStorage(options?: { expire?: number | null }) {
  const DEFAULT_CACHE_TIME = 60 * 60 * 24 * 7

  const { expire } = Object.assign({ expire: DEFAULT_CACHE_TIME }, options)

  function set<T = any>(key: string, data: T) {
    const storageData: StorageData<T> = {
      data,
      expire: expire !== null ? new Date().getTime() + expire * 1000 : null,
    }

    const json = JSON.stringify(storageData)
    try {
      window.localStorage.setItem(key, json)
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('LocalStorage配额超限，正在清理旧数据...')
        cleanExpiredData()

        try {
          window.localStorage.setItem(key, json)
        } catch (retryError) {
          console.warn('配额仍然超限，清理大型存储项...')
          cleanLargeData()

          try {
            window.localStorage.setItem(key, json)
            console.info('存储空间清理完成')
          } catch (thirdError) {
            console.warn('配额仍然超限，清理聊天历史...')
            cleanChatHistory()

            try {
              window.localStorage.setItem(key, json)
              console.info('存储空间清理完成')
            } catch (finalError) {
              console.error('存储失败，请前往设置页面手动清理')
              alert('存储空间严重不足！\n\n建议操作：\n1. 前往【设置】清理存储空间\n2. 导出重要聊天记录\n3. 删除旧的聊天会话')
              throw new Error('存储空间不足，请清理浏览器缓存')
            }
          }
        }
      } else {
        throw error
      }
    }
  }

  function cleanExpiredData() {
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key) {
        const json = window.localStorage.getItem(key)
        if (json) {
          try {
            const storageData: StorageData = JSON.parse(json)
            if (storageData.expire && storageData.expire < Date.now()) {
              keysToRemove.push(key)
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
    keysToRemove.forEach(key => window.localStorage.removeItem(key))
  }

  function cleanChatHistory() {
    const chatStorageKey = 'chatStorage'
    const chatData = get(chatStorageKey)
    if (chatData && chatData.chat) {
      // 只保留最近2条聊天记录，并限制每条记录的消息数量
      const recentChats = chatData.chat.slice(-2).map((chat: any) => ({
        ...chat,
        data: chat.data.slice(-20) // 每条聊天只保留最近20条消息
      }))
      const recentHistory = chatData.history.slice(-2)
      const cleanedData = {
        ...chatData,
        chat: recentChats,
        history: recentHistory
      }
      window.localStorage.removeItem(chatStorageKey)
      const json = JSON.stringify({
        data: cleanedData,
        expire: null
      })
      window.localStorage.setItem(chatStorageKey, json)
      console.info(`已清理聊天历史，保留最近 ${recentChats.length} 条会话`)
    }
  }

  function cleanLargeData() {
    // 清理其他可能占用大量空间的数据
    const keysToClean = [
      'mjDrawStore',
      'sunoStore',
      'lumaStore',
      'viduStore',
      'galleryData',
      'audioHistory',
      'videoHistory'
    ]

    let cleanedCount = 0
    keysToClean.forEach(key => {
      if (window.localStorage.getItem(key)) {
        window.localStorage.removeItem(key)
        cleanedCount++
      }
    })

    if (cleanedCount > 0) {
      console.info(`已清理 ${cleanedCount} 个大型数据存储项`)
    }
  }

  function get(key: string) {
    const json = window.localStorage.getItem(key)
    if (json) {
      let storageData: StorageData | null = null

      try {
        storageData = JSON.parse(json)
      }
      catch {
        // Prevent failure
      }

      if (storageData) {
        const { data, expire } = storageData
        if (expire === null || expire >= Date.now())
          return data
      }

      remove(key)
      return null
    }
  }

  function remove(key: string) {
    window.localStorage.removeItem(key)
  }

  function clear() {
    window.localStorage.clear()
  }

  function getStorageInfo() {
    let total = 0
    let details: Record<string, number> = {}

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key) {
        const value = window.localStorage.getItem(key)
        const size = value ? new Blob([value]).size : 0
        details[key] = size
        total += size
      }
    }

    // 按大小排序
    const sortedDetails = Object.entries(details)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10) // 只返回前10个最大的项

    return {
      total,
      totalMB: (total / 1024 / 1024).toFixed(2),
      details: Object.fromEntries(sortedDetails),
      usage: ((total / (10 * 1024 * 1024)) * 100).toFixed(1) // 假设限制为10MB
    }
  }

  return { set, get, remove, clear, cleanExpiredData, cleanChatHistory, cleanLargeData, getStorageInfo }
}

export const ls = createLocalStorage()
export const ss = createLocalStorage({ expire: null })