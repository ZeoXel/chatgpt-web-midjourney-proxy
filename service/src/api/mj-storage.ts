/**
 * MJ图片存储API - 将MJ图片URL存储到COS JSON文件
 *
 * 存储位置: {userUuid}/assets/mj/images.json
 */

import { Router } from 'express';
import { TencentCOSClient } from '../storage/cos-client';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const router = Router();
const cosClient = new TencentCOSClient();

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

interface MJImage {
  id: string;
  task_id: string;
  prompt: string;
  image_url: string;
  action?: string;
  status: string;
  created_at: string;
  metadata?: any;
}

interface MJImagesFile {
  version: string;
  updated_at: string;
  images: MJImage[];
}

/**
 * 获取用户的MJ图片JSON文件路径
 */
function getMJImagesPath(userUuid: string): string {
  return `${userUuid}/assets/mj/images.json`;
}

/**
 * 从COS加载MJ图片列表
 */
async function loadMJImages(userUuid: string): Promise<MJImage[]> {
  if (!cosClient.isServiceEnabled()) {
    console.warn('[MJ Storage] COS未启用');
    return [];
  }

  try {
    const key = getMJImagesPath(userUuid);
    console.log(`[MJ Storage] 从COS加载: ${key}`);

    const buffer = await cosClient.downloadFile(key);
    const jsonStr = buffer.toString('utf-8');
    const data: MJImagesFile = JSON.parse(jsonStr);

    console.log(`[MJ Storage] ✅ 加载成功: ${data.images.length} 张图片`);
    return data.images || [];

  } catch (error: any) {
    if (error.statusCode === 404 || error.code === 'NoSuchKey') {
      console.log('[MJ Storage] 文件不存在,返回空数组');
      return [];
    }
    console.error('[MJ Storage] 加载失败:', error.message);
    return [];
  }
}

/**
 * 保存MJ图片列表到COS
 */
async function saveMJImages(userUuid: string, images: MJImage[]): Promise<void> {
  if (!cosClient.isServiceEnabled()) {
    throw new Error('COS服务未启用');
  }

  const key = getMJImagesPath(userUuid);
  const data: MJImagesFile = {
    version: '1.0',
    updated_at: new Date().toISOString(),
    images,
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const buffer = Buffer.from(jsonStr, 'utf-8');

  await cosClient.uploadFile(buffer, key, 'application/json');
  console.log(`[MJ Storage] ✅ 保存成功: ${key}, ${images.length} 张图片`);
}

/**
 * 保存单张MJ图片
 * POST /api/mj-storage/save
 */
router.post('/save', async (req: any, res: any) => {
  try {
    const { userUuid, image } = req.body;

    if (!userUuid || !image) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid 或 image',
      });
    }

    console.log('[MJ Storage] 保存图片:', {
      userUuid,
      imageId: image.id,
      prompt: image.prompt?.substring(0, 50),
    });

    // 加载现有图片列表
    const images = await loadMJImages(userUuid);

    // 查找是否已存在
    const existingIndex = images.findIndex(img => img.id === image.id);

    // 添加或更新
    const newImage: MJImage = {
      id: image.id,
      task_id: image.task_id || image.id,
      prompt: image.prompt || '',
      image_url: image.image_url || image.imageUrl,
      action: image.action,
      status: image.status || 'SUCCESS',
      created_at: image.created_at || new Date().toISOString(),
      metadata: image.metadata,
    };

    if (existingIndex >= 0) {
      images[existingIndex] = newImage;
      console.log('[MJ Storage] 更新现有图片');
    } else {
      images.unshift(newImage); // 新图片添加到开头
      console.log('[MJ Storage] 添加新图片');
    }

    // 保存到COS
    await saveMJImages(userUuid, images);

    return res.json({
      success: true,
      message: '保存成功',
      total: images.length,
    });

  } catch (error: any) {
    console.error('[MJ Storage] 保存失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '保存失败',
    });
  }
});

/**
 * 获取MJ图片列表
 * GET /api/mj-storage/list?userUuid=xxx&limit=50&offset=0
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

    console.log('[MJ Storage] 获取图片列表:', {
      userUuid,
      limit,
      offset,
    });

    // 从COS加载
    const allImages = await loadMJImages(userUuid);

    // 分页
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);
    const images = allImages.slice(offsetNum, offsetNum + limitNum);

    return res.json({
      success: true,
      total: allImages.length,
      images,
    });

  } catch (error: any) {
    console.error('[MJ Storage] 获取列表失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '获取列表失败',
    });
  }
});

/**
 * 删除MJ图片
 * DELETE /api/mj-storage/delete
 */
router.delete('/delete', async (req: any, res: any) => {
  try {
    const { userUuid, imageId } = req.body;

    if (!userUuid || !imageId) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid 或 imageId',
      });
    }

    console.log('[MJ Storage] 删除图片:', { userUuid, imageId });

    // 加载现有图片列表
    const images = await loadMJImages(userUuid);

    // 删除指定图片
    const newImages = images.filter(img => img.id !== imageId);

    if (newImages.length === images.length) {
      return res.status(404).json({
        success: false,
        error: '图片不存在',
      });
    }

    // 保存到COS
    await saveMJImages(userUuid, newImages);

    return res.json({
      success: true,
      message: '删除成功',
      total: newImages.length,
    });

  } catch (error: any) {
    console.error('[MJ Storage] 删除失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '删除失败',
    });
  }
});

export default router;
