# 多平台数据同步实施方案

基于测试结果和项目需求，本文档提供完整的实施方案。

## 📊 测试结果分析

### ✅ 当前数据库状态（测试时间：2025-01-23）

| 检查项 | 状态 | 详情 |
|--------|------|------|
| **环境变量** | ✅ 正常 | `SUPABASE_URL` 和 `SUPABASE_SERVICE_KEY` 已配置 |
| **数据库连接** | ✅ 正常 | 成功连接到 `lxxbjwxwujcpgqfoquvv.supabase.co` |
| **表结构** | ✅ 完整 | 3个核心表已创建并验证 |
| **数据状态** | ✅ 就绪 | 所有表为空，等待数据导入 |
| **写入权限** | ⚠️ Schema cache | 无影响，正常使用 |

**结论**: ✅ **数据库已就绪，可以直接开始API集成**

---

## 🎯 实施路线图

### 阶段1: 后端API集成（30分钟）

**目标**: 将同步API集成到现有Express服务器

#### 步骤1.1: 注册同步路由

**文件**: `service/src/index.ts`

在第370行附近（`app.use('/pixverse', authV2, pixverseProxy)` 之后）添加：

```typescript
// 多平台数据同步API
import syncRouter from './api/sync-simple'
app.use('/sync', authV2, syncRouter)
```

**完整修改**:
```typescript
// 第365-372行附近
app.use('/ideogram', authV2, ideoProxy)
app.use('/pika', authV2, pikaProxy)
app.use('/udio', authV2, udioProxy)

app.use('/pixverse', authV2, pixverseProxy)

// ✅ 添加这里：多平台数据同步API
import syncRouter from './api/sync-simple'
app.use('/sync', authV2, syncRouter)

// 图片代理端点，解决CORS问题
router.get('/proxy-image', async (req, res) => {
```

#### 步骤1.2: 验证集成

```bash
cd service
bun run dev
```

**预期输出**:
```
Server is running on port 3002
```

#### 步骤1.3: 测试API端点

```bash
# 测试1: 获取会话列表（应返回空数组）
curl http://localhost:3002/sync/sessions \
  -H "X-Ptoken: your-api-key"

# 预期响应
{"success":true,"sessions":[],"count":0}

# 测试2: 创建测试会话
curl -X POST http://localhost:3002/sync/sessions \
  -H "X-Ptoken: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试会话","messages":[{"role":"user","content":"你好"}]}'

# 预期响应
{"success":true,"session":{"id":"uuid...","title":"测试会话",...}}

# 测试3: 验证数据已保存
curl http://localhost:3002/sync/sessions \
  -H "X-Ptoken: your-api-key"

# 预期响应（应包含刚创建的会话）
{"success":true,"sessions":[{"id":"uuid...","title":"测试会话",...}],"count":1}
```

---

### 阶段2: 前端同步功能（2小时）

**目标**: 实现前端数据自动同步到云端

#### 步骤2.1: 创建同步工具类

**文件**: `src/utils/cloudSync.ts`（已创建，参考 `docs/SYNC_SETUP_GUIDE.md`）

**核心功能**:
```typescript
import { post, get, del, put } from '@/utils/request'

export class CloudSyncManager {
  // 聊天同步
  async syncChatSessions(sessions: any[])
  async getChatSessions()
  async saveSession(session: any)
  async deleteSession(id: string)

  // AI资产同步
  async syncAiAssets(service: string, type: string, assets: any[])
  async getAiAssets(service?: string, type?: string)
  async saveAsset(asset: any)

  // 配置同步
  async syncConfig(config: any)
  async getConfig()

  // 自动同步控制
  startAutoSync()
  stopAutoSync()
}

export const cloudSync = new CloudSyncManager()
```

#### 步骤2.2: 修改Chat Store支持云端同步

**文件**: `src/store/modules/chat/index.ts`

