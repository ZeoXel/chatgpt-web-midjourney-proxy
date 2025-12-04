/**
 * COS资产清理API - 删除JSON记录时同步删除COS上的实际文件
 *
 * 功能:
 * - 根据URL从COS中删除实际的文件资产（图片/视频/音频/模型）
 * - 支持批量删除
 * - 智能识别COS URL并提取Key
 * - 避免误删其他用户的资产
 */

import { Router } from 'express';
import { TencentCOSClient } from '../storage/cos-client';

const router = Router();
const cosClient = new TencentCOSClient();

/**
 * 从COS URL中提取Key
 * 支持格式:
 * - https://bucket-name.cos.ap-guangzhou.myqcloud.com/path/to/file.jpg
 * - https://cos.lsaigc.com/path/to/file.jpg
 */
function extractCOSKey(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const urlObj = new URL(url);

    // COS标准域名格式
    if (urlObj.hostname.includes('.cos.') && urlObj.hostname.includes('.myqcloud.com')) {
      return urlObj.pathname.substring(1); // 移除开头的 /
    }

    // 自定义域名格式
    if (urlObj.hostname.includes('cos.lsaigc.com')) {
      return urlObj.pathname.substring(1);
    }

    return null;
  } catch (error) {
    console.error('[Asset Cleanup] URL解析失败:', url, error);
    return null;
  }
}

/**
 * 验证Key是否属于用户
 * 确保不会误删其他用户的文件
 */
function validateUserKey(key: string, userUuid: string): boolean {
  if (!key || !userUuid) return false;

  // Key必须以userUuid开头
  return key.startsWith(`${userUuid}/`);
}

/**
 * 删除单个COS文件
 */
async function deleteSingleAsset(
  url: string,
  userUuid: string
): Promise<{ success: boolean; key?: string; error?: string }> {
  if (!cosClient.isServiceEnabled()) {
    return { success: false, error: 'COS服务未启用' };
  }

  // 1. 提取Key
  const key = extractCOSKey(url);
  if (!key) {
    console.log(`[Asset Cleanup] ⚠️ 非COS URL，跳过: ${url.substring(0, 80)}`);
    return { success: false, error: '非COS URL' };
  }

  // 2. 验证权限
  if (!validateUserKey(key, userUuid)) {
    console.error(`[Asset Cleanup] ❌ 权限验证失败: ${key} 不属于 ${userUuid}`);
    return { success: false, error: '权限验证失败' };
  }

  // 3. 删除文件
  try {
    await cosClient.deleteFile(key);
    console.log(`[Asset Cleanup] ✅ 删除成功: ${key}`);
    return { success: true, key };
  } catch (error: any) {
    // 文件不存在也算成功（幂等性）
    if (error.statusCode === 404 || error.code === 'NoSuchKey') {
      console.log(`[Asset Cleanup] ⚠️ 文件已不存在: ${key}`);
      return { success: true, key, error: '文件不存在' };
    }

    console.error(`[Asset Cleanup] ❌ 删除失败: ${key}`, error);
    return { success: false, error: error.message };
  }
}

/**
 * POST /api/asset-cleanup/delete
 * 删除单个资产文件
 *
 * Body:
 * {
 *   userUuid: "xxx",
 *   url: "https://xxx.cos.xxx.myqcloud.com/user/assets/xxx.jpg"
 * }
 */
router.post('/delete', async (req: any, res: any) => {
  try {
    const { userUuid, url } = req.body;

    if (!userUuid || !url) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid 或 url',
      });
    }

    console.log('[Asset Cleanup] 删除资产请求:', {
      userUuid,
      url: url.substring(0, 80) + '...',
    });

    const result = await deleteSingleAsset(url, userUuid);

    return res.json({
      success: result.success,
      message: result.success ? '删除成功' : '删除失败',
      key: result.key,
      error: result.error,
    });

  } catch (error: any) {
    console.error('[Asset Cleanup] 删除失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '删除失败',
    });
  }
});

/**
 * POST /api/asset-cleanup/delete-batch
 * 批量删除资产文件
 *
 * Body:
 * {
 *   userUuid: "xxx",
 *   urls: ["https://...", "https://..."]
 * }
 */
router.post('/delete-batch', async (req: any, res: any) => {
  try {
    const { userUuid, urls } = req.body;

    if (!userUuid || !urls || !Array.isArray(urls)) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid 或 urls (数组)',
      });
    }

    console.log('[Asset Cleanup] 批量删除请求:', {
      userUuid,
      count: urls.length,
    });

    // 并发删除所有文件
    const results = await Promise.all(
      urls.map(url => deleteSingleAsset(url, userUuid))
    );

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.length - successCount;

    console.log('[Asset Cleanup] 批量删除完成:', {
      total: urls.length,
      success: successCount,
      failed: failedCount,
    });

    return res.json({
      success: true,
      message: `删除完成: 成功${successCount}个, 失败${failedCount}个`,
      total: urls.length,
      successCount,
      failedCount,
      results,
    });

  } catch (error: any) {
    console.error('[Asset Cleanup] 批量删除失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '批量删除失败',
    });
  }
});

/**
 * POST /api/asset-cleanup/delete-from-record
 * 从记录中提取URL并删除
 *
 * 适用场景: 删除图片/视频/音频/模型记录时，自动删除所有关联的COS文件
 *
 * Body:
 * {
 *   userUuid: "xxx",
 *   record: {
 *     image_url: "...",
 *     cos_url: "...",
 *     poster_url: "...",
 *     // 任何包含URL的字段
 *   }
 * }
 */
router.post('/delete-from-record', async (req: any, res: any) => {
  try {
    const { userUuid, record } = req.body;

    if (!userUuid || !record || typeof record !== 'object') {
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid 或 record',
      });
    }

    console.log('[Asset Cleanup] 从记录删除资产:', {
      userUuid,
      recordKeys: Object.keys(record),
    });

    // 提取所有可能的URL字段
    const urlFields = [
      'image_url',
      'cos_url',
      'original_url',
      'audio_url',
      'video_url',
      'poster_url',
      'preview_url',
      'cos_model_url',
      'cos_base_model_url',
      'cos_pbr_model_url',
      'cos_stl_model_url',
      'cos_preview_url',
      'image_large_url',
    ];

    const urls: string[] = [];

    for (const field of urlFields) {
      const url = record[field];
      if (url && typeof url === 'string' && url.startsWith('http')) {
        urls.push(url);
      }
    }

    if (urls.length === 0) {
      console.log('[Asset Cleanup] 未找到COS URL');
      return res.json({
        success: true,
        message: '未找到需要删除的COS资产',
        deletedCount: 0,
      });
    }

    console.log(`[Asset Cleanup] 找到 ${urls.length} 个URL，开始删除...`);

    // 批量删除
    const results = await Promise.all(
      urls.map(url => deleteSingleAsset(url, userUuid))
    );

    const successCount = results.filter(r => r.success).length;

    console.log('[Asset Cleanup] 记录资产删除完成:', {
      total: urls.length,
      success: successCount,
    });

    return res.json({
      success: true,
      message: `删除完成: ${successCount}/${urls.length}`,
      deletedCount: successCount,
      results,
    });

  } catch (error: any) {
    console.error('[Asset Cleanup] 从记录删除失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '删除失败',
    });
  }
});

export default router;
