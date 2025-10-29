/**
 * 图片上传服务（简化版）
 * 支持两种上传方式：
 * 1. Supabase Storage（优先，返回公网 URL）
 * 2. 压缩 Base64（兜底方案）
 */

import { homeStore } from '@/store';
import { compressImage, blobToBase64 } from '@/utils/imageCompressor';
import { mlog } from './mjapi';

export interface UploadResult {
  url: string;          // 图片访问 URL 或 Base64
  type: 'url' | 'base64'; // 返回类型
  size: number;         // 文件大小（字节）
}

/**
 * 上传图片到 Supabase Storage
 * @param file 图片文件
 * @returns Promise<UploadResult>
 */
async function uploadToSupabase(file: File): Promise<UploadResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/supabase/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `上传失败: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.url) {
      throw new Error(data.error || 'Supabase 上传失败');
    }

    mlog('✅ Supabase Storage 上传成功:', data.url);

    return {
      url: data.url,
      type: 'url',
      size: file.size,
    };
  } catch (error) {
    mlog('❌ Supabase Storage 上传失败:', error);
    throw error;
  }
}

/**
 * 压缩图片并转为 Base64
 * @param file 图片文件
 * @returns Promise<UploadResult>
 */
async function compressToBase64(file: File): Promise<UploadResult> {
  try {
    mlog('🔄 开始压缩图片...');

    const compressedBlob = await compressImage(file, {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.8,
      maxSizeMB: 2, // 压缩目标：2MB 以内
    });

    const base64 = await blobToBase64(compressedBlob);

    const originalSizeKB = (file.size / 1024).toFixed(1);
    const compressedSizeKB = (compressedBlob.size / 1024).toFixed(1);
    mlog(`✅ 压缩完成：${originalSizeKB}KB → ${compressedSizeKB}KB`);

    return {
      url: base64,
      type: 'base64',
      size: compressedBlob.size,
    };
  } catch (error) {
    mlog('❌ 图片压缩失败:', error);
    throw error;
  }
}

/**
 * 智能上传图片（自动选择最佳方式）
 * 优先级：Supabase Storage > 压缩 Base64
 * @param file 图片文件
 * @returns Promise<UploadResult>
 */
export async function smartUploadImage(file: File): Promise<UploadResult> {
  // 1. 验证文件大小
  const maxSize = homeStore.myData.session.uploadImgSize
    ? +homeStore.myData.session.uploadImgSize
    : 10;

  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > maxSize) {
    throw new Error(
      `图片大小 ${fileSizeMB.toFixed(2)}MB 超过限制 ${maxSize}MB`
    );
  }

  // 2. 验证文件格式
  const validFormats = ['.jpg', '.jpeg', '.png', '.gif'];
  const isValidFormat = validFormats.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );

  if (!isValidFormat) {
    throw new Error(`不支持的图片格式，仅支持：${validFormats.join(', ')}`);
  }

  // 3. 策略 1: 尝试上传到 Supabase Storage
  try {
    mlog('📤 尝试上传到 Supabase Storage...');
    return await uploadToSupabase(file);
  } catch (error: any) {
    // 如果是配置缺失或存储桶不存在，记录并降级
    if (error.message?.includes('SUPABASE') || error.message?.includes('不存在')) {
      mlog('⚠️ Supabase 未配置或存储桶不存在，使用压缩 Base64');
    } else {
      mlog('⚠️ Supabase 上传失败，降级到压缩 Base64:', error.message);
    }
  }

  // 4. 策略 2: 压缩后转 Base64（兜底方案）
  return await compressToBase64(file);
}

/**
 * 兼容旧版 upImg 函数的包装器
 * @param file 图片文件
 * @returns Promise<string> 图片 URL 或 Base64
 */
export async function upImg(file: File): Promise<string> {
  const result = await smartUploadImage(file);
  return result.url;
}
