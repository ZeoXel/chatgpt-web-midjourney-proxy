/**
 * 诊断 Runway Video2Video 参数传递
 * 对比不同参数组合的效果
 */

const axios = require('axios');

const GATEWAY_URL = 'http://localhost:3000';
const API_KEY = 'sk-xHO8wq8Sj3l8k9tp8r3e4zCJQXTanh5bpGl8018zQEm9TaAc';
const SUPABASE_VIDEO = 'https://lxxbjwxwujcpgqfoquvv.supabase.co/storage/v1/object/public/runway-videos/2025-11-04/1762245395826-hiag7e.mp4';

console.log('========================================');
console.log('   Runway 参数诊断');
console.log('========================================\n');

async function testWithParams(testName, payload) {
  console.log(`\n📋 测试: ${testName}`);
  console.log('参数:', JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(
      `${GATEWAY_URL}/runway/v1/pro/video2video`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    console.log('✅ 提交成功');
    console.log('任务 ID:', response.data.data?.task_id);
    return response.data.data?.task_id;
  } catch (error) {
    console.error('❌ 提交失败');
    if (error.response) {
      console.error('错误:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return null;
  }
}

async function checkTask(taskId) {
  if (!taskId) return;

  console.log('\n等待 15 秒...');
  await new Promise(resolve => setTimeout(resolve, 15000));

  try {
    const response = await axios.post(
      `${GATEWAY_URL}/runway/v1/feed`,
      { task_id: taskId },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.data.data;
    console.log('\n📊 任务状态:');
    console.log('  Status:', data.status, '(' + data.state + ')');
    console.log('  Prompt:', data.prompt);

    // 关键：检查输入视频来源
    if (data.raw_video_url) {
      console.log('  输入视频:', data.raw_video_url.substring(0, 80) + '...');

      if (data.raw_video_url.includes('supabase')) {
        console.log('  ✅ 来自 Supabase');
      } else if (data.raw_video_url.includes('cloudfront')) {
        console.log('  ⚠️  来自 Runway CDN (网关已转换)');
      }
    } else {
      console.log('  ❌ 未找到输入视频 URL');
    }

    if (data.video_url) {
      console.log('  输出视频:', data.video_url.substring(0, 80) + '...');
    }
  } catch (error) {
    console.error('查询失败:', error.message);
  }
}

async function main() {
  // 测试 1: 完整参数（当前实现）
  const task1 = await testWithParams('完整参数', {
    model: 'runway-video2video',
    prompt: 'Test with full parameters - add rainbow in the sky',
    video_url: SUPABASE_VIDEO,
    structure_transformation: 0.3,
    flip: false
  });

  // 测试 2: 最小参数
  const task2 = await testWithParams('最小参数', {
    model: 'runway-video2video',
    prompt: 'Test with minimal parameters - add stars',
    video_url: SUPABASE_VIDEO
  });

  // 测试 3: 尝试不同的参数名
  const task3 = await testWithParams('尝试 input_video', {
    model: 'runway-video2video',
    prompt: 'Test with input_video parameter',
    input_video: SUPABASE_VIDEO,
    video_url: SUPABASE_VIDEO
  });

  console.log('\n========================================');
  console.log('等待任务处理...');
  console.log('========================================');

  // 检查第一个任务
  if (task1) {
    console.log('\n\n🔍 检查测试 1:');
    await checkTask(task1);
  }

  console.log('\n========================================');
  console.log('诊断完成');
  console.log('========================================');
  console.log('\n💡 建议:');
  console.log('1. 检查网关是否能访问 Supabase URL');
  console.log('2. 确认 video_url 参数名称是否正确');
  console.log('3. 查看网关日志确认视频下载情况');
}

main();
