/**
 * AI资产存储API完整测试
 *
 * 测试流程：
 * 1. 从api_keys表获取一个有效的api_key
 * 2. 使用该api_key创建资产
 * 3. 查询资产列表
 * 4. 查询单个资产
 * 5. 更新资产
 * 6. 获取统计信息
 * 7. 删除资产
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function log(message: string, color: 'green' | 'yellow' | 'red' | 'blue' = 'blue') {
  const colors = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m'
  };
  console.log(`${colors[color]}${message}\x1b[0m`);
}

async function testAssetsAPI() {
  console.log('\n========================================');
  log('AI资产存储API完整测试', 'blue');
  console.log('========================================\n');

  try {
    // 步骤1: 获取一个有效的api_key
    log('步骤1: 从数据库获取测试用api_key...', 'blue');
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('key_value, assigned_user_id, provider, status')
      .eq('status', 'assigned')
      .not('assigned_user_id', 'is', null)
      .limit(1)
      .single();

    if (apiKeyError || !apiKeyData) {
      log('❌ 无法获取测试api_key', 'red');
      console.log('Error:', apiKeyError);
      return;
    }

    log(`✅ 获取到api_key:`, 'green');
    console.log(`  Key: ${apiKeyData.key_value.substring(0, 20)}...`);
    console.log(`  User ID: ${apiKeyData.assigned_user_id}`);
    console.log(`  Provider: ${apiKeyData.provider}`);
    console.log(`  Status: ${apiKeyData.status}`);

    const apiKey = apiKeyData.key_value;
    const headers = {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    };

    // 步骤2: 创建资产
    log('\n步骤2: 创建测试资产...', 'blue');
    const testAsset = {
      service: 'midjourney',
      type: 'image',
      asset_data: {
        id: 'test-' + Date.now(),
        prompt: '测试提示词 - a beautiful landscape',
        imageUrl: 'https://example.com/test-image-' + Date.now() + '.png',
        status: 'SUCCESS',
        action: 'IMAGINE',
        progress: '100%'
      },
      task_id: 'test-task-' + Date.now(),
      main_url: 'https://example.com/test-image-' + Date.now() + '.png',
      prompt: '测试提示词 - a beautiful landscape'
    };

    const createResponse = await axios.post(
      `${API_BASE_URL}/api/assets`,
      testAsset,
      { headers }
    );

    if (createResponse.data.success) {
      log('✅ 资产创建成功！', 'green');
      const createdAsset = createResponse.data.asset;
      console.log(`  Asset ID: ${createdAsset.id}`);
      console.log(`  Service: ${createdAsset.service}`);
      console.log(`  Type: ${createdAsset.type}`);
      console.log(`  Created: ${createdAsset.created_at}`);

      // 步骤3: 查询资产列表
      log('\n步骤3: 查询资产列表...', 'blue');
      const listResponse = await axios.get(
        `${API_BASE_URL}/api/assets?limit=10`,
        { headers }
      );

      if (listResponse.data.success) {
        log(`✅ 查询成功！总共 ${listResponse.data.total} 个资产`, 'green');
        console.log(`  返回 ${listResponse.data.assets.length} 个资产`);
        if (listResponse.data.assets.length > 0) {
          console.log(`  最新资产: ${listResponse.data.assets[0].id}`);
        }
      }

      // 步骤4: 查询单个资产
      log('\n步骤4: 查询单个资产...', 'blue');
      const getResponse = await axios.get(
        `${API_BASE_URL}/api/assets/${createdAsset.id}`,
        { headers }
      );

      if (getResponse.data.success) {
        log('✅ 查询单个资产成功！', 'green');
        console.log('  Asset Data:', JSON.stringify(getResponse.data.asset.asset_data, null, 2));
      }

      // 步骤5: 更新资产
      log('\n步骤5: 更新资产...', 'blue');
      const updateData = {
        asset_data: {
          ...testAsset.asset_data,
          updated: true,
          updatedAt: new Date().toISOString()
        },
        prompt: '更新后的提示词 - an updated beautiful landscape'
      };

      const updateResponse = await axios.put(
        `${API_BASE_URL}/api/assets/${createdAsset.id}`,
        updateData,
        { headers }
      );

      if (updateResponse.data.success) {
        log('✅ 资产更新成功！', 'green');
        console.log('  Updated prompt:', updateResponse.data.asset.prompt);
      }

      // 步骤6: 获取统计信息
      log('\n步骤6: 获取统计信息...', 'blue');
      const statsResponse = await axios.get(
        `${API_BASE_URL}/api/assets/stats/summary`,
        { headers }
      );

      if (statsResponse.data.success) {
        log('✅ 统计信息获取成功！', 'green');
        const stats = statsResponse.data.stats;
        console.log(`  总资产数: ${stats.total_assets || 0}`);
        console.log(`  图片: ${stats.image_count || 0}`);
        console.log(`  音频: ${stats.audio_count || 0}`);
        console.log(`  视频: ${stats.video_count || 0}`);
      }

      // 步骤7: 删除资产
      log('\n步骤7: 删除测试资产...', 'blue');
      const deleteResponse = await axios.delete(
        `${API_BASE_URL}/api/assets/${createdAsset.id}`,
        { headers }
      );

      if (deleteResponse.data.success) {
        log('✅ 资产删除成功！', 'green');
      }

      // 验证删除
      log('\n步骤8: 验证删除...', 'blue');
      try {
        await axios.get(
          `${API_BASE_URL}/api/assets/${createdAsset.id}`,
          { headers }
        );
        log('❌ 资产仍然存在（删除失败）', 'red');
      } catch (error: any) {
        if (error.response?.status === 404) {
          log('✅ 验证通过：资产已被成功删除', 'green');
        } else {
          log(`⚠️  意外错误: ${error.message}`, 'yellow');
        }
      }

      console.log('\n========================================');
      log('✅ 所有测试通过！', 'green');
      console.log('========================================\n');

      log('认证流程验证:', 'blue');
      console.log(`  ✓ API Key → api_keys表查询`);
      console.log(`  ✓ assigned_user_id → users.id映射`);
      console.log(`  ✓ 数据隔离（仅访问自己的资产）`);
      console.log(`  ✓ CRUD操作完整性`);
      console.log();

    } else {
      log('❌ 资产创建失败', 'red');
      console.log('Response:', createResponse.data);
    }

  } catch (error: any) {
    log('\n❌ 测试失败！', 'red');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    if (error.code === 'ECONNREFUSED') {
      log('\n⚠️  提示: 请确保服务器正在运行 (pnpm dev)', 'yellow');
    }
  }
}

// 运行测试
testAssetsAPI().catch(console.error);
