"""审计内置课程结构、重复度和正文词典覆盖率。

输出：
    data/reports/content-audit.json
    data/reports/content-audit.md
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
OUT_DIR = BACKEND / "data" / "builtin_vocabs" / "out"
FRONTEND_DICT = BACKEND.parent / "frontend" / "public" / "dict" / "builtin.json"
REPORT_DIR = BACKEND / "data" / "reports"
COURSE_IDS = ["primary", "junior", "senior", "cet4", "cet6", "daily", "business"]
TOKEN_RE = re.compile(r"[A-Za-z]+(?:['-][A-Za-z]+)*")

IRREGULAR = {
    "went": "go", "gone": "go", "did": "do", "done": "do", "had": "have", "has": "have",
    "was": "be", "were": "be", "been": "be", "is": "be", "are": "be", "am": "be",
    "made": "make", "took": "take", "taken": "take", "came": "come", "saw": "see",
    "seen": "see", "got": "get", "gotten": "get", "gave": "give", "given": "give",
    "found": "find", "told": "tell", "said": "say", "left": "leave", "felt": "feel",
    "kept": "keep", "brought": "bring", "bought": "buy", "thought": "think",
    "taught": "teach", "caught": "catch", "ran": "run", "sat": "sit", "stood": "stand",
    "held": "hold", "heard": "hear", "met": "meet", "paid": "pay", "sent": "send",
    "built": "build", "spent": "spend", "lost": "lose", "meant": "mean", "led": "lead",
    "wrote": "write", "written": "write", "spoke": "speak", "spoken": "speak",
    "broke": "break", "broken": "break", "chose": "choose", "chosen": "choose",
    "drove": "drive", "driven": "drive", "grew": "grow", "grown": "grow", "knew": "know",
    "known": "know", "threw": "throw", "thrown": "throw", "drew": "draw", "drawn": "draw",
    "flew": "fly", "flown": "fly", "wore": "wear", "worn": "wear", "rose": "rise",
    "risen": "rise", "fell": "fall", "fallen": "fall", "began": "begin", "begun": "begin",
    "woke": "wake", "woken": "wake", "won": "win", "sold": "sell",
    "understood": "understand", "children": "child", "men": "man", "women": "woman",
    "feet": "foot", "teeth": "tooth", "mice": "mouse", "people": "person", "lives": "life",
    "better": "good", "best": "good", "worse": "bad", "worst": "bad",
}


def lemma_candidates(raw: str) -> list[str]:
    word = raw.lower().strip("'")
    out: list[str] = []

    def push(candidate: str) -> None:
        if len(candidate) >= 2 and candidate not in out:
            out.append(candidate)

    push(word)
    if word in IRREGULAR:
        push(IRREGULAR[word])
    if word.endswith("'s"):
        push(word[:-2])
    if word.endswith("ies") and len(word) > 4:
        push(f"{word[:-3]}y")
    if word.endswith("es") and len(word) > 3:
        push(word[:-2])
        push(word[:-1])
    elif word.endswith("s") and not word.endswith("ss") and len(word) > 3:
        push(word[:-1])
    if word.endswith("ied") and len(word) > 4:
        push(f"{word[:-3]}y")
    if word.endswith("ed") and len(word) > 3:
        stem = word[:-2]
        push(stem)
        push(word[:-1])
        if len(stem) >= 3 and stem[-1] == stem[-2]:
            push(stem[:-1])
    if word.endswith("ing") and len(word) > 4:
        stem = word[:-3]
        push(stem)
        push(f"{stem}e")
        if len(stem) >= 3 and stem[-1] == stem[-2]:
            push(stem[:-1])
    if word.endswith("ier") and len(word) > 4:
        push(f"{word[:-3]}y")
    if word.endswith("iest") and len(word) > 5:
        push(f"{word[:-4]}y")
    if word.endswith("er") and len(word) > 3:
        push(word[:-2])
        push(word[:-1])
    if word.endswith("est") and len(word) > 4:
        push(word[:-3])
        push(word[:-2])
    if word.endswith("ly") and len(word) > 4:
        push(word[:-2])
        if word.endswith("ily"):
            push(f"{word[:-3]}y")
    return out


def resolves(raw: str, keys: set[str]) -> bool:
    return any(candidate in keys for candidate in lemma_candidates(raw))


def load_courses() -> dict[str, dict]:
    courses: dict[str, dict] = {}
    for course_id in COURSE_IDS:
        path = OUT_DIR / f"{course_id}_course.json"
        if path.exists():
            courses[course_id] = json.loads(path.read_text(encoding="utf-8")).get("course") or {}
    return courses


def build_audit() -> dict:
    courses = load_courses()
    dictionary = json.loads(FRONTEND_DICT.read_text(encoding="utf-8")) if FRONTEND_DICT.exists() else {}
    dict_keys = {str(key).lower() for key in dictionary}
    token_counts: Counter[str] = Counter()
    target_counts: Counter[str] = Counter()
    capitalized_noninitial: Counter[str] = Counter()
    lowercase_occurrences: Counter[str] = Counter()
    errors: list[str] = []
    titles: list[tuple[str, int, str]] = []
    course_stats: list[dict] = []

    for course_id, course in courses.items():
        articles = course.get("articles", [])
        if course.get("total_articles") != len(articles):
            errors.append(f"{course_id}: total_articles 与实际篇数不一致")
        expected_indices = list(range(1, len(articles) + 1))
        actual_indices = [article.get("index") for article in articles]
        if actual_indices != expected_indices:
            errors.append(f"{course_id}: 文章 index 不连续")

        sentence_count = 0
        for article in articles:
            index = int(article.get("index", 0))
            title = str(article.get("title", "")).strip()
            title_zh = str(article.get("title_zh", "")).strip()
            titles.append((course_id, index, title))
            if not title or not title_zh:
                errors.append(f"{course_id}#{index}: 中英文标题缺失")
            if article.get("quality", {}).get("passed") is not True:
                errors.append(f"{course_id}#{index}: quality.passed 不为 true")

            for paragraph in article.get("paragraphs", []):
                for sentence in paragraph.get("sentences", []):
                    sentence_count += 1
                    en = str(sentence.get("en", "")).strip()
                    zh = str(sentence.get("zh", "")).strip()
                    if not en or not zh:
                        errors.append(f"{course_id}#{index}/{sentence.get('id')}: 中英文句子缺失")
                    matches = list(TOKEN_RE.finditer(en))
                    for token_index, match in enumerate(matches):
                        raw = match.group(0)
                        key = raw.lower()
                        token_counts[key] += 1
                        if token_index > 0 and raw[0].isupper():
                            capitalized_noninitial[key] += 1
                        if raw[0].islower():
                            lowercase_occurrences[key] += 1
                    for word in sentence.get("target_words", []):
                        target_counts[str(word).lower()] += 1

        course_stats.append({
            "id": course_id,
            "articles": len(articles),
            "sentences": sentence_count,
            "declared_words": course.get("total_words", 0),
        })

    missing = {word: count for word, count in token_counts.items() if not resolves(word, dict_keys)}
    probable_names = {
        word: count for word, count in missing.items()
        if capitalized_noninitial[word] > 0 and lowercase_occurrences[word] == 0
    }
    actionable_missing = {word: count for word, count in missing.items() if word not in probable_names}
    missing_targets = {word: count for word, count in target_counts.items() if not resolves(word, dict_keys)}

    similar_titles: list[dict] = []
    for left_index, left in enumerate(titles):
        for right in titles[left_index + 1:]:
            ratio = SequenceMatcher(None, left[2].lower(), right[2].lower()).ratio()
            if ratio >= 0.78:
                similar_titles.append({
                    "left": f"{left[0]}#{left[1]} {left[2]}",
                    "right": f"{right[0]}#{right[1]} {right[2]}",
                    "similarity": round(ratio, 3),
                })
    similar_titles.sort(key=lambda item: item["similarity"], reverse=True)

    total_occurrences = sum(token_counts.values())
    missing_occurrences = sum(missing.values())
    probable_name_occurrences = sum(probable_names.values())
    actionable_missing_occurrences = sum(actionable_missing.values())
    eligible_unique_tokens = len(token_counts) - len(probable_names)
    eligible_occurrences = total_occurrences - probable_name_occurrences
    target_total = len(target_counts)
    target_missing = len(missing_targets)
    return {
        "summary": {
            "courses": len(courses),
            "articles": sum(item["articles"] for item in course_stats),
            "dictionary_entries": len(dict_keys),
            "unique_text_tokens": len(token_counts),
            "text_token_occurrences": total_occurrences,
            "unique_token_coverage": round((len(token_counts) - len(missing)) / max(1, len(token_counts)), 4),
            "occurrence_coverage": round((total_occurrences - missing_occurrences) / max(1, total_occurrences), 4),
            "eligible_unique_token_coverage": round(
                (eligible_unique_tokens - len(actionable_missing)) / max(1, eligible_unique_tokens),
                4,
            ),
            "eligible_occurrence_coverage": round(
                (eligible_occurrences - actionable_missing_occurrences) / max(1, eligible_occurrences),
                4,
            ),
            "unique_target_words": target_total,
            "target_coverage": round((target_total - target_missing) / max(1, target_total), 4),
            "actionable_missing_words": len(actionable_missing),
            "probable_names": len(probable_names),
            "structural_errors": len(errors),
            "similar_title_pairs": len(similar_titles),
        },
        "courses": course_stats,
        "errors": errors,
        "missing_target_words": sorted(missing_targets, key=lambda word: (-missing_targets[word], word)),
        "actionable_missing_words": [
            {"word": word, "count": count}
            for word, count in sorted(actionable_missing.items(), key=lambda item: (-item[1], item[0]))
        ],
        "probable_names": [
            {"word": word, "count": count}
            for word, count in sorted(probable_names.items(), key=lambda item: (-item[1], item[0]))
        ],
        "similar_titles": similar_titles,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="审计内置课程和词典数据")
    parser.add_argument("--check", action="store_true", help="按发布阈值检查，不达标时退出 1")
    args = parser.parse_args()
    report = build_audit()
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    json_path = REPORT_DIR / "content-audit.json"
    markdown_path = REPORT_DIR / "content-audit.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = report["summary"]
    lines = [
        "# WordScape 内容与词典审计",
        "",
        "## 摘要",
        "",
        f"- 课程/文章：{summary['courses']} 套 / {summary['articles']} 篇",
        f"- 当前词典：{summary['dictionary_entries']} 条",
        f"- 正文唯一词覆盖率：{summary['unique_token_coverage']:.2%}",
        f"- 正文出现次数覆盖率：{summary['occurrence_coverage']:.2%}",
        f"- 排除疑似专有名词后的唯一词覆盖率：{summary['eligible_unique_token_coverage']:.2%}",
        f"- 排除疑似专有名词后的出现次数覆盖率：{summary['eligible_occurrence_coverage']:.2%}",
        f"- 目标词覆盖率：{summary['target_coverage']:.2%}",
        f"- 待补普通词：{summary['actionable_missing_words']} 个",
        f"- 疑似专有名词：{summary['probable_names']} 个",
        f"- 结构错误：{summary['structural_errors']} 个",
        f"- 高相似标题对：{summary['similar_title_pairs']} 对",
        "",
        "## 课程规模",
        "",
        "| 课程 | 文章 | 句子 | 声明词数 |",
        "| --- | ---: | ---: | ---: |",
    ]
    for course in report["courses"]:
        lines.append(f"| {course['id']} | {course['articles']} | {course['sentences']} | {course['declared_words']} |")
    lines.extend([
        "",
        "## 结构错误",
        "",
        *(f"- {item}" for item in report["errors"][:100]),
        "",
        "## 高频缺词（前 100）",
        "",
        *(f"- `{item['word']}`：{item['count']} 次" for item in report["actionable_missing_words"][:100]),
        "",
        "## 高相似标题（前 100）",
        "",
        *(f"- {item['similarity']:.1%}：{item['left']} ↔ {item['right']}" for item in report["similar_titles"][:100]),
        "",
    ])
    markdown_path.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"[audit] {json_path.relative_to(BACKEND.parent)}")
    print(f"[audit] {markdown_path.relative_to(BACKEND.parent)}")
    if args.check:
        failed = (
            summary["structural_errors"] > 0
            or summary["target_coverage"] < 1
            or summary["eligible_unique_token_coverage"] < 0.98
            or summary["eligible_occurrence_coverage"] < 0.99
        )
        if failed:
            raise SystemExit("[audit] 发布阈值未通过")


if __name__ == "__main__":
    main()
