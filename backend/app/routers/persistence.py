import httpx
from fastapi import APIRouter, HTTPException

from app.models.persistence import PersistGeneratedCourseRequest, PersistGeneratedCourseResponse
from app.services.supabase_service import SupabaseNotConfiguredError, SupabaseService

router = APIRouter()


@router.post("/generated-course", response_model=PersistGeneratedCourseResponse)
async def persist_generated_course(payload: PersistGeneratedCourseRequest) -> PersistGeneratedCourseResponse:
    try:
        service = SupabaseService()
        result = await service.insert_generated_course(
            user_id=payload.user_id,
            vocab_set_name=payload.vocab_set_name,
            source_words=payload.source_words,
            generated=payload.generated_course,
        )
    except SupabaseNotConfiguredError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Supabase 写入失败：{exc.response.text}",
        ) from exc

    return PersistGeneratedCourseResponse(**result)
