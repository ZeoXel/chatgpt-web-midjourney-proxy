/**
 * 检查Supabase数据库中包含Base64特殊字符的token
 *
 * Base64字符问题:
 * - 标准Base64: 包含 +, /, =
 * - Base64URL: 包含 -, _, 不含 =
 *
 * 本脚本检查token中是否包含这些特殊字符，并建议修复方案
 *
 * 运行方式：
 * bun run service/src/scripts/check-base64-chars.ts
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

interface TokenIssue {
  id: string;
  key_value: string;
  status: string;
  provider: string | null;
  assigned_user_id: string | null;
  created_at: string;
  issues: string[];
}

/**
 * 检查token中的Base64字符
 */
function checkBase64Chars(token: string): string[] {
  const issues: string[] = [];

  // 检查标准Base64字符
  if (token.includes('+')) {
    issues.push('包含 + 字符 (标准Base64)');
  }
  if (token.includes('/')) {
    issues.push('包含 / 字符 (标准Base64)');
  }
  if (token.includes('=')) {
    issues.push('包含 = 字符 (Base64填充)');
  }

  // 检查Base64URL字符
  if (token.includes('-')) {
    issues.push('包含 - 字符 (Base64URL)');
  }
  if (token.includes('_')) {
    issues.push('包含 _ 字符 (Base64URL)');
  }

  return issues;
}

/**
 * 生成不包含特殊字符的随机token
 */
