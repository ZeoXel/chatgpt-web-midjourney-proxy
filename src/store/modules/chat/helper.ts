import { ss } from '@/utils/storage'

const LOCAL_NAME = 'chatStorage'
const LAST_CHAT_UUID_KEY = 'lastChatUuid'

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

export function setLocalState(state: Chat.ChatState) {
  ss.set(LOCAL_NAME, state)
}

// 保存聊天模块的最后活动uuid
export function setLastChatUuid(uuid: number | null) {
  ss.set(LAST_CHAT_UUID_KEY, uuid)
}

// 获取聊天模块的最后活动uuid
export function getLastChatUuid(): number | null {
  return ss.get(LAST_CHAT_UUID_KEY)
}
