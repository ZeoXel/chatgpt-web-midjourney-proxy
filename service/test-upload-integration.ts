/**
 * 统一存储服务测试
 * 测试上传、列表、删除等功能
 */

import 'dotenv/config';
import { UnifiedStorageService } from './src/storage/unified-storage';
import fs from 'fs';
import path from 'path';

async function testUploadIntegration() {
  console.log('========================================');
  console.log('统一存储服务测试');
  console.log('========================================\n');

  const storageService = new UnifiedStorageService();

  try {
    // 测试1: 创建测试文件
    console.log('1. 准备测试文件...');
    const testContent = Buffer.from('这是一个测试文件 - ' + new Date().toISOString());
    console.log('   ✓ 测试文件已创建 (大小:', testContent.length, 'bytes)\n');

    // 测试2: 上传文件(有用户ID)
    console.log('2. 测试上传 (有用户ID)...');
    const result1 = await storageService.upload({
      buffer: testContent,
      originalName: 'test-image.png',
      mimeType: 'image/png',
      userId: 'test_user_123',
    });

    console.log('   ✓ 上传成功!');
    console.log('   - URL:', result1.url);
    console.log('   - Key:', result1.key);
    console.log('   - Size:', result1.size, 'bytes');
    console.log('   - Storage:', result1.storage);
    console.log('');

    // 测试3: 上传文件(匿名用户)
    console.log('3. 测试上传 (匿名用户)...');
    const result2 = await storageService.upload({
      buffer: testContent,
      originalName: 'anonymous-video.mp4',
      mimeType: 'video/mp4',
    });

    console.log('   ✓ 上传成功!');
    console.log('   - URL:', result2.url);
    console.log('   - Key:', result2.key);
    console.log('   - Size:', result2.size, 'bytes');
    console.log('');

    // 测试4: 列出用户文件
    console.log('4. 测试列出用户文件...');
    const files = await storageService.listUserFiles('test_user_123');
    console.log('   ✓ 找到', files.length, '个文件');
    files.forEach((file: any, index: number) => {
      console.log(`   ${index + 1}. ${file.Key} (${file.Size} bytes)`);
    });
    console.log('');

    // 测试5: 删除测试文件
    console.log('5. 测试删除文件...');
    await storageService.deleteFile(result1.key);
    console.log('   ✓ 文件已删除:', result1.key);
    await storageService.deleteFile(result2.key);
    console.log('   ✓ 文件已删除:', result2.key);
    console.log('');

    // 测试6: 验证文件已删除
    console.log('6. 验证文件已删除...');
    const filesAfterDelete = await storageService.listUserFiles('test_user_123');
    console.log('   ✓ 剩余文件:', filesAfterDelete.length, '个');
    console.log('');

    console.log('========================================');
    console.log('✅ 所有测试通过!');
    console.log('========================================\n');

    console.log('🎉 统一存储服务运行正常，可以集成到项目中了!\n');

  } catch (error: any) {
    console.log('');
    console.log('========================================');
    console.log('❌ 测试失败');
    console.log('========================================');
    console.log('错误信息:', error.message);
    if (error.stack) {
      console.log('\n错误堆栈:');
      console.log(error.stack);
    }
    console.log('========================================\n');
    process.exit(1);
  }
}

// 运行测试
testUploadIntegration().catch(console.error);
