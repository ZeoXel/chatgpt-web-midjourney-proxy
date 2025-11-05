# 异常令牌清单

## 更新时间: 2025-11-05

### 总览
- **总令牌数**: 681
- **正确格式**: 629 (92.4%)
- **异常令牌**: 52 (7.6%)
- **已修复**: A000056 ✅

---

## 需要修复的令牌

### 🔴 高优先级 - 已分配用户 (5个)

这些令牌已分配给用户,修复后需要通知用户更新:

| ID | 长度 | 用户ID | 状态 | 令牌前缀 |
|---|---|---|---|---|
| **A000051** | 47 | efd127ad-53a0-48dc-a78a-dfeacc92cfc3 | assigned | sk-r32hEvicuUgcrtg6G... |
| **A000052** | 47 | cd3a981c-9bf8-4a9b-9162-d386cd7d1300 | assigned | sk-E15JEBBzpB3SLwJwXt9Qms... |
| **A000053** | 47 | 77519716-9153-4528-845f-1ebce472a4f3 | assigned | sk-GSvovN9-yAom6tRIodVc-x... |
| **A000054** | 47 | 54f90761-8d2d-4ac7-b005-98d5f7625509 | assigned | sk-wSzuwCmadHrBwS3LwGNB57... |
| **A000055** | 47 | fdf1de01-382e-4f0d-b925-a76e32cb45ef | assigned | sk-Wz2jyi_D7iwu0Jk5ETfVUE... |

---

### 🟡 中优先级 - 未分配令牌 (44个)

这些令牌状态为active但未分配给用户,可以直接修复:

**47字符的令牌 (44个):**

```
A000057, A000058, A000059, A000060, A000061, A000062, A000063, A000064,
A000065, A000066, A000067, A000068, A000069, A000070, A000071, A000072,
A000073, A000074, A000075, A000076, A000077, A000078, A000079, A000080,
A000081, A000082, A000083, A000084, A000085, A000086, A000087, A000088,
A000089, A000090, A000091, A000092, A000093, A000094, A000095, A000096,
A000097, A000098, A000099, A000100
```

---

### 🟢 低优先级 - 测试/异常令牌 (3个)

| ID | 长度 | 用户ID | 状态 | 说明 |
|---|---|---|---|---|
| **A000002** | 52 | e739f147-ffc2-4df3-b149-b58487a0c896 | assigned | 多了1个字符 |
| **A000003** | 26 | 5f884fba-d205-4ff9-a204-e4959b1d7187 | assigned | 测试样例 (openai) |
| **A000004** | 26 | 1945549d-18aa-4244-bc13-8ce6003fbcfe | assigned | 测试样例 (claude) |

---

## 快速修复命令

### 方案1: 自动修复脚本

```bash
# 模拟运行
bun run src/scripts/fix-token-format.ts --dry-run

# 实际修复
bun run src/scripts/fix-token-format.ts
```

### 方案2: 批量SQL修复

复制 `src/scripts/check-token-format.ts` 输出的SQL脚本到Supabase SQL Editor执行

### 方案3: 针对单个用户修复

```sql
-- 示例:修复 A000051
UPDATE api_keys
SET key_value = 'sk-' || encode(gen_random_bytes(24), 'base64')
WHERE id = 'A000051';

-- 查询新令牌
SELECT key_value FROM api_keys WHERE id = 'A000051';
```

---

## 受影响用户

需要通知以下8个用户更新API Key:

1. `efd127ad-53a0-48dc-a78a-dfeacc92cfc3` (A000051)
2. `cd3a981c-9bf8-4a9b-9162-d386cd7d1300` (A000052)
3. `77519716-9153-4528-845f-1ebce472a4f3` (A000053)
4. `54f90761-8d2d-4ac7-b005-98d5f7625509` (A000054)
5. `fdf1de01-382e-4f0d-b925-a76e32cb45ef` (A000055)
6. `e739f147-ffc2-4df3-b149-b58487a0c896` (A000002)
7. `5f884fba-d205-4ff9-a204-e4959b1d7187` (A000003)
8. `1945549d-18aa-4244-bc13-8ce6003fbcfe` (A000004)

---

## 查询用户信息SQL

```sql
SELECT
  ak.id as token_id,
  ak.key_value,
  length(ak.key_value) as token_length,
  ak.status,
  u.id as user_id,
  u.name,
  u.email
FROM api_keys ak
LEFT JOIN users u ON ak.assigned_user_id = u.id
WHERE ak.id IN (
  'A000051', 'A000052', 'A000053', 'A000054', 'A000055',
  'A000002', 'A000003', 'A000004'
)
ORDER BY ak.id;
```

---

## 修复进度

- [x] A000056 - 已手动修复 ✅
- [ ] A000051-A000055 - 待修复 (已分配用户,高优先级)
- [ ] A000057-A000100 - 待修复 (未分配,中优先级)
- [ ] A000002-A000004 - 待修复 (异常/测试令牌)

**总进度**: 1/53 完成 (1.9%)
