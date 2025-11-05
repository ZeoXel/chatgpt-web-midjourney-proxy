import { ss } from '@/utils/storage'
import { gptServerStore } from '@/store'

const LOCAL_NAME = 'chatStorage'
const LAST_CHAT_UUID_KEY = 'lastChatUuid'

// 优化配置
const CHAT_OPTIMIZATION_CONFIG = {
  MAX_MESSAGES_TO_SAVE: 100,      // 每个对话最多保存 100 条消息到云端
  MAX_CHATS_TO_SAVE: 50,          // 最多保存 50 个对话到云端
  SAVE_DEBOUNCE_MS: 3000,         // 防抖 3 秒，避免频繁保存
  EXCLUDE_DRAW_UUID: 1002         // 排除生图会话
}

// 追踪最后保存状态的哈希值，用于增量保存
const chatStateHashes = new Map<number, string>()

/**
 * 获取 Assets API 路径（处理开发/生产环境差异）
 */
function getAssetsApiPath(): string {
  const isDev = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  return isDev ? '/api/api/assets' : '/api/assets'
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
 * 获取本地和数据库合并后的状态
 * 数据库数据优先，使用 UUID 去重
 */
export async function getLocalStateWithDB(): Promise<Chat.ChatState> {
  try {
    console.log('[Chat State] 🔄 开始合并数据库和本地数据...')

    // 并行加载数据库和本地数据
    const [dbState, localState] = await Promise.all([
      getAllChatsFromDatabase(),
      Promise.resolve(getLocalState())
    ])

    if (!dbState || !dbState.history || dbState.history.length === 0) {
      console.log('[Chat State] ⚠️ 数据库无数据，使用本地数据')
      return localState
    }

    console.log(`[Chat State] 数据源统计:
  - 数据库: ${dbState.history?.length || 0} 个对话
  - 本地: ${localState.history.length} 个对话`)

    // 使用 Map 进行去重合并，数据库数据优先
    const historyMap = new Map<number, Chat.History>()
    const chatMap = new Map<number, Chat.Chat[]>()

    // 1. 先加载数据库数据（高优先级）
    dbState.history?.forEach((h, index) => {
      historyMap.set(h.uuid, h)
      chatMap.set(h.uuid, dbState.chat?.[index]?.data || [])
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
      active: localState.active,
      usingContext: localState.usingContext,
      history: mergedHistory,
      chat: mergedChat
    }
  } catch (error) {
    console.error('[Chat State] ❌ 合并失败，降级到仅使用本地数据:', error)
    return getLocalState()
  }
}

export function setLocalState(state: Chat.ChatState) {
  ss.set(LOCAL_NAME, state)
}

/**
 * 保存状态到本地和数据库
 * @param state - ChatState
 */
export function setLocalStateWithDB(state: Chat.ChatState) {
  // 1. 立即保存到本地
  ss.set(LOCAL_NAME, state)

  // 2. 异步保存到数据库（不阻塞）
  saveAllChatsToDatabase(state).catch(err => {
    console.warn('[Chat State] 数据库保存失败（不影响用户体验）:', err)
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

/**
 * 计算对话数据的哈希值（简单版本）
 */
function calculateChatHash(uuid: number, chatData: Chat.Chat[]): string {
  return `${uuid}-${chatData.length}-${chatData[chatData.length - 1]?.dateTime || ''}`
}

/**
 * 检查对话是否需要保存（基于哈希值判断是否变更）
 */
function shouldSaveChat(uuid: number, chatData: Chat.Chat[]): boolean {
  const currentHash = calculateChatHash(uuid, chatData)
  const lastHash = chatStateHashes.get(uuid)

  if (lastHash === currentHash) {
    return false // 未变更，跳过保存
  }

  chatStateHashes.set(uuid, currentHash)
  return true
}

/**
 * 保存单个对话到数据库（优化版）
 * @param uuid - 对话UUID
 * @param history - 对话历史信息
 * @param chatData - 对话消息数据
 * @param force - 强制保存，忽略增量检查
 */
export async function saveChatToDatabase(
  uuid: number,
  history: Chat.History,
  chatData: Chat.Chat[],
  force = false
): Promise<void> {
  if (!homeStore.myData.session?.isDatabaseEnabled) {
    return
  }
  try {
    const apiKey = gptServerStore.myData.OPENAI_API_KEY

    if (!apiKey) {
      console.warn('[Chat Save] 未配置API Key，跳过保存')
      return
    }

    // 跳过默认的生图会话
    if (uuid === CHAT_OPTIMIZATION_CONFIG.EXCLUDE_DRAW_UUID) {
      return
    }

    // 跳过空对话
    if (chatData.length === 0) {
      return
    }

    // 增量保存：检查是否有变更
    if (!force && !shouldSaveChat(uuid, chatData)) {
      console.log('[Chat Save] ⏭️ 跳过未变更对话:', uuid)
      return
    }

    // 消息截断：只保存最近的 N 条消息
    const messagesToSave = chatData.slice(-CHAT_OPTIMIZATION_CONFIG.MAX_MESSAGES_TO_SAVE)

    console.log('[Chat Save] 💾 保存对话:', {
      uuid,
      title: history.title,
      totalMessages: chatData.length,
      savedMessages: messagesToSave.length,
      truncated: chatData.length > messagesToSave.length
    })

    const assetData = {
      service: 'chat',
      type: 'conversation',
      asset_data: {
        uuid,
        title: history.title,
        messages: messagesToSave,  // 截断后的消息
        message_count: chatData.length,  // 保存真实消息总数
        saved_message_count: messagesToSave.length,
        is_edit: history.isEdit,
        created_at: new Date(uuid).toISOString(),
        updated_at: new Date().toISOString(),
        truncated: chatData.length > messagesToSave.length
      },
      task_id: uuid.toString(),
      main_url: null,
      prompt: history.title
    }

    const apiPath = getAssetsApiPath()
    const response = await fetch(apiPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(assetData)
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`API error: ${response.status} - ${JSON.stringify(error)}`)
    }

    const result = await response.json()
    console.log('[Chat Save] ✅ 保存成功:', result.asset?.id)
  } catch (error) {
    console.error('[Chat Save] ❌ 保存失败:', error)
    // 不抛出错误，静默失败，不影响用户体验
  }
}

// 防抖计时器
let saveAllDebounceTimer: NodeJS.Timeout | null = null

/**
 * 保存所有对话到数据库（优化版）
 * @param state - 完整的 ChatState
 * @param immediate - 是否立即保存，跳过防抖
 */
export async function saveAllChatsToDatabase(state: Chat.ChatState, immediate = false): Promise<void> {
  if (!homeStore.myData.session?.isDatabaseEnabled) {
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
    console.log('[Chat Batch Save] 🌐 开始智能保存对话...')

    const apiKey = gptServerStore.myData.OPENAI_API_KEY
    if (!apiKey) {
      console.warn('[Chat Batch Save] 未配置API Key，跳过保存')
      return
    }

    // 过滤掉生图会话和空对话，并限制保存数量
    const chatsToSave = state.history
      .map((history, index) => ({
        history,
        chatData: state.chat[index]?.data || []
      }))
      .filter(item => {
        // 排除生图会话
        if (item.history.uuid === CHAT_OPTIMIZATION_CONFIG.EXCLUDE_DRAW_UUID) {
          return false
        }
        // 排除空对话
        if (item.chatData.length === 0) {
          return false
        }
        return true
      })
      .slice(0, CHAT_OPTIMIZATION_CONFIG.MAX_CHATS_TO_SAVE) // 限制最多保存 N 个对话

    console.log('[Chat Batch Save] 📊 保存统计:', {
      总对话数: state.history.length,
      过滤后: chatsToSave.length,
      限制: CHAT_OPTIMIZATION_CONFIG.MAX_CHATS_TO_SAVE
    })

    // 并行保存筛选后的对话
    const savePromises = chatsToSave.map(item =>
      saveChatToDatabase(item.history.uuid, item.history, item.chatData)
    )

    await Promise.all(savePromises)
    console.log('[Chat Batch Save] ✅ 智能保存完成')
  } catch (error) {
    console.error('[Chat Batch Save] ❌ 批量保存失败:', error)
  }
}

/**
 * 从数据库读取所有对话
 * @returns ChatState 包含所有对话
 */
export async function getAllChatsFromDatabase(): Promise<Partial<Chat.ChatState> | null> {
  if (!homeStore.myData.session?.isDatabaseEnabled) {
    return null
  }
  console.log('[Chat Load] 🌐 开始从数据库加载对话...')

  try {
    const apiKey = gptServerStore.myData.OPENAI_API_KEY
    if (!apiKey) {
      console.warn('[Chat Load] ⚠️ 未配置API Key，跳过数据库读取')
      return null
    }

    const params = new URLSearchParams({
      service: 'chat',
      type: 'conversation',
      limit: '200',
      offset: '0'
    })

    const apiPath = getAssetsApiPath()
    console.log('[Chat Load] 请求路径:', `${apiPath}?${params}`)

    const response = await fetch(`${apiPath}?${params}`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey
      }
    })

    console.log('[Chat Load] 响应状态:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Chat Load] API错误响应:', errorText)
      throw new Error(`API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log(`[Chat Load] ✅ 从数据库加载 ${result.assets?.length || 0} 个对话`)

    if (!result.assets || result.assets.length === 0) {
      return null
    }

    // 转换数据库资产为 ChatState 格式
    const history: Chat.History[] = []
    const chat: { uuid: number; data: Chat.Chat[] }[] = []

    result.assets.forEach((asset: any) => {
      const assetData = asset.asset_data || {}
      const uuid = parseInt(asset.task_id) || assetData.uuid

      // 跳过默认生图会话
      if (uuid === 1002) return

      history.push({
        uuid,
        title: assetData.title || asset.prompt || 'New Chat',
        isEdit: assetData.is_edit || false
      })

      chat.push({
        uuid,
        data: assetData.messages || []
      })
    })

    // 按 UUID 降序排列（最新的在前）
    const sortedIndices = history
      .map((h, i) => ({ uuid: h.uuid, index: i }))
      .sort((a, b) => b.uuid - a.uuid)

    const sortedHistory = sortedIndices.map(item => history[item.index])
    const sortedChat = sortedIndices.map(item => chat[item.index])

    console.log(`[Chat Load] ✅ 转换完成:`, {
      总数: sortedHistory.length,
      示例: sortedHistory[0] ? {
        uuid: sortedHistory[0].uuid,
        title: sortedHistory[0].title,
        messageCount: sortedChat[0]?.data.length
      } : '无'
    })

    return {
      history: sortedHistory,
      chat: sortedChat
    }
  } catch (error) {
    console.error('[Chat Load] ❌ 加载失败:', error)
    return null
  }
}

/**
 * 从数据库删除单个对话
 * @param uuid - 对话UUID
 */
export async function deleteChatFromDatabase(uuid: number): Promise<void> {
  if (!homeStore.myData.session?.isDatabaseEnabled) {
    return
  }
  try {
    const apiKey = gptServerStore.myData.OPENAI_API_KEY
    if (!apiKey) {
      console.warn('[Chat Delete] 未配置API Key，跳过数据库删除')
      return
    }

    // 跳过默认的生图会话
    if (uuid === CHAT_OPTIMIZATION_CONFIG.EXCLUDE_DRAW_UUID) {
      return
    }

    console.log('[Chat Delete] 🗑️ 正在从数据库删除对话:', uuid)

    // 步骤1: 先查询获取资产ID（数据库需要资产ID而不是UUID）
    // 查询足够多的对话以确保能找到目标对话
    const params = new URLSearchParams({
      service: 'chat',
      type: 'conversation',
      limit: '200',
      offset: '0'
    })

    const apiPath = getAssetsApiPath()
    const response = await fetch(`${apiPath}?${params}`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`查询资产失败: ${response.status} - ${JSON.stringify(error)}`)
    }

    const result = await response.json()

    // 从查询结果中找到匹配的资产（通过 task_id 匹配 uuid）
    const asset = result.assets?.find((a: any) => {
      const taskId = a.task_id ? parseInt(a.task_id) : a.asset_data?.uuid
      return taskId === uuid
    })

    if (!asset) {
      console.warn('[Chat Delete] ⚠️ 数据库中未找到对应对话，可能已被删除或未保存')
      return
    }

    // 步骤2: 使用资产ID执行删除
    const deleteResponse = await fetch(`${apiPath}/${asset.id}`, {
      method: 'DELETE',
      headers: {
        'x-api-key': apiKey
      }
    })

    if (!deleteResponse.ok) {
      const error = await deleteResponse.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`删除资产失败: ${deleteResponse.status} - ${JSON.stringify(error)}`)
    }

    console.log('[Chat Delete] ✅ 数据库删除成功:', { uuid, assetId: asset.id })
  } catch (error) {
    console.error('[Chat Delete] ❌ 数据库删除失败:', error)
    // 不抛出错误，静默失败，不影响用户体验
  }
}
