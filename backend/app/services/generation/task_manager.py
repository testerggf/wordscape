import asyncio
import time
import uuid
from dataclasses import dataclass, field

from app.models.generate import (
    ArticlePlanStatus,
    GenerateCourseRequest,
    GenerateCourseResponse,
    GeneratedArticle,
    PreviewArticleResponse,
    TaskStatusResponse,
)
from app.services.ai_client import AIClient
from app.services.generation.article_writer import ArticleWriter
from app.services.generation.course_planner import ArticlePlan
from app.services.generation.pipeline import GenerationPipeline

MAX_STORED = 20
TTL_SECONDS = 2 * 60 * 60


@dataclass
class PreviewState:
    id: str
    request: GenerateCourseRequest
    plans: list[ArticlePlan]
    total_words: int
    first_article: GeneratedArticle
    created_at: float = field(default_factory=time.time)


@dataclass
class TaskState:
    id: str
    request: GenerateCourseRequest
    plans: list[ArticlePlan]
    total_words: int
    status: str = "pending"
    completed: dict[int, GeneratedArticle] = field(default_factory=dict)
    failed: dict[int, str] = field(default_factory=dict)
    current_index: int | None = None
    error: str | None = None
    created_at: float = field(default_factory=time.time)


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def _prune(store: dict) -> None:
    now = time.time()
    expired = [key for key, state in store.items() if now - state.created_at > TTL_SECONDS]
    for key in expired:
        store.pop(key, None)
    if len(store) > MAX_STORED:
        oldest = sorted(store.values(), key=lambda state: state.created_at)[: len(store) - MAX_STORED]
        for state in oldest:
            store.pop(state.id, None)


class GenerationTaskManager:
    """内存态生成任务管理：试读缓存 + 异步全量生成 + 单篇失败重试。

    单进程开发部署下够用；接入 Supabase 持久化时可替换为数据库任务表。
    """

    def __init__(self) -> None:
        self.pipeline = GenerationPipeline()
        self.previews: dict[str, PreviewState] = {}
        self.tasks: dict[str, TaskState] = {}

    async def create_preview(self, request: GenerateCourseRequest) -> PreviewArticleResponse:
        processed_words, plans = self.pipeline.prepare(request)
        writer = ArticleWriter(AIClient(request.ai_config))
        first_article = await self.pipeline.write_article(writer, plans[0])

        state = PreviewState(
            id=_new_id("pv"),
            request=request,
            plans=plans,
            total_words=len(processed_words),
            first_article=first_article,
        )
        self.previews[state.id] = state
        _prune(self.previews)

        return PreviewArticleResponse(
            preview_id=state.id,
            course_title=request.vocab_set_name,
            total_words=state.total_words,
            total_articles=len(plans),
            plans=self._plan_statuses(plans, {plans[0].index: first_article}, {}, None),
            first_article=first_article,
        )

    def start_from_preview(self, preview_id: str) -> TaskState:
        preview = self.previews.get(preview_id)
        if preview is None:
            raise KeyError("preview_not_found")

        task = TaskState(
            id=_new_id("task"),
            request=preview.request,
            plans=preview.plans,
            total_words=preview.total_words,
            completed={preview.first_article.index: preview.first_article},
        )
        self._register_and_launch(task)
        return task

    def start_fresh(self, request: GenerateCourseRequest) -> TaskState:
        processed_words, plans = self.pipeline.prepare(request)
        task = TaskState(
            id=_new_id("task"),
            request=request,
            plans=plans,
            total_words=len(processed_words),
        )
        self._register_and_launch(task)
        return task

    def retry_failed(self, task_id: str) -> TaskState:
        task = self.tasks.get(task_id)
        if task is None:
            raise KeyError("task_not_found")
        if task.status in ("pending", "running"):
            return task
        if not task.failed:
            return task

        task.failed = {}
        task.error = None
        task.status = "pending"
        asyncio.get_running_loop().create_task(self._run(task))
        return task

    def get_status(self, task_id: str) -> TaskStatusResponse:
        task = self.tasks.get(task_id)
        if task is None:
            raise KeyError("task_not_found")
        return self._to_status(task)

    def _register_and_launch(self, task: TaskState) -> None:
        self.tasks[task.id] = task
        _prune(self.tasks)
        asyncio.get_running_loop().create_task(self._run(task))

    async def _run(self, task: TaskState) -> None:
        task.status = "running"
        writer = ArticleWriter(AIClient(task.request.ai_config))

        for plan in task.plans:
            if plan.index in task.completed:
                continue

            task.current_index = plan.index
            try:
                article = await self.pipeline.write_article(writer, plan)
                task.completed[plan.index] = article
            except Exception as exc:  # noqa: BLE001 单篇失败不阻断其余篇目
                task.failed[plan.index] = str(exc)[:300]

        task.current_index = None
        if task.completed:
            task.status = "done"
        else:
            task.status = "failed"
            task.error = "全部篇目生成失败，请检查模型配置后重试"

    def _to_status(self, task: TaskState) -> TaskStatusResponse:
        result = None
        if task.status == "done":
            articles = [task.completed[index] for index in sorted(task.completed)]
            result = GenerateCourseResponse(
                course_title=task.request.vocab_set_name,
                total_words=task.total_words,
                total_articles=len(articles),
                articles=articles,
            )

        return TaskStatusResponse(
            task_id=task.id,
            status=task.status,
            course_title=task.request.vocab_set_name,
            total_articles=len(task.plans),
            completed_articles=len(task.completed),
            failed_articles=len(task.failed),
            current_index=task.current_index,
            articles=self._plan_statuses(task.plans, task.completed, task.failed, task.current_index),
            error=task.error,
            result=result,
        )

    @staticmethod
    def _plan_statuses(
        plans: list[ArticlePlan],
        completed: dict[int, GeneratedArticle],
        failed: dict[int, str],
        current_index: int | None,
    ) -> list[ArticlePlanStatus]:
        statuses: list[ArticlePlanStatus] = []
        for plan in plans:
            if plan.index in completed:
                status, title, error = "done", completed[plan.index].title, None
            elif plan.index in failed:
                status, title, error = "failed", None, failed[plan.index]
            elif plan.index == current_index:
                status, title, error = "generating", None, None
            else:
                status, title, error = "pending", None, None

            statuses.append(ArticlePlanStatus(
                index=plan.index,
                topic=plan.topic,
                target_word_count=len(plan.target_words),
                status=status,
                title=title,
                error=error,
            ))
        return statuses


task_manager = GenerationTaskManager()