function generateCleanToken(): string {
  // 只使用字母和数字
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const length = 48; // sk- 后面跟48个字符
  let result = 'sk-';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

async function checkBase64CharsInTokens() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 检查Supabase数据库中包含Base64特殊字符的token');
  console.log('='.repeat(80) + '\n');

  console.log('📋 检查字符:\n');
  console.log('  - 标准Base64: +, /, =');
  console.log('  - Base64URL: -, _');
  console.log('  ⚠️  建议: token应只包含字母和数字，避免特殊字符\n');

  // 1. 查询所有API Keys
  const { data: apiKeys, error } = await supabase
    .from('api_keys')
    .select('id, key_value, status, provider, assigned_user_id, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ 查询失败:', error.message);
    return;
  }

  if (!apiKeys || apiKeys.length === 0) {
    console.log('⚠️  数据库中没有找到任何API Key记录');
    return;
  }

  console.log(`📊 总计找到 ${apiKeys.length} 个API Key\n`);
  console.log('='.repeat(80) + '\n');

  // 2. 检查每个token
  const problemTokens: TokenIssue[] = [];
  const charStats = {
    plus: 0,      // +
    slash: 0,     // /
    equals: 0,    // =
    dash: 0,      // -
    underscore: 0 // _
  };

  apiKeys.forEach((key: any) => {
    const issues = checkBase64Chars(key.key_value);

    if (issues.length > 0) {
      problemTokens.push({
        id: key.id,
        key_value: key.key_value,
        status: key.status,
        provider: key.provider,
        assigned_user_id: key.assigned_user_id,
        created_at: key.created_at,
        issues
      });

      // 统计字符出现次数
      if (key.key_value.includes('+')) charStats.plus++;
      if (key.key_value.includes('/')) charStats.slash++;
      if (key.key_value.includes('=')) charStats.equals++;
      if (key.key_value.includes('-')) charStats.dash++;
      if (key.key_value.includes('_')) charStats.underscore++;
    }
  });

  // 3. 显示统计结果
  if (problemTokens.length === 0) {
    console.log('✅ 恭喜！没有发现包含Base64特殊字符的token');
    console.log('   所有token都是纯字母数字组合\n');
    return;
  }

  console.log(`🚨 发现 ${problemTokens.length} 个包含Base64特殊字符的token\n`);
  console.log('📊 字符统计:\n');

  if (charStats.plus > 0) {
    console.log(`  ❌ + (加号): ${charStats.plus} 个token`);
  }
  if (charStats.slash > 0) {
    console.log(`  ❌ / (斜杠): ${charStats.slash} 个token`);
  }
  if (charStats.equals > 0) {
    console.log(`  ❌ = (等号): ${charStats.equals} 个token`);
  }
  if (charStats.dash > 0) {
    console.log(`  ⚠️  - (横杠): ${charStats.dash} 个token`);
  }
  if (charStats.underscore > 0) {
    console.log(`  ⚠️  _ (下划线): ${charStats.underscore} 个token`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('🔍 问题token详情\n');

  // 4. 按严重程度分组显示
  const assignedTokens = problemTokens.filter(t => t.assigned_user_id);
  const unassignedTokens = problemTokens.filter(t => !t.assigned_user_id);

  if (assignedTokens.length > 0) {
    console.log(`🔴 高优先级 - 已分配用户 (${assignedTokens.length}个)\n`);
    console.log('这些token已分配给用户，修复后需要通知用户更新:\n');

    assignedTokens.forEach((token, index) => {
      console.log(`${index + 1}. ID: ${token.id}`);
      console.log(`   Token: ${token.key_value}`);
      console.log(`   长度: ${token.key_value.length}`);
      console.log(`   状态: ${token.status}`);
      console.log(`   提供商: ${token.provider || 'N/A'}`);
      console.log(`   用户ID: ${token.assigned_user_id}`);
      console.log(`   问题: ${token.issues.join(', ')}`);
      console.log(`   创建时间: ${token.created_at}`);
      console.log('');
    });
  }

  if (unassignedTokens.length > 0) {
    console.log('='.repeat(80));
    console.log(`🟡 中优先级 - 未分配用户 (${unassignedTokens.length}个)\n`);
    console.log('这些token未分配给用户，可以直接修复:\n');

    unassignedTokens.forEach((token, index) => {
      console.log(`${index + 1}. ID: ${token.id}`);
      console.log(`   Token: ${token.key_value}`);
      console.log(`   长度: ${token.key_value.length}`);
      console.log(`   状态: ${token.status}`);
      console.log(`   问题: ${token.issues.join(', ')}`);
      console.log('');
    });
  }

  // 5. 生成修复建议
  console.log('='.repeat(80));
  console.log('💡 修复建议\n');

  console.log('🔧 方案1: 使用自动修复脚本（推荐）\n');
  console.log('   bun run service/src/scripts/fix-base64-chars.ts --dry-run  # 模拟运行');
  console.log('   bun run service/src/scripts/fix-base64-chars.ts            # 实际修复\n');

  console.log('🔧 方案2: 手动SQL更新（Supabase SQL Editor）\n');
  console.log('   -- 备份原始数据');
  console.log('   CREATE TABLE IF NOT EXISTS api_keys_backup AS SELECT * FROM api_keys;\n');

  // 为每个问题token生成SQL
  problemTokens.forEach(token => {
    const cleanToken = generateCleanToken();
    console.log(`   -- 更新 ID: ${token.id} (${token.issues.join(', ')})`);
    console.log(`   UPDATE api_keys SET key_value = '${cleanToken}' WHERE id = '${token.id}';\n`);
  });

  console.log('   -- 验证更新结果');
  console.log('   SELECT id, key_value FROM api_keys');
  console.log("   WHERE key_value ~ '[-_+=\\/]';  -- 查找仍包含特殊字符的token\n");

  // 6. 生成修复SQL脚本文件
  console.log('='.repeat(80));
  console.log('📝 批量修复SQL脚本\n');
  console.log('```sql');
  console.log('-- 备份数据');
  console.log('CREATE TABLE IF NOT EXISTS api_keys_backup_base64 AS SELECT * FROM api_keys;');
  console.log('');

  problemTokens.forEach(token => {
    console.log(`-- Token: ${token.id} - ${token.issues.join(', ')}`);
    console.log(`UPDATE api_keys SET key_value = '${generateCleanToken()}' WHERE id = '${token.id}';`);
  });

  console.log('');
  console.log('-- 验证修复');
  console.log("SELECT COUNT(*) FROM api_keys WHERE key_value ~ '[-_+=\\/]';");
  console.log('-- 应该返回 0');
  console.log('```\n');

  // 7. 生成受影响用户列表
  if (assignedTokens.length > 0) {
    console.log('='.repeat(80));
    console.log('👥 受影响用户列表\n');
    console.log(`需要通知以下 ${assignedTokens.length} 个用户更新API Key:\n`);

    assignedTokens.forEach((token, index) => {
      console.log(`${index + 1}. 用户ID: ${token.assigned_user_id}`);
      console.log(`   Token ID: ${token.id}`);
      console.log(`   问题: ${token.issues.join(', ')}`);
      console.log('');
    });

    console.log('查询用户信息SQL:');
    console.log('```sql');
    console.log('SELECT');
    console.log('  ak.id as token_id,');
    console.log('  ak.key_value,');
    console.log('  u.id as user_id,');
    console.log('  u.name,');
    console.log('  u.email');
    console.log('FROM api_keys ak');
    console.log('LEFT JOIN users u ON ak.assigned_user_id = u.id');
    console.log('WHERE ak.id IN (');
    console.log('  ' + assignedTokens.map(t => `'${t.id}'`).join(',\n  '));
    console.log(');');
    console.log('```\n');
  }

  // 8. 总结
  console.log('='.repeat(80));
  console.log('📊 检查摘要\n');
  console.log(`  总token数: ${apiKeys.length}`);
  console.log(`  ✅ 正常token (纯字母数字): ${apiKeys.length - problemTokens.length}`);
  console.log(`  ❌ 问题token (包含特殊字符): ${problemTokens.length}`);

  if (assignedTokens.length > 0) {
    console.log(`     - 已分配用户: ${assignedTokens.length}`);
  }
  if (unassignedTokens.length > 0) {
    console.log(`     - 未分配: ${unassignedTokens.length}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n⚠️  建议立即修复这些token，避免潜在的安全和兼容性问题');
  console.log('💡 修复后记得通知受影响的用户更新其API Key\n');
}

// 主函数
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ 环境变量未配置');
  console.log('请确保 service/.env 包含:');
  console.log('  SUPABASE_URL=https://your-project.supabase.co');
  console.log('  SUPABASE_SERVICE_KEY=your_service_key');
  process.exit(1);
}

checkBase64CharsInTokens().catch(error => {
  console.error('\n❌ 执行错误:', error);
  process.exit(1);
});
