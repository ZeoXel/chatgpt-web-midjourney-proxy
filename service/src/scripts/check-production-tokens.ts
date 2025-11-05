/**
 * 检查生产数据库中的token格式
 * 用于了解生产库中token的实际格式和需要修复的token
 */

import pkg from 'pg';
const { Client } = pkg;

const PRODUCTION_DB_URL = 'postgresql://postgres:XvYzKZaXEBPujkRBAwgbVbScazUdwqVY@yamanote.proxy.rlwy.net:56740/railway';

interface TokenIssue {
  id: string;
  key: string;
  issues: string[];
  length: number;
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

async function checkProductionTokens() {
  const client = new Client({
    connectionString: PRODUCTION_DB_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ 成功连接到生产数据库\n');

    // 查询所有token
    const result = await client.query(`
      SELECT id, key
      FROM tokens
      ORDER BY id
      LIMIT 10
    `);

    console.log('📋 生产数据库token示例 (前10条):\n');
    result.rows.forEach((row: any, index: number) => {
      const issues = checkBase64Chars(row.key);
      console.log(`${index + 1}. ID: ${row.id}`);
      console.log(`   Key: ${row.key}`);
      console.log(`   长度: ${row.key.length}`);
      console.log(`   问题字符: ${issues.length > 0 ? issues.join(', ') : '无'}`);
      console.log('');
    });

    // 统计问题token
    const allResult = await client.query('SELECT id, key FROM tokens');

    const problemTokens: TokenIssue[] = [];
    allResult.rows.forEach((row: any) => {
      const issues = checkBase64Chars(row.key);
      if (issues.length > 0) {
        problemTokens.push({
          id: row.id,
          key: row.key,
          issues: issues,
          length: row.key.length
        });
      }
    });

    console.log('📊 统计结果:');
    console.log(`  总token数: ${allResult.rows.length}`);
    console.log(`  包含Base64特殊字符的token: ${problemTokens.length}`);

    if (problemTokens.length > 0) {
      console.log('\n🔴 需要修复的token数量:', problemTokens.length);
      console.log('字符统计:');

      const charStats = {
        plus: 0,
        slash: 0,
        equals: 0,
        dash: 0,
        underscore: 0
      };

      problemTokens.forEach(t => {
        if (t.issues.includes('+')) charStats.plus++;
        if (t.issues.includes('/')) charStats.slash++;
        if (t.issues.includes('=')) charStats.equals++;
        if (t.issues.includes('-')) charStats.dash++;
        if (t.issues.includes('_')) charStats.underscore++;
      });

      if (charStats.plus > 0) console.log(`  + (加号): ${charStats.plus} 个`);
      if (charStats.slash > 0) console.log(`  / (斜杠): ${charStats.slash} 个`);
      if (charStats.equals > 0) console.log(`  = (等号): ${charStats.equals} 个`);
      if (charStats.dash > 0) console.log(`  - (横杠): ${charStats.dash} 个`);
      if (charStats.underscore > 0) console.log(`  _ (下划线): ${charStats.underscore} 个`);
    } else {
      console.log('\n✅ 所有token都是纯字母数字格式');
    }

  } finally {
    await client.end();
  }
}

checkProductionTokens().catch(console.error);
