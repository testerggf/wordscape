"""按内容审计缺词清单增量生成词典，逐批 checkpoint，可安全续跑。"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import re
import subprocess
from pathlib import Path

from openai import AsyncOpenAI

from audit_content import BACKEND, REPORT_DIR, build_audit


OUTPUT = BACKEND / "data" / "builtin_vocabs" / "out" / "dict_runtime.json"
PROMPT = BACKEND / "prompts" / "dict_generation.txt"
BATCH_SIZE = 20


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="增量生成正文缺失词典")
    parser.add_argument("--base-url", default="http://127.0.0.1:8317/v1")
    parser.add_argument("--api-key", default="sk-dummy")
    parser.add_argument("--model", default="gpt-5.5")
    parser.add_argument("--concurrency", type=int, default=3)
    parser.add_argument("--retries", type=int, default=5)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def load_checkpoint() -> dict[str, dict]:
    if not OUTPUT.exists():
        return {}
    try:
        data = json.loads(OUTPUT.read_text(encoding="utf-8"))
        return {
            str(item["word"]).lower(): item
            for item in data.get("dict_entries", [])
            if item.get("word")
        }
    except (OSError, json.JSONDecodeError, TypeError):
        return {}


def write_checkpoint(entries: dict[str, dict]) -> None:
    payload = {"course": None, "dict_entries": [entries[key] for key in sorted(entries)]}
    temporary = OUTPUT.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(OUTPUT)


def cooldown_seconds(exc: Exception, attempt: int) -> float:
    match = re.search(r"reset_seconds['\"]?\s*[:=]\s*(\d+)", str(exc))
    if match:
        return min(1800, int(match.group(1)) + 5)
    return min(120, (2 ** attempt) + random.random() * 2)


async def main() -> None:
    args = parse_args()
    audit = build_audit()
    requested = [item["word"] for item in audit["actionable_missing_words"]]
    entries = load_checkpoint()
    pending = [word for word in requested if word not in entries]
    print(
        f"[dict] 正文缺词 {len(requested)}，checkpoint 已有 {len(entries)}，本次待生成 {len(pending)}",
        flush=True,
    )
    if args.dry_run or not pending:
        return

    client = AsyncOpenAI(base_url=args.base_url, api_key=args.api_key)
    system_prompt = PROMPT.read_text(encoding="utf-8")
    batches = [pending[index:index + BATCH_SIZE] for index in range(0, len(pending), BATCH_SIZE)]
    semaphore = asyncio.Semaphore(max(1, args.concurrency))
    checkpoint_lock = asyncio.Lock()
    failures: list[str] = []
    done = 0

    async def run_batch(batch: list[str], batch_index: int) -> None:
        nonlocal done
        remaining = list(batch)
        for attempt in range(args.retries + 1):
            if not remaining:
                break
            try:
                async with semaphore:
                    response = await client.chat.completions.create(
                        model=args.model,
                        max_tokens=8192,
                        temperature=0.2,
                        messages=[
                            {"role": "system", "content": "You are a JSON API. Output raw JSON only."},
                            {
                                "role": "user",
                                "content": f"{system_prompt}\n\n---\nWords:\n" + "\n".join(remaining),
                            },
                        ],
                    )
                payload = json.loads(response.choices[0].message.content or "{}")
                got = {
                    str(item["word"]).lower(): item
                    for item in payload.get("entries", [])
                    if item.get("word")
                }
                async with checkpoint_lock:
                    for word in remaining:
                        if word in got:
                            entries[word] = got[word]
                    write_checkpoint(entries)
                remaining = [word for word in remaining if word not in got]
            except Exception as exc:  # noqa: BLE001
                wait_seconds = cooldown_seconds(exc, attempt)
                print(
                    f"[dict] 批次 {batch_index}/{len(batches)} 第 {attempt + 1} 次失败，"
                    f"{wait_seconds:.1f}s 后重试：{str(exc)[:160]}",
                    flush=True,
                )
                await asyncio.sleep(wait_seconds)

        if remaining:
            failures.extend(remaining)
            print(f"[dict] 批次 {batch_index} 仍缺 {len(remaining)} 词", flush=True)
        done += len(batch) - len(remaining)
        print(
            f"[dict] 批次 {batch_index}/{len(batches)} 完成；累计新增 {done}/{len(pending)}",
            flush=True,
        )

    await asyncio.gather(*(run_batch(batch, index) for index, batch in enumerate(batches, start=1)))

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    failure_path = REPORT_DIR / "dictionary-failures.txt"
    failure_path.write_text("\n".join(sorted(set(failures))), encoding="utf-8")
    subprocess.run(
        [str(BACKEND / ".venv/bin/python"), str(BACKEND / "scripts/export_frontend_data.py")],
        cwd=BACKEND,
        check=True,
    )
    print(f"[dict] checkpoint 共 {len(entries)} 条；失败 {len(set(failures))} 词")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
