/**
 * COS 数据检查脚本
 * 用于查看和验证 COS 中存储的实际数据
 */

import dotenv from 'dotenv';
import { resolve } from 'path';

// 加载环境变量
dotenv.config({ path: resolve(__dirname, '../.env') });

import { TencentCOSClient } from './src/storage/cos-client';
import { ChatStorageService } from './src/storage/chat-storage';
import pako from 'pako';

interface FileInfo {
  Key: string;
  Size: number;
  LastModified: string;
  Category: string;
}

async function main() {
  console.log('========================================');
  console.log('COS 数据检查工具');
  console.log('========================================\n');

  const cosClient = new TencentCOSClient();
  const chatStorage = new ChatStorageService();

  if (!cosClient.isServiceEnabled()) {
    console.error('❌ COS 服务未启用');
    return;
  }

  try {
    // 1. 列出所有文件
    console.log('1️⃣  正在扫描存储桶...\n');
    const allFiles = await cosClient.listFiles('', 1000);

    if (allFiles.length === 0) {
      console.log('⚠️  存储桶为空，没有找到任何文件\n');
      return;
    }

    // 2. 分类统计
    const filesByCategory: Record<string, FileInfo[]> = {
      'conversations': [],
      'images': [],
      'videos': [],
      'audio': [],
      'other': []
    };

    let totalSize = 0;

    allFiles.forEach((file: any) => {
      const key = file.Key;
      const size = parseInt(file.Size);
      totalSize += size;

      const fileInfo: FileInfo = {
        Key: key,
        Size: size,
        LastModified: file.LastModified,
        Category: 'other'
      };

      if (key.includes('/chat/conversations')) {
        fileInfo.Category = 'conversations';
        filesByCategory.conversations.push(fileInfo);
      } else if (key.includes('/assets/image')) {
        fileInfo.Category = 'images';
        filesByCategory.images.push(fileInfo);
      } else if (key.includes('/assets/video')) {
        fileInfo.Category = 'videos';
        filesByCategory.videos.push(fileInfo);
      } else if (key.includes('/assets/audio')) {
        fileInfo.Category = 'audio';
        filesByCategory.audio.push(fileInfo);
      } else {
        filesByCategory.other.push(fileInfo);
      }
    });

    // 3. 显示统计信息
    console.log('📊 存储统计:');
    console.log('─'.repeat(60));
    console.log(`总文件数: ${allFiles.length}`);
    console.log(`总大小: ${formatBytes(totalSize)}`);
    console.log('');
    console.log(`对话文件: ${filesByCategory.conversations.length} 个`);
    console.log(`图片资产: ${filesByCategory.images.length} 个`);
    console.log(`视频资产: ${filesByCategory.videos.length} 个`);
    console.log(`音频资产: ${filesByCategory.audio.length} 个`);
    console.log(`其他文件: ${filesByCategory.other.length} 个`);
    console.log('');

    // 4. 显示对话文件详情
    if (filesByCategory.conversations.length > 0) {
      console.log('💬 对话存储详情:');
      console.log('─'.repeat(60));

      for (const file of filesByCategory.conversations) {
        const uuid = file.Key.split('/')[0];
        console.log(`\n📁 UUID: ${uuid}`);
        console.log(`   文件: ${file.Key}`);
        console.log(`   大小: ${formatBytes(file.Size)}`);
        console.log(`   修改时间: ${file.LastModified}`);

        // 尝试加载并解析对话内容
        try {
          console.log(`   正在加载对话数据...`);
          const chatState = await chatStorage.loadConversations(uuid);

          if (chatState) {
            console.log(`   ✅ 对话加载成功:`);
            console.log(`      - 对话数量: ${chatState.history.length}`);
            console.log(`      - 消息总数: ${chatState.chat.reduce((sum, c) => sum + c.data.length, 0)}`);
            console.log(`      - 当前激活: ${chatState.active !== null ? chatState.active : '无'}`);
            console.log(`      - 使用上下文: ${chatState.usingContext ? '是' : '否'}`);

            // 显示对话标题
            if (chatState.history.length > 0) {
              console.log(`      - 对话列表:`);
              chatState.history.slice(0, 5).forEach((h: any, idx: number) => {
                console.log(`        ${idx + 1}. "${h.title}" (UUID: ${h.uuid})`);
              });
              if (chatState.history.length > 5) {
                console.log(`        ... 还有 ${chatState.history.length - 5} 个对话`);
              }
            }

            // 检查资产URL
            let externalUrls = 0;
            let cosUrls = 0;

            chatState.chat.forEach((conv: any) => {
              conv.data.forEach((msg: any) => {
                // 检查 logo
                if (msg.logo) {
                  if (msg.logo.includes('cos.') || msg.logo.includes('cos.lsaigc.com')) {
                    cosUrls++;
                  } else if (msg.logo.startsWith('http')) {
                    externalUrls++;
                  }
                }

                // 检查 opt 中的 URL
                if (msg.opt) {
                  if (msg.opt.imageUrl) {
                    if (msg.opt.imageUrl.includes('cos.') || msg.opt.imageUrl.includes('cos.lsaigc.com')) {
                      cosUrls++;
                    } else if (msg.opt.imageUrl.startsWith('http')) {
                      externalUrls++;
                    }
                  }

                  if (Array.isArray(msg.opt.images)) {
                    msg.opt.images.forEach((url: string) => {
                      if (url.includes('cos.') || url.includes('cos.lsaigc.com')) {
                        cosUrls++;
                      } else if (url.startsWith('http')) {
                        externalUrls++;
                      }
                    });
                  }
                }
              });
            });

            console.log(`      - 资产URL统计:`);
            console.log(`        COS URLs: ${cosUrls}`);
            console.log(`        外部URLs: ${externalUrls}`);

          } else {
            console.log(`   ⚠️  对话为空或不存在`);
          }
        } catch (error: any) {
          console.log(`   ❌ 加载失败: ${error.message}`);
        }
      }
    }

    // 5. 显示资产文件详情
    console.log('\n\n🖼️  资产文件详情:');
    console.log('─'.repeat(60));

    const assetCategories = ['images', 'videos', 'audio'];
    for (const category of assetCategories) {
      const files = filesByCategory[category as keyof typeof filesByCategory];
      if (files.length > 0) {
        console.log(`\n${getCategoryEmoji(category)} ${category}:`);
        const totalCategorySize = files.reduce((sum, f) => sum + f.Size, 0);
        console.log(`   数量: ${files.length} 个`);
        console.log(`   总大小: ${formatBytes(totalCategorySize)}`);

        // 按 UUID 分组
        const byUser = new Map<string, FileInfo[]>();
        files.forEach(f => {
          const uuid = f.Key.split('/')[0];
          if (!byUser.has(uuid)) {
            byUser.set(uuid, []);
          }
          byUser.get(uuid)!.push(f);
        });

        console.log(`   用户数: ${byUser.size}`);

        // 显示前几个文件示例
        console.log(`   示例文件:`);
        files.slice(0, 3).forEach((f, idx) => {
          console.log(`     ${idx + 1}. ${f.Key.split('/').pop()} (${formatBytes(f.Size)})`);
        });
        if (files.length > 3) {
          console.log(`     ... 还有 ${files.length - 3} 个文件`);
        }
      }
    }

    // 6. 其他文件
    if (filesByCategory.other.length > 0) {
      console.log('\n\n📂 其他文件:');
      console.log('─'.repeat(60));
      filesByCategory.other.forEach((f, idx) => {
        console.log(`${idx + 1}. ${f.Key} (${formatBytes(f.Size)})`);
      });
    }

    // 7. 总结
    console.log('\n\n✅ 数据检查完成!');
    console.log('═'.repeat(60));

  } catch (error: any) {
    console.error('❌ 检查失败:', error.message);
    console.error(error);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    'images': '🖼️ ',
    'videos': '🎬',
    'audio': '🎵'
  };
  return emojis[category] || '📄';
}

main().catch(console.error);
