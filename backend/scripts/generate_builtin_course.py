"""批量生成内置课程（40 篇级别）与配套词典数据。

用法示例（真实模型）：

    python scripts/generate_builtin_course.py \
        --vocab data/builtin_vocabs/cet4.txt \
        --name "大学英语四级" \
        --base-url https://api.deepseek.com/v1 \
        --api-key sk-xxx \
        --model deepseek-chat \
        --output out/cet4_course.json \
        --to-supabase

无 Key 干跑（mock 模型，验证脚本与数据结构）：

    python scripts/generate_builtin_course.py --vocab words.txt --mock --output out/mock.json

输出 JSON 结构：
    {"course": GenerateCourseResponse, "dict_entries": [DictEntry...]}

说明：
- 单篇质检不过或异常会自动重试（--retries 控制），保留最后一次成功结果。
- 词典按 20 词一批生成，缺词自动补跑。
- --to-supabase 使用 backend/.env 的 service role 配置写入数据库（前 5 篇 is_free）。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.generate import GenerateCourseRequest, GenerateCourseResponse, GeneratedArticle, ModelConfig
from app.services.ai_client import AIClient
from app.services.generation.article_writer import ArticleWriter
from app.services.generation.pipeline import GenerationPipeline

DICT_PROMPT_PATH = Path(__file__).resolve().parents[1] / "prompts" / "dict_generation.txt"
DICT_BATCH_SIZE = 20


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="批量生成内置课程与词典数据")
    parser.add_argument("--vocab", required=True, help="词表文件（每行一词或逗号分隔）")
    parser.add_argument("--name", default="大学英语四级", help="课程/词库名称")
    parser.add_argument("--base-url", default="http://mock.local/v1")
    parser.add_argument("--api-key", default="")
    parser.add_argument("--model", default="gpt-4o-mini")
    parser.add_argument("--max-tokens", type=int, default=8192)
    parser.add_argument("--temperature", type=float, default=0.8)
    parser.add_argument("--max-articles", type=int, default=None)
    parser.add_argument("--retries", type=int, default=2, help="单篇失败/质检不过的重试次数")
    parser.add_argument("--concurrency", type=int, default=4, help="文章/词典批次的并发数")
    parser.add_argument("--output", required=True, help="输出 JSON 文件路径")
    parser.add_argument("--skip-dict", action="store_true", help="跳过词典数据生成")
    parser.add_argument("--to-supabase", action="store_true", help="课程写入 Supabase（需 backend/.env 配置）")
    parser.add_argument("--mock", action="store_true", help="使用 mock 模型干跑")
    return parser.parse_args()


def load_words(path: str) -> list[str]:
    text = Path(path).read_text(encoding="utf-8")
    words = [item.strip() for item in re.split(r"[\s,;，；、]+", text) if item.strip()]
    seen: set[str] = set()
    unique: list[str] = []
    for word in words:
        key = word.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(word)
    return unique


async def generate_articles(
    pipeline: GenerationPipeline,
    writer: ArticleWriter,
    request: GenerateCourseRequest,
    retries: int,
    concurrency: int,
) -> GenerateCourseResponse:
    processed_words, plans = pipeline.prepare(request)
    print(f"[plan] {len(processed_words)} 个有效词 → {len(plans)} 篇", flush=True)

    semaphore = asyncio.Semaphore(max(1, concurrency))
    done_count = 0

    async def write_with_retry(plan) -> GeneratedArticle:
        nonlocal done_count
        async with semaphore:
            article: GeneratedArticle | None = None
            for attempt in range(retries + 1):
                try:
                    candidate = await pipeline.write_article(writer, plan)
                except Exception as exc:  # noqa: BLE001
                    print(f"[article {plan.index}] 第 {attempt + 1} 次生成异常：{str(exc)[:120]}", flush=True)
                    continue

                article = candidate
                if candidate.quality.get("passed"):
                    break
                print(f"[article {plan.index}] 第 {attempt + 1} 次质检不过：{candidate.quality.get('issues')}", flush=True)

            if article is None:
                raise RuntimeError(f"第 {plan.index} 篇连续 {retries + 1} 次生成失败，中止。可稍后重跑脚本。")

            done_count += 1
            status = "✓" if article.quality.get("passed") else "⚠ 质检未过（保留最后一次结果）"
            print(
                f"[article {done_count}/{len(plans)}] #{plan.index} {article.title} — {article.word_count} 词，覆盖率 {article.quality.get('coverage'):.0%} {status}",
                flush=True,
            )
            return article

    articles = list(await asyncio.gather(*(write_with_retry(plan) for plan in plans)))
    articles.sort(key=lambda item: item.index)

    return GenerateCourseResponse(
        course_title=request.vocab_set_name,
        total_words=len(processed_words),
        total_articles=len(articles),
        articles=articles,
    )


def mock_dict_entry(word: str) -> dict:
    return {
        "word": word,
        "phonetic": f"/{word}/",
        "pos": "n.",
        "definitions": [f"{word} 的释义（mock）"],
        "etymology": "",
        "examples": [
            {"en": f"This is a mock example sentence with {word}.", "zh": f"这是包含 {word} 的示例句（mock）。"},
            {"en": f"Another sentence uses {word} naturally.", "zh": f"另一个句子自然地使用了 {word}。"},
        ],
    }


async def generate_dictionary(client: AIClient, words: list[str], retries: int, concurrency: int) -> list[dict]:
    system_prompt = DICT_PROMPT_PATH.read_text(encoding="utf-8")
    entries: dict[str, dict] = {}
    pending = [word.lower() for word in words]
    semaphore = asyncio.Semaphore(max(1, concurrency))

    async def run_batch(batch: list[str], batch_index: int, total: int) -> tuple[list[str], dict[str, dict]]:
        if client.mock_mode:
            return batch, {word: mock_dict_entry(word) for word in batch}

        async with semaphore:
            try:
                payload = await client.chat_json(system=system_prompt, user="\n".join(batch))
                got = {str(item.get("word", "")).lower(): item for item in payload.get("entries", []) if item.get("word")}
                print(f"[dict] 批次 {batch_index}/{total} 完成（{len(got)}/{len(batch)} 词）", flush=True)
                return batch, got
            except Exception as exc:  # noqa: BLE001
                print(f"[dict] 批次 {batch_index}/{total} 失败：{str(exc)[:120]}", flush=True)
                return batch, {}

    for round_index in range(retries + 1):
        if not pending:
            break

        batches = [pending[i : i + DICT_BATCH_SIZE] for i in range(0, len(pending), DICT_BATCH_SIZE)]
        print(f"[dict] 第 {round_index + 1} 轮：待生成 {len(pending)} 词，共 {len(batches)} 批", flush=True)

        results = await asyncio.gather(
            *(run_batch(batch, index, len(batches)) for index, batch in enumerate(batches, start=1))
        )

        next_pending: list[str] = []
        for batch, got in results:
            for word in batch:
                if word in got:
                    entries[word] = got[word]
                else:
                    next_pending.append(word)

        pending = next_pending

    if pending:
        print(f"[dict] ⚠ 仍缺 {len(pending)} 词的词典数据：{pending[:10]} ...", flush=True)

    return list(entries.values())


async def main() -> None:
    args = parse_args()
    words = load_words(args.vocab)
    if not words:
        raise SystemExit("词表为空")

    if args.mock:
        config = ModelConfig(base_url="http://mock.local/v1", api_key="mock-local", model_name="mock")
    else:
        if not args.api_key:
            raise SystemExit("非 mock 模式需要 --api-key")
        config = ModelConfig(
            base_url=args.base_url,
            api_key=args.api_key,
            model_name=args.model,
            max_tokens=args.max_tokens,
            temperature=args.temperature,
        )

    request = GenerateCourseRequest(
        vocab_set_name=args.name,
        words=words,
        model_config=config,
        max_articles=args.max_articles,
    )

    pipeline = GenerationPipeline()
    client = AIClient(config)
    writer = ArticleWriter(client)

    course = await generate_articles(pipeline, writer, request, retries=args.retries, concurrency=args.concurrency)

    dict_entries: list[dict] = []
    if not args.skip_dict:
        # 词典覆盖全部目标词（含复现词），用课程计划里的词（即清洗后的词表）
        dict_entries = await generate_dictionary(client, words, retries=args.retries, concurrency=args.concurrency)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(
            {"course": course.model_dump(), "dict_entries": dict_entries},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"[out] 已写入 {output_path}（{course.total_articles} 篇文章，{len(dict_entries)} 条词典）")

    if args.to_supabase:
        from app.services.supabase_service import SupabaseService

        service = SupabaseService()
        result = await service.insert_generated_course(
            user_id=None,
            vocab_set_name=args.name,
            source_words=words,
            generated=course,
        )
        print(f"[supabase] 已写入课程：{result}")


if __name__ == "__main__":
    asyncio.run(main())
