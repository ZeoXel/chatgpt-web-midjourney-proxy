/**
 * 腾讯云 COS 上传 API
 * 功能：上传图片/视频到 COS 并返回公网 URL
 * 替代原 Supabase Storage 上传
 */

import { Router } from 'express';
import multer from 'multer';
import { UnifiedStorageService } from '../storage/unified-storage';

const router = Router();

// 使用内存存储
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB 限制（支持视频）
});

// 初始化统一存储服务
const storageService = new UnifiedStorageService();

/**
 * 上传文件到 COS
 * POST /api/cos/upload
 *
 * Body (FormData):
 * - file: 文件（图片或视频）
 *
 * Headers:
 * - x-user-id: 用户ID（可选，用于目录隔离）
 */
router.post('/upload', upload.single('file'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '未上传文件',
      });
    }

    // 从请求头获取用户ID（用于目录隔离）
    const userId = req.headers['x-user-id'] || 'anonymous';

    console.log(`[COS Upload] 开始上传文件: ${req.file.originalname}, 用户: ${userId}`);

    // 上传到 COS
    const result = await storageService.upload({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      userId,
    });

    console.log(`[COS Upload] 上传成功: ${result.url}`);

    // 返回成功结果（兼容 Supabase 格式）
    return res.json({
      success: true,
      url: result.url,
      path: result.key,
      bucket: process.env.COS_BUCKET,
      size: result.size,
      storage: result.storage,
    });

  } catch (error: any) {
    console.error('[COS Upload] 上传失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '上传失败',
    });
  }
});

/**
 * 健康检查（测试 COS 连接）
 * GET /api/cos/health
 */
router.get('/health', async (req: any, res: any) => {
  try {
    const { TencentCOSClient } = await import('../storage/cos-client');
    const cosClient = new TencentCOSClient();

    if (!cosClient.isServiceEnabled()) {
      return res.status(503).json({
        success: false,
        error: '腾讯云 COS 服务未启用，请在 .env 中设置 ENABLE_TENCENT_COS=true',
      });
    }

    // 测试连接
    const testResult = await cosClient.testConnection();

    if (!testResult.success) {
      return res.status(500).json({
        success: false,
        error: testResult.message,
        details: testResult.data,
      });
    }

    return res.json({
      success: true,
      message: testResult.message,
      data: testResult.data,
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
