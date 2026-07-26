from dataclasses import dataclass
from itertools import groupby
from collections import Counter

from app.services.generation.vocab_processor import ProcessedWord


TARGET_WORDS_PER_ARTICLE = 100
REVIEW_WORDS_PER_ARTICLE = 20

TOPIC_EN = {
    "校园生活": "Campus Life",
    "职场与经济": "Work and Economy",
    "科技与创新": "Technology and Innovation",
    "文化与旅游": "Culture and Travel",
    "健康与生活": "Health and Life",
    "综合词汇": "General Vocabulary",
}


@dataclass(frozen=True)
class ArticlePlan:
    index: int
    topic: str
    topic_en: str
    target_words: list[str]
    review_words: list[str]


class CoursePlanner:
    def plan(self, words: list[ProcessedWord], max_articles: int | None = None) -> list[ArticlePlan]:
        plans: list[ArticlePlan] = []
        history: list[str] = []
        index = 1

        if len(words) <= TARGET_WORDS_PER_ARTICLE:
            topic = self._dominant_topic(words)
            return [ArticlePlan(
                index=1,
                topic=topic,
                topic_en=TOPIC_EN.get(topic, "General Vocabulary"),
                target_words=[item.word for item in sorted(words, key=lambda item: (-item.frequency_rank, item.word))],
                review_words=[],
            )]

        sorted_words = sorted(words, key=lambda item: (item.topic, -item.frequency_rank, item.word))
        for topic, group in groupby(sorted_words, key=lambda item: item.topic):
            topic_words = [item.word for item in group]
            for start in range(0, len(topic_words), TARGET_WORDS_PER_ARTICLE):
                chunk = topic_words[start:start + TARGET_WORDS_PER_ARTICLE]
                if not chunk:
                    continue

                plans.append(ArticlePlan(
                    index=index,
                    topic=topic,
                    topic_en=TOPIC_EN.get(topic, "General Vocabulary"),
                    target_words=chunk,
                    review_words=history[-REVIEW_WORDS_PER_ARTICLE:],
                ))
                history.extend(chunk)
                index += 1

                if max_articles and len(plans) >= max_articles:
                    return plans

        return plans

    def _dominant_topic(self, words: list[ProcessedWord]) -> str:
        counter = Counter(item.topic for item in words)
        topic, count = counter.most_common(1)[0]
        if count / len(words) >= 0.5:
            return topic
        return "综合词汇"