**添加方法**:
```typescript
import { cloudSync } from '@/utils/cloudSync'

export const useChatStore = defineStore('chat-store', {
  state: () => ({
    // ...现有状态
    syncEnabled: true,  // 是否启用云端同步
    isSyncing: false,   // 是否正在同步
  }),

  actions: {
    // 从云端拉取数据
    async syncFromCloud() {
      if (!this.syncEnabled || this.isSyncing) return

      this.isSyncing = true
      try {
        const sessions = await cloudSync.getChatSessions()

        // 合并到本地（保留本地未同步的数据）
        const localIds = new Set(this.history.map(h => h.uuid))
        const newSessions = sessions.filter(s => !localIds.has(s.id))

        this.history.push(...newSessions.map(s => ({
          uuid: s.id,
          title: s.title,
          isEdit: false,
        })))

        // 保存到localStorage
        recordState(this.$state)

        console.log(`✅ 从云端同步了 ${newSessions.length} 个会话`)
      } catch (error) {
        console.error('❌ 同步失败:', error)
      } finally {
        this.isSyncing = false
      }
    },

    // 推送到云端
    async syncToCloud() {
      if (!this.syncEnabled || this.isSyncing) return

      this.isSyncing = true
      try {
        await cloudSync.syncChatSessions(
          this.history.map(h => ({
            id: h.uuid,
            title: h.title,
            messages: this.getChatByUuid(h.uuid),
            model: 'gpt-3.5-turbo',
            usingContext: this.usingContext,
          }))
        )

        console.log('✅ 推送到云端成功')
      } catch (error) {
        console.error('❌ 推送失败:', error)
      } finally {
        this.isSyncing = false
      }
    },

    // 修改现有的添加消息方法
    async addChatByUuid(uuid: number, chat: Chat.Chat) {
      // ...原有逻辑

      // 实时同步到云端（可选）
      if (this.syncEnabled) {
        await cloudSync.saveSession({
          id: uuid,
          title: this.history.find(h => h.uuid === uuid)?.title,
          messages: this.getChatByUuid(uuid),
        })
      }
    },
  },
})
```

#### 步骤2.3: 添加同步UI控制

**文件**: `src/components/common/Setting/General.vue`

**在设置页面添加同步开关**:
```vue
<template>
  <!-- 现有设置项... -->

  <!-- 云端同步设置 -->
  <div class="p-4 space-y-5 min-h-[200px]">
    <div class="space-y-6">
      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[120px]">云端同步</span>
        <div class="flex-1">
          <NSwitch v-model:value="syncEnabled" @update:value="handleSyncToggle" />
        </div>
      </div>

      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[120px]">自动同步</span>
        <div class="flex-1">
          <NSwitch v-model:value="autoSync" :disabled="!syncEnabled" />
        </div>
      </div>

      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[120px]">操作</span>
        <div class="flex-1 space-x-2">
          <NButton size="small" @click="handleSyncFromCloud">
            从云端恢复
          </NButton>
          <NButton size="small" @click="handleSyncToCloud">
            上传到云端
          </NButton>
          <NButton size="small" type="error" @click="handleClearCloud">
            清空云端数据
          </NButton>
        </div>
      </div>

      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[120px]">同步状态</span>
        <div class="flex-1">
          <NTag :type="isSyncing ? 'warning' : 'success'">
            {{ isSyncing ? '同步中...' : '空闲' }}
          </NTag>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useChatStore } from '@/store'
import { cloudSync } from '@/utils/cloudSync'

const chatStore = useChatStore()
const syncEnabled = ref(chatStore.syncEnabled)
const autoSync = ref(true)
const isSyncing = computed(() => chatStore.isSyncing)

async function handleSyncFromCloud() {
  await chatStore.syncFromCloud()
  ms.success('从云端恢复完成')
}

async function handleSyncToCloud() {
  await chatStore.syncToCloud()
  ms.success('上传到云端完成')
}

async function handleClearCloud() {
  // TODO: 实现清空云端数据
  ms.warning('此功能需谨慎使用')
}

function handleSyncToggle(value: boolean) {
  chatStore.syncEnabled = value
  if (value) {
    cloudSync.startAutoSync()
  } else {
    cloudSync.stopAutoSync()
  }
}

// 初始化时启动自动同步
onMounted(() => {
  if (syncEnabled.value && autoSync.value) {
    cloudSync.startAutoSync()
  }
})
</script>
```

