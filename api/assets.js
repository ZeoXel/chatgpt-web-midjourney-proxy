/**
 * Vercel Serverless Function - AI Assets API
 *
 * 用于处理 /api/assets 路由
 * 支持 CRUD 操作和用户资产管理
 */

import { createClient } from '@supabase/supabase-js';

const isDatabaseEnabled = process.env.ENABLE_DATABASE === 'true';

// 初始化 Supabase 客户端
const getSupabaseClient = () => {
  if (!isDatabaseEnabled) {
    throw new Error('Database integration is disabled.');
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

/**
 * 认证中间件：从请求头提取 api_key 并映射到 user_id
 */
async function authenticateApiKey(req) {
  // 从请求头获取 api_key
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    return {
      authenticated: false,
      status: 401,
      error: 'Missing API key. Please provide x-api-key header or Authorization Bearer token.'
    };
  }

  const supabase = getSupabaseClient();

  // 查询 api_keys 表，获取 assigned_user_id
  const { data: keyData, error: keyError } = await supabase
    .from('api_keys')
    .select('assigned_user_id, status, provider')
    .eq('key_value', apiKey)
    .single();

  if (keyError || !keyData) {
    return {
      authenticated: false,
      status: 401,
      error: 'Invalid API key'
    };
  }

  if (keyData.status !== 'assigned' && keyData.status !== 'active') {
    return {
      authenticated: false,
      status: 403,
      error: `API key is ${keyData.status}`
    };
  }

  if (!keyData.assigned_user_id) {
    return {
      authenticated: false,
      status: 403,
      error: 'API key not assigned to any user'
    };
  }

  return {
    authenticated: true,
    userId: keyData.assigned_user_id,
    provider: keyData.provider
  };
}

/**
 * 处理 GET 请求 - 查询资产
 */
async function handleGet(req, userId) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const { service, type, limit = '100', offset = '0' } = Object.fromEntries(url.searchParams);

  const supabase = getSupabaseClient();

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
  const offsetNum = parseInt(offset);
  const limitNum = parseInt(limit);
  query = query.range(offsetNum, offsetNum + limitNum - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('[Assets API] Query error:', error);
    return {
      status: 500,
      body: {
        success: false,
        error: 'Failed to query assets',
        details: error.message
      }
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      assets: data || [],
      total: count || 0,
      limit: limitNum,
      offset: offsetNum
    }
  };
}

/**
 * 处理 POST 请求 - 创建资产
 */
async function handlePost(req, userId) {
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (error) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'Invalid JSON body'
      }
    };
  }

  const { service, type, asset_data, task_id, main_url, prompt } = body;

  // 验证必填字段
  if (!service || !type || !asset_data) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'Missing required fields: service, type, asset_data'
      }
    };
  }

  // 验证 service 和 type 值
  const validServices = ['midjourney', 'suno', 'luma', 'vidu', 'runway', 'kling', 'pika', 'udio', 'ideogram', 'flux'];
  const validTypes = ['image', 'audio', 'video'];

  if (!validServices.includes(service)) {
    return {
      status: 400,
      body: {
        success: false,
        error: `Invalid service. Must be one of: ${validServices.join(', ')}`
      }
    };
  }

  if (!validTypes.includes(type)) {
    return {
      status: 400,
      body: {
        success: false,
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      }
    };
  }

  const supabase = getSupabaseClient();

  // 插入资产
  const { data, error } = await supabase
    .from('ai_assets')
    .insert({
      user_id: userId,
      service,
      type,
      asset_data,
      task_id: task_id || null,
      main_url: main_url || null,
      prompt: prompt || null
    })
    .select()
    .single();

  if (error) {
    console.error('[Assets API] Insert error:', error);
    return {
      status: 500,
      body: {
        success: false,
        error: 'Failed to create asset',
        details: error.message
      }
    };
  }

  return {
    status: 201,
    body: {
      success: true,
      asset: data
    }
  };
}

/**
 * 主处理函数
 */
export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key,Authorization,Content-Type');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!isDatabaseEnabled) {
      return res.status(503).json({
        success: false,
        error: 'Database integration is disabled in this environment.'
      });
    }
    // 认证
    const authResult = await authenticateApiKey(req);
    if (!authResult.authenticated) {
      return res.status(authResult.status).json({
        success: false,
        error: authResult.error
      });
    }

    const { userId } = authResult;

    // 路由处理
    let result;
    switch (req.method) {
      case 'GET':
        result = await handleGet(req, userId);
        break;

      case 'POST':
        result = await handlePost(req, userId);
        break;

      default:
        return res.status(405).json({
          success: false,
          error: `Method ${req.method} not allowed`
        });
    }

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[Assets API] Unhandled error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}
