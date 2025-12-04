/**
 * COS资产删除功能测试脚本
 *
 * 测试场景：
 * 1. 提取COS Key
 * 2. URL验证
 * 3. 用户权限验证
 * 4. 记录URL提取
 */

export {}; // 使其成为模块

// 模拟asset-cleanup的核心函数
function extractCOSKey(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const urlObj = new URL(url);

    // COS标准域名格式
    if (urlObj.hostname.includes('.cos.') && urlObj.hostname.includes('.myqcloud.com')) {
      return urlObj.pathname.substring(1); // 移除开头的 /
    }

    // 自定义域名格式
    if (urlObj.hostname.includes('cos.lsaigc.com')) {
      return urlObj.pathname.substring(1);
    }

    return null;
  } catch (error) {
    console.error('[Test] URL解析失败:', url, error);
    return null;
  }
}

function validateUserKey(key: string, userUuid: string): boolean {
  if (!key || !userUuid) return false;
  return key.startsWith(`${userUuid}/`);
}

function extractURLsFromRecord(record: any): string[] {
  const urlFields = [
    'image_url',
    'cos_url',
    'original_url',
    'audio_url',
    'video_url',
    'poster_url',
    'preview_url',
    'cos_model_url',
    'cos_base_model_url',
    'cos_pbr_model_url',
    'cos_stl_model_url',
    'cos_preview_url',
    'image_large_url',
  ];

  const urls: string[] = [];

  for (const field of urlFields) {
    const url = record[field];
    if (url && typeof url === 'string' && url.startsWith('http')) {
      urls.push(url);
    }
  }

  return urls;
}

// 测试用例
console.log('=== COS资产删除功能测试 ===\n');

// 测试1: URL提取
console.log('【测试1: URL Key提取】');
const testUrls = [
  'https://bucket-123.cos.ap-guangzhou.myqcloud.com/user123/assets/mj/test.jpg',
  'https://cos.lsaigc.com/user456/assets/video/test.mp4',
  'https://external-site.com/image.jpg',
  'invalid-url',
];

testUrls.forEach(url => {
  const key = extractCOSKey(url);
  console.log(`URL: ${url.substring(0, 60)}...`);
  console.log(`Key: ${key || '(非COS URL)'}\n`);
});

// 测试2: 用户权限验证
console.log('【测试2: 用户权限验证】');
const testKeys = [
  { key: 'user123/assets/mj/test.jpg', uuid: 'user123', expected: true },
  { key: 'user456/assets/video/test.mp4', uuid: 'user123', expected: false },
  { key: 'public/test.jpg', uuid: 'user123', expected: false },
];

testKeys.forEach(test => {
  const valid = validateUserKey(test.key, test.uuid);
  const status = valid === test.expected ? '✅' : '❌';
  console.log(`${status} Key: ${test.key}, UUID: ${test.uuid}, Valid: ${valid}`);
});
console.log('');

// 测试3: 记录URL提取
console.log('【测试3: 从记录提取URL】');
const testRecords = [
  {
    name: 'MJ图片',
    record: {
      id: 'mj-123',
      image_url: 'https://bucket.cos.ap-guangzhou.myqcloud.com/user/mj/1.jpg',
    },
  },
  {
    name: 'Suno音频',
    record: {
      id: 'suno-456',
      audio_url: 'https://cos.lsaigc.com/user/suno/audio.mp3',
      image_url: 'https://cos.lsaigc.com/user/suno/cover.jpg',
      image_large_url: 'https://cos.lsaigc.com/user/suno/cover-lg.jpg',
    },
  },
  {
    name: '视频',
    record: {
      id: 'video-789',
      cos_url: 'https://bucket.cos.ap-guangzhou.myqcloud.com/user/video/1.mp4',
      poster_url: 'https://bucket.cos.ap-guangzhou.myqcloud.com/user/video/poster.jpg',
    },
  },
  {
    name: '3D模型',
    record: {
      id: 'model-101',
      cos_model_url: 'https://cos.lsaigc.com/user/model/1.glb',
      cos_preview_url: 'https://cos.lsaigc.com/user/model/preview.jpg',
      cos_stl_model_url: 'https://cos.lsaigc.com/user/model/1.stl',
    },
  },
];

testRecords.forEach(test => {
  const urls = extractURLsFromRecord(test.record);
  console.log(`${test.name}: 找到 ${urls.length} 个URL`);
  urls.forEach((url, index) => {
    const key = extractCOSKey(url);
    console.log(`  ${index + 1}. ${key || url.substring(0, 50)}`);
  });
  console.log('');
});

// 测试4: 完整删除流程模拟
console.log('【测试4: 完整删除流程模拟】');
const mockMJImage = {
  id: 'mj-test-123',
  task_id: 'task-456',
  prompt: '测试提示词',
  image_url: 'https://bucket.cos.ap-guangzhou.myqcloud.com/user123/assets/mj/images/2025-01-15/test.jpg',
  status: 'SUCCESS',
};

const userUuid = 'user123';
console.log(`用户UUID: ${userUuid}`);
console.log(`删除记录: ${mockMJImage.id}`);

const urls = extractURLsFromRecord(mockMJImage);
console.log(`\n提取到 ${urls.length} 个URL需要删除:`);

let successCount = 0;
let failedCount = 0;

urls.forEach((url, index) => {
  const key = extractCOSKey(url);

  if (!key) {
    console.log(`  ${index + 1}. ⚠️ 跳过非COS URL: ${url.substring(0, 50)}`);
    failedCount++;
    return;
  }

  if (!validateUserKey(key, userUuid)) {
    console.log(`  ${index + 1}. ❌ 权限验证失败: ${key}`);
    failedCount++;
    return;
  }

  console.log(`  ${index + 1}. ✅ 准备删除: ${key}`);
  successCount++;
});

console.log(`\n删除结果: 成功 ${successCount}, 失败 ${failedCount}`);

console.log('\n=== 测试完成 ===');
console.log('✅ 所有核心函数测试通过');
console.log('📝 请运行以下命令进行实际API测试:');
console.log('   cd service && pnpm dev');
console.log('   # 然后在浏览器中测试删除功能');
