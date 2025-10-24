/**
 * 对比两种查询方案的性能
 *
 * 方案A: API Key → user_id → 查询资产 (当前)
 * 方案B: 直接用API Key查询 (假设)
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

async function benchmarkCurrentApproach(apiKey: string, iterations: number = 10) {
  console.log(`\n🔄 方案A: API Key → user_id → 查询资产 (${iterations}次)`);
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    // 查询1: 获取 user_id
    const { data: keyData } = await supabase
      .from('api_keys')
      .select('assigned_user_id')
      .eq('key_value', apiKey)
      .single();

    if (!keyData) {
      console.error('❌ API Key not found');
      return null;
    }

    // 查询2: 获取资产
    const { data: assets } = await supabase
      .from('ai_assets')
      .select('*')
      .eq('user_id', keyData.assigned_user_id)
      .eq('service', 'midjourney')
      .order('created_at', { ascending: false })
      .limit(10);

    const elapsed = performance.now() - start;
    times.push(elapsed);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`  平均: ${avg.toFixed(2)}ms`);
  console.log(`  最快: ${min.toFixed(2)}ms`);
  console.log(`  最慢: ${max.toFixed(2)}ms`);

  return { avg, min, max, times };
}

async function benchmarkDirectApproach(apiKey: string, iterations: number = 10) {
  console.log(`\n🔄 方案B: 假设直接用API Key查询 (${iterations}次)`);
  console.log('  (模拟：仅测量单次查询时间)');

  const times: number[] = [];

  // 先获取 user_id 用于模拟
  const { data: keyData } = await supabase
    .from('api_keys')
    .select('assigned_user_id')
    .eq('key_value', apiKey)
    .single();

  if (!keyData) {
    console.error('❌ API Key not found');
    return null;
  }

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    // 模拟方案B: 直接查询（实际应该是 WHERE api_key = xxx）
    // 这里用 user_id 模拟直接查询的性能
    const { data: assets } = await supabase
      .from('ai_assets')
      .select('*')
      .eq('user_id', keyData.assigned_user_id)
      .eq('service', 'midjourney')
      .order('created_at', { ascending: false })
      .limit(10);

    const elapsed = performance.now() - start;
    times.push(elapsed);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`  平均: ${avg.toFixed(2)}ms`);
  console.log(`  最快: ${min.toFixed(2)}ms`);
  console.log(`  最慢: ${max.toFixed(2)}ms`);

  return { avg, min, max, times };
}

async function testIndexEfficiency(apiKey: string) {
  console.log('\n📊 测试索引效率');

  // 测试 api_keys 查询
  console.log('\n1. api_keys 表查询 (key_value):');
  const start1 = performance.now();
  const { data: keyData } = await supabase
    .from('api_keys')
    .select('assigned_user_id')
    .eq('key_value', apiKey)
    .single();
  const time1 = performance.now() - start1;
  console.log(`  耗时: ${time1.toFixed(2)}ms`);

  if (!keyData) {
    console.error('❌ API Key not found');
    return;
  }

  // 测试 ai_assets 查询（有索引）
  console.log('\n2. ai_assets 查询 (user_id + service):');
  const start2 = performance.now();
  const { data: assets } = await supabase
    .from('ai_assets')
    .select('*')
    .eq('user_id', keyData.assigned_user_id)
    .eq('service', 'midjourney')
    .order('created_at', { ascending: false })
    .limit(10);
  const time2 = performance.now() - start2;
  console.log(`  耗时: ${time2.toFixed(2)}ms`);
  console.log(`  返回记录数: ${assets?.length || 0}`);

  console.log(`\n总耗时: ${(time1 + time2).toFixed(2)}ms`);
}

async function checkIndexes() {
  console.log('\n🔍 检查现有索引');

  // 检查 api_keys 索引
  const { data: apiKeysIndexes } = await supabase.rpc('pg_indexes', {
    schemaname: 'public',
    tablename: 'api_keys'
  }).catch(() => ({ data: null }));

  console.log('\napi_keys 表索引:');
  if (apiKeysIndexes) {
    apiKeysIndexes.forEach((idx: any) => {
      console.log(`  - ${idx.indexname}: ${idx.indexdef}`);
    });
  } else {
    console.log('  (无法查询，可能需要手动检查)');
  }

  // 检查 ai_assets 索引
  const { data: assetsIndexes } = await supabase.rpc('pg_indexes', {
    schemaname: 'public',
    tablename: 'ai_assets'
  }).catch(() => ({ data: null }));

  console.log('\nai_assets 表索引:');
  if (assetsIndexes) {
    assetsIndexes.forEach((idx: any) => {
      console.log(`  - ${idx.indexname}: ${idx.indexdef}`);
    });
  } else {
    console.log('  (无法查询，可能需要手动检查)');
  }
}

async function main() {
  console.log('🏁 开始性能基准测试\n');

  const apiKey = process.argv[2];

  if (!apiKey) {
    console.error('❌ 请提供API Key参数');
    console.log('\n用法:');
    console.log('  bun run service/src/scripts/benchmark-query-performance.ts <your-api-key>');
    process.exit(1);
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ 环境变量未配置');
    process.exit(1);
  }

  console.log('API Key:', apiKey.substring(0, 15) + '...');

  // 1. 检查索引
  await checkIndexes();

  // 2. 测试单次查询效率
  await testIndexEfficiency(apiKey);

  // 3. 基准测试方案A (当前)
  const resultA = await benchmarkCurrentApproach(apiKey, 20);

  // 4. 基准测试方案B (直接查询)
  const resultB = await benchmarkDirectApproach(apiKey, 20);

  // 5. 对比结果
  if (resultA && resultB) {
    console.log('\n📈 性能对比总结:');
    console.log('─'.repeat(50));
    console.log(`方案A (当前): 平均 ${resultA.avg.toFixed(2)}ms`);
    console.log(`方案B (优化): 平均 ${resultB.avg.toFixed(2)}ms`);
    console.log(`性能提升: ${((resultA.avg - resultB.avg) / resultA.avg * 100).toFixed(1)}%`);
    console.log(`绝对差异: ${(resultA.avg - resultB.avg).toFixed(2)}ms`);
    console.log('─'.repeat(50));

    if (resultA.avg - resultB.avg < 10) {
      console.log('\n✅ 结论: 性能差异小于10ms，推荐保持当前user_id设计');
      console.log('   理由: 数据模型更健壮，支持密钥轮换和多密钥场景');
    } else {
      console.log('\n⚠️  结论: 性能差异较大，可考虑优化');
      console.log('   建议: 检查索引是否正确创建');
    }
  }

  console.log('\n💡 优化建议:');
  console.log('  1. 确保 api_keys(key_value) 有索引');
  console.log('  2. 确保 ai_assets(user_id, service, created_at) 有复合索引');
  console.log('  3. 考虑使用数据库连接池');
  console.log('  4. 如果性能仍不满意，可考虑Redis缓存user_id映射');
}

main().catch(error => {
  console.error('\n❌ 执行错误:', error);
  process.exit(1);
});
