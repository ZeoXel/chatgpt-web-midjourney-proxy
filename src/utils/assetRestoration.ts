/**
 * 跨平台资产复原系统
 *
 * 功能: 根据用户UUID自动从COS加载所有资产数据
 * 资产类型:
 *   1. 对话历史 (conversations.json.gz)
 *   2. MJ图片 (assets/mj/mj-images.json)
 *   3. 通用图片 (assets/image/images.json)
 *   4. 音乐 (assets/audio/music.json)
 *   5. 视频 (assets/video/videos.json)
 *   6. 3D模型 (assets/model/models.json)
 */

import { getUserUuid } from './userUuid'
import { loadMJImagesFromCOS } from '@/api/mjStorage'
import { loadImagesFromCOS } from '@/api/imageStorage'
import { loadSunoAudiosFromCOS } from '@/api/sunoStorage'
import { loadVideosFromCOS } from '@/api/videoStorage'
import { loadModelsFromCOS } from '@/api/modelStorage'

export interface AssetRestorationResult {
  success: boolean
  userUuid: string | null
  assets: {
    conversations?: number  // 对话数量
    mjImages?: number       // MJ图片数量
    images?: number         // 通用图片数量
    music?: number          // 音乐数量
    videos?: number         // 视频数量
    models?: number         // 模型数量
  }
  errors: string[]
}

/**
 * 主入口: 复原所有资产
 */
export async function restoreAllAssets(): Promise<AssetRestorationResult> {
  const result: AssetRestorationResult = {
    success: false,
    userUuid: null,
    assets: {},
    errors: []
  }

  try {
    // 1. 获取用户UUID
    const userUuid = getUserUuid()
    if (!userUuid) {
      result.errors.push('未找到用户UUID，无法复原资产')
      console.log('[Asset Restoration] ⚠️ 未找到UUID，跳过资产复原')
      return result
    }

    result.userUuid = userUuid
    console.log('[Asset Restoration] 🔄 开始复原资产...', { userUuid })

    // 2. 并行加载所有资产类型
    const [mjImages, images, music, videos, models] = await Promise.allSettled([
      loadMJImagesFromCOS({ limit: 200 }),
      loadImagesFromCOS({ limit: 200 }),
      loadSunoAudiosFromCOS({ limit: 100 }),
      loadVideosFromCOS({ limit: 100 }),
      loadModelsFromCOS({ limit: 50 })
    ])

    // 3. 处理MJ图片
    if (mjImages.status === 'fulfilled') {
      result.assets.mjImages = mjImages.value?.length || 0
      console.log(`[Asset Restoration] ✅ MJ图片: ${result.assets.mjImages} 张`)
    } else {
      result.errors.push(`MJ图片加载失败: ${mjImages.reason}`)
      console.warn('[Asset Restoration] ⚠️ MJ图片加载失败:', mjImages.reason)
    }

    // 4. 处理通用图片
    if (images.status === 'fulfilled') {
      result.assets.images = images.value?.length || 0
      console.log(`[Asset Restoration] ✅ 通用图片: ${result.assets.images} 张`)
    } else {
      result.errors.push(`通用图片加载失败: ${images.reason}`)
      console.warn('[Asset Restoration] ⚠️ 通用图片加载失败:', images.reason)
    }

    // 5. 处理音乐
    if (music.status === 'fulfilled') {
      result.assets.music = music.value?.length || 0
      console.log(`[Asset Restoration] ✅ 音乐: ${result.assets.music} 首`)
    } else {
      result.errors.push(`音乐加载失败: ${music.reason}`)
      console.warn('[Asset Restoration] ⚠️ 音乐加载失败:', music.reason)
    }

    // 6. 处理视频
    if (videos.status === 'fulfilled') {
      result.assets.videos = videos.value?.length || 0
      console.log(`[Asset Restoration] ✅ 视频: ${result.assets.videos} 个`)
    } else {
      result.errors.push(`视频加载失败: ${videos.reason}`)
      console.warn('[Asset Restoration] ⚠️ 视频加载失败:', videos.reason)
    }

    // 7. 处理3D模型
    if (models.status === 'fulfilled') {
      result.assets.models = models.value?.length || 0
      console.log(`[Asset Restoration] ✅ 3D模型: ${result.assets.models} 个`)
    } else {
      result.errors.push(`3D模型加载失败: ${models.reason}`)
      console.warn('[Asset Restoration] ⚠️ 3D模型加载失败:', models.reason)
    }

    // 8. 汇总结果
    const totalAssets = Object.values(result.assets).reduce((sum, count) => sum + (count || 0), 0)
    result.success = totalAssets > 0 || result.errors.length === 0

    console.log('[Asset Restoration] 📊 复原完成:', {
      总资产数: totalAssets,
      详情: result.assets,
      错误数: result.errors.length
    })

    return result

  } catch (error: any) {
    console.error('[Asset Restoration] ❌ 复原失败:', error)
    result.errors.push(`全局错误: ${error.message || error}`)
    return result
  }
}

/**
 * 获取资产复原摘要信息
 */
export function getRestorationSummary(result: AssetRestorationResult): string {
  if (!result.userUuid) {
    return '未登录，无法同步资产'
  }

  const total = Object.values(result.assets).reduce((sum, count) => sum + (count || 0), 0)

  if (total === 0) {
    return '暂无云端资产'
  }

  const parts: string[] = []
  if (result.assets.mjImages) parts.push(`MJ图片${result.assets.mjImages}张`)
  if (result.assets.images) parts.push(`图片${result.assets.images}张`)
  if (result.assets.music) parts.push(`音乐${result.assets.music}首`)
  if (result.assets.videos) parts.push(`视频${result.assets.videos}个`)
  if (result.assets.models) parts.push(`模型${result.assets.models}个`)

  return `已同步: ${parts.join('、')}`
}

/**
 * 检查是否需要复原资产
 */
export function shouldRestoreAssets(): boolean {
  const userUuid = getUserUuid()
  if (!userUuid) {
    return false
  }

  // 检查localStorage中是否已有资产缓存
  const hasLocalAssets = localStorage.getItem('MJ:gallery:images') !== null

  // 即使有本地缓存，也尝试同步（合并策略）
  return true
}
