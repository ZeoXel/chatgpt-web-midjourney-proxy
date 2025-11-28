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
 *
 * 缓存机制: 使用localStorage缓存5分钟,减少重复请求
 */

import { getUserUuid } from './userUuid'
import { loadMJImagesFromCOS } from '@/api/mjStorage'
import { loadImagesFromCOS } from '@/api/imageStorage'
import { loadSunoAudiosFromCOS } from '@/api/sunoStorage'
import { loadVideosFromCOS } from '@/api/videoStorage'
import { loadModelsFromCOS } from '@/api/modelStorage'
import { getCache, setCache, CACHE_KEYS } from './assetCache'

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
  cached: boolean  // 是否使用了缓存
}

/**
 * 带缓存的异步数据加载器
 */
async function loadWithCache<T>(
  cacheKey: string,
  loader: () => Promise<T>,
  dataKey: string
): Promise<T | null> {
  // 1. 尝试从缓存加载
  const cached = getCache<T>(cacheKey)
  if (cached) {
    console.log(`[Asset Restoration] 📦 使用缓存: ${dataKey}`)
    return cached
  }

  // 2. 从COS加载
  try {
    const data = await loader()
    // 保存到缓存
    setCache(cacheKey, data)
    return data
  } catch (error) {
    console.error(`[Asset Restoration] ❌ ${dataKey}加载失败:`, error)
    return null
  }
}

/**
 * 主入口: 复原所有资产
 */
export async function restoreAllAssets(): Promise<AssetRestorationResult> {
  const result: AssetRestorationResult = {
    success: false,
    userUuid: null,
    assets: {},
    errors: [],
    cached: false
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

    // 2. 并行加载所有资产类型(带缓存)
    const [mjImages, images, music, videos, models] = await Promise.all([
      loadWithCache(CACHE_KEYS.MJ_IMAGES, () => loadMJImagesFromCOS({ limit: 200 }), 'MJ图片'),
      loadWithCache(CACHE_KEYS.IMAGES, () => loadImagesFromCOS({ limit: 200 }), '通用图片'),
      loadWithCache(CACHE_KEYS.MUSIC, () => loadSunoAudiosFromCOS({ limit: 100 }), '音乐'),
      loadWithCache(CACHE_KEYS.VIDEOS, () => loadVideosFromCOS({ limit: 100 }), '视频'),
      loadWithCache(CACHE_KEYS.MODELS, () => loadModelsFromCOS({ limit: 50 }), '3D模型')
    ])

    // 3. 处理MJ图片
    if (mjImages) {
      result.assets.mjImages = (mjImages as any[])?.length || 0
      console.log(`[Asset Restoration] ✅ MJ图片: ${result.assets.mjImages} 张`)
    } else {
      result.errors.push('MJ图片加载失败')
    }

    // 4. 处理通用图片
    if (images) {
      result.assets.images = (images as any[])?.length || 0
      console.log(`[Asset Restoration] ✅ 通用图片: ${result.assets.images} 张`)
    } else {
      result.errors.push('通用图片加载失败')
    }

    // 5. 处理音乐
    if (music) {
      result.assets.music = (music as any[])?.length || 0
      console.log(`[Asset Restoration] ✅ 音乐: ${result.assets.music} 首`)
    } else {
      result.errors.push('音乐加载失败')
    }

    // 6. 处理视频
    if (videos) {
      result.assets.videos = (videos as any[])?.length || 0
      console.log(`[Asset Restoration] ✅ 视频: ${result.assets.videos} 个`)
    } else {
      result.errors.push('视频加载失败')
    }

    // 7. 处理3D模型
    if (models) {
      result.assets.models = (models as any[])?.length || 0
      console.log(`[Asset Restoration] ✅ 3D模型: ${result.assets.models} 个`)
    } else {
      result.errors.push('3D模型加载失败')
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
