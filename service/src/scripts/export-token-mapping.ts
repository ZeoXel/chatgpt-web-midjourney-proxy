/**
 * 导出用户令牌映射表
 * 用于通知用户更新他们的API Key
 *
 * 运行方式：
 * bun run service/src/scripts/export-token-mapping.ts > token-updates.csv
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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

async function exportTokenMapping() {
  console.error('\n🔍 导出令牌映射表...\n');

  // 查询所有API Keys及其关联的用户信息
  const { data: apiKeys, error } = await supabase
    .from('api_keys')
    .select('id, key_value, status, provider, assigned_user_id, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  }

  if (!apiKeys || apiKeys.length === 0) {
    console.error('⚠️  没有找到任何API Key');
    return;
  }

  // 获取所有用户信息
  const userIds = [...new Set(apiKeys
    .filter((k: any) => k.assigned_user_id)
    .map((k: any) => k.assigned_user_id))];

  const { data: users } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', userIds);

  const userMap = new Map(users?.map((u: any) => [u.id, u]) || []);

  // 输出CSV格式
  console.log('令牌ID,令牌长度,令牌前缀,状态,提供商,用户ID,用户名,用户邮箱,创建时间,是否需要修复');

  apiKeys.forEach((key: any) => {
    const length = key.key_value?.length || 0;
    const needsFix = length !== 51 ? '是' : '否';
    const user = key.assigned_user_id ? userMap.get(key.assigned_user_id) : null;

    const row = [
      key.id,
      length,
      key.key_value.substring(0, 20) + '...',
      key.status,
      key.provider || 'N/A',
      key.assigned_user_id || '(未分配)',
      user?.name || 'N/A',
      user?.email || 'N/A',
      key.created_at,
      needsFix
    ].map(v => `"${v}"`).join(',');

    console.log(row);
  });

  console.error(`\n✅ 已导出 ${apiKeys.length} 个令牌记录`);

  // 统计需要修复的用户
  const affectedKeys = apiKeys.filter((k: any) => k.key_value?.length !== 51);
  const affectedUserIds = new Set(
    affectedKeys
      .filter((k: any) => k.assigned_user_id)
      .map((k: any) => k.assigned_user_id)
  );

  console.error(`\n📊 统计信息:`);
  console.error(`  - 需要修复的令牌: ${affectedKeys.length}`);
  console.error(`  - 受影响的用户: ${affectedUserIds.size}`);
  console.error(`  - 未分配的令牌: ${affectedKeys.filter((k: any) => !k.assigned_user_id).length}`);

  // 按长度分类
  const lengthStats = new Map<number, number>();
  affectedKeys.forEach((k: any) => {
    const len = k.key_value?.length || 0;
    lengthStats.set(len, (lengthStats.get(len) || 0) + 1);
  });

  console.error(`\n  异常令牌长度分布:`);
  Array.from(lengthStats.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([len, count]) => {
      console.error(`    - ${len}字符: ${count}个`);
    });

  console.error('\n💡 提示:');
  console.error('  1. 将输出重定向到CSV文件:');
  console.error('     bun run service/src/scripts/export-token-mapping.ts > token-updates.csv');
  console.error('  2. 执行修复脚本:');
  console.error('     bun run service/src/scripts/fix-token-format.ts');
  console.error('  3. 再次导出查看新令牌');
  console.error('  4. 通知受影响的用户更新其API Key\n');
}

// 主函数
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ 环境变量未配置');
  console.error('请确保 service/.env 包含:');
  console.error('  SUPABASE_URL=https://your-project.supabase.co');
  console.error('  SUPABASE_SERVICE_KEY=your_service_key');
  process.exit(1);
}

exportTokenMapping().catch(error => {
  console.error('\n❌ 执行错误:', error);
  process.exit(1);
});
