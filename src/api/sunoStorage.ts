/**
 * Suno音频COS JSON存储API封装
 *
 * 替代数据库存储,使用COS JSON文件存储Suno音频URL
 */

import { getUserUuid } from '@/utils/userUuid';
import type { SunoMedia } from './sunoStore';

/**
 * 保存Suno音频到COS JSON文件
 * @param audio - Suno音频对象
 */
export async function saveSunoAudioToCOS(audio: SunoMedia): Promise<void> {
  const userUuid = getUserUuid();
  if (!userUuid) {
    console.warn('[Suno COS Storage] 未找到userUuid,跳过保存');
    return;
  }

  try {
    const response = await fetch('/api/suno-storage/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userUuid,
        audio: {
          id: audio.id,
          task_id: audio.id,
          title: audio.title,
          audio_url: audio.audio_url,
          image_url: audio.image_url,
          image_large_url: audio.image_large_url,
          lyric: audio.metadata?.lyric,
          prompt: audio.metadata?.prompt || audio.metadata?.gpt_description_prompt,
          tags: audio.metadata?.tags,
          duration: audio.metadata?.duration,
          status: audio.status,
          created_at: audio.created_at,
          metadata: audio.metadata,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`保存失败: ${response.status} - ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    console.log('[Suno COS Storage] ✅ 保存成功:', result.total, '首音频');
  } catch (error) {
    console.error('[Suno COS Storage] ❌ 保存失败:', error);
    throw error;
  }
}

/**
 * 从COS JSON文件加载Suno音频列表
 * @param options - 分页选项
 */
export async function loadSunoAudiosFromCOS(options?: {
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const userUuid = getUserUuid();
  if (!userUuid) {
    console.warn('[Suno COS Storage] 未找到userUuid,返回空数组');
    return [];
  }

  try {
    const params = new URLSearchParams({
      userUuid,
      limit: (options?.limit || 50).toString(),
      offset: (options?.offset || 0).toString(),
    });

    const response = await fetch(`/api/suno-storage/list?${params}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`加载失败: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`[Suno COS Storage] ✅ 加载成功: ${result.audios?.length || 0} 首音频`);
    return result.audios || [];
  } catch (error) {
    console.error('[Suno COS Storage] ❌ 加载失败:', error);
    return [];
  }
}

/**
 * 从COS JSON文件删除Suno音频
 * @param audioId - 音频ID
 */
export async function deleteSunoAudioFromCOS(audioId: string): Promise<void> {
  const userUuid = getUserUuid();
  if (!userUuid) {
    console.warn('[Suno COS Storage] 未找到userUuid,跳过删除');
    return;
  }

  try {
    const response = await fetch('/api/suno-storage/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userUuid,
        audioId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`删除失败: ${response.status} - ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    console.log('[Suno COS Storage] ✅ 删除成功:', result.total, '首音频');
  } catch (error) {
    console.error('[Suno COS Storage] ❌ 删除失败:', error);
    throw error;
  }
}
