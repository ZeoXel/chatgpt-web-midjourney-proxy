# API Key 令牌格式修复指南

## 问题概述

通过数据库检查发现,部分用户的API Key令牌格式不正确,导致无法正常使用服务。

### 检查结果

- **总令牌数**: 681个
- **正确格式 (51字符)**: 628个 (92.2%)
- **异常格式**: 53个 (7.8%)

#### 异常令牌分类:
- **47字符**: 50个令牌 (缺少4个字符)
- **26字符**: 2个令牌 (测试样例)
- **52字符**: 1个令牌 (多了1个字符)

### 正确格式标准

✅ **正确格式**: `sk-` + 48个字符 = **51字符**总长度

**示例**: `sk-5TBiqd8OkZd3Uu7djCMwHPYkUy5-7RsWANkA6S3xgKvK123`

## 修复方案

### 方案一: 使用自动修复脚本 (推荐)

#### 1. 检查异常令牌

```bash
cd service
bun run src/scripts/check-token-format.ts
```

这将显示所有异常令牌的详细信息。

#### 2. 模拟运行修复 (可选)

```bash
bun run src/scripts/fix-token-format.ts --dry-run
```

这将模拟修复过程,但不会实际修改数据库。

#### 3. 执行修复

```bash
bun run src/scripts/fix-token-format.ts
```

这将:
- 自动创建备份表
- 为每个异常令牌生成新的51字符令牌
- 更新数据库
- 验证修复结果

#### 4. 导出令牌映射表

```bash
bun run src/scripts/export-token-mapping.ts > token-updates.csv
```

这将生成CSV文件,包含:
- 所有令牌的详细信息
- 受影响的用户列表
- 需要通知用户更新的信息

### 方案二: 手动SQL修复

#### 1. 在Supabase SQL Editor中执行

```sql
-- 1. 创建备份表
CREATE TABLE api_keys_backup AS SELECT * FROM api_keys;

-- 2. 查看需要修复的令牌
SELECT id, length(key_value) as token_length, key_value, status, assigned_user_id
FROM api_keys
WHERE length(key_value) != 51;

-- 3. 批量生成新令牌 (51字符)
UPDATE api_keys
SET key_value = 'sk-' || encode(gen_random_bytes(24), 'base64')
WHERE length(key_value) != 51;

-- 4. 验证修复结果
SELECT id, length(key_value) as token_length, key_value
FROM api_keys
WHERE length(key_value) != 51;

-- 应该返回0条记录
```

#### 2. 针对特定ID修复单个令牌

```sql
UPDATE api_keys
SET key_value = 'sk-' || encode(gen_random_bytes(24), 'base64')
WHERE id = 'A000051';  -- 替换为实际ID
```

## 修复后的操作

### 1. 通知受影响的用户

53个异常令牌中:
- **6个已分配用户** (需要通知更新)
- **47个未分配** (可以直接修复)

#### 通知模板

```
尊敬的用户,

我们对API Key系统进行了格式修复。您的旧令牌已失效,请使用新令牌:

旧令牌: sk-xxxxx... (已失效)
新令牌: sk-yyyyy... (51字符)

请在应用中更新API Key以继续使用服务。

如有问题,请联系技术支持。
```

### 2. 验证修复

运行检查脚本确认所有令牌格式正确:

```bash
bun run src/scripts/check-token-format.ts
```

应该显示:
```
✅ 所有令牌格式检查通过!
```

### 3. 监控日志

检查应用日志,确认用户可以正常使用新令牌:

```bash
# 查看最近的认证日志
tail -f logs/app.log | grep "API Key"
```

## 预防措施

### 1. 添加令牌格式验证

在 `service/src/middleware/auth.ts` 中添加验证:

```typescript
function validateApiKeyFormat(apiKey: string): boolean {
  // 检查格式: sk- + 48个字符 = 51字符
  if (apiKey.length !== 51) {
    return false;
  }

  if (!apiKey.startsWith('sk-')) {
    return false;
  }

  // 检查后48个字符是否为有效的base64url
  const token = apiKey.substring(3);
  const base64urlRegex = /^[A-Za-z0-9_-]{48}$/;

  return base64urlRegex.test(token);
}
```

### 2. 数据库约束

在Supabase中添加CHECK约束:

```sql
ALTER TABLE api_keys
ADD CONSTRAINT check_key_value_length
CHECK (length(key_value) = 51);

ALTER TABLE api_keys
ADD CONSTRAINT check_key_value_prefix
CHECK (key_value LIKE 'sk-%');
```

### 3. 生成令牌的标准函数

创建统一的令牌生成函数:

```typescript
import * as crypto from 'crypto';

export function generateApiKey(): string {
  // 生成24字节随机数据 = 32个base64url字符
  const randomBytes = crypto.randomBytes(24);
  const base64url = randomBytes.toString('base64url');

  // sk- + 48个字符 = 51字符
  return `sk-${base64url}`;
}

// 测试
const key = generateApiKey();
console.log(key.length); // 应该输出: 51
```

## 脚本说明

项目中提供了3个诊断和修复脚本:

### 1. `check-token-format.ts`
- 检查所有令牌格式
- 统计异常令牌
- 生成修复SQL脚本

### 2. `fix-token-format.ts`
- 自动修复所有异常令牌
- 支持 `--dry-run` 模式
- 自动创建备份
- 验证修复结果

### 3. `export-token-mapping.ts`
- 导出令牌映射表(CSV)
- 显示受影响的用户
- 用于通知用户更新

## 回滚方案

如果修复出现问题,可以从备份恢复:

```sql
-- 查看备份表
SELECT * FROM api_keys_backup LIMIT 5;

-- 恢复数据
DELETE FROM api_keys;
INSERT INTO api_keys SELECT * FROM api_keys_backup;

-- 或者恢复特定记录
UPDATE api_keys a
SET key_value = b.key_value
FROM api_keys_backup b
WHERE a.id = b.id;
```

## 常见问题

### Q1: 修复后用户无法登录?

**A**: 新令牌已生成,需要通知用户更新。可以:
1. 发送邮件通知
2. 在应用中显示令牌更新提示
3. 提供令牌查询接口

### Q2: 如何找到某个用户的新令牌?

**A**: 运行以下SQL:

```sql
SELECT key_value, status
FROM api_keys
WHERE assigned_user_id = 'user-uuid-here';
```

### Q3: 修复失败怎么办?

**A**: 检查:
1. Supabase连接是否正常
2. 环境变量是否配置
3. 是否有足够的权限
4. 查看错误日志

### Q4: 47字符的令牌是怎么产生的?

**A**: 可能原因:
1. 使用了不同的随机字节数 (23字节 → 44字符 + "sk-" = 47字符)
2. 旧的令牌生成逻辑
3. 手动创建时输入错误

## 联系支持

如果修复过程中遇到问题:
- 查看日志: `service/logs/`
- 提交Issue: [项目GitHub]
- 技术支持邮箱: [support@example.com]
