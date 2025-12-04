/**
 * 3D模型COS存储API - 下载模型+JSON记录
 *
 * 功能:
 * 1. 下载Tripo 3D模型文件到COS ({userUuid}/assets/model/{hash}.glb)
 * 2. 保存模型元数据到JSON文件 ({userUuid}/assets/model/models.json)
 * 3. 支持多种格式: GLB, STL, FBX, OBJ等
 */

import { Router } from 'express';
import { TencentCOSClient } from '../storage/cos-client';
import { AssetProcessor } from '../storage/asset-processor';

const router = Router();
const cosClient = new TencentCOSClient();
const assetProcessor = new AssetProcessor();

/**
 * 模型记录接口
 */
interface ModelRecord {
  id: string;                      // 任务ID
  service: string;                 // 服务名称: tripo
  sourceType: string;              // 来源类型: image_to_model, multiview_to_model, convert_model
  modelVersion?: string;           // 模型版本
  prompt?: string;                 // 提示词
  notes?: string;                  // 备注

  // 原始URL
  original_model_url?: string;     // GLB模型URL
  original_base_model_url?: string; // 基础模型URL
  original_pbr_model_url?: string;  // PBR模型URL
  original_stl_model_url?: string;  // STL模型URL
  original_preview_url?: string;    // 预览图URL

  // COS URL
  cos_model_url?: string;          // GLB模型COS URL
  cos_base_model_url?: string;     // 基础模型COS URL
  cos_pbr_model_url?: string;      // PBR模型COS URL
  cos_stl_model_url?: string;      // STL模型COS URL
  cos_preview_url?: string;        // 预览图COS URL

  status: string;                  // 状态
  progress?: number;               // 进度
  inputs?: Array<{ label: string; url?: string }>;  // 输入图片
  created_at: string;              // 创建时间
  metadata?: any;                  // 其他元数据
}

interface ModelsFile {
  version: string;
  updated_at: string;
  models: ModelRecord[];
}

/**
 * 获取JSON文件路径
 */
function getModelsJsonPath(userUuid: string): string {
  return `${userUuid}/assets/model/models.json`;
}

/**
 * 加载模型列表
 */
async function loadModels(userUuid: string): Promise<ModelRecord[]> {
  if (!cosClient.isServiceEnabled()) {
    console.log('[Model Storage] COS服务未启用');
    return [];
  }

  try {
    const key = getModelsJsonPath(userUuid);
    const buffer = await cosClient.downloadFile(key);

    if (!buffer) {
      console.log('[Model Storage] 文件不存在,返回空数组');
      return [];
    }

    const content = buffer.toString('utf-8');
    const data: ModelsFile = JSON.parse(content);
    console.log(`[Model Storage] 加载成功: ${data.models.length} 个模型`);

    return data.models || [];
  } catch (error: any) {
    if (error.statusCode === 404 || error.code === 'NoSuchKey') {
      console.log('[Model Storage] 文件不存在,返回空数组');
      return [];
    }
    console.error('[Model Storage] 加载失败:', error);
    throw error;
  }
}

/**
 * 保存模型列表
 */
async function saveModels(userUuid: string, models: ModelRecord[]): Promise<void> {
  if (!cosClient.isServiceEnabled()) {
    throw new Error('COS服务未启用');
  }

  try {
    const key = getModelsJsonPath(userUuid);

    const data: ModelsFile = {
      version: '1.0',
      updated_at: new Date().toISOString(),
      models: models,
    };

    const content = JSON.stringify(data, null, 2);
    await cosClient.uploadFile(Buffer.from(content), key, 'application/json');

    console.log(`[Model Storage] 保存成功: ${models.length} 个模型`);
  } catch (error) {
    console.error('[Model Storage] 保存失败:', error);
    throw error;
  }
}

/**
 * POST /api/model-storage/save
 * 下载模型到COS并保存记录
 *
 * Body:
 * {
 *   userUuid: "xxx",
 *   model: {
 *     id: "task-123",
 *     service: "tripo",
 *     sourceType: "image_to_model",
 *     modelVersion: "v2.0-20240919",
 *     prompt: "a cute cat",
 *     notes: "我的猫咪模型",
 *     original_model_url: "https://...",
 *     original_preview_url: "https://...",
 *     status: "success",
 *     created_at: "2025-11-28T10:00:00Z"
 *   }
 * }
 */
