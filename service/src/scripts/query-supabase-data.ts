/**
 * Supabase数据查询脚本
 * 用于查看和分析数据库中的实际数据
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function queryData() {
  log('\n========================================', 'cyan');
  log('  Supabase 数据库查询', 'cyan');
  log('========================================\n', 'cyan');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 1. 查询所有表的统计信息
  log('📊 数据库统计信息\n', 'blue');

  const tables = ['chat_sessions', 'ai_assets', 'user_configs'];
  const stats: Record<string, any> = {};

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      log(`❌ ${table}: 查询失败 - ${error.message}`, 'yellow');
    } else {
      stats[table] = count || 0;
      log(`   ${table}: ${count || 0} 条记录`, 'cyan');
    }
  }

  // 2. 如果有聊天会话，显示示例
  if (stats.chat_sessions > 0) {
    log('\n📝 聊天会话示例 (最新5条)\n', 'blue');

    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      log(`❌ 查询失败: ${error.message}`, 'yellow');
    } else if (sessions) {
      sessions.forEach((session, index) => {
        log(`\n${index + 1}. 会话ID: ${session.id}`, 'green');
        log(`   用户: ${session.user_id}`, 'cyan');
        log(`   标题: ${session.title}`, 'cyan');
        log(`   模型: ${session.model || 'N/A'}`, 'cyan');
        log(`   消息数: ${Array.isArray(session.messages) ? session.messages.length : 0}`, 'cyan');
        log(`   创建时间: ${new Date(session.created_at).toLocaleString('zh-CN')}`, 'cyan');
        log(`   更新时间: ${new Date(session.updated_at).toLocaleString('zh-CN')}`, 'cyan');
      });
    }
  } else {
    log('\n💡 暂无聊天会话数据', 'yellow');
  }

  // 3. 如果有AI资产，显示示例
  if (stats.ai_assets > 0) {
    log('\n🎨 AI资产示例 (最新5条)\n', 'blue');

    const { data: assets, error } = await supabase
      .from('ai_assets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      log(`❌ 查询失败: ${error.message}`, 'yellow');
    } else if (assets) {
      assets.forEach((asset, index) => {
        log(`\n${index + 1}. 资产ID: ${asset.id}`, 'green');
        log(`   用户: ${asset.user_id}`, 'cyan');
        log(`   服务: ${asset.service}`, 'cyan');
        log(`   类型: ${asset.type}`, 'cyan');
        log(`   任务ID: ${asset.task_id || 'N/A'}`, 'cyan');
        log(`   主URL: ${asset.main_url?.substring(0, 50)}...`, 'cyan');
        log(`   提示词: ${asset.prompt?.substring(0, 60)}...`, 'cyan');
        log(`   创建时间: ${new Date(asset.created_at).toLocaleString('zh-CN')}`, 'cyan');
      });

      // 统计各服务的资产数量
      log('\n📊 各服务资产分布\n', 'blue');
      const serviceStats: Record<string, number> = {};
      assets.forEach(asset => {
        const key = `${asset.service} (${asset.type})`;
        serviceStats[key] = (serviceStats[key] || 0) + 1;
      });

      Object.entries(serviceStats).forEach(([service, count]) => {
        log(`   ${service}: ${count} 条`, 'cyan');
      });
    }
  } else {
    log('\n💡 暂无AI资产数据', 'yellow');
  }

  // 4. 如果有用户配置，显示示例
  if (stats.user_configs > 0) {
    log('\n⚙️  用户配置示例 (最新3条)\n', 'blue');

    const { data: configs, error } = await supabase
      .from('user_configs')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(3);

    if (error) {
      log(`❌ 查询失败: ${error.message}`, 'yellow');
    } else if (configs) {
      configs.forEach((config, index) => {
        log(`\n${index + 1}. 用户ID: ${config.user_id}`, 'green');
        log(`   GPT配置: ${config.gpt_config ? '已配置' : '未配置'}`, 'cyan');
        log(`   服务器配置: ${config.server_config ? '已配置' : '未配置'}`, 'cyan');
        log(`   UI设置: ${config.ui_settings ? '已配置' : '未配置'}`, 'cyan');
        log(`   更新时间: ${new Date(config.updated_at).toLocaleString('zh-CN')}`, 'cyan');
      });
    }
  } else {
    log('\n💡 暂无用户配置数据', 'yellow');
  }

  // 5. 查询用户活跃度（如果有数据）
  if (stats.chat_sessions > 0 || stats.ai_assets > 0) {
    log('\n👥 用户活跃度统计\n', 'blue');

    // 从chat_sessions获取用户列表
    const { data: sessionUsers } = await supabase
      .from('chat_sessions')
      .select('user_id');

    // 从ai_assets获取用户列表
    const { data: assetUsers } = await supabase
      .from('ai_assets')
      .select('user_id');

    const allUsers = new Set([
      ...(sessionUsers?.map(s => s.user_id) || []),
      ...(assetUsers?.map(a => a.user_id) || []),
    ]);

    log(`   总用户数: ${allUsers.size}`, 'cyan');

    // 统计每个用户的数据量
    if (allUsers.size > 0 && allUsers.size <= 10) {
      log('\n   用户数据详情:', 'magenta');
      for (const userId of allUsers) {
        const { count: sessionCount } = await supabase
          .from('chat_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        const { count: assetCount } = await supabase
          .from('ai_assets')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        log(`   - ${userId}: ${sessionCount || 0} 会话, ${assetCount || 0} 资产`, 'cyan');
      }
    }
  }

  // 6. 数据库健康度评估
  log('\n🏥 数据库健康度评估\n', 'blue');

  const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0);

  if (totalRecords === 0) {
    log('   状态: ✅ 数据库已就绪，等待数据导入', 'green');
    log('   建议: 可以开始测试数据同步功能', 'cyan');
  } else {
    log(`   状态: ✅ 数据库运行正常`, 'green');
    log(`   总记录数: ${totalRecords}`, 'cyan');
    log(`   已使用表: ${Object.values(stats).filter(c => c > 0).length}/3`, 'cyan');
  }

  // 7. 存储空间估算
  if (totalRecords > 0) {
    log('\n💾 存储空间估算\n', 'blue');

    // 粗略估算（每条记录约1-5KB）
    const estimatedSize = totalRecords * 3; // KB
    const sizeInMB = (estimatedSize / 1024).toFixed(2);

    log(`   估算使用: ~${sizeInMB} MB`, 'cyan');
    log(`   Supabase免费额度: 500 MB`, 'cyan');
    log(`   使用率: ~${((parseFloat(sizeInMB) / 500) * 100).toFixed(2)}%`, 'cyan');
  }

  log('\n========================================\n', 'cyan');
}

// 运行查询
queryData().catch((error) => {
  console.error('查询失败:', error);
  process.exit(1);
});
