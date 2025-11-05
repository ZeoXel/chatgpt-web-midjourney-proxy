/**
 * 生产环境令牌桶数据同步脚本
 * 将Supabase中修复后的51字符令牌同步到Railway生产数据库的token桶
 *
 * 重要: 生产环境token桶中的令牌没有sk-前缀,需要去除
 *
 * 运行方式：
 * bun run service/src/scripts/sync-production-tokens.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Client } = pkg;
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Supabase配置
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

// Railway生产数据库配置
const PRODUCTION_DB_URL = 'postgresql://postgres:XvYzKZaXEBPujkRBAwgbVbScazUdwqVY@yamanote.proxy.rlwy.net:56740/railway';

interface SyncResult {
  checked: number;
  matched: number;
  updated: number;
  failed: number;
  errors: Array<{ token_id: string; error: string }>;
}

/**
 * 去除sk-前缀
 */
function removeSkPrefix(token: string): string {
  if (token.startsWith('sk-')) {
    return token.substring(3);
  }
  return token;
}

async function syncProductionTokens(dryRun: boolean = false): Promise<SyncResult> {
  console.log('\n' + '='.repeat(60));
  console.log(dryRun ? '🔍 模拟运行模式 (不会修改生产数据库)' : '🔄 开始同步生产环境令牌');
  console.log('='.repeat(60) + '\n');

  const result: SyncResult = {
    checked: 0,
    matched: 0,
    updated: 0,
    failed: 0,
    errors: []
  };

  let productionClient: any = null;

  try {
    // 1. 从Supabase获取所有令牌
    console.log('📊 Step 1: 从Supabase获取所有API Keys...');
    const { data: supabaseKeys, error: supabaseError } = await supabase
      .from('api_keys')
      .select('id, key_value, status, assigned_user_id')
      .order('id');

    if (supabaseError || !supabaseKeys) {
      throw new Error(`Supabase查询失败: ${supabaseError?.message}`);
    }

    console.log(`✅ 获取到 ${supabaseKeys.length} 个Supabase令牌\n`);

    // 2. 连接到Railway生产数据库
    console.log('🔌 Step 2: 连接到Railway生产数据库...');
    productionClient = new Client({
      connectionString: PRODUCTION_DB_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });

    await productionClient.connect();
    console.log('✅ 成功连接到生产数据库\n');

    // 3. 创建备份表(仅在非dry-run模式)
    if (!dryRun) {
      console.log('📦 Step 3: 创建备份表...');
      const backupTableName = `token_backup_${Date.now()}`;

      try {
        await productionClient.query(`
          CREATE TABLE ${backupTableName} AS
          SELECT * FROM tokens;
        `);
        console.log(`✅ 备份创建成功: ${backupTableName}\n`);
      } catch (err: any) {
        console.warn('⚠️  备份创建失败,继续同步:', err.message);
      }
    } else {
      console.log('⏭️  Step 3: 跳过备份(dry-run模式)\n');
    }

    // 4. 查询生产数据库的tokens表
    console.log('🔍 Step 4: 查询生产数据库tokens表...');
    const productionTokensResult = await productionClient.query(
      'SELECT id, name, key, status FROM tokens ORDER BY id'
    );

    const productionTokens = productionTokensResult.rows;
    console.log(`✅ 生产数据库有 ${productionTokens.length} 个令牌\n`);

    result.checked = productionTokens.length;

    // 5. 创建Supabase令牌映射(去除sk-前缀)
    console.log('🗺️  Step 5: 创建令牌映射...');
    const supabaseTokenMap = new Map<string, any>();

    supabaseKeys.forEach((key: any) => {
      // 去除sk-前缀后作为key
      const tokenWithoutPrefix = removeSkPrefix(key.key_value);
      supabaseTokenMap.set(key.id, {
        id: key.id,
        tokenWithPrefix: key.key_value,
        tokenWithoutPrefix: tokenWithoutPrefix,
        status: key.status,
        assigned_user_id: key.assigned_user_id
      });
    });

    console.log(`✅ 映射创建完成: ${supabaseTokenMap.size} 个令牌\n`);

    // 6. 匹配并更新
    console.log('🔄 Step 6: 开始匹配和更新...\n');

    for (const prodToken of productionTokens) {
      const prodId = prodToken.id;
      const prodName = prodToken.name; // Supabase ID存储在name字段
      const prodKeyValue = prodToken.key?.trim() || ''; // 去除可能的空格

      // 通过name字段查找对应的Supabase令牌
      const supabaseToken = supabaseTokenMap.get(prodName);

      if (!supabaseToken) {
        console.log(`⚠️  生产令牌 ID:${prodId} (name:${prodName}) 在Supabase中未找到,跳过`);
        continue;
      }

      result.matched++;

      // 检查是否需要更新(比较去除空格后的值)
      const needsUpdate = prodKeyValue !== supabaseToken.tokenWithoutPrefix;

      if (needsUpdate) {
        console.log(`🔄 Railway ID: ${prodId} / Supabase ID: ${prodName}`);
        console.log(`   生产环境旧令牌: ${prodKeyValue.substring(0, 20)}... (长度: ${prodKeyValue.length})`);
        console.log(`   Supabase新令牌: ${supabaseToken.tokenWithoutPrefix.substring(0, 20)}... (长度: ${supabaseToken.tokenWithoutPrefix.length})`);

        if (dryRun) {
          console.log(`   ✓ [模拟] 将更新此令牌\n`);
          result.updated++;
        } else {
          try {
            // 执行更新
            await productionClient.query(
              'UPDATE tokens SET key = $1 WHERE id = $2',
              [supabaseToken.tokenWithoutPrefix, prodId]
            );

            console.log(`   ✅ 更新成功\n`);
            result.updated++;
          } catch (err: any) {
            console.log(`   ❌ 更新失败: ${err.message}\n`);
            result.failed++;
            result.errors.push({
              token_id: prodName,
              error: err.message
            });
          }
        }
      } else {
        console.log(`✓ Railway ID: ${prodId} (${prodName}) - 令牌已是最新,跳过`);
      }

      // 添加小延迟
      await new Promise(resolve => setTimeout(resolve, 50));
    }

  } catch (error: any) {
    console.error('\n❌ 同步过程出错:', error.message);
    throw error;
  } finally {
    // 关闭生产数据库连接
    if (productionClient) {
      await productionClient.end();
      console.log('\n🔌 已断开生产数据库连接');
    }
  }

  return result;
}

