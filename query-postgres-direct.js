const { Client } = require('pg');

// 从Supabase连接字符串构建
const client = new Client({
  host: 'aws-0-us-west-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.lxxbjwxwujcpgqfoquvv',
  password: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4eGJqd3h3dWpjcGdxZm9xdXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQwMjkwOSwiZXhwIjoyMDcyOTc4OTA5fQ.WQ5yPFpR6tEMsgP9x8LzA6jr8y2kL9b4zi2P2CclyDQ',
  ssl: { rejectUnauthorized: false }
});

async function query() {
  try {
    console.log('\n🔍 连接Supabase PostgreSQL...\n');
    await client.connect();
    console.log('✅ 连接成功！\n');

    // 1. 查询所有表
    console.log('=== 查询public schema中的所有表 ===');
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('找到的表:');
    tablesResult.rows.forEach(row => {
      console.log('  -', row.table_name);
    });

    // 2. 查询chat_sessions表结构
    if (tablesResult.rows.find(r => r.table_name === 'chat_sessions')) {
      console.log('\n=== chat_sessions 表结构 ===');
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'chat_sessions'
        ORDER BY ordinal_position
      `);
      columnsResult.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'nullable' : 'not null';
        console.log(`  - ${col.column_name}: ${col.data_type} (${nullable})`);
      });

      // 3. 查询数据
      console.log('\n=== chat_sessions 数据 ===');
      const dataResult = await client.query('SELECT * FROM chat_sessions LIMIT 10');
      console.log('记录数:', dataResult.rowCount);
      if (dataResult.rows.length > 0) {
        console.log('数据示例:');
        console.log(JSON.stringify(dataResult.rows[0], null, 2));
      } else {
        console.log('表为空');
      }

      // 4. 插入测试数据
      console.log('\n=== 插入测试数据 ===');
      const insertResult = await client.query(`
        INSERT INTO chat_sessions (user_id, title, messages, model)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [
        'test-user-' + Date.now(),
        '测试会话-' + new Date().toLocaleString('zh-CN'),
        JSON.stringify([
          { role: 'user', content: '你好' },
          { role: 'assistant', content: '你好！我是AI助手。' }
        ]),
        'gpt-3.5-turbo'
      ]);

      console.log('✅ 插入成功！');
      console.log('插入的数据:');
      console.log('  ID:', insertResult.rows[0].id);
      console.log('  User ID:', insertResult.rows[0].user_id);
      console.log('  Title:', insertResult.rows[0].title);
      console.log('  Created:', insertResult.rows[0].created_at);

      // 5. 重新查询验证
      console.log('\n=== 验证数据 ===');
      const verifyResult = await client.query('SELECT COUNT(*) as count FROM chat_sessions');
      console.log('总记录数:', verifyResult.rows[0].count);

      const allResult = await client.query('SELECT id, user_id, title, created_at FROM chat_sessions ORDER BY created_at DESC');
      console.log('\n所有会话:');
      allResult.rows.forEach((row, i) => {
        console.log(`  [${i+1}] ${row.title}`);
        console.log(`      User: ${row.user_id}`);
        console.log(`      ID: ${row.id}`);
        console.log(`      Created: ${row.created_at}`);
      });
    } else {
      console.log('\n❌ chat_sessions表不存在！');
    }

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('\n✅ 连接已关闭');
  }
}

query();
