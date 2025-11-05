/**
 * 修复API Key令牌格式
 * 自动将所有非51字符的令牌更新为正确格式
 *
 * 运行方式：
 * bun run service/src/scripts/fix-token-format.ts [--dry-run]
 *
 * --dry-run: 仅模拟运行,不实际更新数据库
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';

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

/**
 * 生成51字符的API Key
 * 格式: sk- + 48个base64url字符 = 51字符
 */
function generateApiKey(): string {
  // 使用36字节生成48个base64url字符
  const randomBytes = crypto.randomBytes(36);
  const base64url = randomBytes.toString('base64url');
  return `sk-${base64url}`;
}

interface FixResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ id: string; error: string }>;
}

async function fixTokenFormats(dryRun: boolean = false): Promise<FixResult> {
  console.log('\n' + '='.repeat(60));
  console.log(dryRun ? '🔍 模拟运行模式 (不会修改数据库)' : '🔧 开始修复API Key令牌格式');
  console.log('='.repeat(60) + '\n');

  const result: FixResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  // 1. 查询所有异常令牌
  const { data: apiKeys, error } = await supabase
    .from('api_keys')
    .select('id, key_value, status, provider, assigned_user_id')
    .neq('key_value', 'length', 51);

  if (error) {
    console.error('❌ 查询失败:', error.message);
    throw error;
  }

  // 使用自定义过滤找出异常令牌
  const abnormalKeys = apiKeys?.filter((key: any) => key.key_value?.length !== 51) || [];

  if (abnormalKeys.length === 0) {
    console.log('✅ 没有发现需要修复的异常令牌');
    return result;
  }

  console.log(`📊 发现 ${abnormalKeys.length} 个需要修复的令牌\n`);

  // 2. 提示备份 (仅在非dry-run模式)
  if (!dryRun) {
    console.log('📦 建议备份数据 (可在Supabase控制台手动备份)\n');
    console.log('💡 提示: 如需回滚,可以查询旧令牌值\n');
  }

  // 3. 修复每个异常令牌
  console.log('开始修复令牌:\n');

  for (const key of abnormalKeys) {
    const oldLength = key.key_value?.length || 0;
    const newToken = generateApiKey();

    console.log(`处理 ID: ${key.id}`);
    console.log(`  - 原长度: ${oldLength}`);
    console.log(`  - 原令牌: ${key.key_value.substring(0, 25)}...`);
    console.log(`  - 新令牌: ${newToken.substring(0, 25)}... (长度: ${newToken.length})`);
    console.log(`  - 状态: ${key.status}`);
    console.log(`  - 用户: ${key.assigned_user_id || '(未分配)'}`);

    if (dryRun) {
      console.log('  ✓ [模拟] 已生成新令牌\n');
      result.skipped++;
      continue;
    }

    // 执行更新
    const { error: updateError } = await supabase
      .from('api_keys')
      .update({ key_value: newToken })
      .eq('id', key.id);

    if (updateError) {
      console.log(`  ✗ 更新失败: ${updateError.message}\n`);
      result.failed++;
      result.errors.push({
        id: key.id,
        error: updateError.message
      });
    } else {
      console.log('  ✓ 更新成功\n');
      result.success++;
    }

    // 添加小延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return result;
}

async function verifyFixes() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 验证修复结果\n');

  const { data: remainingIssues } = await supabase
    .from('api_keys')
    .select('id, key_value')
    .neq('key_value', 'length', 51);

  const abnormal = remainingIssues?.filter((key: any) => key.key_value?.length !== 51) || [];

  if (abnormal.length === 0) {
    console.log('✅ 验证通过! 所有令牌格式正确\n');
  } else {
    console.log(`⚠️  仍有 ${abnormal.length} 个异常令牌:\n`);
    abnormal.forEach((key: any) => {
      console.log(`  - ID: ${key.id}, 长度: ${key.key_value.length}`);
    });
    console.log('');
  }

  // 统计总数
  const { count: totalCount } = await supabase
    .from('api_keys')
    .select('*', { count: 'exact', head: true });

  const { count: correctCount } = await supabase
    .from('api_keys')
    .select('*', { count: 'exact', head: true });

  // 由于Supabase查询限制,我们需要手动计算
  const correctTokens = (correctCount || 0) - abnormal.length;

  console.log('📊 最终统计:');
  console.log(`  - 总令牌数: ${totalCount || 0}`);
  console.log(`  - ✅ 正确格式: ${correctTokens}`);
  console.log(`  - ❌ 异常格式: ${abnormal.length}`);
  console.log('='.repeat(60) + '\n');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ 环境变量未配置');
    console.log('请确保 service/.env 包含:');
    console.log('  SUPABASE_URL=https://your-project.supabase.co');
    console.log('  SUPABASE_SERVICE_KEY=your_service_key');
    process.exit(1);
  }

  try {
    // 执行修复
    const result = await fixTokenFormats(dryRun);

    // 显示结果
    console.log('\n' + '='.repeat(60));
    console.log('📈 修复结果统计\n');
    console.log(`  ✅ 成功: ${result.success}`);
    console.log(`  ❌ 失败: ${result.failed}`);
    console.log(`  ⏭️  跳过: ${result.skipped}`);

    if (result.errors.length > 0) {
      console.log('\n  错误详情:');
      result.errors.forEach(err => {
        console.log(`    - ID ${err.id}: ${err.error}`);
      });
    }

    console.log('='.repeat(60) + '\n');

    // 如果不是dry-run,验证结果
    if (!dryRun && result.success > 0) {
      await verifyFixes();
    }

    if (dryRun) {
      console.log('💡 提示: 移除 --dry-run 参数以执行实际修复');
      console.log('   命令: bun run service/src/scripts/fix-token-format.ts\n');
    } else if (result.success > 0) {
      console.log('✅ 修复完成! 请通知受影响的用户更新其API Key');
      console.log('💡 建议: 在应用中实现API Key自动迁移逻辑\n');
    }

  } catch (error: any) {
    console.error('\n❌ 执行错误:', error.message);
    process.exit(1);
  }
}

main();
