-- ============================================
-- 性能优化索引脚本
-- 用于提升 API Key → user_id → 资产查询 的性能
-- ============================================

-- 说明：
-- 此脚本为当前 user_id 设计添加优化索引，
-- 将2次查询的总时间从 15-30ms 降低到 5-10ms

-- ============================================
-- 1. api_keys 表索引
-- ============================================

-- 检查并创建 key_value 索引（用于快速查找 API Key）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'api_keys'
        AND indexname = 'idx_api_keys_key_value'
    ) THEN
        CREATE INDEX idx_api_keys_key_value ON api_keys(key_value);
        RAISE NOTICE '✅ 创建索引: idx_api_keys_key_value';
    ELSE
        RAISE NOTICE '✓ 索引已存在: idx_api_keys_key_value';
    END IF;
END $$;

-- 优化：为 assigned_user_id 添加索引（支持反向查询）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'api_keys'
        AND indexname = 'idx_api_keys_assigned_user'
    ) THEN
        CREATE INDEX idx_api_keys_assigned_user ON api_keys(assigned_user_id) WHERE assigned_user_id IS NOT NULL;
        RAISE NOTICE '✅ 创建索引: idx_api_keys_assigned_user';
    ELSE
        RAISE NOTICE '✓ 索引已存在: idx_api_keys_assigned_user';
    END IF;
END $$;

-- 复合索引：status + assigned_user_id（加速认证查询）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'api_keys'
        AND indexname = 'idx_api_keys_status_user'
    ) THEN
        CREATE INDEX idx_api_keys_status_user ON api_keys(status, assigned_user_id);
        RAISE NOTICE '✅ 创建索引: idx_api_keys_status_user';
    ELSE
        RAISE NOTICE '✓ 索引已存在: idx_api_keys_status_user';
    END IF;
END $$;

-- ============================================
-- 2. ai_assets 表索引
-- ============================================

-- 核心复合索引：user_id + service + created_at（覆盖最常用的查询）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'ai_assets'
        AND indexname = 'idx_ai_assets_user_service_created'
    ) THEN
        CREATE INDEX idx_ai_assets_user_service_created
        ON ai_assets(user_id, service, created_at DESC);
        RAISE NOTICE '✅ 创建索引: idx_ai_assets_user_service_created';
    ELSE
        RAISE NOTICE '✓ 索引已存在: idx_ai_assets_user_service_created';
    END IF;
END $$;

-- 复合索引：user_id + type + created_at（按类型查询）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'ai_assets'
        AND indexname = 'idx_ai_assets_user_type_created'
    ) THEN
        CREATE INDEX idx_ai_assets_user_type_created
        ON ai_assets(user_id, type, created_at DESC);
        RAISE NOTICE '✅ 创建索引: idx_ai_assets_user_type_created';
    ELSE
        RAISE NOTICE '✓ 索引已存在: idx_ai_assets_user_type_created';
    END IF;
END $$;

-- task_id 唯一索引（防止重复保存 + 加速去重查询）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'ai_assets'
        AND indexname = 'idx_ai_assets_task_id_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_ai_assets_task_id_unique
        ON ai_assets(task_id)
        WHERE task_id IS NOT NULL;
        RAISE NOTICE '✅ 创建唯一索引: idx_ai_assets_task_id_unique';
    ELSE
        RAISE NOTICE '✓ 索引已存在: idx_ai_assets_task_id_unique';
    END IF;
END $$;

-- JSONB GIN 索引（加速 asset_data 内部字段查询）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'ai_assets'
        AND indexname = 'idx_ai_assets_data_gin'
    ) THEN
        CREATE INDEX idx_ai_assets_data_gin
        ON ai_assets USING GIN (asset_data);
        RAISE NOTICE '✅ 创建 GIN 索引: idx_ai_assets_data_gin';
    ELSE
        RAISE NOTICE '✓ 索引已存在: idx_ai_assets_data_gin';
    END IF;
END $$;

-- ============================================
-- 3. 查询性能统计（可选）
-- ============================================

-- 分析表以更新统计信息（帮助查询优化器选择最佳执行计划）
ANALYZE api_keys;
ANALYZE ai_assets;

RAISE NOTICE '';
RAISE NOTICE '🎉 索引优化完成！';
RAISE NOTICE '';
RAISE NOTICE '📊 创建的索引总结:';
RAISE NOTICE '  api_keys:';
RAISE NOTICE '    - idx_api_keys_key_value (单列)';
RAISE NOTICE '    - idx_api_keys_assigned_user (部分索引)';
RAISE NOTICE '    - idx_api_keys_status_user (复合)';
RAISE NOTICE '';
RAISE NOTICE '  ai_assets:';
RAISE NOTICE '    - idx_ai_assets_user_service_created (复合，覆盖最常用查询)';
RAISE NOTICE '    - idx_ai_assets_user_type_created (复合，按类型查询)';
RAISE NOTICE '    - idx_ai_assets_task_id_unique (唯一索引，防重复)';
RAISE NOTICE '    - idx_ai_assets_data_gin (GIN，JSONB加速)';
RAISE NOTICE '';
RAISE NOTICE '💡 预期性能提升:';
RAISE NOTICE '  - API Key → user_id 查询: ~2-5ms';
RAISE NOTICE '  - user_id → 资产查询: ~3-8ms';
RAISE NOTICE '  - 总查询时间: ~5-13ms (相比之前的15-30ms)';
RAISE NOTICE '';
RAISE NOTICE '✅ 建议运行性能测试验证: bun run benchmark:query';

-- ============================================
-- 4. 索引维护建议（注释）
-- ============================================

-- 定期重建索引（生产环境建议每月执行）：
-- REINDEX INDEX CONCURRENTLY idx_ai_assets_user_service_created;

-- 查看索引使用统计：
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
-- FROM pg_stat_user_indexes
-- WHERE tablename IN ('api_keys', 'ai_assets')
-- ORDER BY idx_scan DESC;

-- 查看索引大小：
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
-- FROM pg_stat_user_indexes
-- WHERE tablename IN ('api_keys', 'ai_assets')
-- ORDER BY pg_relation_size(indexrelid) DESC;
