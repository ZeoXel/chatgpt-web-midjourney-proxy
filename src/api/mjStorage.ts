/**
 * MJ图片COS JSON存储API封装
 *
 * 替代数据库存储,使用COS JSON文件存储MJ图片URL
 */

import { getUserUuid } from '@/utils/userUuid';

/**
 * 保存MJ图片到COS JSON文件
 * @param image - MJ图片对象
 */
export async function saveMJImageToCOS(image: {
  id: string;
  task_id?: string;
  prompt?: string;
  image_url: string;
  action?: string;
  status?: string;
  created_at?: string;
  metadata?: any;
}): Promise<void> {
  const userUuid = getUserUuid();
  if (!userUuid) {
    console.warn('[MJ COS Storage] 未找到userUuid,跳过保存');
    return;
  }

  try {
    const response = await fetch('/api/mj-storage/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userUuid,
        image,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`保存失败: ${response.status} - ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    console.log('[MJ COS Storage] ✅ 保存成功:', result.total, '张图片');
  } catch (error) {
    console.error('[MJ COS Storage] ❌ 保存失败:', error);
    throw error;
  }
}

/**
 * 从COS JSON文件加载MJ图片列表
 * @param options - 分页选项
 */
export async function loadMJImagesFromCOS(options?: {
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const userUuid = getUserUuid();
  if (!userUuid) {
    console.warn('[MJ COS Storage] 未找到userUuid,返回空数组');
    return [];
  }

  try {
    const params = new URLSearchParams({
      userUuid,
      limit: (options?.limit || 50).toString(),
      offset: (options?.offset || 0).toString(),
    });

    const response = await fetch(`/api/mj-storage/list?${params}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`加载失败: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`[MJ COS Storage] ✅ 加载成功: ${result.images?.length || 0} 张图片`);
    return result.images || [];
  } catch (error) {
    console.error('[MJ COS Storage] ❌ 加载失败:', error);
    return [];
  }
}

/**
 * 从COS JSON文件删除MJ图片
 * @param imageId - 图片ID
 */
export async function deleteMJImageFromCOS(imageId: string): Promise<void> {
  const userUuid = getUserUuid();
  if (!userUuid) {
    console.warn('[MJ COS Storage] 未找到userUuid,跳过删除');
    return;
  }

  try {
    const response = await fetch('/api/mj-storage/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userUuid,
        imageId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`删除失败: ${response.status} - ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    console.log('[MJ COS Storage] ✅ 删除成功:', result.total, '张图片');
  } catch (error) {
    console.error('[MJ COS Storage] ❌ 删除失败:', error);
    throw error;
  }
}
