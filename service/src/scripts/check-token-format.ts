/**
 * 检查API Key令牌格式
 * 用于验证所有令牌是否符合正确格式（51字符）
 * 参考格式: sk-5TBiqd8OkZd3Uu7djCMwHPYkUy5-7RsWANkA6S3xgKvK123 (51字符)
 *
 * 运行方式：
 * bun run service/src/scripts/check-token-format.ts
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

interface TokenStats {
  length: number;
  count: number;
  examples: string[];
}

async function checkTokenFormats() {
  console.log('\n🔍 开始检查API Key令牌格式...\n');
  console.log('✅ 正确格式: sk- + 48个字符 = 51字符总长度');
  console.log('   示例: sk-5TBiqd8OkZd3Uu7djCMwHPYkUy5-7RsWANkA6S3xgKvK123\n');

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

  // 2. 统计不同长度的令牌
  const lengthStats: Map<number, TokenStats> = new Map();

  apiKeys.forEach((key: any) => {
    const length = key.key_value?.length || 0;

    if (!lengthStats.has(length)) {
      lengthStats.set(length, {
        length,
        count: 0,
        examples: []
      });
    }

    const stats = lengthStats.get(length)!;
    stats.count++;

    // 只保存前3个示例
    if (stats.examples.length < 3) {
      stats.examples.push(key.key_value.substring(0, 20) + '...');
    }
  });

  // 3. 显示长度统计
  console.log('📏 令牌长度分布:\n');

  const sortedStats = Array.from(lengthStats.values()).sort((a, b) => b.count - a.count);

  sortedStats.forEach(stats => {
    const isCorrect = stats.length === 51;
    const indicator = isCorrect ? '✅' : '❌';

    console.log(`${indicator} 长度 ${stats.length}: ${stats.count} 个令牌`);
    if (!isCorrect && stats.examples.length > 0) {
      console.log(`   示例: ${stats.examples[0]}`);
    }
  });

  // 4. 识别异常令牌（48字符）
  console.log('\n' + '='.repeat(60));
  console.log('🚨 异常令牌详情 (长度 ≠ 51)\n');

  const abnormalKeys = apiKeys.filter((key: any) => key.key_value?.length !== 51);

  if (abnormalKeys.length === 0) {
    console.log('✅ 恭喜！所有令牌格式都正确！');
  } else {
    console.log(`⚠️  发现 ${abnormalKeys.length} 个异常令牌:\n`);

    abnormalKeys.forEach((key: any, index: number) => {
      const length = key.key_value?.length || 0;
      console.log(`${index + 1}. 令牌长度: ${length} (期望: 51)`);
      console.log(`   ID: ${key.id}`);
      console.log(`   令牌前缀: ${key.key_value.substring(0, 25)}...`);
      console.log(`   完整令牌: ${key.key_value}`);
      console.log(`   状态: ${key.status}`);
      console.log(`   提供商: ${key.provider || 'N/A'}`);
      console.log(`   关联用户: ${key.assigned_user_id || '(未分配)'}`);
      console.log(`   创建时间: ${key.created_at}`);
      console.log('');
    });

    // 5. 提供修复建议
    console.log('='.repeat(60));
    console.log('💡 修复建议:\n');

    const length48Keys = abnormalKeys.filter((key: any) => key.key_value?.length === 48);

    if (length48Keys.length > 0) {
      console.log(`🔧 方案1: 重新生成51字符的令牌（推荐）\n`);
      console.log('   使用以下Node.js代码生成新令牌:');
      console.log('   ```javascript');
      console.log('   const crypto = require("crypto");');
      console.log('   const newToken = "sk-" + crypto.randomBytes(24).toString("base64url");');
      console.log('   console.log(newToken, newToken.length); // 应该输出 51');
      console.log('   ```\n');

      console.log(`🔧 方案2: 批量更新数据库（Supabase SQL）\n`);
      console.log('   在Supabase SQL Editor中执行:\n');

      length48Keys.forEach((key: any) => {
        console.log(`   -- 更新 ID: ${key.id}`);
        console.log(`   UPDATE api_keys`);
        console.log(`   SET key_value = 'sk-' || encode(gen_random_bytes(24), 'base64')`);
        console.log(`   WHERE id = '${key.id}';\n`);
      });

      console.log(`🔧 方案3: 手动更新单个令牌\n`);
      console.log('   1. 生成新的51字符令牌');
      console.log('   2. 在Supabase控制台 → Table Editor → api_keys');
      console.log('   3. 找到对应的记录并更新 key_value 字段\n');
    }

    // 6. 其他长度的异常令牌
    const otherLengthKeys = abnormalKeys.filter((key: any) => key.key_value?.length !== 48);

    if (otherLengthKeys.length > 0) {
      console.log('⚠️  其他异常长度的令牌需要检查格式是否正确:\n');

      otherLengthKeys.forEach((key: any) => {
        console.log(`   - ID: ${key.id}, 长度: ${key.key_value.length}`);
        console.log(`     令牌: ${key.key_value}`);
        console.log('');
      });
    }
  }

  // 7. 生成修复SQL脚本
  if (abnormalKeys.length > 0) {
    console.log('='.repeat(60));
    console.log('📝 批量修复SQL脚本（复制到Supabase SQL Editor）:\n');
    console.log('-- 备份原始数据');
    console.log('CREATE TABLE IF NOT EXISTS api_keys_backup AS SELECT * FROM api_keys;');
    console.log('');
    console.log('-- 批量更新异常令牌');

    abnormalKeys.forEach((key: any) => {
      console.log(`UPDATE api_keys SET key_value = 'sk-' || encode(gen_random_bytes(24), 'base64') WHERE id = '${key.id}'; -- 原长度: ${key.key_value.length}`);
    });

    console.log('\n-- 验证更新结果');
    console.log('SELECT id, length(key_value) as token_length, key_value FROM api_keys WHERE length(key_value) != 51;');
    console.log('');
  }

  // 8. 统计摘要
  console.log('='.repeat(60));
  console.log('📊 检查摘要:\n');
  console.log(`   总令牌数: ${apiKeys.length}`);
  console.log(`   ✅ 正确格式 (51字符): ${apiKeys.length - abnormalKeys.length}`);
  console.log(`   ❌ 异常格式: ${abnormalKeys.length}`);

  if (abnormalKeys.length > 0) {
    const length48 = abnormalKeys.filter((key: any) => key.key_value?.length === 48).length;
    if (length48 > 0) {
      console.log(`      - 48字符 (缺少3字符): ${length48}`);
    }

    const otherLengths = abnormalKeys.filter((key: any) => key.key_value?.length !== 48);
    if (otherLengths.length > 0) {
      console.log(`      - 其他长度: ${otherLengths.length}`);
    }
  }

  console.log('\n' + '='.repeat(60));

  if (abnormalKeys.length > 0) {
    console.log('\n⚠️  建议立即修复异常令牌，否则可能导致用户无法正常使用服务');
  } else {
    console.log('\n✅ 所有令牌格式检查通过！');
  }
}

// 主函数
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ 环境变量未配置');
  console.log('请确保 service/.env 包含:');
  console.log('  SUPABASE_URL=https://your-project.supabase.co');
  console.log('  SUPABASE_SERVICE_KEY=your_service_key');
  process.exit(1);
}

checkTokenFormats().catch(error => {
  console.error('\n❌ 执行错误:', error);
  process.exit(1);
});
