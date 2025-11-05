/**
 * 测试新网关：https://api.bltcy.ai
 * 诊断为什么被识别为 luma 而不是 runway
 */

const axios = require('axios');

const GATEWAY_URL = 'https://api.bltcy.ai';
const API_KEY = 'sk-JO438PQ5WpZFtR9Gt5tMN119FmD1bG6YDtmczNgGyDIMCHc1';
const VIDEO_URL = 'https://lxxbjwxwujcpgqfoquvv.supabase.co/storage/v1/object/public/runway-videos/2025-11-04/1762244382422-4c7f3w.mp4';

console.log('========================================');
console.log('   测试新网关 - Runway 识别问题');
console.log('========================================\n');

console.log('网关信息:');
console.log('  - URL:', GATEWAY_URL);
console.log('  - API Key:', API_KEY.substring(0, 20) + '...');
console.log('');

// 测试 1: 查看支持的模型
async function test1_listModels() {
  console.log('📋 测试 1: 查看支持的 runway 模型...\n');

  try {
    const response = await axios.get(
      `${GATEWAY_URL}/v1/models`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
        timeout: 10000,
      }
    );

    const runwayModels = response.data.data.filter(m =>
      m.id.toLowerCase().includes('runway')
    );

    console.log(`✅ 找到 ${runwayModels.length} 个 runway 模型:`);
    runwayModels.forEach(m => {
      console.log(`   - ${m.id}`);
    });

    return runwayModels;
  } catch (error) {
    console.error('❌ 获取模型列表失败:', error.message);
    return [];
  }
}

// 测试 2: 使用当前格式（被识别为 luma）
async function test2_currentFormat() {
  console.log('\n📤 测试 2: 当前格式（被识别为 luma）...\n');

  const payload = {
    model: 'runway-video2video',
    prompt: 'Transform this video into a beautiful watercolor painting style',
    video_url: VIDEO_URL,
  };

  console.log('请求格式:');
  console.log('  - Endpoint: /v1/video/generations');
  console.log('  - Payload:', JSON.stringify(payload, null, 2));

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

    console.log('\n✅ 请求成功！');
    console.log('响应:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('\n❌ 请求失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('错误:', error.message);
    }
    return null;
  }
}

// 测试 3: 尝试不同的 endpoint
async function test3_alternativeEndpoints() {
  console.log('\n🔍 测试 3: 尝试其他可能的 endpoint...\n');

  const endpoints = [
    '/v1/pro/video2video',
    '/runway/v1/video/generations',
    '/runway/v1/pro/video2video',
    '/v1/runway/video2video',
  ];

  const payload = {
    model: 'runway-video2video',
    prompt: 'Transform this video into a beautiful watercolor painting style',
    video_url: VIDEO_URL,
  };

  for (const endpoint of endpoints) {
    console.log(`\n尝试: ${endpoint}`);
    try {
      const response = await axios.post(
        `${GATEWAY_URL}${endpoint}`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      console.log('✅ 成功！响应:', JSON.stringify(response.data, null, 2));
      return { endpoint, data: response.data };
    } catch (error) {
      if (error.response) {
        console.log(`❌ 失败 (${error.response.status}):`, error.response.data?.error?.message || error.response.data);
      } else {
        console.log('❌ 失败:', error.message);
      }
    }
  }

  return null;
}

// 测试 4: 尝试不同的模型名称
async function test4_alternativeModels() {
  console.log('\n🔍 测试 4: 尝试不同的模型名称...\n');

  const models = [
    'runway-video2video',
    'runway',
    'runway-gen3',
    'runwayml',
    'gen3',
  ];

  const payload = {
    prompt: 'Transform this video into a beautiful watercolor painting style',
    video_url: VIDEO_URL,
  };

  for (const model of models) {
    console.log(`\n尝试模型: ${model}`);
    try {
      const response = await axios.post(
        `${GATEWAY_URL}/v1/video/generations`,
        { ...payload, model },
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      console.log('✅ 成功！响应:', JSON.stringify(response.data, null, 2));
      return { model, data: response.data };
    } catch (error) {
      if (error.response) {
        console.log(`❌ 失败 (${error.response.status}):`, error.response.data?.error?.message || error.response.data);
      } else {
        console.log('❌ 失败:', error.message);
      }
    }
  }

  return null;
}

async function main() {
  try {
    // 测试 1: 查看模型列表
    const models = await test1_listModels();

    // 测试 2: 当前格式
    await test2_currentFormat();

    // 测试 3: 尝试其他 endpoint
    await test3_alternativeEndpoints();

    // 测试 4: 尝试其他模型名称
    await test4_alternativeModels();

    console.log('\n========================================');
    console.log('测试完成');
    console.log('========================================');
  } catch (error) {
    console.error('\n测试异常:', error.message);
  }
}

main();
