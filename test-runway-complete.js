/**
 * Runway Video2Video 完整流程测试
 * 模拟前端配置直连网关
 */

const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 模拟前端配置
const OPENAI_API_BASE_URL = 'http://localhost:3000';
const OPENAI_API_KEY = 'sk-xHO8wq8Sj3l8k9tp8r3e4zCJQXTanh5bpGl8018zQEm9TaAc';
const BACKEND_URL = 'http://localhost:3002';
const VIDEO_PATH = '/Users/g/Downloads/general-3-2025-10-30T09_36_54Z.mp4';

console.log('========================================');
console.log('   Runway Video2Video 完整流程测试');
console.log('========================================\n');

console.log('配置信息（模拟前端设置）:');
console.log('  - OPENAI_API_BASE_URL:', OPENAI_API_BASE_URL);
console.log('  - OPENAI_API_KEY:', OPENAI_API_KEY.substring(0, 20) + '...');
console.log('  - 后端服务:', BACKEND_URL);
console.log('  - 测试视频:', VIDEO_PATH);
console.log('');

async function step1_uploadToSupabase() {
  console.log('📤 步骤 1: 上传视频到 Supabase...');

  const formData = new FormData();
  const videoStream = fs.createReadStream(VIDEO_PATH);
  formData.append('file', videoStream, {
    filename: path.basename(VIDEO_PATH),
    contentType: 'video/mp4',
  });

  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/supabase/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 120000,
      }
    );

    if (response.data.success) {
      console.log('✅ 视频上传成功！');
      console.log('   URL:', response.data.url);
      console.log('   Size:', (response.data.size / 1024 / 1024).toFixed(2), 'MB');
      return response.data.url;
    } else {
      throw new Error(response.data.error || '上传失败');
    }
  } catch (error) {
    console.error('❌ 上传失败:', error.message);
    throw error;
  }
}

async function step2_submitToGateway(videoUrl) {
  console.log('\n🎬 步骤 2: 提交 video2video 任务到网关...');

  const payload = {
    model: 'runway-video2video',
    prompt: 'Transform this video into a beautiful watercolor painting style',
    video_url: videoUrl,
    // structure_transformation: 0.5,
    // flip: false,
  };

  // 模拟前端 getUrl() 逻辑
  const apiUrl = `${OPENAI_API_BASE_URL}/v1/video/generations`;

  console.log('   请求 URL:', apiUrl);
  console.log('   Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(
      apiUrl,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    console.log('✅ 任务提交成功！');
    console.log('   任务 ID:', response.data.id);
    console.log('   状态:', response.data.state);
    console.log('   创建时间:', response.data.created_at);

    return response.data;
  } catch (error) {
    console.error('❌ 任务提交失败:');
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   错误:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   错误:', error.message);
    }
    throw error;
  }
}

async function step3_queryStatus(taskId) {
  console.log('\n🔍 步骤 3: 查询任务状态...');

  const apiUrl = `${OPENAI_API_BASE_URL}/tasks/${taskId}`;

  try {
    const response = await axios.get(
      apiUrl,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        timeout: 10000,
      }
    );

    console.log('✅ 任务状态查询成功！');
    console.log('   状态:', response.data.task?.status || response.data.state);
    console.log('   进度:', response.data.task?.progressRatio || 'N/A');

    return response.data;
  } catch (error) {
    console.error('❌ 状态查询失败:', error.message);
    throw error;
  }
}

async function main() {
  try {
    // 步骤 1: 上传视频
    const videoUrl = await step1_uploadToSupabase();

    // 步骤 2: 提交任务
    const task = await step2_submitToGateway(videoUrl);

    // 步骤 3: 查询状态
    if (task.id) {
      await step3_queryStatus(task.id);
    }

    console.log('\n========================================');
    console.log('✅ 完整流程测试通过！');
    console.log('========================================');
    console.log('\n💡 使用说明:');
    console.log('   1. 在前端设置中配置:');
    console.log(`      - OPENAI_API_BASE_URL: ${OPENAI_API_BASE_URL}`);
    console.log(`      - OPENAI_API_KEY: ${OPENAI_API_KEY}`);
    console.log('   2. 前端会自动使用这些配置连接网关');
    console.log('   3. 无需配置后端环境变量');
    console.log(`\n   任务 ID: ${task.id}`);
    console.log(`   查询命令: curl -H "Authorization: Bearer ${OPENAI_API_KEY}" ${OPENAI_API_BASE_URL}/tasks/${task.id}`);

  } catch (error) {
    console.log('\n========================================');
    console.log('❌ 测试失败');
    console.log('========================================');
    process.exit(1);
  }
}

main();
