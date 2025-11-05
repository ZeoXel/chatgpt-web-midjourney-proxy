const axios = require('axios');

async function testBackendRoute() {
  try {
    const response = await axios.post(
      'http://localhost:3002/runway/v1/video/generations',
      {
        model: 'runway-video2video',
        prompt: 'test prompt',
        video_url: 'https://example.com/test.mp4'
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ 成功！');
    console.log('响应:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ 失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
  }
}

testBackendRoute();
