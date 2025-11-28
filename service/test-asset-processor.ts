/**
 * 资产处理功能测试脚本
 */

import { AssetProcessor } from './src/storage/asset-processor';

async function testAssetProcessor() {
  console.log('========================================');
  console.log('资产处理功能测试');
  console.log('========================================\n');

  const processor = new AssetProcessor();
  const testUuid = '90b3b85c-0bfb-444d-a5e7-b7fb5a2bef15';

  // 测试1: 单个资产处理
  console.log('测试1: 处理单个图片URL');
  console.log('----------------------------------------');
  const testImageUrl = 'https://via.placeholder.com/300x200.png';

  try {
    const result = await processor.processAssetUrl(testUuid, testImageUrl);
    console.log('✅ 处理结果:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ 处理失败:', error);
  }

  console.log('\n');

  // 测试2: 批量处理
  console.log('测试2: 批量处理多个资产');
  console.log('----------------------------------------');
  const testUrls = [
    'https://via.placeholder.com/400x300.jpg',
    'https://via.placeholder.com/500x400.png',
    'https://via.placeholder.com/600x400.webp',
  ];

  try {
    const batchResult = await processor.processAssetUrls(testUuid, testUrls);
    console.log('✅ 批量处理结果:');
    console.log(`  成功: ${batchResult.processed}`);
    console.log(`  失败: ${batchResult.failed}`);
    console.log(`  资产列表:`);
    batchResult.assets.forEach((asset, index) => {
      console.log(`    ${index + 1}. ${asset.type} - ${asset.error ? '❌' : '✅'}`);
      console.log(`       原始: ${asset.originalUrl}`);
      console.log(`       COS: ${asset.cosUrl}`);
    });
  } catch (error) {
    console.error('❌ 批量处理失败:', error);
  }

  console.log('\n');

  // 测试3: ChatState处理
  console.log('测试3: 处理完整的ChatState');
  console.log('----------------------------------------');
  const testChatState = {
    active: 1003,
    usingContext: true,
    history: [
      { uuid: 1003, title: '测试对话', isEdit: false }
    ],
    chat: [
      {
        uuid: 1003,
        data: [
          {
            dateTime: new Date().toISOString(),
            text: '生成的图片',
            inversion: false,
            opt: {
              imageUrl: 'https://via.placeholder.com/800x600.jpg',
              images: [
                'https://via.placeholder.com/200x200.png',
                'https://via.placeholder.com/300x300.png',
              ],
              videoUrls: [
                { url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4' }
              ]
            }
          },
          {
            dateTime: new Date().toISOString(),
            text: '另一条消息',
            inversion: true,
            logo: 'https://via.placeholder.com/50x50.png'
          }
        ]
      }
    ]
  };

  try {
    console.log('原始ChatState:');
    console.log(JSON.stringify(testChatState, null, 2));
    console.log('\n开始处理...\n');

    const chatResult = await processor.processChatState(testUuid, testChatState);

    console.log('✅ ChatState处理完成:');
    console.log(`  成功: ${chatResult.processed}`);
    console.log(`  失败: ${chatResult.failed}`);

    console.log('\n处理后的ChatState:');
    console.log(JSON.stringify(testChatState, null, 2));

    // 验证URL是否被替换
    console.log('\n✅ URL替换验证:');
    const message = testChatState.chat[0].data[0];
    console.log(`  imageUrl: ${message.opt?.imageUrl?.includes('cos.') ? '✅ 已替换' : '❌ 未替换'}`);
    console.log(`  images[0]: ${message.opt?.images?.[0]?.includes('cos.') ? '✅ 已替换' : '❌ 未替换'}`);
    console.log(`  videoUrls[0]: ${message.opt?.videoUrls?.[0]?.url?.includes('cos.') ? '✅ 已替换' : '❌ 未替换'}`);

    const message2 = testChatState.chat[0].data[1];
    console.log(`  logo: ${message2.logo?.includes('cos.') ? '✅ 已替换' : '❌ 未替换'}`);

  } catch (error) {
    console.error('❌ ChatState处理失败:', error);
  }

  console.log('\n');

  // 测试4: 缓存功能
  console.log('测试4: 测试URL缓存');
  console.log('----------------------------------------');
  const cacheStats = processor.getCacheStats();
  console.log('缓存统计:');
  console.log(`  缓存条目数: ${cacheStats.size}`);
  console.log(`  前10条:`);
  cacheStats.entries.forEach(([original, cos], index) => {
    console.log(`    ${index + 1}. ${original.substring(0, 50)}...`);
    console.log(`       -> ${cos.substring(0, 80)}...`);
  });

  console.log('\n========================================');
  console.log('测试完成！');
  console.log('========================================');
}

// 运行测试
testAssetProcessor().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
