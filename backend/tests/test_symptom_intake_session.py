from app.schemas.symptom_intelligence import (
    SymptomInput,
    SymptomIntakeAnswer,
    SymptomIntakeUpdateRequest,
)
from app.services.symptom_intake_session import update_symptom_intake_session
from app.services.symptom_intelligence_pipeline import build_symptom_answer_plan


def test_fresh_session_starts_with_empty_asked_questions_and_pending_followups():
    _, intelligence = build_symptom_answer_plan(SymptomInput(symptom_text="dizziness"))
    session = intelligence["intake_session"]

    assert session.asked_questions == []
    assert session.follow_up_questions


def test_session_update_applies_severity_duration_location_answers():
    plan, intelligence = build_symptom_answer_plan(SymptomInput(symptom_text="headache"))
    session = intelligence["intake_session"]

    result = update_symptom_intake_session(
        SymptomIntakeUpdateRequest(
            session=session,
            new_answers=[
                SymptomIntakeAnswer(
                    prompt_text=plan.follow_up_questions[0].prompt_text,
                    question_category="severity",
                    answer_text="It is severe, around 8/10 for 3 days and mostly in my head.",
                )
            ],
        )
    )

    assert result.session.extracted.severity == "severe"
    assert result.session.extracted.duration == "for 3 days"
    assert result.session.extracted.location_body_area == "head"


def test_session_update_recomputes_risk_and_category_from_new_answers():
    _, intelligence = build_symptom_answer_plan(SymptomInput(symptom_text="chest pain"))
    session = intelligence["intake_session"]

    updated = update_symptom_intake_session(
        SymptomIntakeUpdateRequest(
            session=session,
            new_answers=[
                SymptomIntakeAnswer(
                    prompt_text="Are you also short of breath right now?",
                    question_category="associated",
                    answer_text="Yes, I also have shortness of breath now.",
                )
            ],
        )
    )

    assert "shortness of breath" in updated.session.extracted.primary_symptoms
    assert updated.session.risk_assessment.risk_level == "emergency"
    assert "cardiovascular/respiratory" in updated.session.categories


def test_session_update_stops_at_max_depth():
    _, intelligence = build_symptom_answer_plan(SymptomInput(symptom_text="mild cough"))
    session = intelligence["intake_session"]
    session.max_depth = 1

    updated = update_symptom_intake_session(
        SymptomIntakeUpdateRequest(
            session=session,
            new_answers=[
                SymptomIntakeAnswer(
                    prompt_text="How long have these symptoms been going on?",
                    question_category="duration",
                    answer_text="for 2 days",
                )
            ],
        )
    )

    assert updated.session.is_complete
    assert updated.session.completion_reason in {"max_follow_up_depth_reached", "sufficient_context_collected"}


def test_session_update_tracks_answers_and_remaining_questions_consistently():
    plan, intelligence = build_symptom_answer_plan(SymptomInput(symptom_text="dizziness"))
    session = intelligence["intake_session"]

    first_question = plan.follow_up_questions[0]
    updated = update_symptom_intake_session(
        SymptomIntakeUpdateRequest(
            session=session,
            new_answers=[
                SymptomIntakeAnswer(
                    prompt_text=first_question.prompt_text,
                    question_category=first_question.question_category,
                    answer_text="No fainting but blurred vision.",
                )
            ],
        )
    )

    assert updated.session.current_depth == 1
    assert updated.session.answers
    assert updated.session.asked_questions == [first_question.prompt_text]
    assert updated.session.follow_up_questions
    assert all(
        question.prompt_text.lower() != first_question.prompt_text.lower()
        for question in updated.session.follow_up_questions
    )
