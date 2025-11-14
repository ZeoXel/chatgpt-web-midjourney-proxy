/**
 * Vercel Edge Function - Supabase Storage 上传
 * 路由: /api/supabase/upload
 *
 * 说明：
 * - 与本地 Express 版 service/src/api/supabase-upload.ts 对齐的最小实现
 * - 使用 Edge Runtime，直接解析 multipart/form-data（req.formData）
 * - 注意 Vercel Edge 单次请求体积限制约 4MB，超过将失败
 */

export const config = {
  runtime: 'edge',
};

import { createClient } from '@supabase/supabase-js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-API-Key',
    },
  });
}

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

export default async function handler(req) {
  // 预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-API-Key',
      },
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { success: false, error: `Method ${req.method} not allowed` });
  }

  try {
    // 环境开关（与本地保持一致，默认启用，显式为 'false' 才关闭）
    if (process.env.ENABLE_SUPABASE_UPLOAD === 'false') {
      return jsonResponse(503, { success: false, error: 'Supabase upload is disabled in this environment.' });
    }

    // 解析表单
    const form = await req.formData();
    const file = form.get('file');

    if (!file || typeof file === 'string') {
      return jsonResponse(400, { success: false, error: '未上传文件' });
    }

    const supabase = getSupabaseClient();

    // 根据文件类型选择存储桶
    const isVideo = (file.type || '').startsWith('video/');
    const bucketName = isVideo ? 'runway-videos' : 'pika-images';

    // 构造文件路径
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    // file.name 在 Edge 下可用；如缺失则兜底使用 bin
    const extFromName = (file.name || '').split('.').pop();
    const fileExt = extFromName && extFromName !== file.name ? extFromName : 'bin';
    const filePath = `${date}/${timestamp}-${randomStr}.${fileExt}`;

    // 上传到 Supabase Storage（Edge环境支持Blob/ArrayBuffer）
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      // 存储桶不存在等典型错误
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('does not exist')) {
        return jsonResponse(400, {
          success: false,
          error: `存储桶 "${bucketName}" 不存在`,
          hint: '请在 Supabase 控制台创建存储桶并设为 Public，例如：pika-images',
        });
      }
      return jsonResponse(500, { success: false, error: uploadError.message || '上传失败' });
    }

    // 获取公网 URL
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);

    // 返回结果
    return jsonResponse(200, {
      success: true,
      url: urlData.publicUrl,
      path: uploadData.path,
      bucket: bucketName,
      size: file.size || null,
      contentType: file.type || null,
      filename: file.name || null,
    });
  } catch (error) {
    return jsonResponse(500, { success: false, error: error.message || '上传失败' });
  }
}

