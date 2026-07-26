from fastapi import APIRouter

from app.models.vocab import VocabPreviewRequest, VocabPreviewResponse
from app.utils.vocab import preview_vocab

router = APIRouter()


@router.post("/preview", response_model=VocabPreviewResponse)
async def preview_vocabulary(payload: VocabPreviewRequest) -> VocabPreviewResponse:
    return VocabPreviewResponse(**preview_vocab(payload.raw_text))
