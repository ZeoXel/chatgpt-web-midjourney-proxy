/**
 * 腾讯云COS连接测试脚本
 *
 * 使用方法:
 * 1. 在 .env 文件中配置腾讯云COS凭证
 * 2. 运行: pnpm test:cos
 */

import 'dotenv/config';
import { TencentCOSClient } from './src/storage/cos-client';

async function testCOSConnection() {
  console.log('========================================');
  console.log('腾讯云COS连接测试');
  console.log('========================================\n');

  // 检查环境变量
  console.log('1. 检查环境变量配置:');
  console.log('   ENABLE_TENCENT_COS:', process.env.ENABLE_TENCENT_COS);
  console.log('   COS_SECRET_ID:', process.env.COS_SECRET_ID ? '已配置 ✓' : '未配置 ✗');
  console.log('   COS_SECRET_KEY:', process.env.COS_SECRET_KEY ? '已配置 ✓' : '未配置 ✗');
  console.log('   COS_BUCKET:', process.env.COS_BUCKET || '未配置 ✗');
  console.log('   COS_REGION:', process.env.COS_REGION || '未配置 ✗');
  console.log('   COS_DOMAIN:', process.env.COS_DOMAIN || '未配置（可选）');
  console.log('');

  if (process.env.ENABLE_TENCENT_COS !== 'true') {
    console.log('⚠️  腾讯云COS未启用');
    console.log('提示: 请在 .env 文件中设置 ENABLE_TENCENT_COS=true');
    console.log('');
    return;
  }

  if (!process.env.COS_SECRET_ID || !process.env.COS_SECRET_KEY || !process.env.COS_BUCKET) {
    console.log('❌ 缺少必要的环境变量配置');
    console.log('请在 .env 文件中配置:');
    console.log('  - COS_SECRET_ID');
    console.log('  - COS_SECRET_KEY');
    console.log('  - COS_BUCKET');
    console.log('  - COS_REGION (可选，默认为 ap-guangzhou)');
    console.log('');
    return;
  }

  try {
    // 初始化客户端
    console.log('2. 初始化COS客户端...');
    const cosClient = new TencentCOSClient();
    console.log('   ✓ 客户端初始化成功\n');

    // 测试连接
    console.log('3. 测试连接...');
    const result = await cosClient.testConnection();

    console.log('');
    console.log('========================================');
    console.log('测试结果:');
    console.log('========================================');

    if (result.success) {
      console.log('✅ 连接成功!\n');
      console.log('存储桶信息:');
      console.log('  - 名称:', result.data?.bucket);
      console.log('  - 区域:', result.data?.region);
      console.log('  - 文件数量:', result.data?.objectCount);
      console.log('  - 账号下存储桶总数:', result.data?.totalBuckets);
      console.log('');
      console.log('🎉 腾讯云COS已成功配置并可以正常使用!');
    } else {
      console.log('❌ 连接失败\n');
      console.log('错误信息:', result.message);
      if (result.data) {
        console.log('详细信息:', JSON.stringify(result.data, null, 2));
      }
      console.log('');
      console.log('常见问题排查:');
      console.log('1. 检查 SecretId 和 SecretKey 是否正确');
      console.log('2. 检查存储桶名称格式: bucket-name-appid (例如: my-bucket-1234567890)');
      console.log('3. 检查存储桶所属区域是否正确 (例如: ap-guangzhou, ap-beijing)');
      console.log('4. 确认子账号有访问存储桶的权限');
      console.log('5. 检查网络连接是否正常');
    }

    console.log('========================================\n');

  } catch (error: any) {
    console.log('');
    console.log('========================================');
    console.log('❌ 测试过程中发生错误');
    console.log('========================================');
    console.log('错误类型:', error.name || 'Error');
    console.log('错误信息:', error.message || error);
    if (error.stack) {
      console.log('\n错误堆栈:');
      console.log(error.stack);
    }
    console.log('========================================\n');
  }
}

// 运行测试
testCOSConnection().catch(console.error);
