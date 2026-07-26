import httpx
from fastapi import APIRouter, HTTPException

from app.models.generate import (
    GenerateCourseRequest,
    GenerateCourseResponse,
    ModelConfig,
    PreviewArticleResponse,
    StartCourseRequest,
    StartCourseResponse,
    TaskStatusResponse,
    VerifyModelResponse,
)
from app.services.generation.pipeline import GenerationPipeline
from app.services.generation.task_manager import task_manager

router = APIRouter()


@router.post("/verify-model", response_model=VerifyModelResponse)
async def verify_model(config: ModelConfig) -> VerifyModelResponse:
    url = str(config.base_url).rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {config.api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": config.model_name,
        "messages": [
            {"role": "system", "content": "Reply with exactly one English word."},
            {"role": "user", "content": "Say: ready"},
        ],
        "max_tokens": min(config.max_tokens, 32),
        "temperature": config.temperature,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(url, headers=headers, json=body)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Model service is unreachable: {exc}") from exc

    if response.status_code >= 400:
        raise HTTPException(
            status_code=400,
            detail=f"Model verification failed with status {response.status_code}: {response.text[:300]}",
        )

    return VerifyModelResponse(ok=True, message="连接成功，模型可用")


@router.post("/course", response_model=GenerateCourseResponse)
async def generate_course(payload: GenerateCourseRequest) -> GenerateCourseResponse:
    pipeline = GenerationPipeline()
    return await pipeline.generate_course(payload)


@router.post("/preview-article", response_model=PreviewArticleResponse)
async def preview_article(payload: GenerateCourseRequest) -> PreviewArticleResponse:
    """生成课程规划 + 第 1 篇试读文章，供用户确认质量后再全量生成。"""
    try:
        return await task_manager.create_preview(payload)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"试读文章生成失败：{str(exc)[:300]}") from exc


@router.post("/course-async", response_model=StartCourseResponse)
async def start_course_async(payload: StartCourseRequest) -> StartCourseResponse:
    """启动异步全量生成。优先使用 preview_id 续接试读结果。"""
    if payload.preview_id:
        try:
            task = task_manager.start_from_preview(payload.preview_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="试读记录已过期，请重新预览后再生成") from exc
        return StartCourseResponse(task_id=task.id, total_articles=len(task.plans))

    if not payload.words or payload.ai_config is None:
        raise HTTPException(status_code=422, detail="缺少 words 或 model_config，也可以改传 preview_id")

    request = GenerateCourseRequest(
        vocab_set_name=payload.vocab_set_name,
        words=payload.words,
        model_config=payload.ai_config,
        difficulty=payload.difficulty,
        style=payload.style,
        max_articles=payload.max_articles,
    )
    task = task_manager.start_fresh(request)
    return StartCourseResponse(task_id=task.id, total_articles=len(task.plans))


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str) -> TaskStatusResponse:
    try:
        return task_manager.get_status(task_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="生成任务不存在或已过期") from exc


@router.post("/tasks/{task_id}/retry", response_model=TaskStatusResponse)
async def retry_task(task_id: str) -> TaskStatusResponse:
    try:
        task_manager.retry_failed(task_id)
        return task_manager.get_status(task_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="生成任务不存在或已过期") from exc
