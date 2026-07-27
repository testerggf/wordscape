"""为已生成的内置课程补齐中文标题，并重新导出前端数据。

用法：
    python scripts/backfill_title_translations.py \
      --base-url http://127.0.0.1:8317/v1 \
      --api-key sk-dummy \
      --model gpt-5.5
"""

from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
from pathlib import Path

from openai import AsyncOpenAI


BACKEND = Path(__file__).resolve().parents[1]
OUT_DIR = BACKEND / "data" / "builtin_vocabs" / "out"
COURSE_IDS = ["primary", "junior", "senior", "cet4", "cet6", "daily", "business"]
BATCH_SIZE = 25


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="批量回填内置课程中文标题")
    parser.add_argument("--base-url", default="http://127.0.0.1:8317/v1")
    parser.add_argument("--api-key", default="sk-dummy")
    parser.add_argument("--model", default="gpt-5.5")
    parser.add_argument("--concurrency", type=int, default=3)
    parser.add_argument("--retries", type=int, default=2)
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    client = AsyncOpenAI(base_url=args.base_url, api_key=args.api_key)
    pending: list[tuple[str, dict]] = []
    course_data: dict[str, dict] = {}

    for course_id in COURSE_IDS:
        path = OUT_DIR / f"{course_id}_course.json"
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        course_data[course_id] = data
        for article in (data.get("course") or {}).get("articles", []):
            if not str(article.get("title_zh", "")).strip():
                pending.append((course_id, article))

    if not pending:
        print("[title] 所有文章均已有中文标题")
        return

    batches = [pending[index : index + BATCH_SIZE] for index in range(0, len(pending), BATCH_SIZE)]
    semaphore = asyncio.Semaphore(max(1, args.concurrency))

    async def translate_batch(batch: list[tuple[str, dict]], batch_index: int) -> dict[str, str]:
        items = [
            {
                "id": f"{course_id}:{article['index']}",
                "title": article["title"],
                "topic": article.get("topic", ""),
            }
            for course_id, article in batch
        ]
        prompt = (
            "Translate each English story title into a natural, concise Chinese story title. "
            "Use the topic only as context. Do not explain. Return JSON exactly as "
            '{"translations":[{"id":"course:index","title_zh":"中文标题"}]}.\n\n'
            + json.dumps(items, ensure_ascii=False)
        )

        async with semaphore:
            for attempt in range(args.retries + 1):
                try:
                    response = await client.chat.completions.create(
                        model=args.model,
                        max_tokens=4096,
                        temperature=0.2,
                        messages=[
                            {"role": "system", "content": "You are a JSON API. Output raw JSON only."},
                            {"role": "user", "content": prompt},
                        ],
                    )
                    payload = json.loads(response.choices[0].message.content or "{}")
                    translated = {
                        str(item["id"]): str(item["title_zh"]).strip()
                        for item in payload.get("translations", [])
                        if item.get("id") and str(item.get("title_zh", "")).strip()
                    }
                    expected = {item["id"] for item in items}
                    if expected <= translated.keys():
                        print(f"[title] 批次 {batch_index}/{len(batches)} 完成（{len(items)} 篇）", flush=True)
                        return translated
                    raise ValueError(f"缺少 {len(expected - translated.keys())} 个标题")
                except Exception as exc:  # noqa: BLE001
                    print(f"[title] 批次 {batch_index} 第 {attempt + 1} 次失败：{exc}", flush=True)

        raise RuntimeError(f"标题批次 {batch_index} 连续失败")

    results = await asyncio.gather(
        *(translate_batch(batch, index) for index, batch in enumerate(batches, start=1))
    )
    translations = {key: value for result in results for key, value in result.items()}

    updated = 0
    for course_id, data in course_data.items():
        for article in (data.get("course") or {}).get("articles", []):
            title_zh = translations.get(f"{course_id}:{article['index']}")
            if title_zh:
                article["title_zh"] = title_zh
                updated += 1

        path = OUT_DIR / f"{course_id}_course.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    subprocess.run(
        [str(BACKEND / ".venv/bin/python"), str(BACKEND / "scripts/export_frontend_data.py")],
        cwd=BACKEND,
        check=True,
    )
    print(f"[title] 已回填并导出 {updated} 个中文标题")


if __name__ == "__main__":
    asyncio.run(main())
