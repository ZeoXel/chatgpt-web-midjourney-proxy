/**
 * 检查tokens表结构和数据
 */

import pkg from 'pg';
const { Client } = pkg;

const PRODUCTION_DB_URL = 'postgresql://postgres:XvYzKZaXEBPujkRBAwgbVbScazUdwqVY@yamanote.proxy.rlwy.net:56740/railway';

async function checkTokensTable() {
  const client = new Client({
    connectionString: PRODUCTION_DB_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ 成功连接到生产数据库\n');

    // 查询表结构
    const columnsResult = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'tokens'
      ORDER BY ordinal_position;
    `);

    console.log('📋 tokens表结构:\n');
    columnsResult.rows.forEach((row: any) => {
      const length = row.character_maximum_length ? ` (${row.character_maximum_length})` : '';
      console.log(`  - ${row.column_name}: ${row.data_type}${length}`);
    });

    // 查询总数
    const countResult = await client.query('SELECT COUNT(*) as count FROM tokens');
    console.log(`\n📊 总令牌数: ${countResult.rows[0].count}`);

    // 查询示例数据
    const sampleResult = await client.query(`
      SELECT *
      FROM tokens
      ORDER BY id
      LIMIT 5
    `);

    console.log('\n📝 示例数据 (前5条):\n');
    sampleResult.rows.forEach((row: any, index: number) => {
      console.log(`${index + 1}. ${JSON.stringify(row, null, 2)}`);
    });

    // 统计令牌长度
    const lengthStatsResult = await client.query(`
      SELECT
        CASE
          WHEN key IS NOT NULL THEN length(key)
          ELSE 0
        END as token_length,
        COUNT(*) as count
      FROM tokens
      GROUP BY token_length
      ORDER BY count DESC
    `);

    console.log('\n📏 令牌长度分布:\n');
    lengthStatsResult.rows.forEach((row: any) => {
      console.log(`  长度 ${row.token_length}: ${row.count} 个`);
    });

  } finally {
    await client.end();
  }
}

checkTokensTable().catch(console.error);
