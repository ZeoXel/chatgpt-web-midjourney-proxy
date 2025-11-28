/**
 * 统一文件上传路由
 *
 * 替代方案:
 * - 移除 Supabase 上传
 * - 简化本地上传
 * - 统一到腾讯云COS
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { UnifiedStorageService } from '../storage/unified-storage';

const router = Router();

// 使用内存存储(不落地本地磁盘)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB限制
  },
});

// 初始化存储服务
const storageService = new UnifiedStorageService();

/**
 * 统一上传接口
 * POST /api/upload
 *
 * Headers:
 * - x-ptoken: 用户token(可选,未登录用户上传到anonymous目录)
 *
 * Body (FormData):
 * - file: 文件
 *
 * Response:
 * {
 *   "success": true,
 *   "url": "https://...",
 *   "key": "users/xxx/images/2025-01-27/...",
 *   "size": 1234567,
 *   "storage": "tencent-cos"
 * }
 */
router.post('/upload', upload.single('file'), async (req: any, res: Response) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: '未上传文件',
      });
    }

    // 从请求头提取用户ID
    const userId = extractUserId(req);

    console.log('[Upload API] 接收到上传请求:', {
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      userId: userId || 'anonymous',
    });

    // 上传到统一存储
    const result = await storageService.upload({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      userId,
    });

    return res.json(result);

  } catch (error: any) {
    console.error('[Upload API] 上传失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '上传失败',
    });
  }
});

/**
 * 列出用户文件
 * GET /api/files?category=images
 *
 * Headers:
 * - x-ptoken: 用户token(必需)
 *
 * Query:
 * - category: 文件类别(images/videos/audio/documents) 可选
 */
router.get('/files', async (req: any, res: Response) => {
  try {
    const userId = extractUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '需要登录',
      });
    }

    const category = req.query.category as string | undefined;

    const files = await storageService.listUserFiles(userId, category);

    return res.json({
      success: true,
      files: files.map((f: any) => ({
        key: f.Key,
        size: f.Size,
        lastModified: f.LastModified,
        url: storageService.getFileUrl(f.Key),
      })),
    });

  } catch (error: any) {
    console.error('[Files API] 获取文件列表失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '获取文件列表失败',
    });
  }
});

/**
 * 删除文件
 * DELETE /api/files/:key
 *
 * Headers:
 * - x-ptoken: 用户token(必需)
 */
router.delete('/files/*', async (req: any, res: Response) => {
  try {
    const userId = extractUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '需要登录',
      });
    }

    // 提取完整key(去掉/api/files/前缀)
    const key = req.params[0];

    // 安全检查: 确保用户只能删除自己的文件
    const sanitizedUserId = userId.length > 32
      ? require('md5')(userId).substring(0, 16)
      : userId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 32);

    if (!key.startsWith(`users/${sanitizedUserId}/`)) {
      return res.status(403).json({
        success: false,
        error: '无权删除此文件',
      });
    }

    await storageService.deleteFile(key);

    return res.json({
      success: true,
      message: '文件已删除',
    });

  } catch (error: any) {
    console.error('[Delete API] 删除文件失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '删除文件失败',
    });
  }
});

/**
 * 从请求中提取用户ID
 */
function extractUserId(req: any): string | undefined {
  // 优先使用 x-ptoken
  let token = req.headers['x-ptoken'];

  // 备选: x-vtoken
  if (!token) {
    token = req.headers['x-vtoken'];
  }

  // 备选: Authorization Bearer
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  return token;
}

export default router;
