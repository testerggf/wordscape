import re
from dataclasses import dataclass

from app.services.generation.course_planner import ArticlePlan


@dataclass(frozen=True)
class CheckResult:
    passed: bool
    issues: list[str]
    word_count: int
    coverage: float


class QualityChecker:
    def check(self, article: dict, plan: ArticlePlan) -> CheckResult:
        issues: list[str] = []
        word_count = count_article_words(article)

        required = set(plan.target_words)
        used = {item.get("word", "").lower() for item in article.get("target_words_used", [])}
        used = {word for word in used if word}
        coverage = len(required & used) / len(required) if required else 1

        if not article.get("title"):
            issues.append("缺少文章标题")
        if not article.get("paragraphs"):
            issues.append("缺少段落内容")
        if coverage < 0.90:
            missing = sorted(required - used)
            issues.append(f"目标词覆盖率不足：{coverage:.0%}，缺少 {missing[:10]}")

        # 小词表本地验证不强制 900-1100 词；正式 80+ 词文章才检查长度。
        if len(required) >= 80 and not (700 <= word_count <= 1300):
            issues.append(f"文章词数不在可接受范围：{word_count}")

        return CheckResult(
            passed=not issues,
            issues=issues,
            word_count=word_count,
            coverage=coverage,
        )


def count_article_words(article: dict) -> int:
    count = 0
    for paragraph in article.get("paragraphs", []):
        for sentence in paragraph.get("sentences", []):
            count += len(re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", sentence.get("en", "")))
    return count
