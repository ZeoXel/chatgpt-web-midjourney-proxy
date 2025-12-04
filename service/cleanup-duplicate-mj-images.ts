/**
 * 清理MJ图片重复数据脚本
 *
 * 功能：
 * 1. 从COS加载 images.json
 * 2. 去除重复的图片（基于ID和URL）
 * 3. 保存清理后的数据回COS
 *
 * 使用：
 * npx tsx cleanup-duplicate-mj-images.ts <userUuid>
 */

import 'dotenv/config';
import { TencentCOSClient } from './src/storage/cos-client';

const cosClient = new TencentCOSClient();

interface MJImage {
  id: string;
  task_id: string;
  prompt: string;
  image_url: string;
  action?: string;
  status: string;
  created_at: string;
  metadata?: any;
}

interface MJImagesFile {
  version: string;
  updated_at: string;
  images: MJImage[];
}

async function cleanupDuplicates(userUuid: string) {
  if (!userUuid) {
    console.error('❌ 错误：请提供userUuid参数');
    console.log('用法: npx tsx cleanup-duplicate-mj-images.ts <userUuid>');
    process.exit(1);
  }

  if (!cosClient.isServiceEnabled()) {
    console.error('❌ COS服务未启用，请检查环境变量');
    process.exit(1);
  }

  console.log('🔍 开始清理重复数据...');
  console.log('UserUUID:', userUuid);

  const key = `${userUuid}/assets/mj/images.json`;

  try {
    // 1. 加载数据
    console.log('\n📥 从COS加载数据...');
    const buffer = await cosClient.downloadFile(key);
    const data: MJImagesFile = JSON.parse(buffer.toString('utf-8'));

    console.log(`原始图片数量: ${data.images.length}`);

    // 2. 去重逻辑
    console.log('\n🧹 开始去重...');
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    const uniqueImages: MJImage[] = [];
    let duplicateCount = 0;

    for (const img of data.images) {
      const isDuplicateId = seenIds.has(img.id);
      const isDuplicateUrl = img.image_url && seenUrls.has(img.image_url);

      if (isDuplicateId || isDuplicateUrl) {
        duplicateCount++;
        console.log(`  ❌ 移除重复:`, {
          id: img.id,
          reason: isDuplicateId ? 'ID重复' : 'URL重复',
          url: img.image_url?.substring(0, 60) + '...',
        });
      } else {
        // 记录ID和URL
        seenIds.add(img.id);
        if (img.image_url) {
          seenUrls.add(img.image_url);
        }
        uniqueImages.push(img);
      }
    }

    console.log(`\n📊 去重统计:`);
    console.log(`  原始数量: ${data.images.length}`);
    console.log(`  重复数量: ${duplicateCount}`);
    console.log(`  去重后数量: ${uniqueImages.length}`);

    if (duplicateCount === 0) {
      console.log('\n✅ 没有发现重复数据，无需清理');
      return;
    }

    // 3. 保存回COS
    console.log('\n💾 保存清理后的数据...');
    data.images = uniqueImages;
    data.updated_at = new Date().toISOString();

    const newBuffer = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
    await cosClient.uploadFile(newBuffer, key, 'application/json');

    console.log('✅ 清理完成！');
    console.log(`\n删除了 ${duplicateCount} 个重复项`);
    console.log(`当前图片数量: ${uniqueImages.length}`);

  } catch (error: any) {
    if (error.statusCode === 404 || error.code === 'NoSuchKey') {
      console.log('⚠️  未找到图片数据文件');
      console.log('可能原因：');
      console.log('  1. userUuid 不正确');
      console.log('  2. 还没有保存过MJ图片');
    } else {
      console.error('❌ 清理失败:', error.message);
      console.error('详细错误:', error);
    }
    process.exit(1);
  }
}

// 从命令行参数获取userUuid
const userUuid = process.argv[2];

cleanupDuplicates(userUuid)
  .then(() => {
    console.log('\n🎉 全部完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 执行失败:', error);
    process.exit(1);
  });

export {};
