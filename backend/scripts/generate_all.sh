#!/bin/bash
# 全量生成 7 套内置课程 + 并集词典 + 导出前端数据。
# 用法: bash scripts/generate_all.sh [base_url] [api_key] [model]
set -e
cd "$(dirname "$0")/.."

BASE_URL="${1:-http://127.0.0.1:8317/v1}"
API_KEY="${2:-sk-dummy}"
MODEL="${3:-claude-fable-5}"
PY=.venv/bin/python
COMMON=(--base-url "$BASE_URL" --api-key "$API_KEY" --model "$MODEL" --max-tokens 32768 --concurrency 6 --retries 2)
VOCAB_DIR=data/builtin_vocabs
OUT_DIR=$VOCAB_DIR/out
mkdir -p "$OUT_DIR"

gen() {
  local id="$1" name="$2"
  if [ -s "$OUT_DIR/${id}_course.json" ]; then
    echo "=== [skip] $name（$OUT_DIR/${id}_course.json 已存在）==="
    return
  fi
  echo "=== [$(date +%H:%M:%S)] 生成课程: $name ($id) ==="
  $PY scripts/generate_builtin_course.py --vocab "$VOCAB_DIR/$id.txt" --name "$name" \
    "${COMMON[@]}" --skip-dict --output "$OUT_DIR/${id}_course.json"
}

gen primary "小学英语词汇"
gen junior "初中英语词汇"
gen senior "高中英语词汇"
gen cet4 "大学英语四级"
gen cet6 "大学英语六级核心"
gen daily "日常高频词汇"
gen business "职场商务英语"

if [ ! -s "$OUT_DIR/dict_all.json" ]; then
  echo "=== [$(date +%H:%M:%S)] 生成并集词典 (7229 词) ==="
  $PY scripts/generate_builtin_course.py --vocab "$VOCAB_DIR/union.txt" --name "词典" \
    "${COMMON[@]}" --dict-only --output "$OUT_DIR/dict_all.json"
else
  echo "=== [skip] 并集词典已存在 ==="
fi

echo "=== [$(date +%H:%M:%S)] 导出前端数据 ==="
$PY scripts/export_frontend_data.py
echo "=== 全部完成 ==="
