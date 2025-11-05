/**
 * Runway Video2Video 生产环境完整测试
 * 使用正确的 endpoint: /runway/v1/pro/video2video
 */

const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 生产环境配置
const GATEWAY_URL = 'https://api.bltcy.ai';
const API_KEY = 'sk-JO438PQ5WpZFtR9Gt5tMN119FmD1bG6YDtmczNgGyDIMCHc1';
const BACKEND_URL = 'http://localhost:3002';
const VIDEO_PATH = '/Users/g/Downloads/general-3-2025-10-30T09_36_54Z.mp4';

console.log('========================================');
console.log('   Runway Video2Video 生产环境测试');
console.log('========================================\n');

console.log('配置信息:');
console.log('  - 网关地址:', GATEWAY_URL);
console.log('  - API Key:', API_KEY.substring(0, 20) + '...');
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

async function step2_submitRunwayTask(videoUrl) {
  console.log('\n🎬 步骤 2: 提交 Runway video2video 任务...');

  const payload = {
    model: 'runway-video2video',
    prompt: 'Transform this video into a beautiful watercolor painting style, artistic and dreamy',
    video_url: videoUrl,
    structure_transformation: 0.5,
    flip: false,
  };

  // 使用正确的 Runway endpoint
  const apiUrl = `${GATEWAY_URL}/runway/v1/pro/video2video`;

  console.log('   请求 URL:', apiUrl);
  console.log('   Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(
      apiUrl,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    console.log('\n✅ 任务提交成功！');
    console.log('   响应码:', response.data.code);
    console.log('   任务 ID:', response.data.data?.task_id);
    console.log('   执行时间:', response.data.exec_time, '秒');
    console.log('   完整响应:', JSON.stringify(response.data, null, 2));

    return response.data.data?.task_id;
  } catch (error) {
    console.error('\n❌ 任务提交失败:');
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   错误:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   错误:', error.message);
    }
    throw error;
  }
}

async function step3_queryTaskStatus(taskId) {
  console.log('\n🔍 步骤 3: 查询任务状态...');

  // 尝试不同的查询路径
  const queryUrls = [
    `${GATEWAY_URL}/runway/tasks/${taskId}`,
    `${GATEWAY_URL}/tasks/${taskId}`,
    `${GATEWAY_URL}/runway/v1/tasks/${taskId}`,
  ];

  for (const url of queryUrls) {
    console.log(`\n尝试查询: ${url}`);
    try {
      const response = await axios.get(
        url,
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
          },
          timeout: 10000,
        }
      );

      console.log('✅ 查询成功！');
      console.log('响应:', JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      if (error.response) {
        console.log(`❌ 失败 (${error.response.status}):`, error.response.data?.error?.message || error.response.data);
      } else {
        console.log('❌ 失败:', error.message);
      }
    }
  }

  console.log('\n⚠️ 所有查询路径都失败了');
  return null;
}

async function main() {
  try {
    // 步骤 1: 上传视频
    const videoUrl = await step1_uploadToSupabase();

    // 步骤 2: 提交任务
    const taskId = await step2_submitRunwayTask(videoUrl);

    // 步骤 3: 查询状态
    if (taskId) {
      await step3_queryTaskStatus(taskId);
    }

    console.log('\n========================================');
    console.log('✅ 测试完成！');
    console.log('========================================');
    console.log('\n💡 前端配置:');
    console.log(`   OPENAI_API_BASE_URL: ${GATEWAY_URL}`);
    console.log(`   OPENAI_API_KEY: ${API_KEY}`);
    console.log('\n💡 关键发现:');
    console.log('   - 正确的 endpoint: /runway/v1/pro/video2video');
    console.log('   - 错误的 endpoint: /v1/video/generations (会被识别为 luma)');
    console.log(`   - 任务 ID: ${taskId}`);

  } catch (error) {
    console.log('\n========================================');
    console.log('❌ 测试失败');
    console.log('========================================');
    process.exit(1);
  }
}

main();