---

### 阶段3: 数据迁移（30分钟）

**目标**: 将现有localStorage数据迁移到云端

#### 步骤3.1: 创建迁移工具

**文件**: `src/utils/dataMigration.ts`

```typescript
import { cloudSync } from './cloudSync'
import { useChatStore } from '@/store'
import { getSunoStore } from '@/api/sunoStore'
import { getLumaStore } from '@/api/lumaStore'
import { getViduStore } from '@/api/viduStore'

export async function migrateLocalDataToCloud() {
  const results = {
    chats: 0,
    suno: 0,
    luma: 0,
    vidu: 0,
    config: false,
    errors: [] as string[],
  }

  try {
    // 1. 迁移聊天历史
    console.log('📤 迁移聊天历史...')
    const chatStore = useChatStore()
    const sessions = chatStore.history.map(h => ({
      id: h.uuid,
      title: h.title,
      messages: chatStore.getChatByUuid(h.uuid),
      model: 'gpt-3.5-turbo',
      usingContext: chatStore.usingContext,
    }))

    const chatResult = await cloudSync.syncChatSessions(sessions)
    results.chats = chatResult.synced || sessions.length

    // 2. 迁移Suno音乐
    console.log('📤 迁移Suno音乐...')
    const sunoStore = getSunoStore()
    if (sunoStore.myData && sunoStore.myData.length > 0) {
      const sunoResult = await cloudSync.syncAiAssets('suno', 'audio', sunoStore.myData)
      results.suno = sunoResult.synced || sunoStore.myData.length
    }

    // 3. 迁移Luma视频
    console.log('📤 迁移Luma视频...')
    const lumaStore = getLumaStore()
    if (lumaStore.myData && lumaStore.myData.length > 0) {
      const lumaResult = await cloudSync.syncAiAssets('luma', 'video', lumaStore.myData)
      results.luma = lumaResult.synced || lumaStore.myData.length
    }

    // 4. 迁移Vidu视频
    console.log('📤 迁移Vidu视频...')
    const viduStore = getViduStore()
    if (viduStore.taskList && viduStore.taskList.length > 0) {
      const viduResult = await cloudSync.syncAiAssets('vidu', 'video', viduStore.taskList)
      results.vidu = viduResult.synced || viduStore.taskList.length
    }

    // 5. 迁移用户配置
    console.log('📤 迁移用户配置...')
    const gptConfig = localStorage.getItem('gptConfigStore')
    const serverConfig = localStorage.getItem('gptServerStore')
    const uiSettings = localStorage.getItem('app-store')

    await cloudSync.syncConfig({
      gptConfig: gptConfig ? JSON.parse(gptConfig) : {},
      serverConfig: serverConfig ? JSON.parse(serverConfig) : {},
      uiSettings: uiSettings ? JSON.parse(uiSettings) : {},
    })
    results.config = true

    console.log('✅ 迁移完成！', results)
    return results

  } catch (error: any) {
    results.errors.push(error.message)
    console.error('❌ 迁移失败:', error)
    return results
  }
}

export async function restoreFromCloud() {
  try {
    // 1. 恢复聊天历史
    console.log('📥 恢复聊天历史...')
    const chatStore = useChatStore()
    await chatStore.syncFromCloud()

    // 2. 恢复AI资产
    console.log('📥 恢复AI资产...')
    const sunoAssets = await cloudSync.getAiAssets('suno', 'audio')
    const lumaAssets = await cloudSync.getAiAssets('luma', 'video')
    const viduAssets = await cloudSync.getAiAssets('vidu', 'video')

    // TODO: 更新到对应的Store

    // 3. 恢复配置
    console.log('📥 恢复配置...')
    const config = await cloudSync.getConfig()
    if (config.gptConfig) {
      localStorage.setItem('gptConfigStore', JSON.stringify(config.gptConfig))
    }
    if (config.serverConfig) {
      localStorage.setItem('gptServerStore', JSON.stringify(config.serverConfig))
    }
    if (config.uiSettings) {
      localStorage.setItem('app-store', JSON.stringify(config.uiSettings))
    }

    console.log('✅ 恢复完成！')
    return true

  } catch (error) {
    console.error('❌ 恢复失败:', error)
    return false
  }
}
```

