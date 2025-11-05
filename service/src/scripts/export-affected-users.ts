/**
 * 导出受影响用户的新令牌
 * 用于通知用户更新他们的API Key
 *
 * 运行方式：
 * bun run service/src/scripts/export-affected-users.ts
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

// 受影响的用户令牌ID (从修复过程中获得)
const affectedTokenIds = [
  'A000002', 'A000003', 'A000004', // 测试/异常令牌
  'A000051', 'A000052', 'A000053', 'A000054', 'A000055', // 已分配用户
];

async function exportAffectedUsers() {
  console.log('\n' + '='.repeat(60));
  console.log('📧 受影响用户及新令牌列表');
  console.log('='.repeat(60) + '\n');

  // 查询这些令牌的详细信息
  const { data: apiKeys, error } = await supabase
    .from('api_keys')
    .select('id, key_value, status, provider, assigned_user_id, created_at')
    .in('id', affectedTokenIds);

  if (error || !apiKeys) {
    console.error('❌ 查询失败:', error?.message);
    return;
  }

  // 获取关联的用户信息
  const userIds = apiKeys
    .filter((k: any) => k.assigned_user_id)
    .map((k: any) => k.assigned_user_id);

  const { data: users } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', userIds);

  const userMap = new Map(users?.map((u: any) => [u.id, u]) || []);

  // 分类显示
  const assignedKeys = apiKeys.filter((k: any) => k.assigned_user_id);
  const unassignedKeys = apiKeys.filter((k: any) => !k.assigned_user_id);

  console.log(`📊 统计信息:`);
  console.log(`  - 总受影响令牌: ${apiKeys.length}`);
  console.log(`  - 已分配用户: ${assignedKeys.length}`);
  console.log(`  - 未分配: ${unassignedKeys.length}\n`);

  // 显示已分配用户的令牌
  if (assignedKeys.length > 0) {
    console.log('🔴 需要通知的用户:\n');

    assignedKeys.forEach((key: any, index: number) => {
      const user = userMap.get(key.assigned_user_id);

      console.log(`${index + 1}. 用户信息:`);
      console.log(`   - 用户ID: ${key.assigned_user_id}`);
      console.log(`   - 用户名: ${user?.name || '(未设置)'}`);
      console.log(`   - 邮箱: ${user?.email || '(未设置)'}`);
      console.log(`   - 令牌ID: ${key.id}`);
      console.log(`   - 新令牌: ${key.key_value}`);
      console.log(`   - 状态: ${key.status}`);
      console.log(`   - 提供商: ${key.provider || 'N/A'}`);
      console.log('');
    });
  }

  // 未分配的令牌
  if (unassignedKeys.length > 0) {
    console.log('🟡 未分配的令牌 (无需通知):\n');

    unassignedKeys.forEach((key: any, index: number) => {
      console.log(`${index + 1}. 令牌ID: ${key.id}`);
      console.log(`   - 新令牌: ${key.key_value}`);
      console.log(`   - 状态: ${key.status}`);
      console.log('');
    });
  }

  // 生成通知模板
  console.log('='.repeat(60));
  console.log('📧 用户通知邮件模板:\n');

  console.log(`主题: 重要通知 - API Key已更新\n`);
  console.log(`内容:`);
  console.log(`---`);
  console.log(`尊敬的用户,\n`);
  console.log(`我们对系统进行了安全升级,您的API Key已更新为新的格式。\n`);
  console.log(`新的API Key:`);
  console.log(`[在此插入用户的新令牌]\n`);
  console.log(`请在您的应用中更新API Key以继续使用服务。旧令牌已失效。\n`);
  console.log(`如有任何问题,请联系技术支持。\n`);
  console.log(`此致,`);
  console.log(`技术团队`);
  console.log(`---\n`);

  // 生成CSV格式
  console.log('='.repeat(60));
  console.log('📄 CSV格式 (可导入Excel):\n');

  console.log('用户ID,用户名,邮箱,令牌ID,新令牌,状态');

  assignedKeys.forEach((key: any) => {
    const user = userMap.get(key.assigned_user_id);
    console.log(`"${key.assigned_user_id}","${user?.name || 'N/A'}","${user?.email || 'N/A'}","${key.id}","${key.key_value}","${key.status}"`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('✅ 导出完成\n');
}

// 主函数
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ 环境变量未配置');
  console.error('请确保 service/.env 包含:');
  console.error('  SUPABASE_URL=https://your-project.supabase.co');
  console.error('  SUPABASE_SERVICE_KEY=your_service_key');
  process.exit(1);
}

exportAffectedUsers().catch(error => {
  console.error('\n❌ 执行错误:', error);
  process.exit(1);
});
