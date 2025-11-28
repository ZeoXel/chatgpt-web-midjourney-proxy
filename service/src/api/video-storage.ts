/**
 * 视频COS存储API - 下载视频+JSON记录
 *
 * 功能:
 * 1. 下载外部视频URL到COS ({userUuid}/assets/video/{hash}.mp4)
 * 2. 保存视频元数据到JSON文件 ({userUuid}/assets/video/videos.json)
 * 3. 支持所有视频服务: Vidu, Luma, Runway, Kling, Pika等
 */

import { Router } from 'express';
import { TencentCOSClient } from '../storage/cos-client';
import { AssetProcessor } from '../storage/asset-processor';

const router = Router();
const cosClient = new TencentCOSClient();
const assetProcessor = new AssetProcessor();

/**
 * 视频记录接口
 */
interface VideoRecord {
  id: string;                      // 任务ID
  service: string;                 // 服务名称: vidu, luma, runway等
  model: string;                   // 模型名称
  prompt: string;                  // 提示词
  original_url: string;            // 原始视频URL
  cos_url: string;                 // COS视频URL
  poster_url?: string;             // 封面图URL
  duration?: number;               // 视频时长(秒)
  aspect_ratio?: string;           // 宽高比
  status: string;                  // 状态
  created_at: string;              // 创建时间
  metadata?: any;                  // 其他元数据
}

interface VideosFile {
  version: string;
  updated_at: string;
  videos: VideoRecord[];
}

/**
 * 获取JSON文件路径
 */
function getVideosJsonPath(userUuid: string): string {
  return `${userUuid}/assets/video/videos.json`;
}

/**
 * 加载视频列表
 */
async function loadVideos(userUuid: string): Promise<VideoRecord[]> {
  if (!cosClient.isServiceEnabled()) {
    console.log('[Video Storage] COS服务未启用');
    return [];
  }

  try {
    const key = getVideosJsonPath(userUuid);
    const buffer = await cosClient.downloadFile(key);

    if (!buffer) {
      console.log('[Video Storage] 文件不存在,返回空数组');
      return [];
    }

    const content = buffer.toString('utf-8');
    const data: VideosFile = JSON.parse(content);
    console.log(`[Video Storage] 加载成功: ${data.videos.length} 个视频`);

    return data.videos || [];
  } catch (error: any) {
    if (error.statusCode === 404 || error.code === 'NoSuchKey') {
      console.log('[Video Storage] 文件不存在,返回空数组');
      return [];
    }
    console.error('[Video Storage] 加载失败:', error);
    throw error;
  }
}

/**
 * 保存视频列表
 */
async function saveVideos(userUuid: string, videos: VideoRecord[]): Promise<void> {
  if (!cosClient.isServiceEnabled()) {
    throw new Error('COS服务未启用');
  }

  try {
    const key = getVideosJsonPath(userUuid);

    const data: VideosFile = {
      version: '1.0',
      updated_at: new Date().toISOString(),
      videos: videos,
    };

    const content = JSON.stringify(data, null, 2);
    await cosClient.uploadFile(Buffer.from(content), key, 'application/json');

    console.log(`[Video Storage] 保存成功: ${videos.length} 个视频`);
  } catch (error) {
    console.error('[Video Storage] 保存失败:', error);
    throw error;
  }
}

/**
 * POST /api/video-storage/save
 * 下载视频到COS并保存记录
 *
 * Body:
 * {
 *   userUuid: "xxx",
 *   video: {
 *     id: "task-123",
 *     service: "vidu",
 *     model: "vidu2.0",
 *     prompt: "猫咪玩球",
 *     original_url: "https://s3.vidu.ai/xxx.mp4",
 *     poster_url: "...",
 *     duration: 4,
 *     status: "success",
 *     created_at: "2025-11-28T09:00:00Z"
 *   }
 * }
 */
