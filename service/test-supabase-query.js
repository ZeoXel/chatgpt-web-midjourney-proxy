const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './service/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function queryDatabase() {
  console.log('\n🔍 正在查询Supabase数据库...\n');
  console.log('URL:', process.env.SUPABASE_URL);
  console.log('Key:', process.env.SUPABASE_SERVICE_KEY?.substring(0, 20) + '...\n');

  // 1. 查询chat_sessions表
  console.log('=== 查询 chat_sessions 表 ===');
  const { data: sessions, error: sessionsError } = await supabase
    .from('chat_sessions')
    .select('*')
    .limit(10);
  
  console.log('- 错误:', sessionsError?.message || '无');
  console.log('- 记录数:', sessions?.length || 0);
  if (sessions && sessions.length > 0) {
    console.log('- 数据示例:', JSON.stringify(sessions[0], null, 2));
  }

  // 2. 查询ai_assets表
  console.log('\n=== 查询 ai_assets 表 ===');
  const { data: assets, error: assetsError } = await supabase
    .from('ai_assets')
    .select('*')
    .limit(10);
  
  console.log('- 错误:', assetsError?.message || '无');
  console.log('- 记录数:', assets?.length || 0);

  // 3. 查询user_configs表
  console.log('\n=== 查询 user_configs 表 ===');
  const { data: configs, error: configsError } = await supabase
    .from('user_configs')
    .select('*')
    .limit(10);
  
  console.log('- 错误:', configsError?.message || '无');
  console.log('- 记录数:', configs?.length || 0);

  // 4. 尝试插入测试数据
  console.log('\n=== 插入测试数据 ===');
  const testSession = {
    user_id: 'test-user-' + Date.now(),
    title: '测试会话-' + new Date().toLocaleString('zh-CN'),
    messages: [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好！我是AI助手。' }
    ],
    model: 'gpt-3.5-turbo'
  };

  const { data: insertedSession, error: insertError } = await supabase
    .from('chat_sessions')
    .insert(testSession)
    .select()
    .single();

  console.log('- 插入错误:', insertError?.message || '无');
  console.log('- 插入成功:', !!insertedSession);
  if (insertedSession) {
    console.log('- 插入的数据:');
    console.log('  ID:', insertedSession.id);
    console.log('  User ID:', insertedSession.user_id);
    console.log('  Title:', insertedSession.title);
    console.log('  Messages:', insertedSession.messages.length, '条');
    console.log('  Created:', insertedSession.created_at);
  }

  // 5. 重新查询验证
  console.log('\n=== 验证插入（重新查询） ===');
  const { data: allSessions, count } = await supabase
    .from('chat_sessions')
    .select('*', { count: 'exact' });
  
  console.log('- 总记录数:', count);
  if (allSessions && allSessions.length > 0) {
    console.log('- 所有会话:');
    allSessions.forEach((s, i) => {
      console.log(`  [${i+1}] ${s.title} (${s.user_id}) - ${s.messages.length}条消息`);
    });
  }

  console.log('\n✅ 查询完成！');
}

queryDatabase().catch(console.error);
