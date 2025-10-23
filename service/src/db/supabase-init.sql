-- ==========================================
-- ChatGPT Web Midjourney Proxy
-- Supabase数据库初始化脚本
-- ==========================================
-- 用途: 支持多平台数据同步
-- 存储: 仅存URL引用和元数据，不存文件
-- 设计: 3个表，简单高效
-- ==========================================

-- ==================== 表1: 聊天会话表 ====================
-- 存储用户的所有对话会话（完整历史记录）
CREATE TABLE IF NOT EXISTS chat_sessions (
  -- 主键和用户关联
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,  -- 对应你的API Key

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

-- 添加注释
COMMENT ON TABLE chat_sessions IS '聊天会话表 - 存储用户对话历史';
COMMENT ON COLUMN chat_sessions.messages IS 'JSONB数组 - 完整消息列表';
COMMENT ON COLUMN chat_sessions.using_context IS '是否使用上下文';

-- ==================== 表2: AI生成资产表 ====================
-- 统一存储所有AI服务生成的内容（图片/音频/视频）
CREATE TABLE IF NOT EXISTS ai_assets (
  -- 主键和用户关联
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,

  -- 资产分类
  service VARCHAR(50) NOT NULL,    -- 服务名: 'midjourney', 'suno', 'luma', 'vidu', 'runway'等
  type VARCHAR(20) NOT NULL,       -- 类型: 'image', 'audio', 'video'

  -- 核心数据（完整的资产对象，兼容现有Store结构）
  asset_data JSONB NOT NULL,
  /*
   * 示例 - Suno音频:
   * {
   *   "id": "abc123",
   *   "audio_url": "https://cdn.suno.ai/abc.mp3",
   *   "video_url": "https://cdn.suno.ai/abc.mp4",
   *   "image_url": "https://cdn.suno.ai/abc.jpg",
   *   "metadata": {
   *     "prompt": "peaceful piano music",
   *     "tags": "piano, peaceful",
   *     "duration": 180
   *   }
   * }
   *
   * 示例 - Luma视频:
   * {
   *   "id": "gen-xyz",
   *   "video": { "url": "https://r2.luma.ai/xyz.mp4", "width": 1920, "height": 1080 },
   *   "state": "completed",
   *   "metadata": { "prompt": "a flying dragon", "duration": 5 }
   * }
   */

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

-- 添加注释
COMMENT ON TABLE ai_assets IS 'AI生成资产表 - 统一存储所有AI服务的生成内容';
COMMENT ON COLUMN ai_assets.asset_data IS 'JSONB对象 - 完整的资产数据结构';
COMMENT ON COLUMN ai_assets.task_id IS '第三方任务ID - 用于去重和追踪';

-- ==================== 表3: 用户配置表 ====================
-- 存储用户的所有偏好设置和配置
CREATE TABLE IF NOT EXISTS user_configs (
  -- 主键（直接使用user_id）
  user_id VARCHAR(255) PRIMARY KEY,

  -- 配置数据（JSONB格式，完全兼容localStorage）
  gpt_config JSONB,      -- GPT模型配置（model, temperature, max_tokens等）
  server_config JSONB,   -- 服务器配置（API keys, endpoints等）
  ui_settings JSONB,     -- UI设置（主题、语言、布局等）

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE user_configs IS '用户配置表 - 存储用户偏好设置';
COMMENT ON COLUMN user_configs.gpt_config IS 'GPT配置 - 对应localStorage的gptConfigStore';
COMMENT ON COLUMN user_configs.server_config IS '服务器配置 - 对应localStorage的gptServerStore';
COMMENT ON COLUMN user_configs.ui_settings IS 'UI设置 - 对应localStorage的app-store';

-- ==================== 性能优化 ====================

-- 启用JSONB GIN索引（加速JSONB字段查询）
CREATE INDEX IF NOT EXISTS idx_chat_sessions_messages_gin
  ON chat_sessions USING GIN (messages);

CREATE INDEX IF NOT EXISTS idx_ai_assets_data_gin
  ON ai_assets USING GIN (asset_data);

-- ==================== 存储统计视图（可选）====================

-- 创建用户统计视图
CREATE OR REPLACE VIEW user_storage_stats AS
SELECT
  user_id,
  COUNT(DISTINCT cs.id) AS total_sessions,
  COUNT(DISTINCT aa.id) AS total_assets,
  SUM(CASE WHEN aa.type = 'image' THEN 1 ELSE 0 END) AS image_count,
  SUM(CASE WHEN aa.type = 'audio' THEN 1 ELSE 0 END) AS audio_count,
  SUM(CASE WHEN aa.type = 'video' THEN 1 ELSE 0 END) AS video_count,
  MAX(cs.updated_at) AS last_chat_time,
  MAX(aa.created_at) AS last_generation_time
FROM
  (SELECT DISTINCT user_id FROM chat_sessions
   UNION
   SELECT DISTINCT user_id FROM ai_assets) users
LEFT JOIN chat_sessions cs USING (user_id)
LEFT JOIN ai_assets aa USING (user_id)
GROUP BY user_id;

COMMENT ON VIEW user_storage_stats IS '用户存储统计 - 实时聚合各类数据';

-- ==================== 自动更新时间戳触发器 ====================

-- 创建触发器函数
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

-- 为user_configs表添加触发器
DROP TRIGGER IF EXISTS trigger_user_configs_updated_at ON user_configs;
CREATE TRIGGER trigger_user_configs_updated_at
  BEFORE UPDATE ON user_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== 数据清理函数（可选）====================

-- 清理指定时间之前的旧数据
CREATE OR REPLACE FUNCTION cleanup_old_data(months_to_keep INTEGER DEFAULT 3)
RETURNS TABLE(
  deleted_sessions BIGINT,
  deleted_assets BIGINT
) AS $$
DECLARE
  cutoff_date TIMESTAMPTZ;
  sessions_deleted BIGINT;
  assets_deleted BIGINT;
BEGIN
  cutoff_date := NOW() - (months_to_keep || ' months')::INTERVAL;

  -- 删除旧会话
  DELETE FROM chat_sessions
  WHERE updated_at < cutoff_date;
  GET DIAGNOSTICS sessions_deleted = ROW_COUNT;

  -- 删除旧资产
  DELETE FROM ai_assets
  WHERE created_at < cutoff_date;
  GET DIAGNOSTICS assets_deleted = ROW_COUNT;

  -- 返回结果
  deleted_sessions := sessions_deleted;
  deleted_assets := assets_deleted;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_data IS '清理旧数据 - 默认保留最近3个月';

-- 使用示例:
-- SELECT * FROM cleanup_old_data(3);  -- 清理3个月前的数据
-- SELECT * FROM cleanup_old_data(6);  -- 清理6个月前的数据

-- ==================== 初始化完成 ====================

-- 查看已创建的表
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN ('chat_sessions', 'ai_assets', 'user_configs')
ORDER BY table_name;

-- 提示信息
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 数据库初始化完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '已创建3个表:';
  RAISE NOTICE '  1. chat_sessions  - 聊天会话';
  RAISE NOTICE '  2. ai_assets      - AI生成资产';
  RAISE NOTICE '  3. user_configs   - 用户配置';
  RAISE NOTICE '';
  RAISE NOTICE '已创建索引: 6个';
  RAISE NOTICE '已创建视图: user_storage_stats';
  RAISE NOTICE '已创建函数: cleanup_old_data()';
  RAISE NOTICE '';
  RAISE NOTICE '下一步:';
  RAISE NOTICE '  1. 复制SUPABASE_URL和SERVICE_KEY到.env';
  RAISE NOTICE '  2. 在后端注册同步路由';
  RAISE NOTICE '  3. 测试API端点';
  RAISE NOTICE '========================================';
END $$;
