/**
 * AI资产存储API
 *
 * 功能：以api_key为媒介存储用户生成的URL格式资产
 * 认证流程：api_key (key_value) → api_keys.assigned_user_id → users.id
 *
 * 路由：
 * - POST   /api/assets          创建资产
 * - GET    /api/assets          查询用户所有资产
 * - GET    /api/assets/:id      查询单个资产
 * - PUT    /api/assets/:id      更新资产
 * - DELETE /api/assets/:id      删除资产
 * - GET    /api/assets/stats    获取用户资产统计
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const router = Router();
const isDatabaseEnabled = process.env.ENABLE_DATABASE === 'true';

let supabase: SupabaseClient | null = null;
if (isDatabaseEnabled) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (supabaseUrl && supabaseKey) {
    supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }
  else {
    console.warn('[Assets API] 缺少 Supabase 配置，已禁用数据库读取功能');
  }
}

/**
 * 认证中间件：从请求头提取api_key并映射到user_id
 */
async function authenticateApiKey(req: any, res: any, next: any) {
  try {
    if (!isDatabaseEnabled || !supabase) {
      return res.status(503).json({
        success: false,
        error: 'Database integration is disabled in this environment.'
      });
    }
    // 从请求头获取api_key
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Missing API key. Please provide x-api-key header or Authorization Bearer token.'
      });
    }

    // 查询api_keys表，获取assigned_user_id
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('assigned_user_id, status, provider')
      .eq('key_value', apiKey)
      .single();

    if (keyError || !keyData) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    if (keyData.status !== 'assigned' && keyData.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: `API key is ${keyData.status}`
      });
    }

    if (!keyData.assigned_user_id) {
      return res.status(403).json({
        success: false,
        error: 'API key not assigned to any user'
      });
    }

    // 将user_id附加到请求对象
    req.userId = keyData.assigned_user_id;
    req.apiKeyProvider = keyData.provider;
    next();
  } catch (error) {
    console.error('[Assets API] Auth error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

// 应用认证中间件到所有路由
router.use(authenticateApiKey);

/**
 * 创建资产
 * POST /api/assets
 *
 * Body:
 * {
 *   service: 'midjourney' | 'suno' | 'luma' | 'vidu' | 'runway',
 *   type: 'image' | 'audio' | 'video',
 *   asset_data: { ...完整资产对象 },
 *   task_id?: string,
 *   main_url?: string,
 *   prompt?: string
 * }
 */
router.post('/', async (req: any, res: any) => {
  try {
    const { service, type, asset_data, task_id, main_url, prompt } = req.body;
    const userId = req.userId;

    // 验证必填字段
    if (!service || !type || !asset_data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: service, type, asset_data'
      });
    }

    // 验证service和type值
    const validServices = ['midjourney', 'dall-e', 'suno', 'luma', 'vidu', 'runway', 'kling', 'pika', 'udio', 'ideogram', 'flux', 'chat'];
    const validTypes = ['image', 'audio', 'video', 'conversation'];

    if (!validServices.includes(service)) {
      return res.status(400).json({
        success: false,
        error: `Invalid service. Must be one of: ${validServices.join(', ')}`
      });
    }

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // UPSERT 资产（对话数据使用 UPSERT 避免重复）
    // 使用传统的查询+更新/插入方式（兼容无唯一约束的数据库）

    let operation = 'created';
    let result = null;

    // 如果有 task_id，先查询是否已存在
    if (task_id) {
      const { data: existing } = await supabase
        .from('ai_assets')
        .select('id')
        .eq('user_id', userId)
        .eq('service', service)
        .eq('task_id', task_id)
        .maybeSingle();

      if (existing) {
        // 已存在，执行更新
        const { data: updated, error: updateError } = await supabase
          .from('ai_assets')
          .update({
            type,
            asset_data,
            main_url,
            prompt
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) {
          console.error('[Assets API] Update error:', updateError);
          return res.status(500).json({
            success: false,
            error: 'Failed to update asset',
            details: updateError.message
          });
        }

        result = updated;
        operation = 'updated';
      }
    }

    // 如果不存在或没有 task_id，执行插入
    if (!result) {
      const { data: inserted, error: insertError } = await supabase
        .from('ai_assets')
        .insert({
          user_id: userId,
          service,
          type,
          asset_data,
          task_id,
          main_url,
          prompt
        })
        .select()
        .single();

      if (insertError) {
        console.error('[Assets API] Insert error:', insertError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create asset',
          details: insertError.message
        });
      }

      result = inserted;
      operation = 'created';
    }

    res.json({
      success: true,
      asset: result,
      operation
    });
  } catch (error) {
    console.error('[Assets API] Create error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * 查询用户所有资产
 * GET /api/assets?service=midjourney&type=image&limit=50&offset=0
 */
router.get('/', async (req: any, res: any) => {
  try {
    const userId = req.userId;
    const { service, type, limit = 100, offset = 0 } = req.query;

    let query = supabase
      .from('ai_assets')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // 可选过滤
    if (service) {
      query = query.eq('service', service);
    }
    if (type) {
      query = query.eq('type', type);
    }

    // 分页
    query = query.range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[Assets API] Query error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to query assets',
        details: error.message
      });
    }

    res.json({
      success: true,
      assets: data || [],
      total: count || 0,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('[Assets API] List error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * 查询单个资产
 * GET /api/assets/:id
 */
router.get('/:id', async (req: any, res: any) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('ai_assets')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Asset not found'
        });
      }
      console.error('[Assets API] Get error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get asset',
        details: error.message
      });
    }

    res.json({
      success: true,
      asset: data
    });
  } catch (error) {
    console.error('[Assets API] Get error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * 更新资产
 * PUT /api/assets/:id
 */
router.put('/:id', async (req: any, res: any) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { asset_data, main_url, prompt } = req.body;

    if (!asset_data && !main_url && !prompt) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    const updateData: any = {};
    if (asset_data) updateData.asset_data = asset_data;
    if (main_url) updateData.main_url = main_url;
    if (prompt) updateData.prompt = prompt;

    const { data, error } = await supabase
      .from('ai_assets')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Asset not found or unauthorized'
        });
      }
      console.error('[Assets API] Update error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update asset',
        details: error.message
      });
    }

    res.json({
      success: true,
      asset: data
    });
  } catch (error) {
    console.error('[Assets API] Update error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * 删除资产
 * DELETE /api/assets/:id
 */
router.delete('/:id', async (req: any, res: any) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const { error } = await supabase
      .from('ai_assets')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[Assets API] Delete error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete asset',
        details: error.message
      });
    }

    res.json({
      success: true,
      message: 'Asset deleted successfully'
    });
  } catch (error) {
    console.error('[Assets API] Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * 获取用户资产统计
 * GET /api/assets/stats
 */
router.get('/stats/summary', async (req: any, res: any) => {
  try {
    const userId = req.userId;

    // 使用视图查询统计数据
    const { data, error } = await supabase
      .from('user_asset_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('[Assets API] Stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get stats',
        details: error.message
      });
    }

    res.json({
      success: true,
      stats: data || {
        total_assets: 0,
        image_count: 0,
        audio_count: 0,
        video_count: 0,
        last_generation_time: null
      }
    });
  } catch (error) {
    console.error('[Assets API] Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
