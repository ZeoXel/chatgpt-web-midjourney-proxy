/**
 * 简化版同步API - 最小化改动，直接对接Supabase
 * 与现有localStorage数据结构完全兼容
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Supabase客户端初始化
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // 使用Service Key绕过RLS
);

/**
 * 认证中间件 - 从你的现有用户系统获取userId
 */
function getUserId(req: any): string {
  // 方案1: 从现有的X-Ptoken header获取（你的API Key）
  const apiKey = req.headers['x-ptoken'] as string;
  return apiKey; // 直接用API Key作为userId

  // 方案2: 如果你的用户系统有独立的userId映射
  // return req.user?.id || apiKey;
}

// ==================== 聊天同步API ====================

/**
 * 获取所有会话
 * GET /sync/sessions
 */
router.get('/sessions', async (req, res) => {
  try {
    const userId = getUserId(req);

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      sessions: data || [],
      count: data?.length || 0,
    });
  } catch (error: any) {
    console.error('获取会话失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 保存/更新会话
 * POST /sync/sessions
 * Body: { id?, title, messages, model, usingContext }
 */
router.post('/sessions', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, title, messages, model, usingContext } = req.body;

    if (id) {
      // 更新现有会话
      const { data, error } = await supabase
        .from('chat_sessions')
        .update({
          title,
          messages,
          model,
          using_context: usingContext,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', userId) // 确保用户只能更新自己的数据
        .select()
        .single();

      if (error) throw error;
      return res.json({ success: true, session: data });
    } else {
      // 创建新会话
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: userId,
          title,
          messages: messages || [],
          model,
          using_context: usingContext ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return res.json({ success: true, session: data });
    }
  } catch (error: any) {
    console.error('保存会话失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 删除会话
 * DELETE /sync/sessions/:id
 */
router.delete('/sessions/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    console.error('删除会话失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 批量同步会话（用于首次迁移或全量同步）
 * POST /sync/sessions/batch
 * Body: { sessions: [...] }
 */
router.post('/sessions/batch', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessions } = req.body;

    if (!Array.isArray(sessions)) {
      return res.status(400).json({ success: false, error: '无效的会话数组' });
    }

    // 添加userId到每个会话
    const sessionsWithUser = sessions.map(s => ({
      id: s.id,
      user_id: userId,
      title: s.title,
      messages: s.messages || [],
      model: s.model,
      using_context: s.usingContext ?? true,
      created_at: s.createdAt || new Date().toISOString(),
      updated_at: s.updatedAt || new Date().toISOString(),
    }));

    // 使用upsert批量插入/更新
    const { data, error } = await supabase
      .from('chat_sessions')
      .upsert(sessionsWithUser, { onConflict: 'id' })
      .select();

    if (error) throw error;

    res.json({
      success: true,
      synced: data?.length || 0,
      sessions: data,
    });
  } catch (error: any) {
    console.error('批量同步失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== AI资产同步API ====================

/**
 * 获取AI生成内容
 * GET /sync/assets?service=suno&limit=50
 */
router.get('/assets', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { service, type, limit = 100, offset = 0 } = req.query;

    let query = supabase
      .from('ai_assets')
      .select('*')
      .eq('user_id', userId);

    if (service) query = query.eq('service', service as string);
    if (type) query = query.eq('type', type as string);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(
        parseInt(offset as string),
        parseInt(offset as string) + parseInt(limit as string) - 1
      );

    if (error) throw error;

    res.json({
      success: true,
      assets: data || [],
      count: data?.length || 0,
    });
  } catch (error: any) {
    console.error('获取资产失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 保存AI生成内容
 * POST /sync/assets
 * Body: { service, type, assetData, taskId?, mainUrl?, prompt? }
 */
router.post('/assets', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { service, type, assetData, taskId, mainUrl, prompt } = req.body;

    // 检查是否已存在（避免重复）
    if (taskId) {
      const { data: existing } = await supabase
        .from('ai_assets')
        .select('id')
        .eq('user_id', userId)
        .eq('task_id', taskId)
        .single();

      if (existing) {
        // 更新现有记录
        const { data, error } = await supabase
          .from('ai_assets')
          .update({ asset_data: assetData })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return res.json({ success: true, asset: data, updated: true });
      }
    }

    // 插入新记录
    const { data, error } = await supabase
      .from('ai_assets')
      .insert({
        user_id: userId,
        service,
        type,
        asset_data: assetData,
        task_id: taskId,
        main_url: mainUrl,
        prompt,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, asset: data });
  } catch (error: any) {
    console.error('保存资产失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 批量保存AI资产（用于首次迁移）
 * POST /sync/assets/batch
 * Body: { service, type, assets: [...] }
 */
router.post('/assets/batch', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { service, type, assets } = req.body;

    if (!Array.isArray(assets)) {
      return res.status(400).json({ success: false, error: '无效的资产数组' });
    }

    const assetsWithUser = assets.map(asset => ({
      user_id: userId,
      service,
      type,
      asset_data: asset,
      task_id: asset.id || asset.task_id,
      main_url: asset.audio_url || asset.video_url || asset.url,
      prompt: asset.metadata?.prompt || asset.prompt,
      created_at: asset.created_at || new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('ai_assets')
      .insert(assetsWithUser)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      synced: data?.length || 0,
      assets: data,
    });
  } catch (error: any) {
    console.error('批量保存资产失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 删除资产
 * DELETE /sync/assets/:id
 */
router.delete('/assets/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const { error } = await supabase
      .from('ai_assets')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    console.error('删除资产失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 用户配置同步API ====================

/**
 * 获取用户配置
 * GET /sync/config
 */
router.get('/config', async (req, res) => {
  try {
    const userId = getUserId(req);

    const { data, error } = await supabase
      .from('user_configs')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // 忽略"未找到"错误

    res.json({
      success: true,
      config: data || {
        gptConfig: {},
        serverConfig: {},
        uiSettings: {},
      },
    });
  } catch (error: any) {
    console.error('获取配置失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 保存用户配置
 * POST /sync/config
 * Body: { gptConfig?, serverConfig?, uiSettings? }
 */
router.post('/config', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { gptConfig, serverConfig, uiSettings } = req.body;

    const { data, error } = await supabase
      .from('user_configs')
      .upsert({
        user_id: userId,
        gpt_config: gptConfig,
        server_config: serverConfig,
        ui_settings: uiSettings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, config: data });
  } catch (error: any) {
    console.error('保存配置失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 辅助API ====================

/**
 * 获取同步状态和统计
 * GET /sync/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = getUserId(req);

    // 并发查询所有统计数据
    const [sessionsResult, assetsResult] = await Promise.all([
      supabase
        .from('chat_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('ai_assets')
        .select('service, type', { count: 'exact' })
        .eq('user_id', userId),
    ]);

    // 按服务分组统计
    const assetsByService: Record<string, number> = {};
    assetsResult.data?.forEach((asset: any) => {
      const key = `${asset.service}_${asset.type}`;
      assetsByService[key] = (assetsByService[key] || 0) + 1;
    });

    res.json({
      success: true,
      stats: {
        totalSessions: sessionsResult.count || 0,
        totalAssets: assetsResult.count || 0,
        assetsByService,
      },
    });
  } catch (error: any) {
    console.error('获取统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 清空用户所有数据（慎用！）
 * DELETE /sync/all
 */
router.delete('/all', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { confirm } = req.body;

    if (confirm !== 'DELETE_ALL_DATA') {
      return res.status(400).json({
        success: false,
        error: '请在body中提供 {"confirm": "DELETE_ALL_DATA"} 以确认删除',
      });
    }

    // 并发删除所有数据
    await Promise.all([
      supabase.from('chat_sessions').delete().eq('user_id', userId),
      supabase.from('ai_assets').delete().eq('user_id', userId),
      supabase.from('user_configs').delete().eq('user_id', userId),
    ]);

    res.json({ success: true, message: '所有数据已清空' });
  } catch (error: any) {
    console.error('清空数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