router.post('/save', async (req: any, res: any) => {
  try {
    const { userUuid, video } = req.body;

    if (!userUuid) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid',
      });
    }

    if (!video || !video.id || !video.original_url) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: video.id 或 video.original_url',
      });
    }

    console.log(`[Video Storage] 保存视频: ${video.service}/${video.id}`);

    // 1. 下载视频到COS (使用AssetProcessor)
    console.log(`[Video Storage] 开始下载视频: ${video.original_url}`);
    const assetResult = await assetProcessor.processAssetUrl(userUuid, video.original_url);

    if (assetResult.error) {
      console.error(`[Video Storage] 视频下载失败:`, assetResult.error);
      return res.status(500).json({
        success: false,
        error: `视频下载失败: ${assetResult.error}`,
      });
    }

    console.log(`[Video Storage] 视频下载成功: ${assetResult.cosUrl}`);

    // 2. 下载封面图到COS (如果有)
    let posterCosUrl = video.poster_url;
    if (video.poster_url && video.poster_url.startsWith('http')) {
      console.log(`[Video Storage] 下载封面图: ${video.poster_url}`);
      const posterResult = await assetProcessor.processAssetUrl(userUuid, video.poster_url);
      if (!posterResult.error) {
        posterCosUrl = posterResult.cosUrl;
        console.log(`[Video Storage] 封面图下载成功: ${posterCosUrl}`);
      }
    }

    // 3. 读取现有视频列表
    const videos = await loadVideos(userUuid);

    // 4. 添加或更新视频记录
    const existingIndex = videos.findIndex(v => v.id === video.id);

    const newVideo: VideoRecord = {
      id: video.id,
      service: video.service || 'unknown',
      model: video.model || '',
      prompt: video.prompt || '',
      original_url: video.original_url,
      cos_url: assetResult.cosUrl || video.original_url,
      poster_url: posterCosUrl,
      duration: video.duration,
      aspect_ratio: video.aspect_ratio,
      status: video.status || 'success',
      created_at: video.created_at || new Date().toISOString(),
      metadata: video.metadata,
    };

    if (existingIndex >= 0) {
      // 更新现有记录
      videos[existingIndex] = newVideo;
      console.log(`[Video Storage] 更新视频记录: ${video.id}`);
    } else {
      // 添加新记录(放在开头)
      videos.unshift(newVideo);
      console.log(`[Video Storage] 添加视频记录: ${video.id}`);
    }

    // 5. 保存到COS JSON
    await saveVideos(userUuid, videos);

    return res.json({
      success: true,
      message: '保存成功',
      total: videos.length,
      video: {
        ...newVideo,
        downloaded: true,
        size: assetResult.size,
      },
    });

  } catch (error: any) {
    console.error('[Video Storage] 保存失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '保存失败',
    });
  }
});

/**
 * GET /api/video-storage/list
 * 获取视频列表
 *
 * Query:
 * - userUuid: 用户UUID
 * - service: 可选,筛选服务 (vidu, luma等)
 * - limit: 限制数量,默认50
 * - offset: 偏移量,默认0
 */
router.get('/list', async (req: any, res: any) => {
  try {
    const { userUuid, service, limit = '50', offset = '0' } = req.query;

    if (!userUuid) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid',
      });
    }

    // 加载所有视频
    let allVideos = await loadVideos(userUuid);

    // 按服务筛选
    if (service) {
      allVideos = allVideos.filter(v => v.service === service);
    }

    // 分页
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);
    const videos = allVideos.slice(offsetNum, offsetNum + limitNum);

    return res.json({
      success: true,
      total: allVideos.length,
      videos,
    });

  } catch (error: any) {
    console.error('[Video Storage] 加载失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '加载失败',
    });
  }
});

/**
 * DELETE /api/video-storage/delete
 * 删除视频记录(不删除COS文件,因为可能被多个记录引用)
 *
 * Body:
 * {
 *   userUuid: "xxx",
 *   videoId: "task-123"
 * }
 */
router.delete('/delete', async (req: any, res: any) => {
  try {
    const { userUuid, videoId } = req.body;

    if (!userUuid || !videoId) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid 或 videoId',
      });
    }

    const videos = await loadVideos(userUuid);
    const newVideos = videos.filter(v => v.id !== videoId);

    if (newVideos.length === videos.length) {
      return res.status(404).json({
        success: false,
        error: '视频记录不存在',
      });
    }

    await saveVideos(userUuid, newVideos);

    console.log(`[Video Storage] 删除视频记录: ${videoId}`);

    return res.json({
      success: true,
      message: '删除成功',
      total: newVideos.length,
    });

  } catch (error: any) {
    console.error('[Video Storage] 删除失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '删除失败',
    });
  }
});

export default router;
