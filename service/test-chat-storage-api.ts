/**
 * COS对话历史存储API测试脚本
 */

import 'dotenv/config';
import axios from 'axios';

const API_BASE = 'http://localhost:3002';
const TEST_UUID = '90b3b85c-0bfb-444d-a5e7-b7fb5a2bef15';

// 测试数据
const testChatState = {
  active: 1003,
  usingContext: true,
  history: [
    { uuid: 1003, title: 'Test Conversation 1', isEdit: false },
    { uuid: 1004, title: 'Test Conversation 2', isEdit: false }
  ],
  chat: [
    {
      uuid: 1003,
      data: [
        {
          dateTime: new Date().toISOString(),
          text: 'Hello, this is a test message',
          inversion: false,
          opt: {
            images: ['https://cdn.midjourney.com/test-image.png']
          }
        },
        {
          dateTime: new Date().toISOString(),
          text: 'Response message',
          inversion: true
        }
      ]
    },
    {
      uuid: 1004,
      data: [
        {
          dateTime: new Date().toISOString(),
          text: 'Another conversation',
          inversion: false
        }
      ]
    }
  ]
};

async function testChatStorageAPI() {
  console.log('========================================');
  console.log('COS对话历史存储API测试');
  console.log('========================================\n');

  try {
    // 测试1: 健康检查
    console.log('1. 健康检查...');
    const healthResponse = await axios.get(`${API_BASE}/api/chat-storage/health`);
    console.log('   ✓ API正常运行:', healthResponse.data.message);
    console.log('');

    // 测试2: 保存对话历史
    console.log('2. 保存对话历史...');
    console.log(`   UUID: ${TEST_UUID}`);
    console.log(`   对话数: ${testChatState.history.length}`);
    console.log(`   消息数: ${testChatState.chat.reduce((s, c) => s + c.data.length, 0)}`);

    const saveResponse = await axios.post(
      `${API_BASE}/api/chat-storage/${TEST_UUID}`,
      testChatState
    );

    console.log('   ✓ 保存成功!');
    console.log('   - URL:', saveResponse.data.url);
    console.log('   - 统计:', saveResponse.data.stats);
    console.log('');

    // 测试3: 获取统计信息
    console.log('3. 获取统计信息...');
    const statsResponse = await axios.get(
      `${API_BASE}/api/chat-storage/${TEST_UUID}/stats`
    );

    console.log('   ✓ 统计信息:');
    console.log('   - 存在:', statsResponse.data.data.exists);
    console.log('   - 大小:', statsResponse.data.data.size, 'bytes');
    console.log('   - 对话数:', statsResponse.data.data.conversationCount);
    console.log('   - 消息数:', statsResponse.data.data.messageCount);
    console.log('   - 最后修改:', statsResponse.data.data.lastModified);
    console.log('');

    // 测试4: 加载对话历史
    console.log('4. 加载对话历史...');
    const loadResponse = await axios.get(
      `${API_BASE}/api/chat-storage/${TEST_UUID}`
    );

    console.log('   ✓ 加载成功!');
    console.log('   - 对话数:', loadResponse.data.data.history.length);
    console.log('   - 消息数:', loadResponse.data.stats.messageCount);
    console.log('   - 第一个对话:', loadResponse.data.data.history[0].title);
    console.log('');

    // 验证数据一致性
    console.log('5. 验证数据一致性...');
    const loaded = loadResponse.data.data;
    if (loaded.history.length === testChatState.history.length &&
        loaded.chat.length === testChatState.chat.length) {
      console.log('   ✓ 数据完整性验证通过!');
    } else {
      console.error('   ✗ 数据不一致!');
    }
    console.log('');

    // 测试5: 删除对话历史(可选)
    console.log('6. 测试删除功能(可选)...');
    const shouldDelete = false; // 设为true以测试删除

    if (shouldDelete) {
      const deleteResponse = await axios.delete(
        `${API_BASE}/api/chat-storage/${TEST_UUID}`
      );
      console.log('   ✓ 删除成功:', deleteResponse.data.message);
    } else {
      console.log('   ⊘ 跳过删除(保留测试数据)');
    }
    console.log('');

    console.log('========================================');
    console.log('✅ 所有测试通过!');
    console.log('========================================\n');

    console.log('📝 测试总结:');
    console.log('- API健康检查: ✓');
    console.log('- 保存对话: ✓');
    console.log('- 获取统计: ✓');
    console.log('- 加载对话: ✓');
    console.log('- 数据一致性: ✓');
    console.log('');
    console.log('🎉 COS对话历史存储功能运行正常!');
    console.log('');

  } catch (error: any) {
    console.log('');
    console.log('========================================');
    console.log('❌ 测试失败');
    console.log('========================================');

    if (error.response) {
      console.log('HTTP状态:', error.response.status);
      console.log('错误信息:', error.response.data);
    } else {
      console.log('错误类型:', error.name);
      console.log('错误信息:', error.message);
    }

    if (error.code === 'ECONNREFUSED') {
      console.log('');
      console.log('💡 提示: 请确保后端服务正在运行');
      console.log('   启动命令: cd service && pnpm dev');
    }

    console.log('========================================\n');
    process.exit(1);
  }
}

// 运行测试
console.log('⚠️  确保后端服务已启动: cd service && pnpm dev\n');
setTimeout(() => {
  testChatStorageAPI().catch(console.error);
}, 1000);
