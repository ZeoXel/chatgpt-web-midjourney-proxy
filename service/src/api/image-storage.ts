/**
 * 通用图片存储 API - COS JSON存储
 *
 * 存储位置: {userUuid}/assets/image/images.json
 * 用途: 存储来自各种AI服务的图片URL记录 (DALL-E, Flux, Ideogram等)
 *
 * 注意: 这是通用图片存储，MJ图片使用独立的 /api/mj-storage
 */

import { Router } from 'express';
import { TencentCOSClient } from '../storage/cos-client';

const router = Router();
const cosClient = new TencentCOSClient();

/**
 * 图片记录接口
 */
interface ImageRecord {
  id: string;
  service: string;  // dall-e, flux, ideogram, stable-diffusion等
  model?: string;
  prompt?: string;
  original_url: string;  // 原始URL
  cos_url?: string;      // COS镜像URL (可选)
  width?: number;
  height?: number;
  format?: string;
  status: string;
  created_at: string;
  metadata?: Record<string, any>;
}

/**
 * images.json 文件结构
 */
interface ImagesFile {
  version: string;
  updated_at: string;
  images: ImageRecord[];
}

/**
 * 构建 images.json 文件的 COS key
 */
function getImagesKey(userUuid: string): string {
  return `${userUuid}/assets/image/images.json`;
}

/**
 * 从 COS 加载 images.json
 */
async function loadImages(userUuid: string): Promise<ImageRecord[]> {
  if (!cosClient.isServiceEnabled()) {
    console.log('[Image Storage] COS服务未启用');
    return [];
  }

  try {
    const key = getImagesKey(userUuid);
    const buffer = await cosClient.downloadFile(key);
    const content = buffer.toString('utf-8');
    const data: ImagesFile = JSON.parse(content);
    return data.images || [];
  } catch (error: any) {
    if (error.statusCode === 404 || error.code === 'NoSuchKey') {
      console.log(`[Image Storage] 文件不存在，返回空数组: ${userUuid}`);
      return [];
    }
    console.error('[Image Storage] 加载失败:', error);
    throw error;
  }
}

/**
 * 保存 images.json 到 COS
 */
async function saveImages(userUuid: string, images: ImageRecord[]): Promise<void> {
  if (!cosClient.isServiceEnabled()) {
    throw new Error('COS服务未启用');
  }

  const data: ImagesFile = {
    version: '1.0',
    updated_at: new Date().toISOString(),
    images,
  };

  const key = getImagesKey(userUuid);
  const content = JSON.stringify(data, null, 2);
  const buffer = Buffer.from(content, 'utf-8');

  await cosClient.uploadFile(buffer, key, 'application/json');
  console.log(`[Image Storage] 保存成功: ${images.length} 条记录`);
}

/**
 * POST /api/image-storage/save
 * 保存图片URL记录到 COS
 */
router.post('/save', async (req: any, res: any) => {
  console.log('[Image Storage API] 🚀 收到保存请求');
  console.log('[Image Storage API] Request body keys:', Object.keys(req.body));
  console.log('[Image Storage API] Full request body:', JSON.stringify(req.body, null, 2));

  try {
    const { userUuid, image } = req.body;

    if (!userUuid || !image) {
      console.error('[Image Storage API] ❌ 缺少参数:', { userUuid: !!userUuid, image: !!image });
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid 或 image',
      });
    }

    console.log('[Image Storage] 保存图片记录:', image.id);
    console.log('[Image Storage] 图片详情:', {
      id: image.id,
      service: image.service,
      model: image.model,
      original_url: image.original_url?.substring(0, 50) + '...'
    });

    // 1. 加载现有记录
    const images = await loadImages(userUuid);

    // 2. 检查是否已存在
    const existingIndex = images.findIndex(v => v.id === image.id);

    const newImage: ImageRecord = {
      id: image.id,
      service: image.service || 'unknown',
      model: image.model,
      prompt: image.prompt,
      original_url: image.original_url,
      cos_url: image.cos_url,
      width: image.width,
      height: image.height,
      format: image.format,
      status: image.status || 'success',
      created_at: image.created_at || new Date().toISOString(),
      metadata: image.metadata,
    };

    if (existingIndex >= 0) {
      // 更新现有记录
      images[existingIndex] = newImage;
      console.log('[Image Storage] 更新记录:', image.id);
    } else {
      // 新增记录 (添加到开头)
      images.unshift(newImage);
      console.log('[Image Storage] 新增记录:', image.id);
    }

    // 3. 保存回COS
    await saveImages(userUuid, images);

    return res.json({
      success: true,
      message: '图片记录已保存',
    });

  } catch (error: any) {
    console.error('[Image Storage] 保存失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '保存失败',
    });
  }
});

