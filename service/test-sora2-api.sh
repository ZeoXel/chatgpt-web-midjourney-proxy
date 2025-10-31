#!/bin/bash

echo "=== 测试 Sora-2 API 端点 ==="
echo ""

# 测试 1: JSON 格式请求
echo "测试 1: JSON 格式请求"
curl -X POST 'https://api.bltcy.ai/v1/videos' \
  -H 'Authorization: Bearer sk-JO438PQ5WpZFtR9Gt5tMN119FmD1bG6YDtmczNgGyDIMCHc1' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "sora-2",
    "prompt": "A beautiful sunset over the ocean",
    "size": "1280x720",
    "seconds": "5"
  }' 2>&1 | jq . 2>/dev/null || cat

echo ""
echo "===================="
echo ""

# 测试 2: 检查具体模型配置
echo "测试 2: 查询 sora-2 模型详情"
curl -X GET 'https://api.bltcy.ai/v1/models/sora-2' \
  -H 'Authorization: Bearer sk-JO438PQ5WpZFtR9Gt5tMN119FmD1bG6YDtmczNgGyDIMCHc1' \
  2>&1 | jq . 2>/dev/null || cat
