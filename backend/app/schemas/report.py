from datetime import datetime

from pydantic import BaseModel


class ReportCreate(BaseModel):
    user_id: int
    report_type: str
    input_payload: str
    output_summary: str


class ReportRead(ReportCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
