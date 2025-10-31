const API_KEY = 'sk-JO438PQ5WpZFtR9Gt5tMN119FmD1bG6YDtmczNgGyDIMCHc1';
const API_BASE = 'https://api.bltcy.ai';

// 从之前的查询中得到的 sora 模型列表
const soraModels = [
  'sora_image',
  'sora_video2',
  'sora_video2-landscape',
  'sora_video2-portrait',
  'sora-2',
  'sora-2-pro',
  'sora-video'
];

async function testModels() {
  console.log('=== 测试不同的 Sora 模型 ===\n');

  for (const model of soraModels) {
    console.log(`\n测试模型: ${model}`);
    console.log('-'.repeat(50));

    const data = {
      model: model,
      prompt: 'A beautiful sunset over the ocean',
      size: '1280x720',
      seconds: 5,
      watermark: false
    };

    try {
      const response = await fetch(`${API_BASE}/v1/videos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      console.log('状态码:', response.status);
      const responseText = await response.text();

      try {
        const json = JSON.parse(responseText);
        if (response.status === 200 || response.status === 201) {
          console.log('✅ 成功! 响应:', JSON.stringify(json, null, 2));
          console.log('\n找到可用模型:', model);
          break;
        } else if (json.code === 'fail_submit_task') {
          console.log('❌ fail_submit_task - 模型可能不可用或参数错误');
        } else {
          console.log('响应:', JSON.stringify(json, null, 2));
        }
      } catch (e) {
        console.log('响应文本:', responseText);
      }
    } catch (error) {
      console.error('请求错误:', error.message);
    }

    // 延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n\n=== 测试完成 ===');
}

testModels().catch(console.error);
