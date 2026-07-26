from dataclasses import dataclass
from itertools import groupby
from collections import Counter

from app.services.generation.vocab_processor import ProcessedWord


TARGET_WORDS_PER_ARTICLE = 100
REVIEW_WORDS_PER_ARTICLE = 20
# 少于此数的话题组并入"综合词汇"，尾块少于此数并入前一块，避免生成一句话的"文章"
MIN_CHUNK_WORDS = 30

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

        # 小话题组并入"综合词汇"，具体话题在前、综合在后
        general: list[str] = []
        topic_groups: list[tuple[str, list[str]]] = []
        for topic, group in groupby(sorted_words, key=lambda item: item.topic):
            topic_words = [item.word for item in group]
            if topic == "综合词汇" or len(topic_words) < MIN_CHUNK_WORDS:
                general.extend(topic_words)
            else:
                topic_groups.append((topic, topic_words))
        if general:
            topic_groups.append(("综合词汇", general))

        for topic, topic_words in topic_groups:
            chunks = [
                topic_words[start:start + TARGET_WORDS_PER_ARTICLE]
                for start in range(0, len(topic_words), TARGET_WORDS_PER_ARTICLE)
            ]
            # 尾块过小则并入前一块
            if len(chunks) >= 2 and len(chunks[-1]) < MIN_CHUNK_WORDS:
                chunks[-2].extend(chunks.pop())

            for chunk in chunks:
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
