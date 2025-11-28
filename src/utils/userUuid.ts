/**
 * 用户UUID管理工具
 *
 * 优先级:
 * 1. gptServerStore.myData.USER_UUID (前端设置-服务端配置)
 * 2. URL hash参数: #/?uuid=xxx
 *
 * UUID会自动保存到gptServerStore,无需每次从URL读取
 *
 * URL格式示例: https://www.lsaigc.chat/#/?uuid=90b3b85c-0bfb-444d-a5e7-b7fb5a2bef15
 */

import { gptServerStore } from '@/store/homeStore'

let cachedUserUuid: string | null = null

/**
 * 从URL hash中提取UUID
 */
function extractUuidFromUrl(): string | null {
  try {
    // 获取hash部分 (例如: #/?uuid=xxx&other=yyy)
    const hash = window.location.hash
    console.log('[UserUUID] 完整hash:', hash)

    if (!hash || hash === '#' || hash === '#/') {
      console.log('[UserUUID] hash为空或仅为#/')
      return null
    }

    // 移除开头的 #/ 或 #
    const cleanHash = hash.replace(/^#\/?/, '')
    console.log('[UserUUID] 清理后hash:', cleanHash)

    // 解析查询参数
    const queryStart = cleanHash.indexOf('?')
    if (queryStart === -1) {
      console.log('[UserUUID] 未找到查询参数')
      return null
    }

    const queryString = cleanHash.substring(queryStart + 1)
    console.log('[UserUUID] 查询字符串:', queryString)

    const params = new URLSearchParams(queryString)
    const uuid = params.get('uuid')
    console.log('[UserUUID] 提取的UUID:', uuid)

    if (uuid && uuid.trim()) {
      // 验证UUID格式 (标准UUID格式)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (uuidRegex.test(uuid.trim())) {
        return uuid.trim()
      } else {
        console.warn('[UserUUID] UUID格式无效:', uuid)
        return null
      }
    }

    console.log('[UserUUID] UUID参数不存在或为空')
    return null
  } catch (error) {
    console.error('[UserUUID] 提取UUID失败:', error)
    return null
  }
}

/**
 * 获取当前用户的UUID
 *
 * 直接从gptServerStore读取,URL参数由openaiSetting函数处理
 *
 * @returns 用户UUID,如果不存在返回null
 */
export function getUserUuid(): string | null {
  // 优先从缓存读取
  if (cachedUserUuid) {
    return cachedUserUuid
  }

  // 从gptServerStore读取(已由openaiSetting从URL初始化)
  const storeUuid = gptServerStore.myData.USER_UUID
  if (storeUuid && storeUuid.trim()) {
    cachedUserUuid = storeUuid.trim()
    console.log('[UserUUID] ✅ UUID:', cachedUserUuid)
    return cachedUserUuid
  }

  console.log('[UserUUID] ⚠️ 未找到UUID (请在设置中配置或通过URL传入)')
  return null
}

/**
 * 重新加载UUID (用于URL变化或手动刷新时)
 */
export function refreshUserUuid(): string | null {
  cachedUserUuid = null
  return getUserUuid()
}

/**
 * 手动设置UUID (用于前端设置界面)
 */
export function setUserUuid(uuid: string): void {
  const trimmedUuid = uuid.trim()

  // 验证UUID格式
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (trimmedUuid && !uuidRegex.test(trimmedUuid)) {
    console.warn('[UserUUID] UUID格式无效:', uuid)
    return
  }

  cachedUserUuid = trimmedUuid || null
  gptServerStore.setMyData({ USER_UUID: trimmedUuid })
  console.log('[UserUUID] UUID已更新:', trimmedUuid || '(已清空)')
}

/**
 * 检查是否有有效的用户UUID
 */
export function hasUserUuid(): boolean {
  return getUserUuid() !== null
}

/**
 * 清除缓存的UUID
 */
export function clearUserUuid(): void {
  cachedUserUuid = null
}
