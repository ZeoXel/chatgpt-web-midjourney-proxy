/**
 * 测试 Runway Video2Video 是否正确传递 video_url
 */

const axios = require('axios');

const GATEWAY_URL = 'http://localhost:3000';
const API_KEY = 'sk-xHO8wq8Sj3l8k9tp8r3e4zCJQXTanh5bpGl8018zQEm9TaAc';

// 使用之前上传的 Supabase 视频
const SUPABASE_VIDEO_URL = 'https://lxxbjwxwujcpgqfoquvv.supabase.co/storage/v1/object/public/runway-videos/2025-11-04/1762245395826-hiag7e.mp4';

console.log('========================================');
console.log('   测试 Runway Video URL 传递');
console.log('========================================\n');

console.log('配置:');
console.log('  - 网关:', GATEWAY_URL);
console.log('  - 输入视频:', SUPABASE_VIDEO_URL);
console.log('');

async function testVideo2Video() {
  console.log('📤 提交 video2video 任务...\n');

  const payload = {
    model: 'runway-video2video',
    prompt: 'Add colorful fireworks in the sky, keep everything else the same',
    video_url: SUPABASE_VIDEO_URL,
    structure_transformation: 0.3,  // 低改造强度，应该保留原视频内容
    flip: false
  };

  console.log('请求 Payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');

  try {
    const response = await axios.post(
      `${GATEWAY_URL}/runway/v1/pro/video2video`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    console.log('✅ 任务提交成功！');
    console.log('响应:', JSON.stringify(response.data, null, 2));

    const taskId = response.data.data?.task_id;

    if (taskId) {
      console.log('\n🔍 等待 10 秒后查询任务状态...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      const feedResponse = await axios.post(
        `${GATEWAY_URL}/runway/v1/feed`,
        { task_id: taskId },
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('\n📊 任务状态:');
      const data = feedResponse.data.data;
      console.log('  - Status:', data.status, '(' + data.state + ')');
      console.log('  - Prompt:', data.prompt);
      console.log('  - 输入视频 URL:', data.raw_video_url || '未找到');
      console.log('  - 输出视频 URL:', data.video_url || '处理中...');

      // 检查输入视频是否匹配
      if (data.raw_video_url) {
        console.log('\n🔍 分析:');
        if (data.raw_video_url.includes('supabase')) {
          console.log('  ✅ 输入视频来自 Supabase - 正确！');
        } else if (data.raw_video_url.includes('cloudfront')) {
          console.log('  ⚠️  输入视频来自 Runway CDN - 可能是网关转换了 URL');
        } else {
          console.log('  ❓ 输入视频来源未知');
        }
      }
    }

    console.log('\n========================================');
    console.log('测试完成');
    console.log('========================================');

  } catch (error) {
    console.error('\n❌ 测试失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('错误:', error.message);
    }
  }
}

testVideo2Video();
