from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ReportCreate(BaseModel):
    report_type: str
    input_payload: dict[str, Any]
    output_summary: dict[str, Any]


class ReportSaveRequest(BaseModel):
    report_type: str = Field(min_length=3, max_length=64)
    original_input_text: str = Field(min_length=1)
    structured_data: dict[str, Any] = Field(default_factory=dict)
    follow_up_qa: list[dict[str, str]] = Field(default_factory=list)
    outputs: dict[str, Any] = Field(default_factory=dict)
    source_metadata: dict[str, Any] = Field(default_factory=dict)
    completed_at: datetime | None = None


class ReportRead(BaseModel):
    id: int
    user_id: int
    report_type: str
    input_payload: str
    output_summary: str
    created_at: datetime

    class Config:
        from_attributes = True
