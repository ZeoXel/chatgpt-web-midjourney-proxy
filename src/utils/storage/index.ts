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
          console.warn('配额仍然超限，清理聊天历史...')
          cleanChatHistory()

          try {
            window.localStorage.setItem(key, json)
            console.info('存储空间清理完成')
          } catch (finalError) {
            console.error('存储失败，请手动清理浏览器缓存')
            alert('存储空间不足！请清理浏览器缓存，或删除部分聊天记录。')
            throw new Error('存储空间不足，请清理浏览器缓存')
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
      const recentChats = chatData.chat.slice(-5)
      const recentHistory = chatData.history.slice(-5)
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

  return { set, get, remove, clear }
}

export const ls = createLocalStorage()
export const ss = createLocalStorage({ expire: null })