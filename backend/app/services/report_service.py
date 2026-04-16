import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.report import Report
from app.schemas.analyze import AnalysisResponse
from app.schemas.report import ReportSaveRequest


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


def create_report(
    *,
    db: Session,
    user_id: int,
    report_type: str,
    input_payload: dict[str, Any],
    output_summary: dict[str, Any],
) -> Report:
    report = Report(
        user_id=user_id,
        report_type=report_type,
        input_payload=json.dumps(input_payload),
        output_summary=json.dumps(output_summary),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def create_report_from_saved_analysis(*, db: Session, user_id: int, payload: ReportSaveRequest) -> Report:
    completed_at = payload.completed_at or datetime.utcnow()
    return create_report(
        db=db,
        user_id=user_id,
        report_type=payload.report_type,
        input_payload={
            "original_input_text": payload.original_input_text,
            "source_metadata": payload.source_metadata,
            "completed_at": completed_at.isoformat(),
        },
        output_summary={
            "structured_data": payload.structured_data,
            "follow_up_qa": payload.follow_up_qa,
            "outputs": payload.outputs,
            "completed_at": completed_at.isoformat(),
        },
    )
