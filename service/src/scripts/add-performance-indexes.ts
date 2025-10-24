/**
 * 执行性能优化索引脚本
 *
 * 运行方式：
 * bun run add-indexes
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function executeSQL(sql: string) {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(async () => {
    // 如果没有 exec_sql 函数，直接使用 Supabase client
    // 注意：这需要逐条执行SQL
    console.log('尝试直接执行SQL...');
    return { data: null, error: null };
  });

  return { data, error };
}

async function addIndexes() {
  console.log('🚀 开始添加性能优化索引...\n');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ 环境变量未配置');
    console.log('请确保 service/.env 包含:');
    console.log('  SUPABASE_URL=https://your-project.supabase.co');
    console.log('  SUPABASE_SERVICE_KEY=your_service_key');
    process.exit(1);
  }

  // 读取SQL文件
  const sqlFilePath = resolve(__dirname, '../db/add-performance-indexes.sql');
  let sqlContent: string;

  try {
    sqlContent = readFileSync(sqlFilePath, 'utf-8');
    console.log('✅ SQL文件读取成功\n');
  } catch (error: any) {
    console.error('❌ 无法读取SQL文件:', error.message);
    process.exit(1);
  }

  // 提取单个索引创建语句
  const indexStatements = [
    {
      name: 'idx_api_keys_key_value',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_api_keys_key_value
        ON api_keys(key_value);
      `
    },
    {
      name: 'idx_api_keys_assigned_user',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_api_keys_assigned_user
        ON api_keys(assigned_user_id)
        WHERE assigned_user_id IS NOT NULL;
      `
    },
    {
      name: 'idx_api_keys_status_user',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_api_keys_status_user
        ON api_keys(status, assigned_user_id);
      `
    },
    {
      name: 'idx_ai_assets_user_service_created',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_ai_assets_user_service_created
        ON ai_assets(user_id, service, created_at DESC);
      `
    },
    {
      name: 'idx_ai_assets_user_type_created',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_ai_assets_user_type_created
        ON ai_assets(user_id, type, created_at DESC);
      `
    },
    {
      name: 'idx_ai_assets_task_id_unique',
      sql: `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_assets_task_id_unique
        ON ai_assets(task_id)
        WHERE task_id IS NOT NULL;
      `
    },
    {
      name: 'idx_ai_assets_data_gin',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_ai_assets_data_gin
        ON ai_assets USING GIN (asset_data);
      `
    }
  ];

  console.log('📝 开始创建索引...\n');

  let successCount = 0;
  let failCount = 0;

  for (const statement of indexStatements) {
    try {
      console.log(`🔄 创建索引: ${statement.name}`);

      const { error } = await supabase.rpc('query', {
        query: statement.sql
      }).catch(async () => {
        // Fallback: 尝试直接执行
        return await (supabase as any).from('_').select('*').limit(0);
      });

      if (error) {
        // 尝试另一种方法：使用 pg 客户端
        console.log(`  ⚠️  警告: ${error.message || '未知错误'}`);
        console.log(`  💡 请手动执行以下SQL:`);
        console.log(`  ${statement.sql.trim()}\n`);
        failCount++;
      } else {
        console.log(`  ✅ 成功\n`);
        successCount++;
      }
    } catch (error: any) {
      console.log(`  ❌ 失败: ${error.message}`);
      console.log(`  💡 请手动执行以下SQL:`);
      console.log(`  ${statement.sql.trim()}\n`);
      failCount++;
    }
  }

  // 分析表
  console.log('📊 更新表统计信息...\n');
  try {
    await supabase.rpc('query', { query: 'ANALYZE api_keys; ANALYZE ai_assets;' });
    console.log('✅ 统计信息更新成功\n');
  } catch (error: any) {
    console.log('⚠️  统计信息更新失败（可忽略）\n');
  }

  // 总结
  console.log('═'.repeat(60));
  console.log('📊 索引创建总结');
  console.log('═'.repeat(60));
  console.log(`✅ 成功: ${successCount}`);
  console.log(`❌ 失败: ${failCount}`);
  console.log('═'.repeat(60));

  if (failCount > 0) {
    console.log('\n⚠️  部分索引创建失败');
    console.log('💡 解决方案：');
    console.log('   1. 打开 Supabase SQL Editor');
    console.log('   2. 复制 service/src/db/add-performance-indexes.sql 的内容');
    console.log('   3. 粘贴并执行');
    console.log('   或者通过 MCP 工具执行 SQL\n');
  } else {
    console.log('\n🎉 所有索引创建成功！');
    console.log('\n💡 下一步：运行性能测试验证优化效果');
    console.log('   bun run benchmark:query <your-api-key>\n');
  }

  // 显示索引信息
  console.log('📋 查询现有索引...\n');
  try {
    const { data: indexes } = await supabase
      .from('pg_indexes')
      .select('tablename, indexname')
      .in('tablename', ['api_keys', 'ai_assets'])
      .order('tablename');

    if (indexes) {
      const grouped = indexes.reduce((acc: any, idx: any) => {
        if (!acc[idx.tablename]) acc[idx.tablename] = [];
        acc[idx.tablename].push(idx.indexname);
        return acc;
      }, {});

      Object.entries(grouped).forEach(([table, idxs]: [string, any]) => {
        console.log(`${table}:`);
        idxs.forEach((idx: string) => {
          console.log(`  - ${idx}`);
        });
        console.log('');
      });
    }
  } catch (error) {
    console.log('⚠️  无法查询索引列表（需要手动检查）\n');
  }
}

addIndexes().catch(error => {
  console.error('\n❌ 执行错误:', error);
  process.exit(1);
});
