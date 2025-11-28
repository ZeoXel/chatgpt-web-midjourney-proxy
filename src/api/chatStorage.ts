/**
 * COS对话历史存储API接口
 *
 * 与后端 /api/chat-storage 接口交互
 */

import type { GenericAbortSignal } from 'axios'
import { post, get } from '@/utils/request'
import type { ChatState } from '@/store/modules/chat/helper'

/**
 * 保存对话历史到COS
 */
export function saveChatStorageToCOS<T = any>(
  uuid: string,
  chatState: ChatState,
  signal?: GenericAbortSignal,
) {
  return post<T>({
    url: `/chat-storage/${uuid}`,
    data: chatState,
    signal,
  })
}

/**
 * 从COS加载对话历史
 */
export function loadChatStorageFromCOS<T = any>(
  uuid: string,
  signal?: GenericAbortSignal,
) {
  return get<T>({
    url: `/chat-storage/${uuid}`,
    signal,
  })
}
