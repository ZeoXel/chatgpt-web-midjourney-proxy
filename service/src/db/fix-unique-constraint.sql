-- ============================================
-- 修复 ai_assets 表的唯一约束
-- 用于支持 UPSERT 操作的复合唯一键
-- ============================================

-- 说明：
-- 后端代码使用 onConflict: 'user_id,service,task_id' 进行 UPSERT
-- 需要在数据库中创建对应的复合唯一约束

-- ============================================
-- 1. 删除旧的单字段唯一索引（如果存在）
-- ============================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'ai_assets'
        AND indexname = 'idx_ai_assets_task_id_unique'
    ) THEN
        DROP INDEX idx_ai_assets_task_id_unique;
        RAISE NOTICE '✅ 删除旧索引: idx_ai_assets_task_id_unique';
    ELSE
        RAISE NOTICE '✓ 旧索引不存在: idx_ai_assets_task_id_unique';
    END IF;
END $$;

-- ============================================
-- 2. 创建复合唯一约束
-- ============================================

-- 复合唯一索引：user_id + service + task_id（支持 UPSERT）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'ai_assets'
        AND indexname = 'idx_ai_assets_user_service_task_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_ai_assets_user_service_task_unique
        ON ai_assets(user_id, service, task_id)
        WHERE task_id IS NOT NULL;
        RAISE NOTICE '✅ 创建复合唯一索引: idx_ai_assets_user_service_task_unique';
    ELSE
        RAISE NOTICE '✓ 索引已存在: idx_ai_assets_user_service_task_unique';
    END IF;
END $$;

-- ============================================
-- 3. 验证约束
-- ============================================

-- 查看新创建的索引
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'ai_assets'
AND indexname = 'idx_ai_assets_user_service_task_unique';

RAISE NOTICE '';
RAISE NOTICE '🎉 唯一约束修复完成！';
RAISE NOTICE '';
RAISE NOTICE '📊 约束详情:';
RAISE NOTICE '  - 字段组合: (user_id, service, task_id)';
RAISE NOTICE '  - 约束类型: UNIQUE INDEX';
RAISE NOTICE '  - 支持操作: UPSERT with ON CONFLICT';
RAISE NOTICE '';
RAISE NOTICE '✅ 现在可以正常使用 UPSERT 操作保存对话历史了';
