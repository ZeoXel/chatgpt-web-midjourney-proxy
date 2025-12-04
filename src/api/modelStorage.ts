/**
 * 3D模型COS存储API封装
 */

import { getUserUuid } from '@/utils/userUuid';

export interface ModelRecord {
  id: string;
  service: string;
  sourceType: string;
  modelVersion?: string;
  prompt?: string;
  notes?: string;
  original_model_url?: string;
  original_preview_url?: string;
  cos_model_url?: string;
  cos_preview_url?: string;
  status: string;
  created_at: string;
  metadata?: any;
}

/**
 * 保存模型到COS并记录到JSON
 */
export async function saveModelToCOS(model: {
  id: string;
  service: string;
  sourceType: string;
  modelVersion?: string;
  prompt?: string;
  notes?: string;
  original_model_url?: string;
  original_base_model_url?: string;
  original_pbr_model_url?: string;
  original_stl_model_url?: string;
  original_preview_url?: string;
  status?: string;
  progress?: number;
  inputs?: any[];
  created_at?: string;
  metadata?: any;
}): Promise<void> {
  const userUuid = getUserUuid();

  if (!userUuid) {
    console.warn('[Model COS Storage] 未找到userUuid,跳过保存');
    return;
  }

  try {
    console.log(`[Model COS Storage] 开始保存模型: ${model.service}/${model.id}`);

    const response = await fetch('/api/model-storage/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userUuid, model }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`保存失败: ${response.status} - ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    console.log(`[Model COS Storage] ✅ 保存成功:`, result.model?.id);

  } catch (error: any) {
    console.error('[Model COS Storage] ❌ 保存失败:', error.message);
  }
}

/**
 * 从COS JSON加载模型列表
 */
export async function loadModelsFromCOS(options?: {
  service?: string;
  limit?: number;
  offset?: number;
}): Promise<ModelRecord[]> {
  const userUuid = getUserUuid();

  if (!userUuid) {
    console.warn('[Model COS Storage] 未找到userUuid');
    return [];
  }

  try {
    const params = new URLSearchParams({
      userUuid,
      ...(options?.service && { service: options.service }),
      limit: (options?.limit || 50).toString(),
      offset: (options?.offset || 0).toString(),
    });

    const response = await fetch(`/api/model-storage/list?${params}`);

    if (!response.ok) {
      throw new Error(`加载失败: ${response.status}`);
    }

    const result = await response.json();
    console.log(`[Model COS Storage] ✅ 加载成功: ${result.models?.length || 0} 个模型`);

    return result.models || [];

  } catch (error: any) {
    console.error('[Model COS Storage] ❌ 加载失败:', error.message);
    return [];
  }
}

/**
 * 删除模型记录
 */
export async function deleteModelFromCOS(modelId: string): Promise<boolean> {
  const userUuid = getUserUuid();

  if (!userUuid) {
    console.warn('[Model COS Storage] 未找到userUuid');
    return false;
  }

  try {
    const response = await fetch('/api/model-storage/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userUuid,
        modelId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`删除失败: ${response.status} - ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    console.log(`[Model COS Storage] ✅ 删除成功: ${modelId}, 剩余 ${result.total} 个`);

    return true;

  } catch (error: any) {
    console.error('[Model COS Storage] ❌ 删除失败:', error.message);
    return false;
  }
}
