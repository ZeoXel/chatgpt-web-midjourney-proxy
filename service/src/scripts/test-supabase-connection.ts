/**
 * Supabase数据库连接测试脚本
 * 用于验证数据库配置和表结构
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testConnection() {
  log('\n========================================', 'cyan');
  log('  Supabase 数据库连接测试', 'cyan');
  log('========================================\n', 'cyan');

  // 1. 检查环境变量
  log('📋 步骤1: 检查环境变量配置', 'blue');
  if (!SUPABASE_URL) {
    log('❌ 错误: SUPABASE_URL 未配置', 'red');
    log('   请在 service/.env 中添加: SUPABASE_URL=https://xxx.supabase.co', 'yellow');
    process.exit(1);
  }
  if (!SUPABASE_SERVICE_KEY) {
    log('❌ 错误: SUPABASE_SERVICE_KEY 未配置', 'red');
    log('   请在 service/.env 中添加 Service Role Key', 'yellow');
    process.exit(1);
  }

  log(`✅ SUPABASE_URL: ${SUPABASE_URL}`, 'green');
  log(`✅ SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY.substring(0, 20)}...`, 'green');

  // 2. 创建客户端
  log('\n📋 步骤2: 创建Supabase客户端', 'blue');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  log('✅ 客户端创建成功', 'green');

  // 3. 测试连接
  log('\n📋 步骤3: 测试数据库连接', 'blue');
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('count', { count: 'exact', head: true });

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        log('⚠️  表 chat_sessions 不存在', 'yellow');
        log('   需要先执行初始化SQL脚本', 'yellow');
        return { connected: true, tablesExist: false };
      }
      throw error;
    }

    log('✅ 数据库连接成功', 'green');
  } catch (error: any) {
    log(`❌ 连接失败: ${error.message}`, 'red');
    process.exit(1);
  }

  // 4. 检查表结构
  log('\n📋 步骤4: 检查表结构', 'blue');
  const tables = ['chat_sessions', 'ai_assets', 'user_configs'];
  const tableStatus: Record<string, boolean> = {};

  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .limit(1);

      if (error) {
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          log(`❌ 表 ${table} 不存在`, 'red');
          tableStatus[table] = false;
        } else {
          throw error;
        }
      } else {
        log(`✅ 表 ${table} 存在`, 'green');
        tableStatus[table] = true;
      }
    } catch (error: any) {
      log(`❌ 检查表 ${table} 失败: ${error.message}`, 'red');
      tableStatus[table] = false;
    }
  }

  const allTablesExist = Object.values(tableStatus).every(status => status);

  // 5. 获取表统计信息
  if (allTablesExist) {
    log('\n📋 步骤5: 获取表统计信息', 'blue');

    try {
      const [sessionsCount, assetsCount, configsCount] = await Promise.all([
        supabase.from('chat_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('ai_assets').select('*', { count: 'exact', head: true }),
        supabase.from('user_configs').select('*', { count: 'exact', head: true }),
      ]);

      log(`📊 chat_sessions: ${sessionsCount.count || 0} 条记录`, 'cyan');
      log(`📊 ai_assets: ${assetsCount.count || 0} 条记录`, 'cyan');
      log(`📊 user_configs: ${configsCount.count || 0} 条记录`, 'cyan');

      // 如果有数据，显示示例
      if (sessionsCount.count && sessionsCount.count > 0) {
        const { data: sampleSession } = await supabase
          .from('chat_sessions')
          .select('*')
          .limit(1)
          .single();

        if (sampleSession) {
          log('\n📄 chat_sessions 示例数据:', 'cyan');
          console.log(JSON.stringify(sampleSession, null, 2));
        }
      }
    } catch (error: any) {
      log(`⚠️  获取统计信息失败: ${error.message}`, 'yellow');
    }
  }

  // 6. 测试写入权限
  if (allTablesExist) {
    log('\n📋 步骤6: 测试写入权限', 'blue');
    try {
      const testSession = {
        user_id: 'test-user-' + Date.now(),
        title: '测试会话',
        messages: [],
      };

      const { data, error } = await supabase
        .from('chat_sessions')
        .insert(testSession)
        .select()
        .single();

      if (error) throw error;

      log('✅ 写入测试成功', 'green');

      // 清理测试数据
      await supabase.from('chat_sessions').delete().eq('id', data.id);
      log('✅ 测试数据已清理', 'green');
    } catch (error: any) {
      log(`❌ 写入测试失败: ${error.message}`, 'red');
    }
  }

  // 7. 检查索引
  if (allTablesExist) {
    log('\n📋 步骤7: 检查数据库索引', 'blue');
    try {
      // 注意：这需要直接查询pg_indexes，可能需要额外权限
      log('⚠️  索引检查需要数据库管理员权限，跳过', 'yellow');
    } catch (error: any) {
      log(`⚠️  无法检查索引: ${error.message}`, 'yellow');
    }
  }

  // 最终总结
  log('\n========================================', 'cyan');
  log('  测试结果总结', 'cyan');
  log('========================================\n', 'cyan');

  if (allTablesExist) {
    log('✅ 所有检查通过！数据库配置正确', 'green');
    log('\n下一步:', 'blue');
    log('  1. 在 service/src/index.ts 中注册同步路由', 'cyan');
    log('  2. 重启服务: bun run dev', 'cyan');
    log('  3. 测试API: curl http://localhost:3002/sync/sessions -H "X-Ptoken: your-key"', 'cyan');
  } else {
    log('⚠️  表结构不完整，需要初始化数据库', 'yellow');
    log('\n请执行以下步骤:', 'blue');
    log('  1. 访问 Supabase 控制台 → SQL Editor', 'cyan');
    log('  2. 复制 service/src/db/supabase-init.sql 的内容', 'cyan');
    log('  3. 粘贴并执行 SQL', 'cyan');
    log('  4. 重新运行此测试脚本', 'cyan');
  }

  log('\n========================================\n', 'cyan');
}

// 运行测试
testConnection().catch((error) => {
  log(`\n❌ 测试过程出现错误: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
