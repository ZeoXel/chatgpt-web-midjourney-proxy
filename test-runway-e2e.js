/**
 * Runway Video2Video 端到端测试
 * 测试完整流程：上传视频到 Supabase → 调用后端 API → 网关处理
 */

const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 配置
const BACKEND_URL = 'http://localhost:3002'; // 后端服务地址
const GATEWAY_URL = 'http://localhost:3000'; // 网关地址
const API_KEY = 'sk-xHO8wq8Sj3l8k9tp8r3e4zCJQXTanh5bpGl8018zQEm9TaAc';
const VIDEO_PATH = '/Users/g/Downloads/general-3-2025-10-30T09_36_54Z.mp4';

/**
 * 步骤 1: 上传视频到 Supabase
 */
async function uploadVideoToSupabase() {
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
        timeout: 120000, // 2分钟超时
      }
    );

    if (response.data.success) {
      console.log('✅ 视频上传成功！');
      console.log('   URL:', response.data.url);
      console.log('   Bucket:', response.data.bucket);
      console.log('   Size:', (response.data.size / 1024 / 1024).toFixed(2), 'MB');
      return response.data.url;
    } else {
      throw new Error(response.data.error || '上传失败');
    }
  } catch (error) {
    console.error('❌ Supabase 上传失败:');
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   错误:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   错误:', error.message);
    }
    throw error;
  }
}

/**
 * 步骤 2: 调用后端 API 提交 video2video 任务
 */
async function submitVideo2VideoTask(videoUrl) {
  console.log('\n🎬 步骤 2: 提交 video2video 任务...');

  const payload = {
    model: 'runway-video2video',
    prompt: 'Transform this video into a beautiful watercolor painting style',
    video_url: videoUrl,
    structure_transformation: 0.5,
    flip: false,
  };

  console.log('   请求数据:', JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(
      `${BACKEND_URL}/runway/v1/video/generations`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    console.log('✅ 任务提交成功！');
    console.log('   任务 ID:', response.data.id);
    console.log('   状态:', response.data.state);
    console.log('   创建时间:', response.data.created_at);
    console.log('   完整响应:', JSON.stringify(response.data, null, 2));

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

/**
 * 步骤 3: 查询任务状态
 */
async function queryTaskStatus(taskId) {
  console.log('\n🔍 步骤 3: 查询任务状态...');

  try {
    const response = await axios.get(
      `${GATEWAY_URL}/tasks/${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
        timeout: 10000,
      }
    );

    console.log('✅ 任务状态查询成功！');
    console.log('   状态:', response.data.task?.status || response.data.state);
    console.log('   完整响应:', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('❌ 任务状态查询失败:');
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   错误:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   错误:', error.message);
    }
    throw error;
  }
}

/**
 * 主测试流程
 */
async function main() {
  console.log('========================================');
  console.log('   Runway Video2Video 端到端测试');
  console.log('========================================\n');

  console.log('配置信息:');
  console.log('  - 后端服务:', BACKEND_URL);
  console.log('  - 网关地址:', GATEWAY_URL);
  console.log('  - 测试视频:', VIDEO_PATH);
  console.log('');

  try {
    // 步骤 1: 上传视频
    const videoUrl = await uploadVideoToSupabase();

    // 步骤 2: 提交任务
    const task = await submitVideo2VideoTask(videoUrl);

    // 步骤 3: 查询任务状态
    if (task.id) {
      await queryTaskStatus(task.id);
    }

    console.log('\n========================================');
    console.log('✅ 端到端测试完成！');
    console.log('========================================');
    console.log('\n💡 后续操作:');
    console.log(`   - 查询任务状态: curl -H "Authorization: Bearer ${API_KEY}" ${GATEWAY_URL}/tasks/${task.id}`);
    console.log(`   - 任务 ID: ${task.id}`);

  } catch (error) {
    console.log('\n========================================');
    console.log('❌ 端到端测试失败');
    console.log('========================================');
    process.exit(1);
  }
}

// 运行测试
main();
