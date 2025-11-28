/**
 * COS存储桶状态检查脚本
 * 分析当前存储桶的文件结构和统计信息
 */

import 'dotenv/config';
import { TencentCOSClient } from './src/storage/cos-client';

interface FileStats {
  totalFiles: number;
  totalSize: number;
  byType: Record<string, { count: number; size: number }>;
  byPrefix: Record<string, { count: number; size: number }>;
  samples: Array<{ key: string; size: number; lastModified: string }>;
}

async function inspectCOSBucket() {
  console.log('========================================');
  console.log('COS存储桶状态检查');
  console.log('========================================\n');

  try {
    const cosClient = new TencentCOSClient();

    if (!cosClient.isServiceEnabled()) {
      console.log('❌ COS服务未启用');
      return;
    }

    console.log('1. 获取存储桶文件列表...\n');

    // 获取所有文件
    const files = await cosClient.listFiles('', 1000);

    const stats: FileStats = {
      totalFiles: files.length,
      totalSize: 0,
      byType: {},
      byPrefix: {},
      samples: [],
    };

    // 分析文件
    files.forEach((file: any) => {
      const key = file.Key;
      const size = file.Size || 0;

      stats.totalSize += size;

      // 按文件类型统计
      const ext = key.split('.').pop()?.toLowerCase() || 'unknown';
      if (!stats.byType[ext]) {
        stats.byType[ext] = { count: 0, size: 0 };
      }
      stats.byType[ext].count++;
      stats.byType[ext].size += size;

      // 按顶级目录统计
      const prefix = key.split('/')[0];
      if (!stats.byPrefix[prefix]) {
        stats.byPrefix[prefix] = { count: 0, size: 0 };
      }
      stats.byPrefix[prefix].count++;
      stats.byPrefix[prefix].size += size;

      // 收集前10个文件样本
      if (stats.samples.length < 10) {
        stats.samples.push({
          key,
          size,
          lastModified: file.LastModified,
        });
      }
    });

    // 输出统计结果
    console.log('========================================');
    console.log('存储桶统计信息');
    console.log('========================================\n');

    console.log('📊 总体统计:');
    console.log(`  - 文件总数: ${stats.totalFiles}`);
    console.log(`  - 总大小: ${formatSize(stats.totalSize)}`);
    console.log('');

    if (Object.keys(stats.byType).length > 0) {
      console.log('📁 按文件类型统计:');
      Object.entries(stats.byType)
        .sort((a, b) => b[1].count - a[1].count)
        .forEach(([type, data]) => {
          console.log(`  - .${type}: ${data.count}个文件, ${formatSize(data.size)}`);
        });
      console.log('');
    }

    if (Object.keys(stats.byPrefix).length > 0) {
      console.log('📂 按顶级目录统计:');
      Object.entries(stats.byPrefix)
        .sort((a, b) => b[1].count - a[1].count)
        .forEach(([prefix, data]) => {
          console.log(`  - ${prefix}/: ${data.count}个文件, ${formatSize(data.size)}`);
        });
      console.log('');
    }

    if (stats.samples.length > 0) {
      console.log('📄 文件样本 (最近10个):');
      stats.samples.forEach((sample, index) => {
        console.log(`  ${index + 1}. ${sample.key}`);
        console.log(`     大小: ${formatSize(sample.size)}, 修改时间: ${sample.lastModified}`);
      });
      console.log('');
    }

    // 分析当前目录结构
    console.log('========================================');
    console.log('目录结构分析');
    console.log('========================================\n');

    const prefixes = Object.keys(stats.byPrefix);
    if (prefixes.length === 0) {
      console.log('✨ 存储桶为空，可以设计全新的目录结构\n');
    } else {
      console.log('当前目录结构:');
      prefixes.forEach(prefix => {
        console.log(`  - ${prefix}/`);
      });
      console.log('');
    }

    // 给出建议
    console.log('========================================');
    console.log('目录结构建议');
    console.log('========================================\n');

    console.log('推荐的用户隔离目录结构:');
    console.log('');
    console.log('users/');
    console.log('  ├── {userId}/');
    console.log('  │   ├── images/          # 图片资源');
    console.log('  │   │   └── 2025-01-27/');
    console.log('  │   ├── videos/          # 视频资源');
    console.log('  │   │   └── 2025-01-27/');
    console.log('  │   └── audio/           # 音频资源');
    console.log('  │       └── 2025-01-27/');
    console.log('  └── anonymous/           # 未登录用户临时文件');
    console.log('');
    console.log('shared/                    # 公共资源');
    console.log('  └── templates/');
    console.log('');

    console.log('========================================\n');

  } catch (error: any) {
    console.error('❌ 检查过程中发生错误:', error.message);
    console.error(error);
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// 运行检查
inspectCOSBucket().catch(console.error);
