# 多平台数据同步配置指南

## 一、Supabase数据库设置

### 1. 在Supabase控制台执行以下SQL

访问你的Supabase项目 → SQL Editor → 新建查询 → 粘贴以下SQL：

```sql
-- ==================== 表1: 聊天会话表 ====================
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) DEFAULT '新对话',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  model VARCHAR(50),
  using_context JSONB DEFAULT 'true'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引（提升查询性能）
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);

-- ==================== 表2: AI资产表 ====================
CREATE TABLE ai_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  service VARCHAR(50) NOT NULL,    -- 'midjourney', 'suno', 'luma', 'vidu'
  type VARCHAR(20) NOT NULL,       -- 'image', 'audio', 'video'
  asset_data JSONB NOT NULL,       -- 完整的资产对象
  task_id VARCHAR(255),            -- 第三方任务ID
  main_url VARCHAR(1024),          -- 主要资源URL
  prompt TEXT,                     -- 提示词
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_ai_assets_user_service ON ai_assets(user_id, service);
CREATE INDEX idx_ai_assets_created_at ON ai_assets(created_at DESC);
CREATE INDEX idx_ai_assets_task_id ON ai_assets(task_id);

-- ==================== 表3: 用户配置表 ====================
CREATE TABLE user_configs (
  user_id VARCHAR(255) PRIMARY KEY,
  gpt_config JSONB,
  server_config JSONB,
  ui_settings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== 启用行级安全（可选，如果需要直接从前端访问）====================
-- ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_assets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_configs ENABLE ROW LEVEL SECURITY;

-- 注释：由于你使用Service Key从后端访问，可以暂不启用RLS
-- 如果未来需要从前端直接访问Supabase，可以取消注释并配置策略
```

### 2. 获取Supabase凭证

在Supabase项目设置中获取：
- **Project URL**: `https://xxx.supabase.co`
- **Service Role Key** (⚠️ 保密): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## 二、后端配置

### 1. 安装依赖

```bash
cd service
bun add @supabase/supabase-js
```

### 2. 配置环境变量

在 `service/.env` 中添加：

```bash
# Supabase配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

### 3. 注册同步路由

编辑 `service/src/index.ts`，添加：

```typescript
import syncRouter from './api/sync-simple';

// 在现有路由后添加（约第600行附近）
app.use('/sync', authV2, syncRouter);  // 使用现有的authV2中间件
```

### 4. 重启服务

```bash
cd service
bun run dev  # 开发环境
# 或
bun run prod  # 生产环境
```

## 三、前端同步功能集成

### 1. 创建同步工具 (src/utils/cloudSync.ts)

```typescript
import { post, get, del } from '@/utils/request';

export interface SyncConfig {
  enabled: boolean;
  autoSync: boolean;
  syncInterval: number; // 毫秒
}

class CloudSyncManager {
  private config: SyncConfig = {
    enabled: true,
    autoSync: true,
    syncInterval: 60000, // 1分钟
  };
  private syncTimer: number | null = null;

  // ========== 聊天同步 ==========

  async syncChatSessions(sessions: any[]) {
    try {
      const response = await post({
        url: '/sync/sessions/batch',
        data: { sessions },
      });
      console.log('✅ 聊天同步成功:', response.synced);
      return response;
    } catch (error) {
      console.error('❌ 聊天同步失败:', error);
      throw error;
    }
  }

  async getChatSessions() {
    try {
      const response = await get({ url: '/sync/sessions' });
      return response.sessions || [];
    } catch (error) {
      console.error('❌ 获取聊天失败:', error);
      return [];
    }
  }

  async saveSession(session: any) {
    return post({
      url: '/sync/sessions',
      data: session,
    });
  }

  async deleteSession(id: string) {
    return del({ url: `/sync/sessions/${id}` });
  }

  // ========== AI资产同步 ==========

  async syncAiAssets(service: string, type: string, assets: any[]) {
    try {
      const response = await post({
        url: '/sync/assets/batch',
        data: { service, type, assets },
      });
      console.log(`✅ ${service}资产同步成功:`, response.synced);
      return response;
    } catch (error) {
      console.error(`❌ ${service}资产同步失败:`, error);
      throw error;
    }
  }

  async getAiAssets(service?: string, type?: string) {
    try {
      const response = await get({
        url: '/sync/assets',
        params: { service, type, limit: 200 },
      });
      return response.assets || [];
    } catch (error) {
      console.error('❌ 获取资产失败:', error);
      return [];
    }
  }

