/**
 * 修复包含Base64特殊字符的token
 *
 * 自动将所有包含 -, _, =, +, / 字符的token替换为纯字母数字组合
 *
 * 运行方式：
 * bun run service/src/scripts/fix-base64-chars.ts [--dry-run]
 *
 * --dry-run: 仅模拟运行，不实际更新数据库
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

interface FixResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ id: string; error: string }>;
}

interface TokenUpdate {
  id: string;
  oldToken: string;
  newToken: string;
  issues: string[];
  assigned_user_id: string | null;
}

/**
 * 检查token中的Base64字符
 */
function checkBase64Chars(token: string): string[] {
  const issues: string[] = [];

  if (token.includes('+')) issues.push('+');
  if (token.includes('/')) issues.push('/');
  if (token.includes('=')) issues.push('=');
  if (token.includes('-')) issues.push('-');
  if (token.includes('_')) issues.push('_');

  return issues;
}

/**
 * 生成纯字母数字的token（51字符）
 * 只使用 A-Z, a-z, 0-9
 */
function generateCleanToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const length = 48; // sk- 后面跟48个字符
  let result = 'sk-';

  // 使用加密安全的随机数生成
  const randomBytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomBytes[i] % chars.length);
  }

  return result;
}

async function fixBase64Chars(dryRun: boolean = false): Promise<FixResult> {
  console.log('\n' + '='.repeat(80));
  console.log(dryRun ? '🔍 模拟运行模式 (不会修改数据库)' : '🔧 开始修复包含Base64特殊字符的token');
  console.log('='.repeat(80) + '\n');

  const result: FixResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  const updates: TokenUpdate[] = [];

  // 1. 查询所有API Keys
  const { data: apiKeys, error } = await supabase
    .from('api_keys')
    .select('id, key_value, status, provider, assigned_user_id, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ 查询失败:', error.message);
    throw error;
  }

  if (!apiKeys || apiKeys.length === 0) {
    console.log('⚠️  数据库中没有找到任何API Key记录');
    return result;
  }

  // 2. 识别需要修复的token
  const problemTokens = apiKeys.filter((key: any) => {
    const issues = checkBase64Chars(key.key_value);
    return issues.length > 0;
  });

  if (problemTokens.length === 0) {
    console.log('✅ 没有发现需要修复的token');
    return result;
  }

  console.log(`📊 发现 ${problemTokens.length} 个需要修复的token\n`);

  // 3. 提示备份（仅在非dry-run模式）
  if (!dryRun) {
    console.log('📦 建议备份数据（可在Supabase控制台手动备份）\n');
    console.log('💡 提示: 如需回滚，可以查询旧token值\n');
  }

  // 4. 修复每个问题token
  console.log('开始修复token:\n');

  for (const key of problemTokens) {
    const issues = checkBase64Chars(key.key_value);
    const newToken = generateCleanToken();

    const update: TokenUpdate = {
      id: key.id,
      oldToken: key.key_value,
      newToken: newToken,
      issues: issues,
      assigned_user_id: key.assigned_user_id
    };

    updates.push(update);

    console.log(`处理 ID: ${key.id}`);
    console.log(`  - 原token: ${key.key_value}`);
    console.log(`  - 长度: ${key.key_value.length}`);
    console.log(`  - 问题字符: ${issues.join(', ')}`);
    console.log(`  - 新token: ${newToken} (长度: ${newToken.length})`);
    console.log(`  - 状态: ${key.status}`);
    console.log(`  - 用户: ${key.assigned_user_id || '(未分配)'}`);

    if (dryRun) {
      console.log('  ✓ [模拟] 已生成新token\n');
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

  // 5. 导出token映射表（仅在实际修复时）
  if (!dryRun && result.success > 0) {
    console.log('='.repeat(80));
    console.log('📋 Token更新映射表\n');
    console.log('ID,旧Token,新Token,问题字符,用户ID');

    updates.forEach(update => {
      console.log(`${update.id},${update.oldToken},${update.newToken},"${update.issues.join(', ')}",${update.assigned_user_id || '(未分配)'}`);
    });
    console.log('');
  }

  return result;
}

async function verifyFixes() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 验证修复结果\n');

  // 查询所有token
  const { data: allKeys } = await supabase
    .from('api_keys')
    .select('id, key_value');

  if (!allKeys) {
    console.log('⚠️  无法查询token');
    return;
  }

  // 检查是否还有问题token
  const remainingIssues = allKeys.filter((key: any) => {
    const issues = checkBase64Chars(key.key_value);
    return issues.length > 0;
  });

  if (remainingIssues.length === 0) {
    console.log('✅ 验证通过！所有token都已修复为纯字母数字组合\n');
  } else {
    console.log(`⚠️  仍有 ${remainingIssues.length} 个问题token:\n`);
    remainingIssues.forEach((key: any) => {
      const issues = checkBase64Chars(key.key_value);
      console.log(`  - ID: ${key.id}`);
      console.log(`    Token: ${key.key_value}`);
      console.log(`    问题字符: ${issues.join(', ')}`);
      console.log('');
    });
  }

  // 统计token格式
  const formatStats = {
    correct: 0,    // 正确格式（51字符，纯字母数字）
    wrongLength: 0, // 长度不对
    hasSpecialChars: 0 // 包含特殊字符
  };

  allKeys.forEach((key: any) => {
    const length = key.key_value.length;
    const issues = checkBase64Chars(key.key_value);

    if (length === 51 && issues.length === 0) {
      formatStats.correct++;
    } else {
      if (length !== 51) formatStats.wrongLength++;
      if (issues.length > 0) formatStats.hasSpecialChars++;
    }
  });

  console.log('📊 最终统计:');
  console.log(`  - 总token数: ${allKeys.length}`);
  console.log(`  - ✅ 完全正确 (51字符 + 纯字母数字): ${formatStats.correct}`);
  console.log(`  - ⚠️  长度不正确: ${formatStats.wrongLength}`);
  console.log(`  - ⚠️  包含特殊字符: ${formatStats.hasSpecialChars}`);
  console.log('='.repeat(80) + '\n');
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
    const result = await fixBase64Chars(dryRun);

    // 显示结果
    console.log('\n' + '='.repeat(80));
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

    console.log('='.repeat(80) + '\n');

    // 如果不是dry-run，验证结果
    if (!dryRun && result.success > 0) {
      await verifyFixes();
    }

    if (dryRun) {
      console.log('💡 提示: 移除 --dry-run 参数以执行实际修复');
      console.log('   命令: bun run service/src/scripts/fix-base64-chars.ts\n');
    } else if (result.success > 0) {
      console.log('✅ 修复完成！');
      console.log('💡 建议: 通知受影响的用户更新其API Key');
      console.log('📋 可使用上面的Token更新映射表通知用户\n');
    }

  } catch (error: any) {
    console.error('\n❌ 执行错误:', error.message);
    process.exit(1);
  }
}

main();
