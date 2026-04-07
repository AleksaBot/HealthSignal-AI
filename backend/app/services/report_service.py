import json

from sqlalchemy.orm import Session

from app.models.report import Report
from app.schemas.analyze import AnalysisResponse


def create_report_for_analysis(
    *,
    db: Session,
    user_id: int,
    report_type: str,
    input_payload: dict,
    analysis: AnalysisResponse,
) -> Report:
    report = Report(
        user_id=user_id,
        report_type=report_type,
        input_payload=json.dumps(input_payload),
        output_summary=analysis.model_dump_json(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
