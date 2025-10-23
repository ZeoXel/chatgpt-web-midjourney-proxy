-- ==========================================
-- ChatGPT Web Midjourney Proxy
-- Supabase 资产存储表 - 简化版
-- ==========================================
-- 用途: 以 api_key 为媒介存储用户生成的 URL 格式资产
-- 认证流程: api_key (key_value) → api_keys.assigned_user_id → users.id
-- 存储内容: 仅URL和元数据（不存储文件本身）
-- ==========================================

-- ==================== AI生成资产表 ====================
-- 统一存储所有AI服务生成的URL资产（图片/音频/视频）
CREATE TABLE IF NOT EXISTS ai_assets (
  -- 主键和用户关联
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 资产分类
  service VARCHAR(50) NOT NULL,    -- 服务名: 'midjourney', 'suno', 'luma', 'vidu', 'runway'
  type VARCHAR(20) NOT NULL,       -- 类型: 'image', 'audio', 'video'

  -- 核心数据（完整的资产对象，存储URL和元数据）
  asset_data JSONB NOT NULL,

  -- 冗余字段（用于快速检索，避免JSONB查询）
  task_id VARCHAR(255),            -- 第三方任务ID（用于去重）
  main_url VARCHAR(1024),          -- 主要资源URL
  prompt TEXT,                     -- 生成提示词

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建复合索引（优化多条件查询）
CREATE INDEX IF NOT EXISTS idx_ai_assets_user_service
  ON ai_assets(user_id, service);

CREATE INDEX IF NOT EXISTS idx_ai_assets_created_at
  ON ai_assets(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_assets_task_id
  ON ai_assets(task_id) WHERE task_id IS NOT NULL;

-- 创建GIN索引加速JSONB查询
CREATE INDEX IF NOT EXISTS idx_ai_assets_data_gin
  ON ai_assets USING GIN (asset_data);

-- 添加注释
COMMENT ON TABLE ai_assets IS 'AI生成资产表 - 存储URL格式的资产数据，通过api_key关联用户';
COMMENT ON COLUMN ai_assets.user_id IS '关联到users.id，通过api_keys.assigned_user_id映射';
COMMENT ON COLUMN ai_assets.asset_data IS 'JSONB对象 - 完整的资产数据（URLs、元数据）';
COMMENT ON COLUMN ai_assets.task_id IS '第三方任务ID - 用于去重和追踪';
COMMENT ON COLUMN ai_assets.main_url IS '主要资源URL - 冗余字段用于快速查询';

-- ==================== 行级安全策略（RLS）====================

-- 启用RLS
ALTER TABLE ai_assets ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能访问自己的资产
CREATE POLICY "Users can view their own ai assets"
  ON ai_assets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own ai assets"
  ON ai_assets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own ai assets"
  ON ai_assets FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own ai assets"
  ON ai_assets FOR DELETE
  USING (user_id = auth.uid());

-- ==================== 存储统计视图 ====================

-- 创建资产统计视图
CREATE OR REPLACE VIEW user_asset_stats AS
SELECT
  u.id AS user_id,
  u.phone,
  u.name,
  COUNT(aa.id) AS total_assets,
  SUM(CASE WHEN aa.type = 'image' THEN 1 ELSE 0 END) AS image_count,
  SUM(CASE WHEN aa.type = 'audio' THEN 1 ELSE 0 END) AS audio_count,
  SUM(CASE WHEN aa.type = 'video' THEN 1 ELSE 0 END) AS video_count,
  SUM(CASE WHEN aa.service = 'midjourney' THEN 1 ELSE 0 END) AS midjourney_count,
  SUM(CASE WHEN aa.service = 'suno' THEN 1 ELSE 0 END) AS suno_count,
  SUM(CASE WHEN aa.service = 'luma' THEN 1 ELSE 0 END) AS luma_count,
  MAX(aa.created_at) AS last_generation_time
FROM users u
LEFT JOIN ai_assets aa ON u.id = aa.user_id
GROUP BY u.id, u.phone, u.name;

COMMENT ON VIEW user_asset_stats IS '用户资产统计 - 实时聚合各服务生成的资产数量';

-- ==================== 初始化完成 ====================

-- 查看已创建的表
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'ai_assets') AS column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name = 'ai_assets';

-- 提示信息
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ AI资产表初始化完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '已创建: ai_assets 表';
  RAISE NOTICE '已创建索引: 4个';
  RAISE NOTICE '已创建视图: user_asset_stats';
  RAISE NOTICE '已启用RLS安全策略';
  RAISE NOTICE '';
  RAISE NOTICE '认证流程:';
  RAISE NOTICE '  1. 前端传递 api_key (key_value)';
  RAISE NOTICE '  2. 后端查询 api_keys 表获取 assigned_user_id';
  RAISE NOTICE '  3. 使用 user_id 进行 CRUD 操作';
  RAISE NOTICE '';
  RAISE NOTICE '存储内容: 仅URL和元数据（不存储文件）';
  RAISE NOTICE '预估占用: ~37MB/用户/年';
  RAISE NOTICE '========================================';
END $$;
