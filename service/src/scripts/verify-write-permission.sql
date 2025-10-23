-- ==========================================
-- 验证Supabase写入权限
-- ==========================================
-- 用途: 直接在Supabase SQL Editor中执行，验证表的读写权限
-- 使用方法: 复制到Supabase → SQL Editor → 运行
-- ==========================================

-- 测试1: 插入测试数据到 chat_sessions
INSERT INTO chat_sessions (user_id, title, messages)
VALUES (
  'test-user-' || EXTRACT(EPOCH FROM NOW())::TEXT,
  '权限测试会话',
  '[]'::jsonb
)
RETURNING id, user_id, title, created_at;

-- 测试2: 查询刚插入的数据
SELECT COUNT(*) as total_sessions FROM chat_sessions;

-- 测试3: 插入测试数据到 ai_assets
INSERT INTO ai_assets (user_id, service, type, asset_data)
VALUES (
  'test-user-' || EXTRACT(EPOCH FROM NOW())::TEXT,
  'test-service',
  'image',
  '{"test": true}'::jsonb
)
RETURNING id, service, type, created_at;

-- 测试4: 查询资产数量
SELECT COUNT(*) as total_assets FROM ai_assets;

-- 测试5: 插入测试配置
INSERT INTO user_configs (user_id, gpt_config, server_config)
VALUES (
  'test-user-' || EXTRACT(EPOCH FROM NOW())::TEXT,
  '{"model": "gpt-4"}'::jsonb,
  '{"api_key": "test"}'::jsonb
)
ON CONFLICT (user_id) DO UPDATE SET
  gpt_config = EXCLUDED.gpt_config
RETURNING user_id, created_at, updated_at;

-- 测试6: 查询配置数量
SELECT COUNT(*) as total_configs FROM user_configs;

-- 测试7: 清理测试数据
DELETE FROM chat_sessions WHERE user_id LIKE 'test-user-%';
DELETE FROM ai_assets WHERE user_id LIKE 'test-user-%';
DELETE FROM user_configs WHERE user_id LIKE 'test-user-%';

-- 测试8: 验证清理结果（应该返回0）
SELECT
  (SELECT COUNT(*) FROM chat_sessions WHERE user_id LIKE 'test-user-%') as test_sessions,
  (SELECT COUNT(*) FROM ai_assets WHERE user_id LIKE 'test-user-%') as test_assets,
  (SELECT COUNT(*) FROM user_configs WHERE user_id LIKE 'test-user-%') as test_configs;

-- ==========================================
-- 如果以上SQL全部执行成功，说明权限正常！
-- ==========================================
