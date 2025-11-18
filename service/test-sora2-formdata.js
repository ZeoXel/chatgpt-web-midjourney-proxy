const FormData = require('form-data');
const https = require('https');

const API_KEY = 'sk-JO438PQ5WpZFtR9Gt5tMN119FmD1bG6YDtmczNgGyDIMCHc1';
const API_BASE = 'https://api.bltcy.ai';

async function testSora2WithFormData() {
  console.log('=== 测试 Sora-2 API (FormData) ===\n');

  const form = new FormData();
  form.append('model', 'sora-2');
  form.append('prompt', 'A beautiful sunset over the ocean');
  form.append('size', '1280x720');
  form.append('seconds', '5');
  form.append('watermark', 'false');

  const options = {
    method: 'POST',
    hostname: 'api.bltcy.ai',
    path: '/v1/videos',
    headers: {
      ...form.getHeaders(),
      'Authorization': `Bearer ${API_KEY}`
    },
    timeout: 90000 // 90秒超时
  };

  console.log('📤 发送请求...');
  console.log('URL:', `${API_BASE}/v1/videos`);
  console.log('Headers:', options.headers);
  console.log('');

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log('✅ 收到响应');
      console.log('状态码:', res.statusCode);
      console.log('响应头:', res.headers);
      console.log('');

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
        process.stdout.write('.');
      });

      res.on('end', () => {
        console.log('\n\n📥 响应完成');
        console.log('响应内容:', data);

        try {
          const json = JSON.parse(data);
          console.log('\nJSON 解析:', JSON.stringify(json, null, 2));
        } catch (e) {
          console.log('⚠️ 无法解析为 JSON');
        }

        resolve(data);
      });
    });

    req.on('error', (error) => {
      console.error('❌ 请求错误:', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      console.error('⏱️ 请求超时 (90秒)');
      req.destroy();
      reject(new Error('Request timeout'));
    });

    // 显示上传进度
    let uploaded = 0;
    form.on('data', (chunk) => {
      uploaded += chunk.length;
      process.stdout.write(`\r上传中... ${uploaded} bytes`);
    });

    form.pipe(req);
  });
}

testSora2WithFormData()
  .then(() => {
    console.log('\n✅ 测试完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  });
