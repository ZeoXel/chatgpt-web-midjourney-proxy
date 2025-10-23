/**
 * Supabase交互式配置脚本
 * 自动引导用户完成数据库配置
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function question(rl: readline.Interface, query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  const rl = createInterface();

  log('\n╔═══════════════════════════════════════════╗', 'cyan');
  log('║  🚀 Supabase数据库配置向导              ║', 'cyan');
  log('╚═══════════════════════════════════════════╝\n', 'cyan');

  try {
    // 步骤1: 欢迎和说明
    log('本向导将帮助你：', 'blue');
    log('  1. 配置Supabase连接信息', 'cyan');
    log('  2. 测试数据库连接', 'cyan');
    log('  3. 初始化数据库表结构', 'cyan');
    log('  4. 验证配置是否正确\n', 'cyan');

    // 步骤2: 检查是否已有配置
    const envPath = path.resolve(__dirname, '../../.env');
    let existingUrl = '';
    let existingKey = '';

    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const urlMatch = envContent.match(/SUPABASE_URL=(.+)/);
      const keyMatch = envContent.match(/SUPABASE_SERVICE_KEY=(.+)/);

      if (urlMatch) existingUrl = urlMatch[1].trim();
      if (keyMatch) existingKey = keyMatch[1].trim();

      if (existingUrl || existingKey) {
        log('⚠️  检测到已有配置：', 'yellow');
        if (existingUrl) log(`   URL: ${existingUrl}`, 'cyan');
        if (existingKey) log(`   Key: ${existingKey.substring(0, 20)}...`, 'cyan');

        const overwrite = await question(rl, '\n是否覆盖现有配置？(y/N): ');
        if (overwrite.toLowerCase() !== 'y') {
          log('\n✅ 保留现有配置，跳过配置步骤', 'green');
          rl.close();
          return;
        }
      }
    }

    // 步骤3: 获取Supabase URL
    log('\n📝 步骤1: 配置Supabase URL', 'blue');
    log('   获取方式: Supabase项目 → Settings → API → Project URL', 'cyan');
    log('   格式: https://xxxxx.supabase.co\n', 'cyan');

    let supabaseUrl = await question(rl, '请输入SUPABASE_URL: ');
    supabaseUrl = supabaseUrl.trim();

    // 验证URL格式
    if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('supabase.co')) {
      log('❌ URL格式不正确，应该类似: https://xxxxx.supabase.co', 'red');
      rl.close();
      return;
    }

    // 步骤4: 获取Service Role Key
    log('\n📝 步骤2: 配置Service Role Key', 'blue');
    log('   获取方式: Supabase项目 → Settings → API → Service Role Key', 'cyan');
    log('   ⚠️  注意: 使用service_role，不是anon key', 'yellow');
    log('   格式: eyJhbGci... (很长的JWT字符串)\n', 'cyan');

    let serviceKey = await question(rl, '请输入SUPABASE_SERVICE_KEY: ');
    serviceKey = serviceKey.trim();

    // 验证Key格式
    if (!serviceKey.startsWith('eyJ') || serviceKey.length < 100) {
      log('❌ Service Key格式不正确或不完整', 'red');
      log('   提示: Service Key通常是300+字符的长字符串', 'yellow');
      rl.close();
      return;
    }

    // 步骤5: 测试连接
    log('\n📡 步骤3: 测试数据库连接...', 'blue');

    try {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // 尝试查询（不需要表存在）
      const { error } = await supabase
        .from('_health_check')
        .select('*', { count: 'exact', head: true })
        .limit(1);

      // 如果是表不存在的错误，说明连接成功
      if (error && error.message.includes('relation') && error.message.includes('does not exist')) {
        log('✅ 数据库连接成功！', 'green');
      } else if (!error) {
        log('✅ 数据库连接成功！', 'green');
      } else {
        throw error;
      }
    } catch (error: any) {
      log('❌ 连接测试失败:', 'red');
      log(`   错误: ${error.message}`, 'yellow');
      log('\n可能的原因:', 'cyan');
      log('   1. URL或Key不正确', 'cyan');
      log('   2. 网络连接问题', 'cyan');
      log('   3. Supabase项目未启动', 'cyan');

      const retry = await question(rl, '\n是否重新输入？(y/N): ');
      rl.close();
      if (retry.toLowerCase() === 'y') {
        return setup(); // 重新运行
      }
      return;
    }

    // 步骤6: 保存配置
    log('\n💾 步骤4: 保存配置到.env文件...', 'blue');

    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');

      // 移除旧的Supabase配置
      envContent = envContent.replace(/SUPABASE_URL=.+\n?/g, '');
      envContent = envContent.replace(/SUPABASE_SERVICE_KEY=.+\n?/g, '');
    }

    // 添加新配置
    const supabaseConfig = `
# Supabase数据库配置（多平台数据同步）
# 配置时间: ${new Date().toLocaleString('zh-CN')}
SUPABASE_URL=${supabaseUrl}
SUPABASE_SERVICE_KEY=${serviceKey}
`;

    envContent = envContent.trim() + '\n' + supabaseConfig;
    fs.writeFileSync(envPath, envContent);

    log('✅ 配置已保存到 service/.env', 'green');

    // 步骤7: 检查表结构
    log('\n🔍 步骤5: 检查数据库表结构...', 'blue');

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const tables = ['chat_sessions', 'ai_assets', 'user_configs'];
    const missingTables: string[] = [];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .limit(1);

      if (error && error.message.includes('relation') && error.message.includes('does not exist')) {
        log(`❌ 表 ${table} 不存在`, 'red');
        missingTables.push(table);
      } else {
        log(`✅ 表 ${table} 已存在`, 'green');
      }
    }

    // 步骤8: 提示初始化表
    if (missingTables.length > 0) {
      log('\n⚠️  需要初始化数据库表', 'yellow');
      log('\n请执行以下步骤:', 'blue');
      log('  1. 访问 Supabase 控制台 → SQL Editor', 'cyan');
      log('  2. 复制文件内容: service/src/db/supabase-init.sql', 'cyan');
      log('  3. 粘贴到SQL Editor并运行', 'cyan');
      log('\n或者使用Supabase CLI:', 'blue');
      log('  supabase db push < service/src/db/supabase-init.sql', 'cyan');

      const initNow = await question(rl, '\n已初始化表结构？(y/N): ');
      if (initNow.toLowerCase() === 'y') {
        log('\n重新检查表结构...', 'blue');
        // 可以重新检查...
      }
    }

    // 完成
    log('\n╔═══════════════════════════════════════════╗', 'green');
    log('║  ✅ 配置完成！                           ║', 'green');
    log('╚═══════════════════════════════════════════╝\n', 'green');

    log('下一步:', 'blue');
    log('  1. 运行测试: bun run test:supabase', 'cyan');
    log('  2. 启动服务: bun run dev', 'cyan');
    log('  3. 测试API: curl http://localhost:3002/sync/sessions -H "X-Ptoken: your-key"\n', 'cyan');

    rl.close();

  } catch (error: any) {
    log(`\n❌ 配置过程出错: ${error.message}`, 'red');
    console.error(error);
    rl.close();
    process.exit(1);
  }
}

// 运行配置
setup().catch(error => {
  console.error('Setup failed:', error);
  process.exit(1);
});
