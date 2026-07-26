from pathlib import Path

from app.services.ai_client import AIClient
from app.services.generation.course_planner import ArticlePlan


PROMPT_PATH = Path(__file__).resolve().parents[3] / "prompts" / "article_generation.txt"


class ArticleWriter:
    def __init__(self, ai_client: AIClient):
        self.ai_client = ai_client
        self.prompt = PROMPT_PATH.read_text(encoding="utf-8")

    async def write(self, plan: ArticlePlan) -> dict:
        word_list = "\n".join(plan.target_words)
        review_words = ", ".join(plan.review_words) if plan.review_words else "None"
        # 完整指令放进 user 消息：部分中转/模型对长 system prompt 的遵循很弱
        user_prompt = (
            f"{self.prompt}\n\n---\n"
            f"Theme: {plan.topic}（{plan.topic_en}）\n"
            f"Target words to include ({len(plan.target_words)} words):\n{word_list}\n\n"
            f"Review words to naturally reuse if possible:\n{review_words}"
        )
        article = await self.ai_client.chat_json(
            system="You are a JSON API. Output raw JSON only — no markdown fences, no commentary.",
            user=user_prompt,
        )
        article.setdefault("topic", plan.topic)
        article.setdefault("topic_en", plan.topic_en)
        return article