async function verifySync() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 验证同步结果\n');

  const productionClient = new Client({
    connectionString: PRODUCTION_DB_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await productionClient.connect();

    // 统计生产数据库中的令牌长度
    const lengthStatsResult = await productionClient.query(`
      SELECT length(TRIM(key)) as token_length, COUNT(*) as count
      FROM tokens
      GROUP BY length(TRIM(key))
      ORDER BY count DESC
    `);

    console.log('📏 生产数据库令牌长度分布:\n');

    lengthStatsResult.rows.forEach((row: any) => {
      const isCorrect = row.token_length === 48; // 生产环境是48字符(无sk-前缀)
      const indicator = isCorrect ? '✅' : '❌';
      console.log(`${indicator} 长度 ${row.token_length}: ${row.count} 个令牌`);
    });

    // 查询异常长度的令牌
    const abnormalResult = await productionClient.query(`
      SELECT id, name, length(TRIM(key)) as token_length,
             substring(TRIM(key), 1, 20) || '...' as token_preview
      FROM tokens
      WHERE length(TRIM(key)) != 48
      LIMIT 10
    `);

    if (abnormalResult.rows.length > 0) {
      console.log(`\n⚠️  发现 ${abnormalResult.rows.length} 个异常令牌:\n`);
      abnormalResult.rows.forEach((row: any) => {
        console.log(`  - ID: ${row.id}, Name: ${row.name}, 长度: ${row.token_length}, 预览: ${row.token_preview}`);
      });
    } else {
      console.log('\n✅ 所有令牌长度正确 (48字符)');
    }

  } finally {
    await productionClient.end();
  }

  console.log('\n' + '='.repeat(60));
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
    // 执行同步
    const result = await syncProductionTokens(dryRun);

    // 显示结果
    console.log('\n' + '='.repeat(60));
    console.log('📈 同步结果统计\n');
    console.log(`  📊 检查的令牌: ${result.checked}`);
    console.log(`  🔗 匹配到的令牌: ${result.matched}`);
    console.log(`  ✅ 成功更新: ${result.updated}`);
    console.log(`  ❌ 失败: ${result.failed}`);

    if (result.errors.length > 0) {
      console.log('\n  错误详情:');
      result.errors.forEach(err => {
        console.log(`    - ID ${err.token_id}: ${err.error}`);
      });
    }

    console.log('='.repeat(60) + '\n');

    // 如果不是dry-run且有更新,验证结果
    if (!dryRun && result.updated > 0) {
      await verifySync();
    }

    if (dryRun) {
      console.log('💡 提示: 移除 --dry-run 参数以执行实际同步');
      console.log('   命令: bun run service/src/scripts/sync-production-tokens.ts\n');
    } else if (result.updated > 0) {
      console.log('✅ 生产环境同步完成!');
      console.log('💡 建议: 监控应用日志确认用户可正常使用\n');
    } else {
      console.log('✅ 生产环境数据已是最新,无需同步\n');
    }

  } catch (error: any) {
    console.error('\n❌ 执行错误:', error.message);
    process.exit(1);
  }
}

main();