#### 步骤3.2: 在设置页面添加迁移按钮

**更新**: `src/components/common/Setting/General.vue`

```vue
<NButton size="small" type="primary" @click="handleMigrate">
  一键迁移本地数据
</NButton>

<script setup>
import { migrateLocalDataToCloud } from '@/utils/dataMigration'

async function handleMigrate() {
  const result = await migrateLocalDataToCloud()

  if (result.errors.length === 0) {
    ms.success(`迁移成功！聊天:${result.chats} Suno:${result.suno} Luma:${result.luma} Vidu:${result.vidu}`)
  } else {
    ms.error(`迁移部分失败: ${result.errors.join(', ')}`)
  }
}
</script>
```

---

### 阶段4: 用户系统集成（1小时）

**目标**: 对接你的外部用户系统

#### 当前认证机制分析

**文件**: `service/src/middleware/auth.ts`

**现有逻辑**:
```typescript
export async function authV2(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-ptoken'] as string

  // 验证apiKey是否在AUTH_SECRET_KEY列表中
  const validKeys = process.env.AUTH_SECRET_KEY?.split(',') || []
  if (validKeys.includes(apiKey)) {
    next()
  } else {
    res.status(401).json({ error: '未授权' })
  }
}
```

#### 改造方案：对接外部用户系统

**方式1: 保持现有逻辑（推荐）**

如果你的外部用户系统已经为每个用户生成了唯一的API Key，直接使用现有的 `authV2`：

```typescript
// 无需修改，直接使用
// 用户通过 X-Ptoken header 传递自己的API Key
// Supabase中的 user_id 字段直接存储这个API Key
```

**优势**:
- ✅ 无需修改现有代码
- ✅ 自然的用户隔离（user_id = api_key）
- ✅ 简单可靠

**方式2: 增强认证（如需要）**

如果需要更复杂的用户系统集成：

```typescript
// service/src/middleware/auth.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function authV3(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-ptoken'] as string

  // 从你的外部用户系统验证API Key
  const user = await validateUserFromExternalSystem(apiKey)

  if (!user) {
    return res.status(401).json({ error: '无效的API密钥' })
  }

  // 将用户信息附加到请求对象
  req.user = {
    id: user.id,
    apiKey: apiKey,
    email: user.email,
    // ...其他用户信息
  }

  next()
}

// 外部用户系统验证函数（示例）
async function validateUserFromExternalSystem(apiKey: string) {
  // 选项1: 查询你的用户数据库
  // const user = await yourUserDB.findOne({ apiKey })

  // 选项2: 调用你的用户服务API
  // const response = await fetch(`https://your-user-api.com/validate?key=${apiKey}`)
  // const user = await response.json()

  // 选项3: 直接使用Supabase存储用户（推荐）
  const { data: user } = await supabase
    .from('users')  // 需要创建users表
    .select('*')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .single()

  return user
}
```

---

## 💾 存储容量规划

### 基于你的需求（一用户一密钥）

#### 单用户数据量估算（年度）

| 数据类型 | 单条大小 | 年生成量 | 年存储量 |
|---------|---------|---------|---------|
| **聊天消息** | 1KB | 36,000条 | 36MB |
| **Midjourney URL** | 0.5KB | 1,200张 | 0.6MB |
| **Suno URL** | 0.8KB | 360首 | 0.3MB |
| **Luma URL** | 0.7KB | 240个 | 0.17MB |
| **Vidu URL** | 0.7KB | 200个 | 0.14MB |
| **用户配置** | 5KB | 1份 | 0.005MB |
| **总计** | - | - | **≈37MB/用户/年** |

#### 多用户容量规划

| 用户数 | 年度数据量 | Supabase方案 | 月成本 |
|-------|-----------|-------------|--------|
| **10用户** | 370MB | 免费版 ✅ | $0 |
| **50用户** | 1.85GB | Pro版 ✅ | $25 |
| **100用户** | 3.7GB | Pro版 ✅ | $25 |
| **500用户** | 18.5GB | Pro版 ⚠️ | $25 + 超额费用 |
| **1000用户** | 37GB | Team版 或 自建 | $599+ |

**Supabase定价**:
- **Free**: 500MB数据库 + 1GB文件 = **免费**
- **Pro**: 8GB数据库 + 100GB文件 = **$25/月**
- **Team**: 100GB数据库 + 100GB文件 = **$599/月**

**建议**:
- ≤10用户: Free版（够用）
- 10-100用户: Pro版（性价比高）
- 100-500用户: Pro版 + 定期清理（保留6个月数据）
- >500用户: 考虑自建PostgreSQL

---

## 🚀 快速开始（10分钟上手）

### 步骤1: 注册同步路由（2分钟）

```bash
cd service

