"""把本地内置课程和词典幂等迁移到 Supabase。

默认只展示迁移规模；必须显式传入 --apply 才会写数据库。

    python scripts/migrate_builtin_to_supabase.py
    python scripts/migrate_builtin_to_supabase.py --apply
    python scripts/migrate_builtin_to_supabase.py --verify-only

本脚本不会删除任何本地 JSON/TXT。数据库侧按 builtin_id、课程关系和唯一键
复用现有记录；文章目标词关系会在对应文章范围内先清理再重建，避免重复。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path
from typing import Any

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings


BACKEND = Path(__file__).resolve().parents[1]
VOCAB_DIR = BACKEND / "data" / "builtin_vocabs"
OUT_DIR = VOCAB_DIR / "out"
DICT_PATH = BACKEND.parent / "frontend/public/dict/builtin.json"
REPORT_PATH = BACKEND / "data/reports/supabase-migration.json"
COURSES = [
    ("primary", "小学英语词汇"),
    ("junior", "初中英语词汇"),
    ("senior", "高中英语词汇"),
    ("cet4", "大学英语四级"),
    ("cet6", "大学英语六级核心"),
    ("daily", "日常高频词汇"),
    ("business", "职场商务英语"),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="迁移内置课程和词典到 Supabase")
    parser.add_argument("--apply", action="store_true", help="执行数据库写入")
    parser.add_argument("--verify-only", action="store_true", help="只验证数据库现状")
    parser.add_argument("--batch-size", type=int, default=250)
    return parser.parse_args()


def load_words(course_id: str) -> list[str]:
    text = (VOCAB_DIR / f"{course_id}.txt").read_text(encoding="utf-8")
    words = [item.strip() for item in re.split(r"[\s,;，；、]+", text) if item.strip()]
    return list(dict.fromkeys(word.lower() for word in words))


def load_course(course_id: str) -> dict[str, Any]:
    data = json.loads((OUT_DIR / f"{course_id}_course.json").read_text(encoding="utf-8"))
    course = data.get("course")
    if not course or not course.get("articles"):
        raise RuntimeError(f"{course_id} 缺少有效课程数据")
    return course


def load_dictionary() -> list[dict[str, Any]]:
    data = json.loads(DICT_PATH.read_text(encoding="utf-8"))
    return [data[key] for key in sorted(data)]


def chunks(items: list[Any], size: int):
    for index in range(0, len(items), size):
        yield items[index:index + size]


class SupabaseRest:
    def __init__(self) -> None:
        if not settings.supabase_url or not settings.supabase_service_key:
            raise RuntimeError("Supabase URL 或 service role key 未配置")
        self.base_url = settings.supabase_url.rstrip("/") + "/rest/v1"
        self.headers = {
            "apikey": settings.supabase_service_key,
            "Authorization": f"Bearer {settings.supabase_service_key}",
            "Content-Type": "application/json",
        }
        self.client = httpx.AsyncClient(timeout=60)

    async def close(self) -> None:
        await self.client.aclose()

    async def select(
        self,
        table: str,
        *,
        columns: str = "*",
        filters: dict[str, str] | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {"select": columns}
        params.update(filters or {})
        if limit is not None:
            params["limit"] = str(limit)
        response = await self.client.get(f"{self.base_url}/{table}", headers=self.headers, params=params)
        response.raise_for_status()
        data = response.json()
        return data if isinstance(data, list) else []

    async def count(self, table: str, filters: dict[str, str] | None = None) -> int:
        headers = {**self.headers, "Prefer": "count=exact", "Range": "0-0"}
        params: dict[str, str] = {"select": "id"}
        params.update(filters or {})
        response = await self.client.get(f"{self.base_url}/{table}", headers=headers, params=params)
        response.raise_for_status()
        content_range = response.headers.get("content-range", "*/0")
        return int(content_range.rsplit("/", 1)[-1])

    async def insert(self, table: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        headers = {**self.headers, "Prefer": "return=representation"}
        response = await self.client.post(f"{self.base_url}/{table}", headers=headers, json=rows)
        response.raise_for_status()
        return response.json()

    async def update(
        self,
        table: str,
        payload: dict[str, Any],
        filters: dict[str, str],
    ) -> list[dict[str, Any]]:
        headers = {**self.headers, "Prefer": "return=representation"}
        response = await self.client.patch(
            f"{self.base_url}/{table}",
            headers=headers,
            params=filters,
            json=payload,
        )
        response.raise_for_status()
        return response.json()

    async def upsert(
        self,
        table: str,
        rows: list[dict[str, Any]],
        *,
        on_conflict: str,
    ) -> list[dict[str, Any]]:
        headers = {
            **self.headers,
            "Prefer": "resolution=merge-duplicates,return=representation",
        }
        response = await self.client.post(
            f"{self.base_url}/{table}",
            headers=headers,
            params={"on_conflict": on_conflict},
            json=rows,
        )
        response.raise_for_status()
        return response.json()

    async def delete(self, table: str, filters: dict[str, str]) -> None:
        response = await self.client.delete(
            f"{self.base_url}/{table}",
            headers=self.headers,
            params=filters,
        )
        response.raise_for_status()


async def get_or_create_vocab_set(
    db: SupabaseRest,
    course_id: str,
    name: str,
    course: dict[str, Any],
) -> str:
    payload = {
        "user_id": None,
        "name": name,
        "source": "builtin",
        "builtin_id": course_id,
        "word_count": course["total_words"],
        "article_count": course["total_articles"],
        "status": "ready",
        "gen_progress": course["total_articles"],
        "settings": {"local_fallback": True, "schema_version": 1},
    }
    existing = await db.select(
        "vocab_sets",
        columns="id",
        filters={"builtin_id": f"eq.{course_id}", "source": "eq.builtin"},
        limit=1,
    )
    if existing:
        await db.update("vocab_sets", payload, {"id": f"eq.{existing[0]['id']}"})
        return str(existing[0]["id"])
    return str((await db.insert("vocab_sets", [payload]))[0]["id"])


async def get_or_create_course(
    db: SupabaseRest,
    vocab_set_id: str,
    course: dict[str, Any],
) -> str:
    payload = {
        "vocab_set_id": vocab_set_id,
        "user_id": None,
        "title": course["course_title"],
        "total_articles": course["total_articles"],
    }
    existing = await db.select(
        "courses",
        columns="id",
        filters={"vocab_set_id": f"eq.{vocab_set_id}"},
        limit=1,
    )
    if existing:
        await db.update("courses", payload, {"id": f"eq.{existing[0]['id']}"})
        return str(existing[0]["id"])
    return str((await db.insert("courses", [payload]))[0]["id"])


async def migrate_course(
    db: SupabaseRest,
    course_id: str,
    name: str,
    batch_size: int,
) -> dict[str, Any]:
    generated = load_course(course_id)
    source_words = load_words(course_id)
    vocab_set_id = await get_or_create_vocab_set(db, course_id, name, generated)
    cloud_course_id = await get_or_create_course(db, vocab_set_id, generated)

    vocab_rows = [
        {
            "vocab_set_id": vocab_set_id,
            "word": word,
            "frequency_rank": None,
            "topic_tags": [],
        }
        for word in source_words
    ]
    for batch in chunks(vocab_rows, batch_size):
        await db.upsert("vocab_words", batch, on_conflict="vocab_set_id,word")

    article_rows = [
        {
            "course_id": cloud_course_id,
            "vocab_set_id": vocab_set_id,
            "index": article["index"],
            "title": article["title"],
            "topic": article["topic"],
            "topic_en": article.get("topic_en"),
            "content": {
                "title_zh": article.get("title_zh", article["topic"]),
                "paragraphs": article["paragraphs"],
            },
            "target_word_count": article["target_word_count"],
            "word_count": article["word_count"],
            "is_free": article["index"] <= 5,
            "quality": article.get("quality", {}),
        }
        for article in generated["articles"]
    ]
    cloud_articles: list[dict[str, Any]] = []
    for batch in chunks(article_rows, 50):
        cloud_articles.extend(await db.upsert("articles", batch, on_conflict="course_id,index"))

    article_ids = {int(row["index"]): str(row["id"]) for row in cloud_articles}
    target_rows: list[dict[str, Any]] = []
    for article in generated["articles"]:
        article_id = article_ids[article["index"]]
        await db.delete("article_target_words", {"article_id": f"eq.{article_id}"})
        target_rows.extend([
            {
                "article_id": article_id,
                "word": item.get("word", ""),
                "sentence_id": item.get("sentence_id", ""),
                "form_used": item.get("form_used", ""),
            }
            for item in article.get("target_words_used", [])
            if item.get("word") and item.get("sentence_id") and item.get("form_used")
        ])
    for batch in chunks(target_rows, batch_size):
        await db.insert("article_target_words", batch)

    print(
        f"[migrate] {course_id}: {len(source_words)} 词 / "
        f"{len(article_rows)} 篇 / {len(target_rows)} 个目标词关联",
        flush=True,
    )
    return {
        "builtin_id": course_id,
        "vocab_set_id": vocab_set_id,
        "course_id": cloud_course_id,
        "vocab_words": len(source_words),
        "articles": len(article_rows),
        "target_words": len(target_rows),
    }


async def migrate_dictionary(db: SupabaseRest, batch_size: int) -> int:
    entries = load_dictionary()
    rows = [
        {
            "word": str(entry["word"]).lower(),
            "phonetic": entry.get("phonetic"),
            "pos": entry.get("pos"),
            "definitions": entry.get("definitions", []),
            "etymology": entry.get("etymology"),
            "examples": entry.get("examples", []),
        }
        for entry in entries
    ]
    for index, batch in enumerate(chunks(rows, batch_size), start=1):
        await db.upsert("dict_entries", batch, on_conflict="word")
        print(f"[migrate] 词典批次 {index}，累计 {min(index * batch_size, len(rows))}/{len(rows)}", flush=True)
    return len(rows)


async def verify(db: SupabaseRest) -> dict[str, Any]:
    by_course: list[dict[str, Any]] = []
    for course_id, _ in COURSES:
        vocab_sets = await db.select(
            "vocab_sets",
            columns="id,word_count,article_count,status",
            filters={"builtin_id": f"eq.{course_id}", "source": "eq.builtin"},
        )
        if len(vocab_sets) != 1:
            by_course.append({"builtin_id": course_id, "error": f"vocab_sets={len(vocab_sets)}"})
            continue
        vocab_set = vocab_sets[0]
        course_rows = await db.select(
            "courses",
            columns="id,total_articles",
            filters={"vocab_set_id": f"eq.{vocab_set['id']}"},
        )
        course_id_cloud = course_rows[0]["id"] if len(course_rows) == 1 else ""
        article_count = await db.count("articles", {"course_id": f"eq.{course_id_cloud}"}) if course_id_cloud else 0
        free_count = await db.count(
            "articles",
            {"course_id": f"eq.{course_id_cloud}", "is_free": "eq.true"},
        ) if course_id_cloud else 0
        vocab_count = await db.count("vocab_words", {"vocab_set_id": f"eq.{vocab_set['id']}"})
        target_count = await db.count(
            "article_target_words",
            {"article_id": f"in.({','.join(str(row['id']) for row in await db.select('articles', columns='id', filters={'course_id': f'eq.{course_id_cloud}'}) )})"},
        ) if article_count else 0
        by_course.append({
            "builtin_id": course_id,
            "vocab_sets": 1,
            "courses": len(course_rows),
            "vocab_words": vocab_count,
            "articles": article_count,
            "free_articles": free_count,
            "target_words": target_count,
            "status": vocab_set["status"],
        })

    return {
        "vocab_sets": await db.count("vocab_sets", {"source": "eq.builtin"}),
        "courses": await db.count("courses"),
        "articles": await db.count("articles"),
        "free_articles": await db.count("articles", {"is_free": "eq.true"}),
        "article_target_words": await db.count("article_target_words"),
        "dict_entries": await db.count("dict_entries"),
        "by_course": by_course,
    }


async def main() -> None:
    args = parse_args()
    local_summary = {
        "courses": len(COURSES),
        "articles": sum(load_course(course_id)["total_articles"] for course_id, _ in COURSES),
        "dict_entries": len(load_dictionary()),
        "local_files_preserved": True,
    }
    print("[local]", json.dumps(local_summary, ensure_ascii=False))

    db = SupabaseRest()
    try:
        if args.verify_only:
            print(json.dumps(await verify(db), ensure_ascii=False, indent=2))
            return
        if not args.apply:
            print("[dry-run] 未写数据库；传入 --apply 执行迁移")
            return

        migrated_courses = [
            await migrate_course(db, course_id, name, args.batch_size)
            for course_id, name in COURSES
        ]
        dictionary_count = await migrate_dictionary(db, args.batch_size)
        verification = await verify(db)
        report = {
            "local": local_summary,
            "migrated_courses": migrated_courses,
            "migrated_dictionary": dictionary_count,
            "verification": verification,
        }
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print("[verify]", json.dumps(verification, ensure_ascii=False, indent=2))
        print(f"[report] {REPORT_PATH.relative_to(BACKEND.parent)}")
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
