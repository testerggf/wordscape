from app.models.generate import GenerateCourseRequest, GenerateCourseResponse, GeneratedArticle
from app.services.ai_client import AIClient
from app.services.generation.article_writer import ArticleWriter
from app.services.generation.course_planner import ArticlePlan, CoursePlanner
from app.services.generation.quality_checker import QualityChecker
from app.services.generation.vocab_processor import ProcessedWord, VocabProcessor


class GenerationPipeline:
    def __init__(self) -> None:
        self.vocab_processor = VocabProcessor()
        self.course_planner = CoursePlanner()
        self.quality_checker = QualityChecker()

    def prepare(self, request: GenerateCourseRequest) -> tuple[list[ProcessedWord], list[ArticlePlan]]:
        """词汇清洗 + 课程规划（同步、无 AI 调用）。"""
        processed_words = self.vocab_processor.process(request.words)
        plans = self.course_planner.plan(processed_words, max_articles=request.max_articles)
        return processed_words, plans

    async def write_article(self, writer: ArticleWriter, plan: ArticlePlan) -> GeneratedArticle:
        """生成单篇文章并做质量校验。"""
        raw_article = await writer.write(plan)
        quality = self.quality_checker.check(raw_article, plan)
        if not quality.passed:
            raw_article["quality_issues"] = quality.issues

        return GeneratedArticle(
            index=plan.index,
            title=raw_article["title"],
            topic=raw_article.get("topic", plan.topic),
            topic_en=raw_article.get("topic_en", plan.topic_en),
            paragraphs=raw_article["paragraphs"],
            target_words_used=raw_article.get("target_words_used", []),
            target_word_count=len(plan.target_words),
            word_count=quality.word_count,
            quality={
                "passed": quality.passed,
                "issues": quality.issues,
                "coverage": quality.coverage,
            },
        )

    async def generate_course(self, request: GenerateCourseRequest) -> GenerateCourseResponse:
        processed_words, plans = self.prepare(request)
        writer = ArticleWriter(AIClient(request.ai_config))
        articles: list[GeneratedArticle] = []

        for plan in plans:
            articles.append(await self.write_article(writer, plan))

        return GenerateCourseResponse(
            course_title=request.vocab_set_name,
            total_words=len(processed_words),
            total_articles=len(articles),
            articles=articles,
        )
