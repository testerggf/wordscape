#!/bin/bash
# 兼容入口：按 172 篇正文的实际缺词增量生成，逐批 checkpoint，可安全续跑。
# 用法: bash scripts/generate_dict_shards.sh [base_url] [api_key] [model] [concurrency]
set -e
cd "$(dirname "$0")/.."

BASE_URL="${1:-http://127.0.0.1:8317/v1}"
API_KEY="${2:-sk-dummy}"
MODEL="${3:-gpt-5.5}"
CONCURRENCY="${4:-6}"

.venv/bin/python scripts/generate_missing_dictionary.py \
  --base-url "$BASE_URL" \
  --api-key "$API_KEY" \
  --model "$MODEL" \
  --concurrency "$CONCURRENCY" \
  --retries 5
