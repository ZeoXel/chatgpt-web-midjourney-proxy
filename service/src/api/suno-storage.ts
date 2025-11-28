/**
 * Suno音频存储API - 将Suno音频URL存储到COS JSON文件
 *
 * 存储位置: {userUuid}/assets/suno/audios.json
 */

import { Router } from 'express';
import { TencentCOSClient } from '../storage/cos-client';

const router = Router();
const cosClient = new TencentCOSClient();

interface SunoAudio {
  id: string;
  task_id: string;
  title: string;
  audio_url: string;
  image_url?: string;
  image_large_url?: string;
  lyric?: string;
  prompt?: string;
  tags?: string;
  duration?: number;
  status: string;
  created_at: string;
  metadata?: any;
}

interface SunoAudiosFile {
  version: string;
  updated_at: string;
  audios: SunoAudio[];
}

/**
 * 获取用户的Suno音频JSON文件路径
 */
function getSunoAudiosPath(userUuid: string): string {
  return `${userUuid}/assets/suno/audios.json`;
}

/**
 * 从COS加载Suno音频列表
 */
async function loadSunoAudios(userUuid: string): Promise<SunoAudio[]> {
  if (!cosClient.isServiceEnabled()) {
    console.warn('[Suno Storage] COS未启用');
    return [];
  }

  try {
    const key = getSunoAudiosPath(userUuid);
    console.log(`[Suno Storage] 从COS加载: ${key}`);

    const buffer = await cosClient.downloadFile(key);
    const jsonStr = buffer.toString('utf-8');
    const data: SunoAudiosFile = JSON.parse(jsonStr);

    console.log(`[Suno Storage] ✅ 加载成功: ${data.audios.length} 首音频`);
    return data.audios || [];

  } catch (error: any) {
    if (error.statusCode === 404 || error.code === 'NoSuchKey') {
      console.log('[Suno Storage] 文件不存在,返回空数组');
      return [];
    }
    console.error('[Suno Storage] 加载失败:', error.message);
    return [];
  }
}

/**
 * 保存Suno音频列表到COS
 */
async function saveSunoAudios(userUuid: string, audios: SunoAudio[]): Promise<void> {
  if (!cosClient.isServiceEnabled()) {
    throw new Error('COS服务未启用');
  }

  const key = getSunoAudiosPath(userUuid);
  const data: SunoAudiosFile = {
    version: '1.0',
    updated_at: new Date().toISOString(),
    audios,
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const buffer = Buffer.from(jsonStr, 'utf-8');

  await cosClient.uploadFile(buffer, key, 'application/json');
  console.log(`[Suno Storage] ✅ 保存成功: ${key}, ${audios.length} 首音频`);
}

/**
 * 保存单首Suno音频
 * POST /api/suno-storage/save
 */
router.post('/save', async (req: any, res: any) => {
  try {
    const { userUuid, audio } = req.body;

    if (!userUuid || !audio) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid 或 audio',
      });
    }

    console.log('[Suno Storage] 保存音频:', {
      userUuid,
      audioId: audio.id,
      title: audio.title,
    });

    // 加载现有音频列表
    const audios = await loadSunoAudios(userUuid);

    // 查找是否已存在
    const existingIndex = audios.findIndex(a => a.id === audio.id);

    // 添加或更新
    const newAudio: SunoAudio = {
      id: audio.id,
      task_id: audio.task_id || audio.id,
      title: audio.title || '',
      audio_url: audio.audio_url || '',
      image_url: audio.image_url,
      image_large_url: audio.image_large_url,
      lyric: audio.lyric || audio.metadata?.lyric,
      prompt: audio.prompt || audio.metadata?.prompt || audio.metadata?.gpt_description_prompt,
      tags: audio.tags || audio.metadata?.tags,
      duration: audio.duration || audio.metadata?.duration,
      status: audio.status || 'complete',
      created_at: audio.created_at || new Date().toISOString(),
      metadata: audio.metadata,
    };

    if (existingIndex >= 0) {
      audios[existingIndex] = newAudio;
      console.log('[Suno Storage] 更新现有音频');
    } else {
      audios.unshift(newAudio); // 新音频添加到开头
      console.log('[Suno Storage] 添加新音频');
    }

    // 保存到COS
    await saveSunoAudios(userUuid, audios);

    return res.json({
      success: true,
      message: '保存成功',
      total: audios.length,
    });

  } catch (error: any) {
    console.error('[Suno Storage] 保存失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '保存失败',
    });
  }
});

/**
 * 获取Suno音频列表
 * GET /api/suno-storage/list?userUuid=xxx&limit=50&offset=0
 */
router.get('/list', async (req: any, res: any) => {
  try {
    const { userUuid, limit = '50', offset = '0' } = req.query;

    if (!userUuid) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid',
      });
    }

    console.log('[Suno Storage] 获取音频列表:', {
      userUuid,
      limit,
      offset,
    });

    // 从COS加载
    const allAudios = await loadSunoAudios(userUuid);

    // 分页
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);
    const audios = allAudios.slice(offsetNum, offsetNum + limitNum);

    return res.json({
      success: true,
      total: allAudios.length,
      audios,
    });

  } catch (error: any) {
    console.error('[Suno Storage] 获取列表失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '获取列表失败',
    });
  }
});

/**
 * 删除Suno音频
 * DELETE /api/suno-storage/delete
 */
router.delete('/delete', async (req: any, res: any) => {
  try {
    const { userUuid, audioId } = req.body;

    if (!userUuid || !audioId) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid 或 audioId',
      });
    }

    console.log('[Suno Storage] 删除音频:', { userUuid, audioId });

    // 加载现有音频列表
    const audios = await loadSunoAudios(userUuid);

    // 删除指定音频
    const newAudios = audios.filter(a => a.id !== audioId);

    if (newAudios.length === audios.length) {
      return res.status(404).json({
        success: false,
        error: '音频不存在',
      });
    }

    // 保存到COS
    await saveSunoAudios(userUuid, newAudios);

    return res.json({
      success: true,
      message: '删除成功',
      total: newAudios.length,
    });

  } catch (error: any) {
    console.error('[Suno Storage] 删除失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '删除失败',
    });
  }
});

export default router;
