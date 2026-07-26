#!/bin/bash
# 按课程顺序增量生成词典分片（跳过已覆盖词），每片完成后立即导出前端。
# 与 generate_all.sh 的文章流水线并行运行；配合预置的 dict_all.json 空文件，
# 主流水线末尾的并集词典步骤会被跳过，避免重复生成。
set -e
cd "$(dirname "$0")/.."
PY=.venv/bin/python
V=data/builtin_vocabs

for id in junior senior cet4 cet6 daily business; do
  if [ -s "$V/out/dict_$id.json" ]; then
    echo "=== [skip] 词典分片 $id 已存在 ==="
    continue
  fi

  $PY - "$id" <<'EOF'
import json, sys
from pathlib import Path

vid = sys.argv[1]
out = Path("data/builtin_vocabs/out")
covered = set()
for shard in out.glob("dict_*.json"):
    try:
        for entry in json.loads(shard.read_text()).get("dict_entries", []):
            covered.add(str(entry.get("word", "")).lower())
    except Exception:
        pass

words = [w.strip() for w in Path(f"data/builtin_vocabs/{vid}.txt").read_text().splitlines() if w.strip()]
todo = [w for w in words if w.lower() not in covered]
Path(f"data/builtin_vocabs/out/todo_{vid}.txt").write_text("\n".join(todo))
print(f"[shard] {vid}: {len(todo)} 词待生成（跳过 {len(words) - len(todo)} 个已覆盖）", flush=True)
EOF

  if [ -s "$V/out/todo_$id.txt" ]; then
    echo "=== [$(date +%H:%M:%S)] 生成词典分片: $id ==="
    $PY scripts/generate_builtin_course.py --vocab "$V/out/todo_$id.txt" --name "词典-$id" \
      --base-url http://127.0.0.1:8317/v1 --api-key sk-dummy --model claude-fable-5 \
      --max-tokens 32768 --dict-only --concurrency 3 --retries 2 --output "$V/out/dict_$id.json"
  else
    printf '{"course": null, "dict_entries": []}' > "$V/out/dict_$id.json"
    echo "=== [skip] $id 全部词已覆盖 ==="
  fi

  $PY scripts/export_frontend_data.py | grep dict
done

echo "=== 全部词典分片完成 ==="
