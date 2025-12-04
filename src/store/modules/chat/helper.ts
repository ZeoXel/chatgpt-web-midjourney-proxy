import { ss } from '@/utils/storage'
import { getUserUuid } from '@/utils/userUuid'
import { saveChatStorageToCOS, loadChatStorageFromCOS } from '@/api/chatStorage'
import { getCache, setCache, CACHE_KEYS } from '@/utils/assetCache'

const LOCAL_NAME = 'chatStorage'
const LAST_CHAT_UUID_KEY = 'lastChatUuid'

// 优化配置
const CHAT_OPTIMIZATION_CONFIG = {
  MAX_MESSAGES_TO_SAVE: 100,      // 每个对话最多保存 100 条消息到云端
  MAX_CHATS_TO_SAVE: 50,          // 最多保存 50 个对话到云端
  SAVE_DEBOUNCE_MS: 3000,         // 防抖 3 秒，避免频繁保存
  EXCLUDE_DRAW_UUID: 1002         // 排除生图会话
}

export function defaultState(): Chat.ChatState {
  const uuid = 1002
  return {
    active: uuid,
    usingContext: true,
    history: [{ uuid, title: 'New Chat', isEdit: false }],
    chat: [{ uuid, data: [] }],
  }
}

export function getLocalState(): Chat.ChatState {
  const localState = ss.get(LOCAL_NAME)
  return { ...defaultState(), ...localState }
}

/**
 * 获取本地和COS合并后的状态
 * COS数据优先，使用 UUID 去重
 */
export async function getLocalStateWithDB(): Promise<Chat.ChatState> {
  try {
    console.log('[Chat State] 🔄 开始合并COS和本地数据...')

    // 并行加载COS和本地数据
    const [cosState, localState] = await Promise.all([
      getAllChatsFromCOS(),
      Promise.resolve(getLocalState())
    ])

    if (!cosState || !cosState.history || cosState.history.length === 0) {
      console.log('[Chat State] ⚠️ COS无数据，使用本地数据')
      return localState
    }

    console.log(`[Chat State] 数据源统计:
  - COS: ${cosState.history?.length || 0} 个对话
  - 本地: ${localState.history.length} 个对话`)

    // 使用 Map 进行去重合并，COS数据优先
    const historyMap = new Map<number, Chat.History>()
    const chatMap = new Map<number, Chat.Chat[]>()

    // 1. 先加载COS数据（高优先级）
    cosState.history?.forEach((h, index) => {
      historyMap.set(h.uuid, h)
      chatMap.set(h.uuid, cosState.chat?.[index]?.data || [])
    })

    // 2. 加载本地数据（如果 UUID 不存在才添加）
    localState.history.forEach((h, index) => {
      if (!historyMap.has(h.uuid)) {
        historyMap.set(h.uuid, h)
        chatMap.set(h.uuid, localState.chat[index]?.data || [])
      }
    })

    // 3. 转换为数组并保持顺序（按 UUID 降序）
    const mergedHistory = Array.from(historyMap.values()).sort((a, b) => b.uuid - a.uuid)
    const mergedChat = mergedHistory.map(h => ({
      uuid: h.uuid,
      data: chatMap.get(h.uuid) || []
    }))

    console.log(`[Chat State] ✅ 合并完成: ${mergedHistory.length} 个对话 (已去重)`)

    return {
      active: cosState.active || localState.active,
      usingContext: cosState.usingContext !== undefined ? cosState.usingContext : localState.usingContext,
      history: mergedHistory,
      chat: mergedChat
    }
  } catch (error) {
    console.error('[Chat State] ❌ 合并失败，降级到仅使用本地数据:', error)
    return getLocalState()
  }
}

/**
 * 保存状态到LocalStorage
 * 注意: 自动限制数据量以避免超出10MB限制
 */
export function setLocalState(state: Chat.ChatState) {
  // 🔥 优化: 只保存最近的对话到LocalStorage
  // 原因:
  // 1. LocalStorage有10MB限制
  // 2. 完整数据在COS，这里只是缓存
  // 3. 用户主要访问最近的对话

  const MAX_LOCAL_CHATS = 3  // 只保留最近3个对话
  const MAX_LOCAL_MESSAGES = 50  // 每个对话最多50条消息

  const optimizedState = {
    ...state,
    // 只保留最近的对话
    history: state.history.slice(-MAX_LOCAL_CHATS),
    // 只保留对应的聊天记录，并限制消息数量
    chat: state.chat
      .slice(-MAX_LOCAL_CHATS)
      .map(c => ({
        ...c,
        data: c.data.slice(-MAX_LOCAL_MESSAGES)
      }))
  }

  console.log(`[Local State] 优化保存: ${state.history.length} → ${optimizedState.history.length} 个对话`)

  ss.set(LOCAL_NAME, optimizedState)
}