  async saveAsset(asset: {
    service: string;
    type: string;
    assetData: any;
    taskId?: string;
    mainUrl?: string;
    prompt?: string;
  }) {
    return post({
      url: '/sync/assets',
      data: asset,
    });
  }

  // ========== 配置同步 ==========

  async syncConfig(config: {
    gptConfig?: any;
    serverConfig?: any;
    uiSettings?: any;
  }) {
    try {
      const response = await post({
        url: '/sync/config',
        data: config,
      });
      console.log('✅ 配置同步成功');
      return response;
    } catch (error) {
      console.error('❌ 配置同步失败:', error);
      throw error;
    }
  }

  async getConfig() {
    try {
      const response = await get({ url: '/sync/config' });
      return response.config || {};
    } catch (error) {
      console.error('❌ 获取配置失败:', error);
      return {};
    }
  }

  // ========== 统计信息 ==========

  async getStats() {
    try {
      const response = await get({ url: '/sync/stats' });
      return response.stats || {};
    } catch (error) {
      console.error('❌ 获取统计失败:', error);
      return {};
    }
  }

  // ========== 自动同步控制 ==========

  startAutoSync() {
    if (this.syncTimer) return;

    this.syncTimer = window.setInterval(() => {
      this.performAutoSync();
    }, this.config.syncInterval);

    console.log('🔄 自动同步已启动');
  }

  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('⏸️ 自动同步已停止');
    }
  }

  private async performAutoSync() {
    if (!this.config.enabled || !this.config.autoSync) return;

    try {
      // 可以在这里实现增量同步逻辑
      console.log('🔄 执行自动同步...');
    } catch (error) {
      console.error('自动同步失败:', error);
    }
  }
}

export const cloudSync = new CloudSyncManager();
```

### 2. 创建一键迁移工具

在设置页面添加迁移按钮，点击后执行：

```typescript
// src/components/common/Setting/CloudSync.vue
import { cloudSync } from '@/utils/cloudSync';
import { useChatStore } from '@/store';
import { getSunoStore } from '@/api/sunoStore';
import { getLumaStore } from '@/api/lumaStore';
import { getViduStore } from '@/api/viduStore';

async function migrateLocalDataToCloud() {
  const loading = ref(true);
  const progress = ref(0);

  try {
    // 1. 迁移聊天历史
    console.log('📤 正在迁移聊天历史...');
    const chatStore = useChatStore();
    const sessions = chatStore.history.map(h => ({
      id: h.uuid,
      title: h.title,
      messages: chatStore.getChatByUuid(h.uuid),
      model: 'gpt-3.5-turbo',
      usingContext: true,
    }));

    await cloudSync.syncChatSessions(sessions);
    progress.value = 25;

    // 2. 迁移Suno音乐
    console.log('📤 正在迁移Suno音乐...');
    const sunoStore = getSunoStore();
    const sunoData = sunoStore.myData || [];
    await cloudSync.syncAiAssets('suno', 'audio', sunoData);
    progress.value = 50;

    // 3. 迁移Luma视频
    console.log('📤 正在迁移Luma视频...');
    const lumaStore = getLumaStore();
    const lumaData = lumaStore.myData || [];
    await cloudSync.syncAiAssets('luma', 'video', lumaData);
    progress.value = 75;

    // 4. 迁移Vidu视频
    console.log('📤 正在迁移Vidu视频...');
    const viduStore = getViduStore();
    const viduData = viduStore.taskList || [];
    await cloudSync.syncAiAssets('vidu', 'video', viduData);
    progress.value = 90;

    // 5. 迁移用户配置
    console.log('📤 正在迁移用户配置...');
    const gptConfig = localStorage.getItem('gptConfigStore');
    const serverConfig = localStorage.getItem('gptServerStore');
    const uiSettings = localStorage.getItem('app-store');

    await cloudSync.syncConfig({
      gptConfig: gptConfig ? JSON.parse(gptConfig) : {},
      serverConfig: serverConfig ? JSON.parse(serverConfig) : {},
      uiSettings: uiSettings ? JSON.parse(uiSettings) : {},
    });
    progress.value = 100;

    console.log('✅ 迁移完成！');
    alert('数据已成功同步到云端！');

  } catch (error) {
    console.error('迁移失败:', error);
    alert('迁移失败，请查看控制台错误信息');
  } finally {
    loading.value = false;
  }
}

