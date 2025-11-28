/**
 * 查看对话详细内容
 */

import dotenv from 'dotenv';
import { resolve } from 'path';
import { ChatStorageService } from './src/storage/chat-storage';

// 加载环境变量
dotenv.config({ path: resolve(__dirname, '../.env') });

const UUID = '90b3b85c-0bfb-444d-a5e7-b7fb5a2bef15'; // 测试UUID

async function main() {
  console.log('========================================');
  console.log('对话内容详细查看');
  console.log('========================================\n');

  const chatStorage = new ChatStorageService();

  try {
    console.log(`📥 正在加载 UUID: ${UUID} 的对话...\n`);

    const chatState = await chatStorage.loadConversations(UUID);

    if (!chatState) {
      console.log('❌ 未找到对话数据');
      return;
    }

    console.log('✅ 对话加载成功!\n');
    console.log('═'.repeat(60));
    console.log('📊 对话统计:');
    console.log('═'.repeat(60));
    console.log(`当前激活对话: ${chatState.active}`);
    console.log(`使用上下文: ${chatState.usingContext ? '是' : '否'}`);
    console.log(`对话总数: ${chatState.history.length}`);
    console.log(`消息总数: ${chatState.chat.reduce((sum, c) => sum + c.data.length, 0)}`);
    console.log('');

    // 显示所有对话
    console.log('═'.repeat(60));
    console.log('💬 对话列表:');
    console.log('═'.repeat(60));

    chatState.history.forEach((history, index) => {
      console.log(`\n${index + 1}. "${history.title}"`);
      console.log(`   UUID: ${history.uuid}`);
      console.log(`   编辑状态: ${history.isEdit ? '编辑中' : '已完成'}`);

      // 找到对应的消息
      const conversation = chatState.chat.find(c => c.uuid === history.uuid);
      if (conversation) {
        console.log(`   消息数量: ${conversation.data.length}`);

        // 显示消息内容
        console.log(`   消息内容:`);
        conversation.data.forEach((msg, msgIdx) => {
          const prefix = msg.inversion ? '👤 用户' : '🤖 助手';
          const time = new Date(msg.dateTime).toLocaleString('zh-CN');

          console.log(`\n      ${msgIdx + 1}. ${prefix} [${time}]`);

          // 显示文本内容 (限制长度)
          const text = msg.text || '';
          const displayText = text.length > 100 ? text.substring(0, 100) + '...' : text;
          console.log(`         ${displayText.replace(/\n/g, '\n         ')}`);

          // 显示模型信息
          if (msg.model) {
            console.log(`         模型: ${msg.model}`);
          }

          // 显示 logo
          if (msg.logo) {
            const logoType = msg.logo.includes('cos.') || msg.logo.includes('cos.lsaigc.com')
              ? '✅ COS URL'
              : '🔗 外部URL';
            console.log(`         Logo: ${logoType}`);
            console.log(`         ${msg.logo.substring(0, 80)}...`);
          }

          // 显示 opt 信息
          if (msg.opt) {
            const opt = msg.opt;

            if (opt.imageUrl) {
              const urlType = opt.imageUrl.includes('cos.') || opt.imageUrl.includes('cos.lsaigc.com')
                ? '✅ COS URL'
                : '🔗 外部URL';
              console.log(`         图片: ${urlType}`);
              console.log(`         ${opt.imageUrl.substring(0, 80)}...`);
            }

            if (opt.images && opt.images.length > 0) {
              console.log(`         图片数组: ${opt.images.length} 个`);
              opt.images.forEach((url: string, i: number) => {
                const urlType = url.includes('cos.') || url.includes('cos.lsaigc.com')
                  ? '✅ COS'
                  : '🔗 外部';
                console.log(`           ${i + 1}. ${urlType}: ${url.substring(0, 60)}...`);
              });
            }

            if (opt.videoUrls && opt.videoUrls.length > 0) {
              console.log(`         视频数组: ${opt.videoUrls.length} 个`);
              opt.videoUrls.forEach((v: any, i: number) => {
                const urlType = v.url.includes('cos.') || v.url.includes('cos.lsaigc.com')
                  ? '✅ COS'
                  : '🔗 外部';
                console.log(`           ${i + 1}. ${urlType}: ${v.url.substring(0, 60)}...`);
              });
            }

            if (opt.status) {
              console.log(`         状态: ${opt.status}`);
            }

            if (opt.progress) {
              console.log(`         进度: ${opt.progress}`);
            }
          }

          // 显示错误信息
          if (msg.error) {
            console.log(`         ❌ 错误消息`);
          }

          // 显示加载状态
          if (msg.loading) {
            console.log(`         ⏳ 加载中...`);
          }
        });
      } else {
        console.log(`   ⚠️  未找到对应的消息数据`);
      }
    });

    // 统计资产URL
    console.log('\n\n═'.repeat(60));
    console.log('🔗 资产URL统计:');
    console.log('═'.repeat(60));

    let totalCosUrls = 0;
    let totalExternalUrls = 0;
    const cosUrlExamples: string[] = [];
    const externalUrlExamples: string[] = [];

    chatState.chat.forEach(conv => {
      conv.data.forEach(msg => {
        const checkUrl = (url: string) => {
          if (url.includes('cos.') || url.includes('cos.lsaigc.com')) {
            totalCosUrls++;
            if (cosUrlExamples.length < 3) {
              cosUrlExamples.push(url);
            }
          } else if (url.startsWith('http')) {
            totalExternalUrls++;
            if (externalUrlExamples.length < 3) {
              externalUrlExamples.push(url);
            }
          }
        };

        if (msg.logo) checkUrl(msg.logo);

        if (msg.opt) {
          if (msg.opt.imageUrl) checkUrl(msg.opt.imageUrl);
          if (msg.opt.images) msg.opt.images.forEach(checkUrl);
          if (msg.opt.videoUrls) msg.opt.videoUrls.forEach((v: any) => checkUrl(v.url));
          if (msg.opt.imageUrls) msg.opt.imageUrls.forEach((v: any) => checkUrl(v.url));
        }
      });
    });

    console.log(`\n✅ COS URLs: ${totalCosUrls} 个`);
    if (cosUrlExamples.length > 0) {
      console.log(`   示例:`);
      cosUrlExamples.forEach((url, i) => {
        console.log(`   ${i + 1}. ${url}`);
      });
    }

    console.log(`\n🔗 外部URLs: ${totalExternalUrls} 个`);
    if (externalUrlExamples.length > 0) {
      console.log(`   示例:`);
      externalUrlExamples.forEach((url, i) => {
        console.log(`   ${i + 1}. ${url}`);
      });
    }

    // 数据完整性检查
    console.log('\n\n═'.repeat(60));
    console.log('✅ 数据完整性检查:');
    console.log('═'.repeat(60));

    const issues: string[] = [];

    // 检查对话和消息的一致性
    const historyUuids = new Set(chatState.history.map(h => h.uuid));
    const chatUuids = new Set(chatState.chat.map(c => c.uuid));

    historyUuids.forEach(uuid => {
      if (!chatUuids.has(uuid)) {
        issues.push(`⚠️  对话 ${uuid} 在 history 中但缺少消息数据`);
      }
    });

    chatUuids.forEach(uuid => {
      if (!historyUuids.has(uuid)) {
        issues.push(`⚠️  对话 ${uuid} 有消息数据但不在 history 中`);
      }
    });

    // 检查消息完整性
    chatState.chat.forEach(conv => {
      conv.data.forEach((msg, idx) => {
        if (!msg.dateTime) {
          issues.push(`⚠️  对话 ${conv.uuid} 消息 ${idx} 缺少时间戳`);
        }
        if (msg.text === undefined || msg.text === null) {
          issues.push(`⚠️  对话 ${conv.uuid} 消息 ${idx} 缺少文本内容`);
        }
      });
    });

    if (issues.length === 0) {
      console.log('\n✅ 数据完整性检查通过，没有发现问题！');
    } else {
      console.log(`\n发现 ${issues.length} 个问题:`);
      issues.forEach(issue => console.log(`  ${issue}`));
    }

    console.log('\n\n✅ 对话详情查看完成!');
    console.log('═'.repeat(60));

  } catch (error: any) {
    console.error('❌ 加载失败:', error.message);
    console.error(error);
  }
}

main().catch(console.error);
