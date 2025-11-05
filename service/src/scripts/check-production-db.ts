/**
 * 检查生产数据库表结构
 */

import pkg from 'pg';
const { Client } = pkg;

const PRODUCTION_DB_URL = 'postgresql://postgres:XvYzKZaXEBPujkRBAwgbVbScazUdwqVY@yamanote.proxy.rlwy.net:56740/railway';

async function checkDatabase() {
  const client = new Client({
    connectionString: PRODUCTION_DB_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ 成功连接到生产数据库\n');

    // 查询所有表
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('📋 数据库中的表:\n');
    tablesResult.rows.forEach((row: any) => {
      console.log(`  - ${row.table_name}`);
    });

    // 查找包含token的表
    const tokenTablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE '%token%'
      ORDER BY table_name;
    `);

    console.log('\n🔍 包含"token"的表:\n');
    if (tokenTablesResult.rows.length > 0) {
      tokenTablesResult.rows.forEach((row: any) => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('  (未找到包含token的表)');
    }

    // 查找包含api的表
    const apiTablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE '%api%' OR table_name LIKE '%key%')
      ORDER BY table_name;
    `);

    console.log('\n🔍 包含"api"或"key"的表:\n');
    if (apiTablesResult.rows.length > 0) {
      apiTablesResult.rows.forEach((row: any) => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('  (未找到包含api或key的表)');
    }

  } finally {
    await client.end();
  }
}

checkDatabase().catch(console.error);
