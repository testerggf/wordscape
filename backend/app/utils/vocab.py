import math
import re


WORD_RE = re.compile(r"^[a-zA-Z][a-zA-Z'-]{1,}$")

TOPIC_KEYWORDS: dict[str, set[str]] = {
    "校园生活": {"academic", "assignment", "campus", "class", "course", "deadline", "dormitory", "exam", "library", "proposal", "research", "semester", "student", "submit"},
    "职场与经济": {"budget", "business", "career", "company", "cooperate", "economy", "enterprise", "interview", "market", "negotiate", "pressure", "salary", "team"},
    "科技与创新": {"algorithm", "artificial", "data", "device", "digital", "engineering", "innovation", "internet", "robot", "software", "technology"},
    "文化与旅游": {"ancient", "culture", "district", "heritage", "journey", "museum", "route", "tradition", "travel"},
    "健康与生活": {"accident", "anxiety", "diet", "health", "recovery", "regular", "routine", "strength", "therapy"},
}


def split_raw_vocab(raw_text: str) -> list[str]:
    return [item.strip() for item in re.split(r"[\s,;，；]+", raw_text) if item.strip()]


def clean_word(item: str) -> str | None:
    first_part = item.strip().split(" ")[0].strip().lower()
    first_part = re.sub(r"^[^a-zA-Z]+|[^a-zA-Z'-]+$", "", first_part)

    if not first_part or not WORD_RE.match(first_part):
        return None

    return first_part


def preview_vocab(raw_text: str) -> dict:
    items = split_raw_vocab(raw_text)
    seen: set[str] = set()
    valid_words: list[str] = []
    invalid_items: list[str] = []
    duplicate_count = 0

    for item in items:
        word = clean_word(item)
        if not word:
            invalid_items.append(item)
            continue
        if word in seen:
            duplicate_count += 1
            continue
        seen.add(word)
        valid_words.append(word)

    return {
        "total_input_items": len(items),
        "valid_words": valid_words,
        "invalid_items": invalid_items,
        "duplicate_count": duplicate_count,
        "estimated_articles": max(1, math.ceil(len(valid_words) / 100)) if valid_words else 0,
        "topic_preview": build_topic_preview(valid_words),
    }


def build_topic_preview(words: list[str]) -> list[dict[str, int | str]]:
    counts: dict[str, int] = {}

    for word in words:
        topic = infer_topic(word)
        counts[topic] = counts.get(topic, 0) + 1

    return [
        {"topic": topic, "count": count}
        for topic, count in sorted(counts.items(), key=lambda item: item[1], reverse=True)
    ]


def infer_topic(word: str) -> str:
    for topic, keywords in TOPIC_KEYWORDS.items():
        if word in keywords:
            return topic
    return "综合词汇"
