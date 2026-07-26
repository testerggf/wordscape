from pydantic import BaseModel, Field

from app.models.generate import GenerateCourseResponse


class PersistGeneratedCourseRequest(BaseModel):
    user_id: str | None = Field(default=None, min_length=1)
    vocab_set_name: str = Field(..., min_length=1)
    source_words: list[str] = Field(default_factory=list)
    generated_course: GenerateCourseResponse


class PersistGeneratedCourseResponse(BaseModel):
    vocab_set_id: str
    course_id: str
