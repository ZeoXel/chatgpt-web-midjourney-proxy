/**
 * 通用图片COS存储 API
 *
 * 存储位置: {userUuid}/assets/image/images.json
 * 用途: 存储来自各种AI服务的图片URL (DALL-E, Flux, Ideogram等，不包括MJ)
 */

import { getUserUuid } from '@/utils/userUuid';

/**
 * 图片记录接口
 */
export interface ImageRecord {
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
 * 保存图片记录到COS
 */
export async function saveImageToCOS(image: {
  id: string;
  service: string;
  model?: string;
  prompt?: string;
  original_url: string;
  cos_url?: string;
  width?: number;
  height?: number;
  format?: string;
  status?: string;
  created_at?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const userUuid = getUserUuid();

  // 如果没有userUuid,抛出错误
  if (!userUuid) {
    console.error('[Image COS Storage] ❌ 未配置userUuid,无法保存图片');
    throw new Error('未配置userUuid,请在设置中配置或通过URL传入');
  }

  console.log('[Image COS Storage] 🎯 准备保存图片到COS');
  console.log('[Image COS Storage] UserUUID:', userUuid);
  console.log('[Image COS Storage] Image ID:', image.id);
  console.log('[Image COS Storage] Service:', image.service);
  console.log('[Image COS Storage] Original URL:', image.original_url?.substring(0, 80) + '...');

  const requestBody = {
    userUuid,
    image: {
      id: image.id,
      service: image.service,
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
    },
  };

  console.log('[Image COS Storage] 📤 发送请求到 /api/image-storage/save');
  console.log('[Image COS Storage] Request body:', JSON.stringify(requestBody, null, 2));

  const response = await fetch('/api/image-storage/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  console.log('[Image COS Storage] 📥 收到响应 - Status:', response.status, response.statusText);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '保存图片记录失败');
  }

  const result = await response.json();
  console.log('[Image COS Storage] ✅ 保存成功:', result);
}

/**
 * 从COS加载图片列表
 */
export async function loadImagesFromCOS(options?: {
  service?: string;  // 按服务过滤
  limit?: number;    // 限制返回数量
}): Promise<ImageRecord[]> {
  const userUuid = getUserUuid();

  // 如果没有userUuid,返回空数组
  if (!userUuid) {
    console.warn('[Image COS Storage] ⚠️ 未配置userUuid,无法加载图片');
    return [];
  }

  console.log('[Image COS Storage] 开始从COS加载图片列表...');

  const params = new URLSearchParams({
    userUuid,
  });

  if (options?.service) {
    params.append('service', options.service);
  }

  if (options?.limit) {
    params.append('limit', String(options.limit));
  }

  const response = await fetch(`/api/image-storage/list?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('[Image COS Storage] 加载失败:', error);
    return [];
  }

  const result = await response.json();
  console.log(`[Image COS Storage] ✅ 加载成功: ${result.total} 条记录`);

  return result.images || [];
}

/**
 * 从COS删除图片记录
 */
export async function deleteImageFromCOS(id: string): Promise<void> {
  const userUuid = getUserUuid();

  // 如果没有userUuid,抛出错误
  if (!userUuid) {
    console.error('[Image COS Storage] ❌ 未配置userUuid,无法删除图片');
    throw new Error('未配置userUuid,请在设置中配置或通过URL传入');
  }

  console.log('[Image COS Storage] 开始删除图片记录:', id);

  const response = await fetch('/api/image-storage/delete', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userUuid,
      id,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '删除图片记录失败');
  }

  const result = await response.json();
  console.log('[Image COS Storage] ✅ 删除成功:', result);
}
