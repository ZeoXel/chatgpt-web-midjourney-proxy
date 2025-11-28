/**
 * 资产镜像 API - 下载外部资产到 COS
 *
 * 功能：将 AI 生成的外部 URL 资产下载到 COS，返回 COS URL
 * 适用：Suno音频、MJ图片、Vidu视频、Luma视频等所有AI生成资产
 */

import { Router } from 'express';
import { AssetProcessor } from '../storage/asset-processor';

const router = Router();
const assetProcessor = new AssetProcessor();

/**
 * 下载单个资产到 COS
 * POST /api/asset-mirror/single
 *
 * Body:
 * {
 *   url: "https://cdn.suno.ai/xxx.mp3",
 *   userId: "user-001"  // 可选，用于目录隔离
 * }
 *
 * Response:
 * {
 *   success: true,
 *   originalUrl: "https://cdn.suno.ai/xxx.mp3",
 *   cosUrl: "https://cos.lsaigc.com/users/user-001/assets/audio/xxx.mp3",
 *   type: "audio",
 *   size: 2048576
 * }
 */
router.post('/single', async (req: any, res: any) => {
  try {
    const { url, userId = 'anonymous' } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: url',
      });
    }

    console.log(`[Asset Mirror] 开始镜像资产: ${url}`);

    // 使用 AssetProcessor 下载并上传到 COS
    const result = await assetProcessor.processAssetUrl(userId, url);

    if (result.error) {
      return res.status(500).json({
        success: false,
        error: result.error,
        originalUrl: result.originalUrl,
      });
    }

    console.log(`[Asset Mirror] ✅ 镜像成功: ${url} → ${result.cosUrl}`);

    return res.json({
      success: true,
      originalUrl: result.originalUrl,
      cosUrl: result.cosUrl,
      type: result.type,
      size: result.size,
      hash: result.hash,
    });

  } catch (error: any) {
    console.error('[Asset Mirror] 镜像失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '资产镜像失败',
    });
  }
});

/**
 * 批量下载资产到 COS
 * POST /api/asset-mirror/batch
 *
 * Body:
 * {
 *   urls: ["https://cdn.suno.ai/xxx.mp3", "https://mj.com/yyy.png"],
 *   userId: "user-001"
 * }
 *
 * Response:
 * {
 *   success: true,
 *   processed: 2,
 *   failed: 0,
 *   results: [
 *     { originalUrl: "xxx", cosUrl: "xxx", type: "audio" },
 *     { originalUrl: "yyy", cosUrl: "yyy", type: "image" }
 *   ]
 * }
 */
router.post('/batch', async (req: any, res: any) => {
  try {
    const { urls, userId = 'anonymous' } = req.body;

    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: urls (数组)',
      });
    }

    console.log(`[Asset Mirror] 开始批量镜像: ${urls.length} 个资产`);

    // 使用 AssetProcessor 批量处理
    const result = await assetProcessor.processAssetUrls(userId, urls);

    console.log(`[Asset Mirror] ✅ 批量镜像完成: 成功=${result.processed}, 失败=${result.failed}`);

    return res.json({
      success: result.success,
      processed: result.processed,
      failed: result.failed,
      results: result.assets,
    });

  } catch (error: any) {
    console.error('[Asset Mirror] 批量镜像失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '批量镜像失败',
    });
  }
});

/**
 * 清除 URL 缓存
 * POST /api/asset-mirror/clear-cache
 */
router.post('/clear-cache', async (req: any, res: any) => {
  try {
    assetProcessor.clearCache();

    return res.json({
      success: true,
      message: '缓存已清除',
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 获取缓存统计
 * GET /api/asset-mirror/cache-stats
 */
router.get('/cache-stats', async (req: any, res: any) => {
  try {
    const stats = assetProcessor.getCacheStats();

    return res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
