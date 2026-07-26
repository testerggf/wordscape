from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class ModelConfig(BaseModel):
    base_url: HttpUrl = Field(..., description="OpenAI-compatible base URL")
    api_key: str = Field(..., min_length=1)
    model_name: str = Field(..., min_length=1)
    max_tokens: int = Field(default=128, ge=16, le=8192)
    temperature: float = Field(default=0.2, ge=0, le=2)


class VerifyModelResponse(BaseModel):
    ok: bool
    message: str


class GenerateCourseRequest(BaseModel):
    vocab_set_name: str = Field(default="自定义词库", min_length=1)
    words: list[str] = Field(..., min_length=1)
    ai_config: ModelConfig = Field(alias="model_config")
    difficulty: str = Field(default="intermediate")
    style: str = Field(default="mixed")
    max_articles: int | None = Field(default=None, ge=1, le=20)

    model_config = ConfigDict(populate_by_name=True)


class GeneratedSentence(BaseModel):
    id: str
    en: str
    zh: str
    target_words: list[str] = Field(default_factory=list)


class GeneratedParagraph(BaseModel):
    id: int
    sentences: list[GeneratedSentence]


class GeneratedArticle(BaseModel):
    index: int
    title: str
    topic: str
    topic_en: str
    paragraphs: list[GeneratedParagraph]
    target_words_used: list[dict[str, str]]
    target_word_count: int
    word_count: int
    quality: dict


class GenerateCourseResponse(BaseModel):
    course_title: str
    total_words: int
    total_articles: int
    articles: list[GeneratedArticle]
