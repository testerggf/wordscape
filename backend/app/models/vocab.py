from pydantic import BaseModel, Field


class VocabPreviewRequest(BaseModel):
    raw_text: str = Field(..., min_length=1)


class TopicPreview(BaseModel):
    topic: str
    count: int


class VocabPreviewResponse(BaseModel):
    total_input_items: int
    valid_words: list[str]
    invalid_items: list[str]
    duplicate_count: int
    estimated_articles: int
    topic_preview: list[TopicPreview]
