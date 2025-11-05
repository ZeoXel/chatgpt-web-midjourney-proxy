/**
 * Supabase Storage 上传 API（简化版）
 * 功能：上传图片到 Supabase Storage 并记录到数据库
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';

const router = Router();
const isSupabaseUploadEnabled = process.env.ENABLE_SUPABASE_UPLOAD !== 'false';

// 使用内存存储
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB 限制（支持视频）
});

// 初始化 Supabase 客户端
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('缺少 Supabase 配置：SUPABASE_URL 或 SUPABASE_SERVICE_KEY');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * 上传文件到 Supabase Storage
 * POST /api/supabase/upload
 *
 * Body (FormData):
 * - file: 图片文件
 */
router.post('/upload', upload.single('file'), async (req: any, res: any) => {
  try {
    if (!isSupabaseUploadEnabled) {
      return res.status(503).json({
        success: false,
        error: 'Supabase upload is disabled in this environment.',
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '未上传文件',
      });
    }

    const supabase = getSupabaseClient();

    // 根据文件类型选择存储桶
    const isVideo = req.file.mimetype.startsWith('video/');
    const bucketName = isVideo ? 'runway-videos' : 'pika-images';

    // 生成唯一文件路径
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileExt = req.file.originalname.split('.').pop();
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filePath = `${date}/${timestamp}-${randomStr}.${fileExt}`;

    console.log(`[Supabase Upload] 开始上传: ${filePath}`);

    // 1. 上传文件到 Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('[Supabase Upload] 上传失败:', uploadError);

      // 处理存储桶不存在的情况
      if (uploadError.message.includes('not found') || uploadError.message.includes('does not exist')) {
        return res.status(400).json({
          success: false,
          error: `存储桶 "${bucketName}" 不存在`,
          hint: '请在 Supabase 控制台创建存储桶：Storage → New Bucket → 名称: pika-images → Public: 是',
        });
      }

      return res.status(500).json({
        success: false,
        error: uploadError.message,
      });
    }

    // 2. 获取公网 URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    console.log(`[Supabase Upload] 上传成功: ${urlData.publicUrl}`);

    // 3. 记录到数据库（可选，用于追踪和清理）
    try {
      await supabase
        .from('temp_image_uploads')
        .insert({
          storage_path: filePath,
          public_url: urlData.publicUrl,
          file_name: req.file.originalname,
          file_size: req.file.size,
          mime_type: req.file.mimetype,
          bucket_name: bucketName,
        });
      console.log('[Supabase Upload] 数据库记录成功');
    } catch (dbError) {
      // 数据库记录失败不影响上传结果
      console.warn('[Supabase Upload] 数据库记录失败（不影响上传）:', dbError);
    }

    // 4. 返回成功结果
    return res.json({
      success: true,
      url: urlData.publicUrl,
      path: uploadData.path,
      bucket: bucketName,
      size: req.file.size,
    });

  } catch (error: any) {
    console.error('[Supabase Upload] 异常:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '上传失败',
    });
  }
});

/**
 * 健康检查（测试 Supabase 连接）
 * GET /api/supabase/health
 */
router.get('/health', async (req: any, res: any) => {
  try {
    if (!isSupabaseUploadEnabled) {
      return res.status(503).json({
        success: false,
        error: 'Supabase upload is disabled in this environment.',
      });
    }
    const supabase = getSupabaseClient();

    // 测试连接：列出存储桶
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    const hasPikaBucket = data.some(b => b.name === 'pika-images');

    return res.json({
      success: true,
      message: 'Supabase 连接正常',
      buckets: data.map(b => b.name),
      pika_bucket_exists: hasPikaBucket,
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