/**
 * 保存状态到本地和COS
 * @param state - ChatState
 */
export function setLocalStateWithDB(state: Chat.ChatState) {
  // 1. 立即保存到本地
  ss.set(LOCAL_NAME, state)

  // 2. 异步保存到COS（不阻塞）
  saveAllChatsToDatabase(state).catch(err => {
    console.warn('[Chat State] COS保存失败（不影响用户体验）:', err)
  })
}

// 保存聊天模块的最后活动uuid
export function setLastChatUuid(uuid: number | null) {
  ss.set(LAST_CHAT_UUID_KEY, uuid)
}

// 获取聊天模块的最后活动uuid
export function getLastChatUuid(): number | null {
  return ss.get(LAST_CHAT_UUID_KEY)
}

// 防抖计时器
let saveAllDebounceTimer: NodeJS.Timeout | null = null

/**
 * 保存所有对话到COS（优化版）
 * @param state - 完整的 ChatState
 * @param immediate - 是否立即保存，跳过防抖
 */
export async function saveAllChatsToDatabase(state: Chat.ChatState, immediate = false): Promise<void> {
  // 检查用户UUID
  const userUuid = getUserUuid()
  if (!userUuid) {
    console.log('[COS Save] ⚠️ 未找到用户UUID，跳过COS保存')
    return
  }

  // 防抖处理
  if (!immediate) {
    if (saveAllDebounceTimer) {
      clearTimeout(saveAllDebounceTimer)
    }

    return new Promise((resolve) => {
      saveAllDebounceTimer = setTimeout(() => {
        saveAllChatsToDatabase(state, true).then(resolve)
      }, CHAT_OPTIMIZATION_CONFIG.SAVE_DEBOUNCE_MS)
    })
  }

  try {
    // 调试: 保存前检查当前激活会话的最后一条消息内容
    const activeUuid = state.active
    const activeChat = activeUuid
      ? state.chat.find(c => c.uuid === activeUuid)
      : state.chat[0]
    const lastMessage = activeChat && activeChat.data.length > 0
      ? activeChat.data[activeChat.data.length - 1]
      : null

    console.log('[COS Save] 💾 开始保存对话到COS...', {
      userUuid,
      对话数: state.history.length,
      activeUuid,
      最后一条消息文本长度: lastMessage?.text ? lastMessage.text.length : 0,
      最后一条消息是否loading: lastMessage?.loading,
    })

    // 保存整个ChatState到COS
    const response = await saveChatStorageToCOS(userUuid, state)

    console.log('[COS Save] ✅ 保存成功', response?.data)
  } catch (error: any) {
    // 只有真正的错误才记录
    if (error?.response?.status) {
      console.error('[COS Save] ❌ 保存失败:', error.response.status, error.message)
    } else {
      console.error('[COS Save] ❌ 保存失败:', error)
    }
    // 不抛出错误，静默失败，不影响用户体验
  }
}

/**
 * 从COS读取所有对话
 * @returns ChatState 包含所有对话
 */
export async function getAllChatsFromCOS(): Promise<Partial<Chat.ChatState> | null> {
  const userUuid = getUserUuid()
  if (!userUuid) {
    console.log('[COS Load] ⚠️ 未找到用户UUID，跳过COS加载')
    return null
  }

  // 尝试从缓存加载
  const cached = getCache<Chat.ChatState>(CACHE_KEYS.CHAT_HISTORY)
  if (cached) {
    console.log('[COS Load] 📦 使用缓存对话历史:', {
      对话数: cached.history?.length || 0
    })
    return cached
  }

  console.log('[COS Load] 🌐 开始从COS加载对话...', { userUuid })

  try {
    const response = await loadChatStorageFromCOS(userUuid)

    if (!response || !response.data) {
      console.log('[COS Load] ⚠️ COS返回空数据')
      return null
    }

    const chatState = response.data as Chat.ChatState

    // 保存到缓存
    setCache(CACHE_KEYS.CHAT_HISTORY, chatState)

    console.log('[COS Load] ✅ 加载成功:', {
      对话数: chatState.history?.length || 0,
      active: chatState.active
    })

    return chatState
  } catch (error: any) {
    // 404错误表示文件不存在，这是正常情况
    if (error.response?.status === 404) {
      console.log('[COS Load] ℹ️ COS中暂无对话历史')
      return null
    }

    console.error('[COS Load] ❌ 加载失败:', error)
    return null
  }
}

// 导出ChatState类型供其他模块使用
export type { Chat }
export type ChatState = Chat.ChatState
