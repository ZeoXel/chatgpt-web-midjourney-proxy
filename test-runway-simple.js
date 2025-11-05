/**
 * 简化的 Runway 测试脚本 - 调试网关接口
 */

const axios = require('axios');

const GATEWAY_URL = 'http://localhost:3000';
const API_KEY = 'sk-xHO8wq8Sj3l8k9tp8r3e4zCJQXTanh5bpGl8018zQEm9TaAc';

async function testTextToVideo() {
  console.log('🎬 测试 Runway Text-to-Video');

  try {
    const response = await axios.post(
      `${GATEWAY_URL}/v1/video/generations`,
      {
        model: 'runway-video2video',
        prompt: 'A beautiful sunset over the ocean',
        video_url: 'https://example.com/test.mp4',  // 测试 URL
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    console.log('✅ 成功！');
    console.log('响应:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ 失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('错误:', error.message);
    }
  }
}

testTextToVideo();
