from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ReportRead(BaseModel):
    id: int
    user_id: int
    report_type: str
    input_payload: str
    output_summary: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