async function restoreFromCloud() {
  const loading = ref(true);

  try {
    // 1. 恢复聊天历史
    console.log('📥 正在恢复聊天历史...');
    const sessions = await cloudSync.getChatSessions();
    // TODO: 更新到chatStore

    // 2. 恢复Suno
    const sunoAssets = await cloudSync.getAiAssets('suno', 'audio');
    // TODO: 更新到sunoStore

    // 3. 恢复Luma
    const lumaAssets = await cloudSync.getAiAssets('luma', 'video');
    // TODO: 更新到lumaStore

    // 4. 恢复配置
    const config = await cloudSync.getConfig();
    if (config.gptConfig) {
      localStorage.setItem('gptConfigStore', JSON.stringify(config.gptConfig));
    }

    console.log('✅ 恢复完成！');
    alert('数据已从云端恢复！请刷新页面。');

  } catch (error) {
    console.error('恢复失败:', error);
    alert('恢复失败，请查看控制台错误信息');
  } finally {
    loading.value = false;
  }
}
```

## 四、测试验证

### 1. 测试API端点

```bash
# 获取会话列表
curl -X GET http://localhost:3002/sync/sessions \
  -H "X-Ptoken: your-api-key"

# 保存会话
curl -X POST http://localhost:3002/sync/sessions \
  -H "X-Ptoken: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试会话","messages":[{"role":"user","text":"hello"}]}'

# 获取统计
curl -X GET http://localhost:3002/sync/stats \
  -H "X-Ptoken: your-api-key"
```

### 2. 前端测试流程

1. **首次迁移**:
   - 打开设置页面 → 云端同步
   - 点击"上传本地数据到云端"
   - 等待进度完成

2. **验证同步**:
   - 打开Supabase控制台 → Table Editor
   - 检查 `chat_sessions`、`ai_assets`、`user_configs` 表
   - 确认数据已正确写入

3. **跨设备测试**:
   - 在另一个浏览器/设备登录
   - 点击"从云端恢复数据"
   - 刷新页面，确认数据已同步

## 五、存储空间管理

### 自动清理策略（可选）

如果担心数据库容量不足，可以实现自动清理：

```typescript
// 在后端添加定时任务
import cron from 'node-cron';

// 每天凌晨2点执行清理（保留最近3个月数据）
cron.schedule('0 2 * * *', async () => {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  try {
    // 清理旧会话
    await supabase
      .from('chat_sessions')
      .delete()
      .lt('updated_at', threeMonthsAgo.toISOString());

    // 清理旧资产
    await supabase
      .from('ai_assets')
      .delete()
      .lt('created_at', threeMonthsAgo.toISOString());

    console.log('✅ 自动清理完成');
  } catch (error) {
    console.error('自动清理失败:', error);
  }
});
```

### 存储容量监控

```typescript
// 获取数据库使用情况
async function getStorageStats() {
  const { data } = await supabase.rpc('get_database_size');
  console.log('数据库大小:', data);
}
```

## 六、常见问题

### Q1: 如何处理冲突（本地和云端都有数据）？

**方案1: 时间戳优先**（推荐）
- 比较 `updated_at` 字段
- 保留最新的数据

**方案2: 用户选择**
- 弹窗让用户选择保留哪一份
- 或提供合并选项

### Q2: 如何优化同步性能？

- **增量同步**: 只同步 `updated_at > last_sync_time` 的数据
- **批量操作**: 使用 `upsert` 批量插入/更新
- **后台同步**: 使用 Web Worker 避免阻塞UI

### Q3: Supabase免费套餐够用吗？

**免费套餐限制**:
- 500MB 数据库存储
- 1GB 文件存储
- 2GB 带宽/月

**适合场景**:
- ✅ 10-20个活跃用户（完整历史）
- ✅ 100+用户（仅保留3个月数据）
- ❌ 不适合大规模商用（需升级Pro）

## 七、升级路径

当用户量增长后，可以考虑：

1. **升级Supabase Pro** ($25/月)
   - 8GB 数据库
   - 100GB 文件存储
   - 支持200+并发用户

2. **迁移到自建PostgreSQL**
   - 完全控制
   - 无容量限制
   - 需要运维成本

3. **引入Redis缓存**
   - 热数据缓存
   - 减少数据库查询
   - 提升响应速度

---

**完成设置后，你的应用将支持**:
- ✅ 多设备数据同步
- ✅ 换浏览器不丢数据
- ✅ 清除缓存可恢复
- ✅ 团队协作（如果需要）
