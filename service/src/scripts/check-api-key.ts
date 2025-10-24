/**
 * 检查API Key是否有效及其关联的user_id
 *
 * 运行方式：
 * bun run service/src/scripts/check-api-key.ts <your-api-key>
 */

import { createClient } from '@supabase/supabase-js';
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

async function checkApiKey(apiKey: string) {
  console.log('\n🔍 检查API Key:', apiKey.substring(0, 15) + '...\n');

  // 1. 查询 api_keys 表
  const { data: keyData, error: keyError } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_value', apiKey)
    .single();

  if (keyError || !keyData) {
    console.error('❌ API Key不存在于数据库');
    console.error('错误:', keyError?.message);
    console.log('\n💡 解决方案:');
    console.log('  1. 确认API Key是否正确');
    console.log('  2. 检查是否在 api_keys 表中创建了该Key');
    return;
  }

  console.log('✅ API Key找到:');
  console.log('  - ID:', keyData.id);
  console.log('  - 状态:', keyData.status);
  console.log('  - 提供商:', keyData.provider);
  console.log('  - 分配的用户ID:', keyData.assigned_user_id || '(未分配)');
  console.log('  - 创建时间:', keyData.created_at);

  // 2. 检查状态
  if (keyData.status !== 'assigned' && keyData.status !== 'active') {
    console.warn(`\n⚠️  警告: API Key状态为 "${keyData.status}"`);
    console.log('💡 需要将状态改为 "assigned" 或 "active"');
    console.log(`\nSQL修复命令:`);
    console.log(`UPDATE api_keys SET status = 'assigned' WHERE key_value = '${apiKey}';`);
    return;
  }

  // 3. 检查是否分配用户
  if (!keyData.assigned_user_id) {
    console.error('\n❌ API Key未分配给任何用户');
    console.log('💡 需要分配一个用户ID');
    console.log(`\nSQL修复命令 (需替换 <USER_UUID>):`);
    console.log(`UPDATE api_keys SET assigned_user_id = '<USER_UUID>' WHERE key_value = '${apiKey}';`);
    return;
  }

  // 4. 查询用户信息
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, name, email, created_at')
    .eq('id', keyData.assigned_user_id)
    .single();

  if (userError || !userData) {
    console.error('\n❌ 关联的用户不存在');
    console.error('错误:', userError?.message);
    console.log('💡 用户ID', keyData.assigned_user_id, '在 users 表中未找到');
    return;
  }

  console.log('\n✅ 关联用户信息:');
  console.log('  - 用户ID:', userData.id);
  console.log('  - 用户名:', userData.name || '(未设置)');
  console.log('  - 邮箱:', userData.email || '(未设置)');
  console.log('  - 创建时间:', userData.created_at);

  // 5. 查询该用户的资产数量
  const { count: assetCount, error: countError } = await supabase
    .from('ai_assets')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userData.id);

  if (countError) {
    console.error('\n❌ 查询资产失败:', countError.message);
    return;
  }

  console.log('\n📊 用户资产统计:');
  console.log('  - 总资产数:', assetCount || 0);

  // 6. 按服务类型统计
  const { data: serviceStats } = await supabase
    .from('ai_assets')
    .select('service')
    .eq('user_id', userData.id);

  if (serviceStats && serviceStats.length > 0) {
    const serviceCounts: Record<string, number> = {};
    serviceStats.forEach((item: any) => {
      serviceCounts[item.service] = (serviceCounts[item.service] || 0) + 1;
    });

    console.log('\n  按服务分类:');
    Object.entries(serviceCounts).forEach(([service, count]) => {
      console.log(`    - ${service}: ${count}`);
    });
  }

  // 7. 显示最近5条资产
  const { data: recentAssets } = await supabase
    .from('ai_assets')
    .select('id, service, type, task_id, created_at')
    .eq('user_id', userData.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (recentAssets && recentAssets.length > 0) {
    console.log('\n📋 最近5条资产:');
    recentAssets.forEach((asset: any, index: number) => {
      console.log(`  ${index + 1}. [${asset.service}/${asset.type}] ${asset.task_id || asset.id.substring(0, 8)} - ${asset.created_at}`);
    });
  }

  console.log('\n✅ API Key 检查完成，配置正常！');
  console.log('\n🔧 如果前端仍无法读取数据，请检查:');
  console.log('  1. 生产环境后端是否重启并加载了新代码');
  console.log('  2. 环境变量 SUPABASE_URL 和 SUPABASE_SERVICE_KEY 是否配置');
  console.log('  3. 前端是否使用了正确的 API Key');
  console.log('  4. 浏览器Console是否有错误日志');
}

// 主函数
const apiKey = process.argv[2];

if (!apiKey) {
  console.error('❌ 请提供API Key参数');
  console.log('\n用法:');
  console.log('  bun run service/src/scripts/check-api-key.ts <your-api-key>');
  console.log('\n示例:');
  console.log('  bun run service/src/scripts/check-api-key.ts sk-xxxxxxxxxxxxx');
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ 环境变量未配置');
  console.log('请确保 service/.env 包含:');
  console.log('  SUPABASE_URL=https://your-project.supabase.co');
  console.log('  SUPABASE_SERVICE_KEY=your_service_key');
  process.exit(1);
}

checkApiKey(apiKey).catch(error => {
  console.error('\n❌ 执行错误:', error);
  process.exit(1);
});
