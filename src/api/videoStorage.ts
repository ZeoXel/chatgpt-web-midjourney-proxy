/**
 * 视频COS存储API封装
 *
 * 功能:
 * 1. 下载视频URL到COS并保存JSON记录
 * 2. 从COS JSON加载视频列表
 * 3. 支持所有视频服务
 */

import { getUserUuid } from '@/utils/userUuid';

/**
 * 视频记录接口
 */
export interface VideoRecord {
  id: string;
  service: string;
  model: string;
  prompt: string;
  original_url: string;
  cos_url: string;
  poster_url?: string;
  duration?: number;
  aspect_ratio?: string;
  status: string;
  created_at: string;
  metadata?: any;
}

/**
 * 保存视频到COS并记录到JSON
 * @param video 视频信息
 */
export async function saveVideoToCOS(video: {
  id: string;
  service: string;
  model?: string;
  prompt?: string;
  original_url: string;
  poster_url?: string;
  duration?: number;
  aspect_ratio?: string;
  status?: string;
  created_at?: string;
  metadata?: any;
}): Promise<void> {
  const userUuid = getUserUuid();

  if (!userUuid) {
    console.warn('[Video COS Storage] 未找到userUuid,跳过保存');
    return;
  }

  if (!video.original_url) {
    console.warn('[Video COS Storage] 缺少original_url,跳过保存');
    return;
  }

  try {
    console.log(`[Video COS Storage] 开始保存视频: ${video.service}/${video.id}`);
    console.log(`[Video COS Storage] 原始URL: ${video.original_url}`);

    const response = await fetch('/api/video-storage/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userUuid,
        video: {
          id: video.id,
          service: video.service,
          model: video.model || '',
          prompt: video.prompt || '',
          original_url: video.original_url,
          poster_url: video.poster_url,
          duration: video.duration,
          aspect_ratio: video.aspect_ratio,
          status: video.status || 'success',
          created_at: video.created_at || new Date().toISOString(),
          metadata: video.metadata,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`保存失败: ${response.status} - ${JSON.stringify(error)}`);
    }

    const result = await response.json();

    console.log(`[Video COS Storage] ✅ 保存成功:`, {
      id: video.id,
      service: video.service,
      cos_url: result.video?.cos_url,
      size: result.video?.size,
      total: result.total,
    });

  } catch (error: any) {
    console.error('[Video COS Storage] ❌ 保存失败:', error.message);
    // 不抛出错误,避免影响用户体验
  }
}

/**
 * 从COS JSON加载视频列表
 * @param options 加载选项
 */
export async function loadVideosFromCOS(options?: {
  service?: string;
  limit?: number;
  offset?: number;
}): Promise<VideoRecord[]> {
  const userUuid = getUserUuid();

  if (!userUuid) {
    console.warn('[Video COS Storage] 未找到userUuid');
    return [];
  }

  try {
    const params = new URLSearchParams({
      userUuid,
      ...(options?.service && { service: options.service }),
      limit: (options?.limit || 50).toString(),
      offset: (options?.offset || 0).toString(),
    });

    const response = await fetch(`/api/video-storage/list?${params}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`加载失败: ${response.status} - ${JSON.stringify(error)}`);
    }

    const result = await response.json();

    console.log(`[Video COS Storage] ✅ 加载成功: ${result.videos?.length || 0} 个视频`);

    return result.videos || [];

  } catch (error: any) {
    console.error('[Video COS Storage] ❌ 加载失败:', error.message);
    return [];
  }
}

/**
 * 删除视频记录
 * @param videoId 视频ID
 */
export async function deleteVideoFromCOS(videoId: string): Promise<boolean> {
  const userUuid = getUserUuid();

  if (!userUuid) {
    console.warn('[Video COS Storage] 未找到userUuid');
    return false;
  }

  try {
    const response = await fetch('/api/video-storage/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userUuid,
        videoId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`删除失败: ${response.status} - ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    console.log(`[Video COS Storage] ✅ 删除成功: ${videoId}, 剩余 ${result.total} 个`);

    return true;

  } catch (error: any) {
    console.error('[Video COS Storage] ❌ 删除失败:', error.message);
    return false;
  }
}
