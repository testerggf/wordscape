import httpx
from fastapi import APIRouter, HTTPException

from app.models.generate import GenerateCourseRequest, GenerateCourseResponse, ModelConfig, VerifyModelResponse
from app.services.generation.pipeline import GenerationPipeline

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
