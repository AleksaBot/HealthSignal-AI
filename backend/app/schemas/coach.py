from pydantic import BaseModel, Field


class CoachQueryRequest(BaseModel):
    question: str = Field(min_length=2, max_length=500)


class CoachQueryResponse(BaseModel):
    answer: str
    based_on: str = "Based on your current profile"