# 编辑 src/index.ts，在第370行附近添加：
# import syncRouter from './api/sync-simple'
# app.use('/sync', authV2, syncRouter)
```

### 步骤2: 重启服务（1分钟）

```bash
bun run dev
```

### 步骤3: 测试API（2分钟）

```bash
# 获取会话列表
curl http://localhost:3002/sync/sessions \
  -H "X-Ptoken: your-api-key"

# 创建测试会话
curl -X POST http://localhost:3002/sync/sessions \
  -H "X-Ptoken: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试","messages":[]}'
```

### 步骤4: 前端集成（5分钟）

1. 创建 `src/utils/cloudSync.ts`（复制模板）
2. 修改 `src/store/modules/chat/index.ts`（添加同步方法）
3. 在设置页面添加同步按钮
4. 测试同步功能

---

## 📋 验收标准

### 后端验收

- [ ] `/sync/sessions` 接口返回200
- [ ] `/sync/assets` 接口返回200
- [ ] `/sync/config` 接口返回200
- [ ] `/sync/stats` 接口返回统计信息
- [ ] 数据库中可以看到新增记录

### 前端验收

- [ ] 设置页面显示"云端同步"开关
- [ ] 点击"上传到云端"成功
- [ ] 点击"从云端恢复"成功
- [ ] 换浏览器/设备可以看到同步的数据
- [ ] localStorage和Supabase数据一致

### 用户体验验收

- [ ] 用户A在设备1创建会话
- [ ] 用户A在设备2可以看到会话
- [ ] 用户B无法看到用户A的数据（隔离验证）
- [ ] 离线时数据保存在localStorage
- [ ] 上线后自动同步到云端

---

## 🆘 故障排查

### 问题1: API返回401未授权

**原因**: API Key不正确或未配置

**解决**:
```bash
# 检查环境变量
cat service/.env | grep AUTH_SECRET_KEY

# 检查请求头
curl -v http://localhost:3002/sync/sessions \
  -H "X-Ptoken: your-correct-key"
```

### 问题2: 数据库连接失败

**原因**: Supabase配置错误

**解决**:
```bash
# 重新测试连接
cd service
bun run test:supabase

# 查看错误详情
```

### 问题3: 写入权限错误

**原因**: Service Role Key权限不足

**解决**:
1. 检查是否使用 **service_role** key（不是anon key）
2. 在Supabase → Settings → API 重新复制
3. 更新.env文件

### 问题4: 前端CORS错误

**原因**: 跨域配置问题

**解决**:
```typescript
// service/src/index.ts已有配置（第33行）
app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type, X-Ptoken')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})
```

---

## 📞 获取帮助

### 在Claude Code中

```
我在实施多平台同步时遇到[具体问题]
当前进度：[阶段1/2/3/4]
错误信息：[粘贴错误]
```

### 查看文档

- 配置指南: `docs/SUPABASE_CONNECTION_GUIDE.md`
- 部署指南: `docs/SYNC_SETUP_GUIDE.md`
- 方案对比: `docs/SUPABASE_MCP_VS_TEST_SCRIPT.md`

---

**最后更新**: 2025-01-23
**预计完成时间**: 4小时（分阶段实施）
**当前状态**: 数据库已就绪，可以开始阶段1
