import json
import re
from typing import Any

from openai import AsyncOpenAI

from app.models.generate import ModelConfig


class AIClient:
    """统一封装 OpenAI 兼容接口。mock 配置用于本地无 Key 验证流水线。"""

    def __init__(self, config: ModelConfig):
        self.config = config
        self.mock_mode = config.api_key.startswith("mock-") or config.model_name == "mock"
        self.client = None if self.mock_mode else AsyncOpenAI(
            base_url=str(config.base_url),
            api_key=config.api_key,
        )

    async def chat(self, system: str, user: str) -> str:
        if self.mock_mode:
            return self._mock_article_response(user)

        assert self.client is not None
        response = await self.client.chat.completions.create(
            model=self.config.model_name,
            max_tokens=self.config.max_tokens,
            temperature=self.config.temperature,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        content = response.choices[0].message.content
        return content or ""

    async def chat_json(self, system: str, user: str) -> dict[str, Any]:
        content = await self.chat(system, user)
        cleaned = _strip_json_markdown(content)
        return json.loads(cleaned)

    def _mock_article_response(self, user_prompt: str) -> str:
        topic = _extract_after(user_prompt, "Theme:", "\n") or "综合词汇"
        topic_cn, _, topic_en_raw = topic.partition("（")
        topic_en = topic_en_raw.rstrip("）") if topic_en_raw else "General Vocabulary"
        words = _extract_word_block(user_prompt)
        title = f"A Story About {topic_en}"

        sentences = []
        used = []
        for idx, word in enumerate(words, start=1):
            sentence_id = f"{idx}-1"
            sentences.append({
                "id": sentence_id,
                "en": f"Lina used the word {word} in a clear sentence during her daily reading practice.",
                "zh": f"Lina 在每天的阅读练习中，用一个清楚的句子使用了 {word} 这个词。",
                "target_words": [word],
            })
            used.append({"word": word, "form_used": word, "sentence_id": sentence_id})

        paragraphs = [
            {"id": idx, "sentences": [sentence]}
            for idx, sentence in enumerate(sentences, start=1)
        ]

        return json.dumps({
            "title": title,
            "topic": topic_cn.strip(),
            "topic_en": topic_en.strip(),
            "paragraphs": paragraphs,
            "target_words_used": used,
        }, ensure_ascii=False)


def _strip_json_markdown(content: str) -> str:
    stripped = content.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?", "", stripped).strip()
        stripped = re.sub(r"```$", "", stripped).strip()
    return stripped


def _extract_after(text: str, start: str, end: str) -> str | None:
    start_index = text.find(start)
    if start_index == -1:
        return None
    start_index += len(start)
    end_index = text.find(end, start_index)
    if end_index == -1:
        return text[start_index:].strip()
    return text[start_index:end_index].strip()


def _extract_word_block(user_prompt: str) -> list[str]:
    marker = "Target words to include"
    start = user_prompt.find(marker)
    if start == -1:
        return []
    start = user_prompt.find(":\n", start)
    if start == -1:
        return []
    start += 2
    end = user_prompt.find("\n\n", start)
    block = user_prompt[start:end if end != -1 else len(user_prompt)]
    return [line.strip().lower() for line in block.splitlines() if line.strip()]
