import fs from 'fs';
import FormData from 'form-data';

// 配置
const API_BASE_URL = 'https://railway.lsaigc.com';
const API_KEY = 'sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw';

async function testVideoAPI() {
  console.log('开始测试视频生成API...\n');

  // 使用项目中已有的测试图片
  const testImagePath = './docs/desk.jpg';
  if (!fs.existsSync(testImagePath)) {
    console.error(`错误: 测试图片不存在: ${testImagePath}`);
    return;
  }
  console.log(`使用测试图片: ${testImagePath}\n`);

  try {
    // 创建FormData
    const formData = new FormData();
    formData.append('model', 'sora-2');
    formData.append('prompt', '基于这张图片生成视频');
    formData.append('size', '720x1280');
    formData.append('input_reference', fs.createReadStream(testImagePath));
    formData.append('seconds', '4');
    formData.append('watermark', 'false');

    console.log('请求配置:');
    console.log(`URL: ${API_BASE_URL}/v1/videos`);
    console.log(`API Key: ${API_KEY.substring(0, 20)}...`);
    console.log('参数:');
    console.log('  - model: sora-2');
    console.log('  - prompt: 基于这张图片生成视频');
    console.log('  - size: 720x1280');
    console.log('  - seconds: 4');
    console.log('  - watermark: false');
    console.log('\n正在发送请求...\n');

    // 发送请求
    const response = await fetch(`${API_BASE_URL}/v1/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    // 获取响应
    const responseText = await response.text();

    console.log('=== 响应结果 ===');
    console.log(`状态码: ${response.status} ${response.statusText}`);
    console.log('\n响应头:');
    response.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    console.log('\n响应体:');
    try {
      const jsonResponse = JSON.parse(responseText);
      console.log(JSON.stringify(jsonResponse, null, 2));
    } catch (e) {
      console.log(responseText);
    }

    // 判断是否成功
    if (response.ok) {
      console.log('\n✅ 测试成功！网关支持该视频生成API');
    } else {
      console.log('\n❌ 测试失败！可能原因：');
      if (response.status === 401) {
        console.log('  - API密钥无效或已过期');
      } else if (response.status === 404) {
        console.log('  - 端点不存在，网关可能不支持此API');
      } else if (response.status === 400) {
        console.log('  - 请求参数错误');
      } else if (response.status === 500) {
        console.log('  - 服务器内部错误');
      }
    }

  } catch (error) {
    console.error('\n❌ 请求失败:');
    console.error(error.message);

    if (error.code === 'ENOTFOUND') {
      console.log('\n可能原因: 网关地址无法访问');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n可能原因: 连接被拒绝');
    }
  }
}

// 执行测试
testVideoAPI();
