from app.schemas.health_profile import HealthProfileRead
from app.services import coach_service


def _build_profile() -> HealthProfileRead:
    return HealthProfileRead(
        age=30,
        height_cm=175,
        weight_kg=75,
        activity_level="moderate",
        sleep_average_hours=6.5,
        stress_level="moderate",
    )


class _NoopAIProvider:
    def generate_text(self, *, system_prompt: str, user_prompt: str) -> str:
        return ""


def test_classify_coach_question_plan_builder() -> None:
    assert coach_service.classify_coach_question("make my plan for this week") == "plan_builder"


def test_classify_coach_question_next_action() -> None:
    assert coach_service.classify_coach_question("what should I focus on tomorrow") == "next_action"


def test_classify_coach_question_tomorrow_plan_prioritizes_next_action() -> None:
    assert coach_service.classify_coach_question("make a plan for tomorrow") == "next_action"


def test_classify_coach_question_generic_ask_is_not_clinician_prep() -> None:
    assert coach_service.classify_coach_question("what should I ask you next") != "clinician_prep"


def test_classify_coach_question_doctor_is_clinician_prep() -> None:
    assert coach_service.classify_coach_question("what should I ask my doctor") == "clinician_prep"


def test_fallback_plan_builder_contains_weekly_plan(monkeypatch) -> None:
    monkeypatch.setattr(coach_service, "get_ai_provider", lambda: _NoopAIProvider())

    answer = coach_service.answer_with_context(
        question="make my plan for this week",
        momentum_score=58,
        momentum_label="Building",
        trend_direction="stable",
        weekly_focus="sleep consistency",
        profile=_build_profile(),
        watchlist=[],
        medication_summary="none",
        recent_trend_summary="steady",
        recent_checkins=[],
        context={},
        history=[],
    )

    assert "this week" in answer.lower() or "plan" in answer.lower()


def test_fallback_next_action_differs_from_plan_builder(monkeypatch) -> None:
    monkeypatch.setattr(coach_service, "get_ai_provider", lambda: _NoopAIProvider())

    common_kwargs = dict(
        momentum_score=58,
        momentum_label="Building",
        trend_direction="stable",
        weekly_focus="sleep consistency",
        profile=_build_profile(),
        watchlist=[],
        medication_summary="none",
        recent_trend_summary="steady",
        recent_checkins=[],
        context={},
        history=[],
    )
    plan_answer = coach_service.answer_with_context(
        question="make my plan for this week",
        **common_kwargs,
    )
    next_action_answer = coach_service.answer_with_context(
        question="what should I focus on tomorrow?",
        **common_kwargs,
    )

    assert plan_answer != next_action_answer


def test_fallback_improvement_strategy_differs_from_plan_builder(monkeypatch) -> None:
    monkeypatch.setattr(coach_service, "get_ai_provider", lambda: _NoopAIProvider())

    common_kwargs = dict(
        momentum_score=58,
        momentum_label="Building",
        trend_direction="stable",
        weekly_focus="sleep consistency",
        profile=_build_profile(),
        watchlist=[],
        medication_summary="none",
        recent_trend_summary="steady",
        recent_checkins=[],
        context={},
        history=[],
    )
    plan_answer = coach_service.answer_with_context(question="make my plan for this week", **common_kwargs)
    improvement_answer = coach_service.answer_with_context(
        question="how can I improve my momentum this month?",
        **common_kwargs,
    )

    assert plan_answer != improvement_answer


def test_fallback_clinician_prep_includes_clinician_questions(monkeypatch) -> None:
    monkeypatch.setattr(coach_service, "get_ai_provider", lambda: _NoopAIProvider())

    answer = coach_service.answer_with_context(
        question="what should I ask my doctor at my next visit?",
        momentum_score=58,
        momentum_label="Building",
        trend_direction="stable",
        weekly_focus="sleep consistency",
        profile=_build_profile(),
        watchlist=[],
        medication_summary="none",
        recent_trend_summary="steady",
        recent_checkins=[],
        context={},
        history=[],
    )

    assert "questions to bring" in answer.lower()
    assert "clinician" in answer.lower() or "doctor" in answer.lower()
