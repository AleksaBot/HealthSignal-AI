from typing import Literal

from pydantic import BaseModel, Field


class CoachChatMessage(BaseModel):
    role: Literal["user", "coach"]
    content: str = Field(min_length=1, max_length=1000)


class CoachQueryRequest(BaseModel):
    question: str = Field(min_length=2, max_length=500)
    history: list[CoachChatMessage] = Field(default_factory=list, max_length=20)
    context: dict | None = None


class CoachQueryResponse(BaseModel):
    answer: str
    based_on: str = "Based on your profile, momentum, guidance plan, medications, and recent check-ins"
    disclaimer: str = "Educational guidance only. Not a medical diagnosis or emergency care replacement."
