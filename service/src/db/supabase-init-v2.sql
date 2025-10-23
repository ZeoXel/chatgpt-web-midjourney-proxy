-- ==========================================
-- ChatGPT Web Midjourney Proxy
-- Supabase数据库初始化脚本 V2
-- ==========================================
-- 用途: 支持多平台数据同步
-- 版本: V2 - 集成到现有用户系统
-- 特性: 关联现有users表，利用现有api_keys认证
-- ==========================================

-- ==================== 表1: 聊天会话表 ====================
-- 存储用户的所有对话会话（完整历史记录）
CREATE TABLE IF NOT EXISTS chat_sessions (
  -- 主键和用户关联
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 关联到现有用户表

  -- 会话基本信息
  title VARCHAR(500) DEFAULT '新对话',
  model VARCHAR(50),

  -- 核心数据（JSONB格式，兼容现有localStorage结构）
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  using_context JSONB DEFAULT 'true'::jsonb,

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引（大幅提升查询速度）
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id
  ON chat_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at
  ON chat_sessions(updated_at DESC);

-- 创建GIN索引加速JSONB查询
CREATE INDEX IF NOT EXISTS idx_chat_sessions_messages_gin
  ON chat_sessions USING GIN (messages);

-- 添加注释
COMMENT ON TABLE chat_sessions IS '聊天会话表 - 存储用户对话历史，关联到users表';
COMMENT ON COLUMN chat_sessions.user_id IS '关联到users.id，级联删除';
COMMENT ON COLUMN chat_sessions.messages IS 'JSONB数组 - 完整消息列表';
COMMENT ON COLUMN chat_sessions.using_context IS '是否使用上下文';

-- ==================== 表2: AI生成资产表 ====================
-- 统一存储所有AI服务生成的内容（图片/音频/视频）
CREATE TABLE IF NOT EXISTS ai_assets (
  -- 主键和用户关联
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 关联到现有用户表

  -- 资产分类
  service VARCHAR(50) NOT NULL,    -- 服务名: 'midjourney', 'suno', 'luma', 'vidu', 'runway'等
  type VARCHAR(20) NOT NULL,       -- 类型: 'image', 'audio', 'video'

  -- 核心数据（完整的资产对象，兼容现有Store结构）
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
COMMENT ON TABLE ai_assets IS 'AI生成资产表 - 统一存储所有AI服务的生成内容，关联到users表';
COMMENT ON COLUMN ai_assets.user_id IS '关联到users.id，级联删除';
COMMENT ON COLUMN ai_assets.asset_data IS 'JSONB对象 - 完整的资产数据结构';
COMMENT ON COLUMN ai_assets.task_id IS '第三方任务ID - 用于去重和追踪';

-- ==================== 表3: 用户同步配置表 ====================
-- 存储用户的AI工具配置（区别于workspace_user_configs）
CREATE TABLE IF NOT EXISTS user_sync_configs (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,  -- 关联到现有用户表

  -- 配置数据（JSONB格式，完全兼容localStorage）
  gpt_config JSONB,      -- GPT模型配置（model, temperature, max_tokens等）
  server_config JSONB,   -- 服务器配置（API keys, endpoints等）
  ui_settings JSONB,     -- UI设置（主题、语言、布局等）

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE user_sync_configs IS '用户同步配置表 - 存储AI工具相关配置，关联到users表';
COMMENT ON COLUMN user_sync_configs.user_id IS '关联到users.id，级联删除';
COMMENT ON COLUMN user_sync_configs.gpt_config IS 'GPT配置 - 对应localStorage的gptConfigStore';
COMMENT ON COLUMN user_sync_configs.server_config IS '服务器配置 - 对应localStorage的gptServerStore';
COMMENT ON COLUMN user_sync_configs.ui_settings IS 'UI设置 - 对应localStorage的app-store';

-- ==================== 存储统计视图 ====================

-- 创建用户存储统计视图
CREATE OR REPLACE VIEW user_storage_stats AS
SELECT
  u.id AS user_id,
  u.phone,
  u.name,
  COUNT(DISTINCT cs.id) AS total_sessions,
  COUNT(DISTINCT aa.id) AS total_assets,
  SUM(CASE WHEN aa.type = 'image' THEN 1 ELSE 0 END) AS image_count,
  SUM(CASE WHEN aa.type = 'audio' THEN 1 ELSE 0 END) AS audio_count,
  SUM(CASE WHEN aa.type = 'video' THEN 1 ELSE 0 END) AS video_count,
  MAX(cs.updated_at) AS last_chat_time,
  MAX(aa.created_at) AS last_generation_time
FROM users u
LEFT JOIN chat_sessions cs ON u.id = cs.user_id
LEFT JOIN ai_assets aa ON u.id = aa.user_id
GROUP BY u.id, u.phone, u.name;

COMMENT ON VIEW user_storage_stats IS '用户存储统计 - 实时聚合各类数据，关联users表';

-- ==================== 自动更新时间戳触发器 ====================

-- 创建触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为chat_sessions表添加触发器
DROP TRIGGER IF EXISTS trigger_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER trigger_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为user_sync_configs表添加触发器
DROP TRIGGER IF EXISTS trigger_user_sync_configs_updated_at ON user_sync_configs;
CREATE TRIGGER trigger_user_sync_configs_updated_at
  BEFORE UPDATE ON user_sync_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== 行级安全策略（RLS）====================

-- 启用RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sync_configs ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能访问自己的数据
CREATE POLICY "Users can view their own chat sessions"
  ON chat_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own chat sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own chat sessions"
  ON chat_sessions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own chat sessions"
  ON chat_sessions FOR DELETE
  USING (user_id = auth.uid());

-- AI资产策略
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

-- 同步配置策略
CREATE POLICY "Users can view their own sync configs"
  ON user_sync_configs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own sync configs"
  ON user_sync_configs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sync configs"
  ON user_sync_configs FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own sync configs"
  ON user_sync_configs FOR DELETE
  USING (user_id = auth.uid());

-- ==================== 初始化完成 ====================

-- 查看已创建的表
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN ('chat_sessions', 'ai_assets', 'user_sync_configs')
ORDER BY table_name;

-- 提示信息
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 数据库初始化完成（V2）！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '已创建3个表（关联到现有users表）:';
  RAISE NOTICE '  1. chat_sessions       - 聊天会话';
  RAISE NOTICE '  2. ai_assets           - AI生成资产';
  RAISE NOTICE '  3. user_sync_configs   - 用户同步配置';
  RAISE NOTICE '';
  RAISE NOTICE '已创建索引: 8个';
  RAISE NOTICE '已创建视图: user_storage_stats';
  RAISE NOTICE '已创建触发器: 2个';
  RAISE NOTICE '已启用RLS安全策略';
  RAISE NOTICE '';
  RAISE NOTICE '特性:';
  RAISE NOTICE '  - 关联现有users表（user_id → users.id）';
  RAISE NOTICE '  - 利用现有api_keys认证';
  RAISE NOTICE '  - 级联删除（删除用户自动清理数据）';
  RAISE NOTICE '  - 行级安全（RLS）数据隔离';
  RAISE NOTICE '';
  RAISE NOTICE '下一步:';
  RAISE NOTICE '  1. 修改后端API使用users.id作为user_id';
  RAISE NOTICE '  2. 通过api_keys.key_value验证用户';
  RAISE NOTICE '  3. 测试数据同步功能';
  RAISE NOTICE '========================================';
END $$;
