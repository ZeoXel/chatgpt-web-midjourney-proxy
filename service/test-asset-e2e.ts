/**
 * 端到端资产处理测试 - 使用真实API
 */

async function testAssetProcessingEndToEnd() {
  console.log('========================================');
  console.log('端到端资产处理测试');
  console.log('========================================\n');

  const API_BASE = 'http://localhost:3002/api';
  const TEST_UUID = '90b3b85c-0bfb-444d-a5e7-b7fb5a2bef15';

  // 使用 httpbin.org 的图片（可靠的测试服务）
  const testChatState = {
    active: 2001,
    usingContext: true,
    history: [
      { uuid: 2001, title: '资产测试对话', isEdit: false }
    ],
    chat: [
      {
        uuid: 2001,
        data: [
          {
            dateTime: new Date().toISOString(),
            text: '这是一个包含外部图片的消息',
            inversion: false,
            opt: {
              // 使用 httpbin.org 的 image endpoint (返回PNG)
              imageUrl: 'https://httpbin.org/image/png',
              images: [
                'https://httpbin.org/image/jpeg',
              ]
            }
          },
          {
            dateTime: new Date().toISOString(),
            text: '这是另一个消息',
            inversion: true,
            // GitHub 的 logo (小图片)
            logo: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
          }
        ]
      }
    ]
  };

  console.log('原始ChatState:');
  console.log(JSON.stringify(testChatState, null, 2));
  console.log('\n');

  try {
    console.log(`📤 发送保存请求到: ${API_BASE}/chat-storage/${TEST_UUID}`);

    const response = await fetch(`${API_BASE}/chat-storage/${TEST_UUID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testChatState)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const saveResult = await response.json();
    console.log('✅ 保存成功:', saveResult);
    console.log('\n');

    // 等待一下
    console.log('⏳ 等待2秒...\n');
    await new Promise(r => setTimeout(r, 2000));

    // 加载回来验证
    console.log(`📥 从COS加载数据: ${API_BASE}/chat-storage/${TEST_UUID}`);

    const loadResponse = await fetch(`${API_BASE}/chat-storage/${TEST_UUID}`);
    if (!loadResponse.ok) {
      throw new Error(`HTTP ${loadResponse.status}: ${await loadResponse.text()}`);
    }

    const loadResult = await loadResponse.json();
    const loadedState = loadResult.data;

    console.log('\n加载的ChatState:');
    console.log(JSON.stringify(loadedState, null, 2));
    console.log('\n');

    // 验证URL替换
    console.log('========================================');
    console.log('🔍 URL替换验证');
    console.log('========================================');

    const message1 = loadedState.chat?.[0]?.data?.[0];
    const message2 = loadedState.chat?.[0]?.data?.[1];

    if (message1?.opt?.imageUrl) {
      const isCOS = message1.opt.imageUrl.includes('cos.') || message1.opt.imageUrl.includes('lsaigc');
      console.log(`✅ imageUrl: ${isCOS ? '✅ 已替换为COS' : '⚠️ 未替换'}`);
      console.log(`   原始: https://httpbin.org/image/png`);
      console.log(`   当前: ${message1.opt.imageUrl}`);
    }

    if (message1?.opt?.images?.[0]) {
      const isCOS = message1.opt.images[0].includes('cos.') || message1.opt.images[0].includes('lsaigc');
      console.log(`✅ images[0]: ${isCOS ? '✅ 已替换为COS' : '⚠️ 未替换'}`);
      console.log(`   原始: https://httpbin.org/image/jpeg`);
      console.log(`   当前: ${message1.opt.images[0]}`);
    }

    if (message2?.logo) {
      const isCOS = message2.logo.includes('cos.') || message2.logo.includes('lsaigc');
      console.log(`✅ logo: ${isCOS ? '✅ 已替换为COS' : '⚠️ 未替换'}`);
      console.log(`   原始: https://github.githubassets.com/...`);
      console.log(`   当前: ${message2.logo}`);
    }

    console.log('\n========================================');
    console.log('✅ 测试完成！');
    console.log('========================================');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testAssetProcessingEndToEnd().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
