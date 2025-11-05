/**
 * Runway Video2Video 网关测试脚本
 * 测试连接: http://localhost:3000
 * API Key: sk-xHO8wq8Sj3l8k9tp8r3e4zCJQXTanh5bpGl8018zQEm9TaAc
 */

const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 网关配置
const GATEWAY_URL = 'http://localhost:3000';
const API_KEY = 'sk-xHO8wq8Sj3l8k9tp8r3e4zCJQXTanh5bpGl8018zQEm9TaAc';

/**
 * 获取测试视频文件路径
 */
function getTestVideoPath() {
  // 使用指定的测试视频
  const testVideoPath = '/Users/g/Downloads/general-3-2025-10-30T09_36_54Z.mp4';

  // 检查文件是否存在
  if (fs.existsSync(testVideoPath)) {
    console.log('✅ 找到测试视频:', testVideoPath);
    return testVideoPath;
  }

  console.log('❌ 测试视频不存在:', testVideoPath);
  return null;
}

/**
 * 测试 Runway video2video 接口
 */
async function testRunwayVideo2Video() {
  console.log('🎬 开始测试 Runway Video2Video');
  console.log('网关地址:', GATEWAY_URL);
  console.log('API Key:', API_KEY.substring(0, 20) + '...');
  console.log('---');

  // 1. 准备测试视频
  const videoPath = getTestVideoPath();
  if (!videoPath) {
    console.error('❌ 无法找到测试视频文件');
    process.exit(1);
  }

  // 2. 构建 FormData（NewAPI 标准格式）
  const formData = new FormData();
  const videoStream = fs.createReadStream(videoPath);
  const stats = fs.statSync(videoPath);

  // 视频文件
  formData.append('file', videoStream, {
    filename: 'test-video.mp4',
    contentType: 'video/mp4',
  });

  // 模型名称（使用 runway-video2video）
  formData.append('model', 'runway-video2video');

  // 提示词
  formData.append('prompt', 'Transform this video into a beautiful watercolor painting style');

  // 额外参数（可选）
  formData.append('structure_transformation', '0.5');
  formData.append('flip', 'false');

  console.log('📤 准备发送请求:');
  console.log('  - 端点: /v1/video/generations');
  console.log('  - 视频文件:', path.basename(videoPath));
  console.log('  - 文件大小:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
  console.log('  - 模型: runway-video2video');
  console.log('  - 提示词: Transform this video into a beautiful watercolor painting style');
  console.log('  - 结构改造强度: 0.5');
  console.log('---');

  try {
    // 3. 发送请求到网关（使用 NewAPI 标准端点）
    const response = await axios.post(
      `${GATEWAY_URL}/v1/video/generations`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'multipart/form-data',
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 60000, // 60秒超时
      }
    );

    console.log('✅ 请求成功！');
    console.log('📋 响应状态:', response.status);
    console.log('📋 响应数据:');
    console.log(JSON.stringify(response.data, null, 2));

    // 4. 检查任务 ID
    const taskId = response.data.task?.id || response.data.id;
    if (taskId) {
      console.log('---');
      console.log('🎯 任务已创建，任务 ID:', taskId);
      console.log('💡 可以使用以下命令查询任务状态:');
      console.log(`   curl -H "Authorization: Bearer ${API_KEY}" ${GATEWAY_URL}/tasks/${taskId}`);
    }

    return response.data;

  } catch (error) {
    console.error('❌ 请求失败:');

    if (error.response) {
      // 服务器返回错误响应
      console.error('状态码:', error.response.status);
      console.error('错误数据:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // 请求已发送但没有收到响应
      console.error('无响应:', error.message);
      console.error('可能原因:');
      console.error('  1. 网关服务未启动 (http://localhost:3000)');
      console.error('  2. 网络连接问题');
      console.error('  3. 防火墙阻止');
    } else {
      // 其他错误
      console.error('错误:', error.message);
    }

    throw error;
  }
}

/**
 * 测试网关连通性
 */
async function testGatewayConnection() {
  console.log('🔍 测试网关连通性...');

  try {
    const response = await axios.get(`${GATEWAY_URL}/`, {
      timeout: 5000,
      validateStatus: () => true, // 接受所有状态码
    });

    console.log('✅ 网关可访问');
    console.log('状态码:', response.status);
    return true;
  } catch (error) {
    console.error('❌ 无法连接到网关');
    console.error('错误:', error.message);
    return false;
  }
}

// 主函数
async function main() {
  console.log('========================================');
  console.log('   Runway Video2Video 网关测试');
  console.log('========================================');
  console.log('');

  // 先测试网关连通性
  const isConnected = await testGatewayConnection();
  if (!isConnected) {
    console.error('');
    console.error('❌ 请确保网关服务正在运行:');
    console.error('   网关地址: http://localhost:3000');
    process.exit(1);
  }

  console.log('---');

  // 执行 video2video 测试
  try {
    await testRunwayVideo2Video();
    console.log('');
    console.log('========================================');
    console.log('✅ 测试完成');
    console.log('========================================');
  } catch (error) {
    console.log('');
    console.log('========================================');
    console.log('❌ 测试失败');
    console.log('========================================');
    process.exit(1);
  }
}

// 运行测试
main();
