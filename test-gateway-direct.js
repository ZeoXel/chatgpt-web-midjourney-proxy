const axios = require('axios');

async function test() {
  try {
    const response = await axios.post(
      'http://localhost:3000/v1/pro/video2video',
      {
        model: 'runway-video2video',
        prompt: 'test',
        video_url: 'https://lxxbjwxwujcpgqfoquvv.supabase.co/storage/v1/object/public/runway-videos/2025-11-04/1762243077377-ktpkso.mp4'
      },
      {
        headers: {
          'Authorization': 'Bearer sk-xHO8wq8Sj3l8k9tp8r3e4zCJQXTanh5bpGl8018zQEm9TaAc',
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ 成功！');
    console.log(JSON.stringify(response.data, null, 2));
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

test();