router.post('/save', async (req: any, res: any) => {
  try {
    const { userUuid, model } = req.body;

    if (!userUuid) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid',
      });
    }

    if (!model || !model.id) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: model.id',
      });
    }

    console.log(`[Model Storage] 保存模型: ${model.service}/${model.id}`);

    // 1. 下载主模型到COS (GLB)
    let cosModelUrl = model.original_model_url;
    if (model.original_model_url && model.original_model_url.startsWith('http')) {
      console.log(`[Model Storage] 下载主模型: ${model.original_model_url}`);
      const modelResult = await assetProcessor.processAssetUrl(userUuid, model.original_model_url);
      if (!modelResult.error) {
        cosModelUrl = modelResult.cosUrl;
        console.log(`[Model Storage] 主模型下载成功: ${cosModelUrl}`);
      }
    }

    // 2. 下载预览图到COS
    let cosPreviewUrl = model.original_preview_url;
    if (model.original_preview_url && model.original_preview_url.startsWith('http')) {
      console.log(`[Model Storage] 下载预览图: ${model.original_preview_url}`);
      const previewResult = await assetProcessor.processAssetUrl(userUuid, model.original_preview_url);
      if (!previewResult.error) {
        cosPreviewUrl = previewResult.cosUrl;
        console.log(`[Model Storage] 预览图下载成功: ${cosPreviewUrl}`);
      }
    }

    // 3. 下载其他格式模型到COS (如果有)
    let cosBaseModelUrl = model.original_base_model_url;
    if (model.original_base_model_url && model.original_base_model_url.startsWith('http')) {
      const baseResult = await assetProcessor.processAssetUrl(userUuid, model.original_base_model_url);
      if (!baseResult.error) cosBaseModelUrl = baseResult.cosUrl;
    }

    let cosPbrModelUrl = model.original_pbr_model_url;
    if (model.original_pbr_model_url && model.original_pbr_model_url.startsWith('http')) {
      const pbrResult = await assetProcessor.processAssetUrl(userUuid, model.original_pbr_model_url);
      if (!pbrResult.error) cosPbrModelUrl = pbrResult.cosUrl;
    }

    let cosStlModelUrl = model.original_stl_model_url;
    if (model.original_stl_model_url && model.original_stl_model_url.startsWith('http')) {
      const stlResult = await assetProcessor.processAssetUrl(userUuid, model.original_stl_model_url);
      if (!stlResult.error) cosStlModelUrl = stlResult.cosUrl;
    }

    // 4. 读取现有模型列表
    const models = await loadModels(userUuid);

    // 5. 添加或更新模型记录
    const existingIndex = models.findIndex(m => m.id === model.id);

    const newModel: ModelRecord = {
      id: model.id,
      service: model.service || 'tripo',
      sourceType: model.sourceType || 'image_to_model',
      modelVersion: model.modelVersion,
      prompt: model.prompt,
      notes: model.notes,

      original_model_url: model.original_model_url,
      original_base_model_url: model.original_base_model_url,
      original_pbr_model_url: model.original_pbr_model_url,
      original_stl_model_url: model.original_stl_model_url,
      original_preview_url: model.original_preview_url,

      cos_model_url: cosModelUrl,
      cos_base_model_url: cosBaseModelUrl,
      cos_pbr_model_url: cosPbrModelUrl,
      cos_stl_model_url: cosStlModelUrl,
      cos_preview_url: cosPreviewUrl,

      status: model.status || 'success',
      progress: model.progress,
      inputs: model.inputs,
      created_at: model.created_at || new Date().toISOString(),
      metadata: model.metadata,
    };

    if (existingIndex >= 0) {
      // 更新现有记录
      models[existingIndex] = newModel;
      console.log(`[Model Storage] 更新模型记录: ${model.id}`);
    } else {
      // 添加新记录(放在开头)
      models.unshift(newModel);
      console.log(`[Model Storage] 添加模型记录: ${model.id}`);
    }

    // 6. 保存到COS JSON
    await saveModels(userUuid, models);

    return res.json({
      success: true,
      message: '保存成功',
      total: models.length,
      model: newModel,
    });

  } catch (error: any) {
    console.error('[Model Storage] 保存失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '保存失败',
    });
  }
});

/**
 * GET /api/model-storage/list
 * 获取模型列表
 *
 * Query:
 * - userUuid: 用户UUID
 * - service: 可选,筛选服务 (tripo)
 * - limit: 限制数量,默认50
 * - offset: 偏移量,默认0
 */
router.get('/list', async (req: any, res: any) => {
  try {
    const { userUuid, service, limit = '50', offset = '0' } = req.query;

    if (!userUuid) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid',
      });
    }

    // 加载所有模型
    let allModels = await loadModels(userUuid);

    // 按服务筛选
    if (service) {
      allModels = allModels.filter(m => m.service === service);
    }

    // 分页
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);
    const models = allModels.slice(offsetNum, offsetNum + limitNum);

    return res.json({
      success: true,
      total: allModels.length,
      models,
    });

  } catch (error: any) {
    console.error('[Model Storage] 加载失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '加载失败',
    });
  }
});

/**
 * DELETE /api/model-storage/delete
 * 删除模型记录并删除COS文件
 *
 * Body:
 * {
 *   userUuid: "xxx",
 *   modelId: "task-123"
 * }
 */
router.delete('/delete', async (req: any, res: any) => {
  try {
    const { userUuid, modelId } = req.body;

    if (!userUuid || !modelId) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: userUuid 或 modelId',
      });
    }

    const models = await loadModels(userUuid);

    // 找到要删除的模型
    const modelToDelete = models.find(m => m.id === modelId);

    if (!modelToDelete) {
      return res.status(404).json({
        success: false,
        error: '模型记录不存在',
      });
    }

    const newModels = models.filter(m => m.id !== modelId);
    await saveModels(userUuid, newModels);

    // 🔥 删除COS上的实际文件（模型文件 + 预览图 + 其他格式）
    const hasFiles = modelToDelete.cos_model_url || modelToDelete.cos_base_model_url ||
                     modelToDelete.cos_pbr_model_url || modelToDelete.cos_stl_model_url ||
                     modelToDelete.cos_preview_url;

    if (hasFiles) {
      try {
        const deleteResponse = await fetch('http://localhost:3002/api/asset-cleanup/delete-from-record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userUuid,
            record: modelToDelete,
          }),
        });

        if (deleteResponse.ok) {
          const deleteResult = await deleteResponse.json();
          console.log(`[Model Storage] ✅ COS文件删除成功: ${deleteResult.deletedCount} 个文件`);
        }
      } catch (error) {
        console.warn('[Model Storage] ⚠️ COS文件删除请求失败:', error);
      }
    }

    console.log(`[Model Storage] 删除模型记录: ${modelId}`);

    return res.json({
      success: true,
      message: '删除成功',
      total: newModels.length,
    });

  } catch (error: any) {
    console.error('[Model Storage] 删除失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '删除失败',
    });
  }
});

export default router;
