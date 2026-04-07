import json

from sqlalchemy.orm import Session

from app.models.report import Report


def save_analysis_report(db: Session, user_id: int, report_type: str, input_payload: dict, output_summary: dict) -> Report:
    report = Report(
        user_id=user_id,
        report_type=report_type,
        input_payload=json.dumps(input_payload),
        output_summary=json.dumps(output_summary)
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
