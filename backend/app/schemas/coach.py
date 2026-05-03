from typing import Literal

from pydantic import BaseModel, Field, field_validator


class CoachQueryHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1000)

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, value: str) -> str:
        if value == "coach":
            return "assistant"
        return value


class CoachStoredMessage(BaseModel):
    role: Literal["user", "coach"]
    content: str = Field(min_length=1, max_length=1000)


class CoachQueryRequest(BaseModel):
    question: str = Field(min_length=2, max_length=500)
    history: list[CoachQueryHistoryMessage] = Field(default_factory=list, max_length=20)
    context: dict | None = None


class CoachQueryResponse(BaseModel):
    answer: str
    memory_summary: str | None = None
    based_on: str = "Based on your profile, momentum, guidance plan, medications, and recent check-ins"
    disclaimer: str = "Educational guidance only. Not a medical diagnosis or emergency care replacement."


class CoachHistoryResponse(BaseModel):
    messages: list[CoachStoredMessage]
    memory_summary: str | None = None
