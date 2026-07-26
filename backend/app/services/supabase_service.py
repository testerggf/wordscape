from typing import Any

import httpx

from app.config import settings
from app.models.generate import GenerateCourseResponse


class SupabaseNotConfiguredError(RuntimeError):
    pass


class SupabaseService:
    """使用 service role 访问 Supabase REST API。"""

    def __init__(self) -> None:
        if not settings.supabase_url or not settings.supabase_service_key:
            raise SupabaseNotConfiguredError("Supabase URL 或 service key 未配置")

        self.base_url = settings.supabase_url.rstrip("/") + "/rest/v1"
        self.headers = {
            "apikey": settings.supabase_service_key,
            "Authorization": f"Bearer {settings.supabase_service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    async def insert_generated_course(
        self,
        *,
        user_id: str | None,
        vocab_set_name: str,
        source_words: list[str],
        generated: GenerateCourseResponse,
    ) -> dict[str, Any]:
        vocab_set = await self._insert_one("vocab_sets", {
            "user_id": user_id,
            "name": vocab_set_name,
            "source": "custom",
            "word_count": generated.total_words,
            "article_count": generated.total_articles,
            "status": "ready",
            "gen_progress": generated.total_articles,
        })

        vocab_set_id = vocab_set["id"]
        if source_words:
            await self._insert_many("vocab_words", [
                {
                    "vocab_set_id": vocab_set_id,
                    "word": word,
                    "frequency_rank": None,
                    "topic_tags": [],
                }
                for word in source_words
            ])

        course = await self._insert_one("courses", {
            "vocab_set_id": vocab_set_id,
            "user_id": user_id,
            "title": generated.course_title,
            "total_articles": generated.total_articles,
        })

        for article in generated.articles:
            article_row = await self._insert_one("articles", {
                "course_id": course["id"],
                "vocab_set_id": vocab_set_id,
                "index": article.index,
                "title": article.title,
                "topic": article.topic,
                "topic_en": article.topic_en,
                "content": {"paragraphs": [paragraph.model_dump() for paragraph in article.paragraphs]},
                "target_word_count": article.target_word_count,
                "word_count": article.word_count,
                "is_free": article.index <= 5,
                "quality": article.quality,
            })

            if article.target_words_used:
                await self._insert_many("article_target_words", [
                    {
                        "article_id": article_row["id"],
                        "word": item.get("word"),
                        "sentence_id": item.get("sentence_id"),
                        "form_used": item.get("form_used"),
                    }
                    for item in article.target_words_used
                ])

        return {
            "vocab_set_id": vocab_set_id,
            "course_id": course["id"],
        }

    async def _insert_one(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        rows = await self._insert_many(table, [payload])
        return rows[0]

    async def _insert_many(self, table: str, payload: list[dict[str, Any]]) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.base_url}/{table}",
                headers=self.headers,
                json=payload,
            )

        response.raise_for_status()
        data = response.json()
        return data if isinstance(data, list) else [data]
