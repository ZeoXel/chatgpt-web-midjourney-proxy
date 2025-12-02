/**
 * 腾讯云 COS CORS 配置脚本
 * 用于添加 OPTIONS 方法支持,解决 CORS 预检问题
 *
 * 使用方法:
 * 1. 确保 .env 中配置了 COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET, COS_REGION
 * 2. 运行: node service/configure-cos-cors.js
 */

require('dotenv').config();
const COS = require('cos-nodejs-sdk-v5');

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
});

const bucket = process.env.COS_BUCKET;
const region = process.env.COS_REGION || 'ap-guangzhou';

console.log('📦 配置 COS CORS...');
console.log(`   Bucket: ${bucket}`);
console.log(`   Region: ${region}`);

// CORS 配置
const corsConfig = {
  Bucket: bucket,
  Region: region,
  CORSRules: [
    {
      AllowedOrigins: [
        'https://www.lsaigc.chat',
        'https://lsaigc.chat'
      ],
      AllowedMethods: [
        'GET',
        'HEAD',
        'OPTIONS',  // ⚠️ 关键: 支持 CORS 预检
        'PUT',
        'POST'
      ],
      AllowedHeaders: ['*'],
      ExposeHeaders: [
        'ETag',
        'Content-Length',
        'Content-Type',
        'Accept-Ranges',
        'Content-Range',
        'x-cos-request-id'
      ],
      MaxAgeSeconds: '3600'
    }
  ]
};

cos.putBucketCors(corsConfig, (err, data) => {
  if (err) {
    console.error('❌ CORS 配置失败:', err);
    process.exit(1);
  }

  console.log('✅ CORS 配置成功!');
  console.log('📋 已配置规则:');
  console.log(JSON.stringify(corsConfig.CORSRules[0], null, 2));
  console.log('\n⏳ 配置可能需要 5-10 分钟生效');
  console.log('💡 建议清除浏览器缓存后测试');
});
