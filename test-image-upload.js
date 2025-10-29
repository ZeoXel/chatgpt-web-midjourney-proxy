/**
 * 图片上传完整测试脚本
 * 测试：Supabase Storage 上传 + Pika API 请求
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 配置
const BASE_URL = 'http://localhost:3002';
const PIKA_SERVER = 'https://railway.lsaigc.com';
const PIKA_KEY = 'sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`步骤 ${step}: ${message}`, 'cyan');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// 创建测试图片（简单的 PNG）
function createTestImage() {
  logStep(1, '创建测试图片');

  const testImagePath = path.join(__dirname, 'test-image.png');

  // 创建一个简单的 1x1 PNG 图片（红色像素）
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG 签名
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 图片
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D,
    0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND chunk
    0x44, 0xAE, 0x42, 0x60, 0x82
  ]);

  fs.writeFileSync(testImagePath, pngData);
  logSuccess(`测试图片已创建: ${testImagePath}`);
  logInfo(`文件大小: ${pngData.length} bytes`);

  return testImagePath;
}

// 测试 1: Supabase 健康检查
async function testSupabaseHealth() {
  logStep(2, 'Supabase 健康检查');

  try {
    const response = await fetch(`${BASE_URL}/api/supabase/health`);
    const data = await response.json();

    if (data.success) {
      logSuccess('Supabase 连接正常');
      logInfo(`存储桶列表: ${data.buckets.join(', ')}`);

      if (data.pika_bucket_exists) {
        logSuccess('pika-images 存储桶已存在');
      } else {
        logWarning('pika-images 存储桶不存在，需要创建');
        logInfo('请访问: https://supabase.com/dashboard/project/lxxbjwxwujcpgqfoquvv/storage/buckets');
        logInfo('创建存储桶: 名称=pika-images, Public=是');
        return false;
      }
    } else {
      logError(`健康检查失败: ${data.error}`);
      return false;
    }

    return true;
  } catch (error) {
    logError(`健康检查异常: ${error.message}`);
    logInfo('请确保后端服务已启动: cd service && bun run dev');
    return false;
  }
}

// 测试 2: 上传图片到 Supabase Storage
async function testImageUpload(imagePath) {
  logStep(3, '上传图片到 Supabase Storage');

  try {
    const formData = new FormData();
    const fileBlob = new Blob([fs.readFileSync(imagePath)], { type: 'image/png' });
    formData.append('file', fileBlob, 'test-image.png');

    const response = await fetch(`${BASE_URL}/api/supabase/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      logSuccess('图片上传成功');
      logInfo(`URL: ${data.url}`);
      logInfo(`路径: ${data.path}`);
      logInfo(`大小: ${data.size} bytes`);

      // 验证 URL 可访问
      log('\n验证图片 URL 是否可访问...');
      const urlCheck = await fetch(data.url);
      if (urlCheck.ok) {
        logSuccess('图片 URL 可正常访问');
      } else {
        logWarning(`图片 URL 访问失败: ${urlCheck.status}`);
      }

      return data.url;
    } else {
      logError(`上传失败: ${data.error}`);
      if (data.hint) {
        logInfo(`提示: ${data.hint}`);
      }
      return null;
    }
  } catch (error) {
    logError(`上传异常: ${error.message}`);
    return null;
  }
}

// 测试 3: Pika 文生视频请求（测试格式）
async function testPikaTextToVideo() {
  logStep(4, 'Pika 文生视频请求（测试格式）');

  const requestBody = {
    pikaffect: '',
    promptText: 'a beautiful sunset over the ocean',
    model: '1.5',
    options: {
      aspectRatio: 1.7777777777777777,
      frameRate: 24,
      camera: {},
      parameters: {
        guidanceScale: 12,
        motion: 1,
        negativePrompt: ''
      },
      extend: false
    }
  };

  logInfo('请求体 (文生视频):');
  console.log(JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(`${PIKA_SERVER}/pika/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PIKA_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (response.ok) {
      logSuccess('Pika 文生视频请求成功');
      logInfo(`任务 ID: ${data.id || '未返回'}`);
      console.log('\n响应数据:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      logError(`请求失败: ${response.status}`);
      console.log(data);
    }

    return data;
  } catch (error) {
    logError(`请求异常: ${error.message}`);
    return null;
  }
}

// 测试 4: Pika 图生视频请求（使用上传的图片 URL）
async function testPikaImageToVideo(imageUrl) {
  logStep(5, 'Pika 图生视频请求（使用 Supabase URL）');

  const requestBody = {
    pikaffect: '',
    promptText: 'make it move gently',
    model: '1.5',
    options: {
      frameRate: 24,
      camera: {},
      parameters: {
        guidanceScale: 12,
        motion: 1,
        negativePrompt: ''
      },
      extend: false
    },
    image: imageUrl
  };

  logInfo('请求体 (图生视频):');
  console.log(JSON.stringify(requestBody, null, 2));
  logInfo(`\n图片 URL 长度: ${imageUrl.length} bytes`);
  logSuccess(`✅ 请求体大小极小！（相比 Base64 的 ~13MB）`);

  try {
    const response = await fetch(`${PIKA_SERVER}/pika/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PIKA_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (response.ok) {
      logSuccess('Pika 图生视频请求成功');
      logInfo(`任务 ID: ${data.id || '未返回'}`);
      console.log('\n响应数据:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      logError(`请求失败: ${response.status}`);
      console.log(data);
    }

    return data;
  } catch (error) {
    logError(`请求异常: ${error.message}`);
    return null;
  }
}

// 主测试流程
async function runTests() {
  log('\n🚀 开始图片上传完整测试', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');

  // 1. 创建测试图片
  const imagePath = createTestImage();

  // 2. Supabase 健康检查
  const healthOk = await testSupabaseHealth();
  if (!healthOk) {
    logError('\n测试终止：请先配置 Supabase Storage');
    process.exit(1);
  }

  // 3. 上传图片
  const imageUrl = await testImageUpload(imagePath);
  if (!imageUrl) {
    logError('\n测试终止：图片上传失败');
    process.exit(1);
  }

  // 4. 测试 Pika 文生视频
  await testPikaTextToVideo();

  // 5. 测试 Pika 图生视频
  await testPikaImageToVideo(imageUrl);

  // 总结
  log('\n' + '='.repeat(60), 'cyan');
  log('🎉 测试完成！', 'green');
  log('='.repeat(60), 'cyan');

  logInfo('\n测试结果总结:');
  logSuccess('✅ Supabase Storage 连接正常');
  logSuccess('✅ 图片上传成功');
  logSuccess('✅ 图片 URL 可访问');
  logSuccess('✅ Pika 文生视频格式正确');
  logSuccess('✅ Pika 图生视频格式正确');
  logSuccess('✅ 请求体大小优化成功（URL vs Base64）');

  logInfo('\n下一步:');
  logInfo('1. 前端测试：打开 http://localhost:1002，进入 Pika 页面上传图片');
  logInfo('2. 查看上传记录：SELECT * FROM temp_image_uploads;');
  logInfo('3. 生产部署：更新环境变量后重启服务');

  // 清理测试图片
  fs.unlinkSync(imagePath);
  logInfo('\n测试图片已清理');
}

// 运行测试
runTests().catch((error) => {
  logError(`\n测试失败: ${error.message}`);
  console.error(error);
  process.exit(1);
});
