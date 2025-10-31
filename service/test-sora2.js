const https = require('https');

const API_KEY = 'sk-JO438PQ5WpZFtR9Gt5tMN119FmD1bG6YDtmczNgGyDIMCHc1';
const API_BASE = 'https://api.bltcy.ai';

async function testSora2API() {
  console.log('=== 测试 Sora-2 API 端点 ===\n');

  // 测试 1: JSON 格式请求
  console.log('测试 1: JSON 格式请求 (application/json)');
  const jsonData = {
    model: 'sora-2',
    prompt: 'A beautiful sunset over the ocean',
    size: '1280x720',
    seconds: '5',
    watermark: false
  };

  try {
    const response1 = await fetch(`${API_BASE}/v1/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(jsonData)
    });

    console.log('状态码:', response1.status);
    console.log('状态文本:', response1.statusText);

    const responseText = await response1.text();
    console.log('响应内容:', responseText);

    try {
      const responseJson = JSON.parse(responseText);
      console.log('JSON 解析:', JSON.stringify(responseJson, null, 2));
    } catch (e) {
      console.log('无法解析为 JSON');
    }
  } catch (error) {
    console.error('请求错误:', error.message);
  }

  console.log('\n====================\n');

  // 测试 2: 查询模型详情
  console.log('测试 2: 查询 sora-2 模型详情');
  try {
    const response2 = await fetch(`${API_BASE}/v1/models/sora-2`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });

    console.log('状态码:', response2.status);
    const data2 = await response2.json();
    console.log('模型信息:', JSON.stringify(data2, null, 2));
  } catch (error) {
    console.error('请求错误:', error.message);
  }

  console.log('\n====================\n');

  // 测试 3: 测试不同的参数格式
  console.log('测试 3: 尝试数值类型的 seconds');
  const jsonData2 = {
    model: 'sora-2',
    prompt: 'A beautiful sunset over the ocean',
    size: '1280x720',
    seconds: 5,  // 数值而非字符串
    watermark: false
  };

  try {
    const response3 = await fetch(`${API_BASE}/v1/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(jsonData2)
    });

    console.log('状态码:', response3.status);
    const responseText3 = await response3.text();
    console.log('响应:', responseText3);
  } catch (error) {
    console.error('请求错误:', error.message);
  }
}

testSora2API().catch(console.error);