/**
 * GET /api/image-storage/list
 * 加载图片列表
 */
router.get('/list', async (req: any, res: any) => {
  try {
    const { userUuid, service, limit = 100 } = req.query;

    if (!userUuid) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid',
      });
    }

    console.log('[Image Storage] 加载图片列表:', userUuid);

    let images = await loadImages(userUuid);

    // 按服务过滤
    if (service) {
      images = images.filter(v => v.service === service);
    }

    // 限制返回数量
    const limitNum = parseInt(limit as string, 10);
    if (limitNum > 0) {
      images = images.slice(0, limitNum);
    }

    return res.json({
      success: true,
      total: images.length,
      images,
    });

  } catch (error: any) {
    console.error('[Image Storage] 加载失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '加载失败',
      images: [],
    });
  }
});

/**
 * PATCH /api/image-storage/update-cos-urls
 * 批量更新图片的cos_url (AssetProcessor处理后调用)
 */
router.patch('/update-cos-urls', async (req: any, res: any) => {
  try {
    const { userUuid, urlMappings } = req.body;

    if (!userUuid || !urlMappings || !Array.isArray(urlMappings)) {
      console.error('[Image Storage] ❌ 参数错误:', {
        userUuid: !!userUuid,
        urlMappings: !!urlMappings,
        isArray: Array.isArray(urlMappings)
      });
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid 或 urlMappings (数组)',
      });
    }

    console.log(`[Image Storage] 📝 更新COS URLs: ${urlMappings.length} 条映射`);

    // 1. 加载现有记录
    const images = await loadImages(userUuid);
    let updatedCount = 0;

    // 2. 遍历映射并更新
    urlMappings.forEach((mapping: { originalUrl: string; cosUrl: string }) => {
      const { originalUrl, cosUrl } = mapping;

      if (!originalUrl || !cosUrl) {
        console.warn('[Image Storage] ⚠️ 跳过无效映射:', mapping);
        return;
      }

      // 查找匹配的图片记录
      const imageIndex = images.findIndex(img => img.original_url === originalUrl);

      if (imageIndex >= 0) {
        images[imageIndex].cos_url = cosUrl;
        updatedCount++;
        console.log(`[Image Storage] ✅ 更新: ${images[imageIndex].id} -> ${cosUrl.substring(0, 50)}...`);
      } else {
        console.log(`[Image Storage] ⚠️ 未找到匹配记录: ${originalUrl.substring(0, 50)}...`);
      }
    });

    // 3. 保存回COS
    if (updatedCount > 0) {
      await saveImages(userUuid, images);
      console.log(`[Image Storage] ✅ 已更新 ${updatedCount}/${urlMappings.length} 条记录`);
    } else {
      console.log(`[Image Storage] ⚠️ 没有记录被更新`);
    }

    return res.json({
      success: true,
      message: `已更新 ${updatedCount} 条记录`,
      updatedCount,
    });

  } catch (error: any) {
    console.error('[Image Storage] 更新COS URLs失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '更新失败',
    });
  }
});

/**
 * DELETE /api/image-storage/delete
 * 删除图片记录
 */
router.delete('/delete', async (req: any, res: any) => {
  try {
    const { userUuid, id } = req.body;

    if (!userUuid || !id) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid 或 id',
      });
    }

    console.log('[Image Storage] 删除图片记录:', id);

    // 1. 加载现有记录
    const images = await loadImages(userUuid);

    // 2. 删除指定记录
    const filteredImages = images.filter(v => v.id !== id);

    if (filteredImages.length === images.length) {
      return res.status(404).json({
        success: false,
        error: '记录不存在',
      });
    }

    // 3. 保存回COS
    await saveImages(userUuid, filteredImages);

    return res.json({
      success: true,
      message: '图片记录已删除',
    });

  } catch (error: any) {
    console.error('[Image Storage] 删除失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '删除失败',
    });
  }
});

export default router;
