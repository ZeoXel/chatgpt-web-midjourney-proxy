/**
 * Runway Video2Video 最终测试
 * 测试路径: /runway/v1/pro/video2video
 */

const axios = require('axios');

const BACKEND_URL = 'http://localhost:3002';
const GATEWAY_URL = 'http://localhost:3000';
const API_KEY = 'sk-xHO8wq8Sj3l8k9tp8r3e4zCJQXTanh5bpGl8018zQEm9TaAc';

// 使用已上传的 Supabase 视频 URL
const VIDEO_URL = 'https://lxxbjwxwujcpgqfoquvv.supabase.co/storage/v1/object/public/runway-videos/2025-11-04/1762243077377-ktpkso.mp4';

async function testBackendProxy() {
  console.log('========================================');
  console.log('   测试后端代理路径');
  console.log('========================================\n');

  const payload = {
    model: 'runway-video2video',
    prompt: 'Transform this video into a beautiful watercolor painting style',
    video_url: VIDEO_URL,
    structure_transformation: 0.5,
    flip: false,
  };

  console.log('📤 发送请求到后端代理:');
  console.log('   URL:', `${BACKEND_URL}/runway/v1/video/generations`);
  console.log('   Payload:', JSON.stringify(payload, null, 2));
  console.log('');

  try {
    const response = await axios.post(
      `${BACKEND_URL}/runway/v1/video/generations`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    console.log('✅ 后端代理成功！');
    console.log('   任务 ID:', response.data.id);
    console.log('   状态:', response.data.state);
    console.log('   完整响应:', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('❌ 后端代理失败:');
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   错误:', error.response.data);
    } else {
      console.error('   错误:', error.message);
    }
    throw error;
  }
}

async function testDirectGateway() {
  console.log('\n========================================');
  console.log('   测试直连网关（对比）');
  console.log('========================================\n');

  const payload = {
    model: 'runway-video2video',
    prompt: 'Transform this video into a beautiful watercolor painting style',
    video_url: VIDEO_URL,
    structure_transformation: 0.5,
    flip: false,
  };

  console.log('📤 发送请求到网关:');
  console.log('   URL:', `${GATEWAY_URL}/v1/video/generations`);
  console.log('');

  try {
    const response = await axios.post(
      `${GATEWAY_URL}/v1/video/generations`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    console.log('✅ 直连网关成功！');
    console.log('   任务 ID:', response.data.id);
    console.log('   状态:', response.data.state);
    console.log('   完整响应:', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('❌ 直连网关失败:');
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   错误:', error.response.data);
    } else {
      console.error('   错误:', error.message);
    }
    throw error;
  }
}

async function main() {
  console.log('🎬 Runway Video2Video 最终测试\n');
  console.log('配置信息:');
  console.log('  - 后端服务:', BACKEND_URL);
  console.log('  - 网关地址:', GATEWAY_URL);
  console.log('  - 视频 URL:', VIDEO_URL);
  console.log('');

  try {
    // 测试 1: 后端代理
    await testBackendProxy();

    // 测试 2: 直连网关（对比）
    await testDirectGateway();

    console.log('\n========================================');
    console.log('✅ 所有测试通过！');
    console.log('========================================');
  } catch (error) {
    console.log('\n========================================');
    console.log('❌ 测试失败');
    console.log('========================================');
    process.exit(1);
  }
}

main();
