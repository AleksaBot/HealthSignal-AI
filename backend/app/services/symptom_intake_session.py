from __future__ import annotations

import re

from app.schemas.symptom_intelligence import (
    ExtractedSymptomIntelligence,
    SymptomInput,
    SymptomIntakeAnswer,
    SymptomIntakeSession,
    SymptomIntakeUpdateRequest,
    SymptomIntakeUpdateResult,
)
from app.services.symptom_intelligence_pipeline import build_symptom_answer_plan_from_extracted


def _merge_unique(existing: list[str], new_items: list[str]) -> list[str]:
    merged = list(existing)
    seen = {item.lower() for item in existing}
    for item in new_items:
        normalized = item.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        merged.append(item)
    return merged


def _extract_duration_from_text(text: str) -> str | None:
    patterns = [
        r"\bfor\s+\d+\s+(minute|minutes|hour|hours|day|days|week|weeks|month|months)\b",
        r"\bsince\s+(yesterday|today|last night|this morning)\b",
    ]
    lowered = text.lower()
    for pattern in patterns:
        match = re.search(pattern, lowered, flags=re.IGNORECASE)
        if match:
            return match.group(0)
    return None


def _extract_severity_from_text(text: str) -> str | None:
    lowered = text.lower()
    if any(word in lowered for word in ["severe", "worst", "10/10", "9/10", "8/10"]):
        return "severe"
    if any(word in lowered for word in ["moderate", "6/10", "5/10", "7/10"]):
        return "moderate"
    if any(word in lowered for word in ["mild", "1/10", "2/10", "3/10", "4/10"]):
        return "mild"
    return None


def _extract_location_from_text(text: str) -> str | None:
    for term in ["head", "chest", "abdomen", "stomach", "back", "neck", "arm", "leg"]:
        if re.search(rf"\b{term}\b", text, flags=re.IGNORECASE):
            return term
    return None


def _apply_answers_to_extracted(
    extracted: ExtractedSymptomIntelligence,
    answers: list[SymptomIntakeAnswer],
) -> ExtractedSymptomIntelligence:
    updated = extracted.model_copy(deep=True)
    all_answer_text = " ".join(answer.answer_text for answer in answers)

    if all_answer_text:
        duration = _extract_duration_from_text(all_answer_text)
        severity = _extract_severity_from_text(all_answer_text)
        location = _extract_location_from_text(all_answer_text)

        if duration and not updated.duration:
            updated.duration = duration
        if severity:
            updated.severity = severity
        if location and not updated.location_body_area:
            updated.location_body_area = location

    lowered_answers = all_answer_text.lower()
    if "nausea" in lowered_answers and "nausea" not in {item.lower() for item in updated.associated_symptoms}:
        updated.associated_symptoms.append("nausea")
    if "blurred vision" in lowered_answers and "blurred vision" not in {
        item.lower() for item in updated.associated_symptoms
    }:
        updated.associated_symptoms.append("blurred vision")
    if "shortness of breath" in lowered_answers and "shortness of breath" not in {
        item.lower() for item in updated.primary_symptoms
    }:
        updated.primary_symptoms.append("shortness of breath")

    return updated


def _is_intake_complete(session: SymptomIntakeSession) -> tuple[bool, str | None]:
    if session.risk_assessment.risk_level == "emergency":
        return True, "emergency_risk_detected"

    minimum_context = bool(session.extracted.primary_symptoms) and bool(session.extracted.severity) and bool(
        session.extracted.duration
    )

    if minimum_context and session.current_depth >= 1:
        return True, "sufficient_context_collected"

    if session.current_depth >= session.max_depth:
        return True, "max_follow_up_depth_reached"

    if not session.follow_up_questions:
        return True, "no_remaining_questions"

    return False, None


def update_symptom_intake_session(request: SymptomIntakeUpdateRequest) -> SymptomIntakeUpdateResult:
    prior = request.session
    updated_extracted = _apply_answers_to_extracted(prior.extracted, request.new_answers)

    plan, refreshed = build_symptom_answer_plan_from_extracted(
        symptom_input=SymptomInput(symptom_text=prior.input.symptom_text),
        extracted=updated_extracted,
        max_depth=prior.max_depth,
    )

    answered_prompts = [answer.prompt_text for answer in request.new_answers if answer.prompt_text]
    all_asked = _merge_unique(prior.asked_questions, answered_prompts)
    all_answers = prior.answers + request.new_answers

    remaining_questions = [
        question for question in refreshed.follow_up_questions if question.prompt_text.lower() not in {item.lower() for item in all_asked}
    ]

    current_depth = prior.current_depth + (1 if request.new_answers else 0)
    refreshed.asked_questions = all_asked
    refreshed.answers = all_answers
    refreshed.current_depth = current_depth
    refreshed.follow_up_questions = remaining_questions

    is_complete, completion_reason = _is_intake_complete(refreshed)
    refreshed.is_complete = is_complete
    refreshed.completion_reason = completion_reason

    plan.follow_up_questions = remaining_questions

    return SymptomIntakeUpdateResult(session=refreshed, answer_plan=plan)
