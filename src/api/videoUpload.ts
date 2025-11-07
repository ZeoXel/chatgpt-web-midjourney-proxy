/**
 * 视频上传服务（简化版 - 不使用 Supabase）
 * 使用本地 Blob URL 或项目上传接口
 */

import { mlog } from './mjapi';

export interface VideoUploadResult {
  url: string;          // 视频访问 URL 或 Blob URL
  type: 'blob' | 'url'; // 返回类型
  size: number;         // 文件大小（字节）
  duration?: number;    // 视频时长（秒）
  bucket?: string;      // Supabase 存储桶
  path?: string;        // Supabase 文件路径
  contentType?: string; // MIME 类型
  filename?: string;    // 原始文件名
}

/**
 * 上传视频到项目后端
 * @param file 视频文件
 * @returns Promise<VideoUploadResult>
 */
async function uploadVideoToBackend(file: File): Promise<VideoUploadResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    mlog('📤 开始上传视频到 Supabase 云存储...');

    // 使用 Supabase 上传接口
    const response = await fetch('/api/supabase/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`上传失败: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.url) {
      throw new Error(data.error || 'Supabase 上传失败');
    }

    mlog('✅ Supabase 视频上传成功:', data.url);

    return {
      url: data.url, // Supabase 返回的是完整的公网 URL
      type: 'url',
      size: file.size,
      bucket: data.bucket,
      path: data.path,
      contentType: file.type,
      filename: file.name,
    };
  } catch (error: any) {
    mlog('❌ Supabase 上传失败，降级到 Blob URL:', error);
    throw error;
  }
}

/**
 * 创建本地 Blob URL
 * @param file 视频文件
 * @returns VideoUploadResult
 */
function createBlobURL(file: File): VideoUploadResult {
  const blobURL = URL.createObjectURL(file);

  mlog('✅ 创建本地 Blob URL:', blobURL);

  return {
    url: blobURL,
    type: 'blob',
    size: file.size,
    contentType: file.type,
    filename: file.name,
  };
}

/**
 * 智能上传视频（简化版）
 * 优先使用后端上传，失败则使用本地 Blob URL
 * @param file 视频文件
 * @param maxSizeMB 最大文件大小（MB），默认200MB
 * @returns Promise<VideoUploadResult>
 */
export async function smartUploadVideo(
  file: File,
  maxSizeMB: number = 200
): Promise<VideoUploadResult> {
  // 1. 验证文件大小
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > maxSizeMB) {
    throw new Error(
      `视频大小 ${fileSizeMB.toFixed(2)}MB 超过限制 ${maxSizeMB}MB`
    );
  }

  // 2. 验证文件格式
  const validFormats = ['.mp4', '.mov', '.avi', '.webm'];
  const isValidFormat = validFormats.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );

  if (!isValidFormat) {
    throw new Error(`不支持的视频格式，仅支持：${validFormats.join(', ')}`);
  }

  // 3. 尝试上传到后端，失败则使用 Blob URL
  try {
    return await uploadVideoToBackend(file);
  } catch (error) {
    mlog('⚠️ 后端上传失败，使用本地 Blob URL');
    return createBlobURL(file);
  }
}

/**
 * 获取视频时长
 * @param file 视频文件
 * @returns Promise<number> 视频时长（秒）
 */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };

    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      reject(new Error('无法读取视频元数据'));
    };

    video.src = URL.createObjectURL(file);
  });
}
