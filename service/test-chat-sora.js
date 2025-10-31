const API_KEY = 'sk-JO438PQ5WpZFtR9Gt5tMN119FmD1bG6YDtmczNgGyDIMCHc1';
const API_BASE = 'https://api.bltcy.ai';

async function testChatFormat() {
  console.log('=== 测试通过 Chat Completions 格式使用 Sora ===\n');

  // 测试 1: 使用 chat completions 格式
  console.log('测试 1: Chat Completions 格式');
  const chatData = {
    model: 'sora-2',
    messages: [
      {
        role: 'user',
        content: 'Generate a video: A beautiful sunset over the ocean'
      }
    ]
  };

  try {
    const response = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chatData)
    });

    console.log('状态码:', response.status);
    const responseText = await response.text();

    try {
      const json = JSON.parse(responseText);
      console.log('响应:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('响应文本:', responseText);
    }
  } catch (error) {
    console.error('请求错误:', error.message);
  }

  console.log('\n====================\n');

  // 测试 2: 检查是否有专用的 sora 端点
  console.log('测试 2: 尝试 /v1/sora 端点');
  const soraData = {
    model: 'sora-2',
    prompt: 'A beautiful sunset over the ocean',
    size: '1280x720',
    seconds: 5
  };

  try {
    const response = await fetch(`${API_BASE}/v1/sora`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(soraData)
    });

    console.log('状态码:', response.status);
    const responseText = await response.text();

    try {
      const json = JSON.parse(responseText);
      console.log('响应:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('响应文本:', responseText);
    }
  } catch (error) {
    console.error('请求错误:', error.message);
  }

  console.log('\n====================\n');

  // 测试 3: 检查账户余额和配置
  console.log('测试 3: 检查账户信息');
  try {
    const response = await fetch(`${API_BASE}/v1/dashboard/billing/subscription`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });

    console.log('状态码:', response.status);
    const responseText = await response.text();
    console.log('账户信息:', responseText);
  } catch (error) {
    console.error('请求错误:', error.message);
  }
}

testChatFormat().catch(console.error);
