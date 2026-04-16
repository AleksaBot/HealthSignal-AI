from __future__ import annotations

from app.schemas.symptom_intelligence import ExtractedSymptomIntelligence, FollowUpQuestion, SymptomRiskLevel

QUESTION_RULES: dict[str, list[tuple[int, str, str]]] = {
    "headache": [
        (8, "severity", "How severe is the headache right now on a 0-10 scale?"),
        (12, "associated", "Are you also having nausea or vomiting with the headache?"),
        (14, "associated", "Do bright lights make the headache worse?"),
        (16, "neurologic", "Have you noticed any vision changes with this headache?"),
    ],
    "chest pain": [
        (3, "severity", "How severe is the chest pain right now on a 0-10 scale?"),
        (5, "quality", "Does the chest pain feel like pressure/tightness or sharp/stabbing pain?"),
        (6, "associated", "Are you also short of breath right now?"),
        (7, "associated", "Does the pain spread to your arm, jaw, neck, or back?"),
        (9, "associated", "Are you having sweating, nausea, or feeling faint with the chest pain?"),
    ],
    "abdominal pain": [
        (8, "location", "Where exactly is the abdominal pain located (upper, lower, right, left)?"),
        (10, "duration", "How long has the abdominal pain been present?"),
        (11, "associated", "Are you having nausea or vomiting?"),
        (12, "associated", "Are you having diarrhea or constipation?"),
        (14, "associated", "Have you had fever or chills with this pain?"),
    ],
    "dizziness": [
        (7, "safety", "Have you fainted or nearly fainted?"),
        (10, "neurologic", "Do you have weakness, numbness, or trouble speaking?"),
        (11, "associated", "Do you also have a headache?"),
        (12, "associated", "Have you noticed blurred or double vision?"),
    ],
}

GENERAL_QUESTIONS: list[tuple[int, str, str]] = [
    (18, "duration", "When did these symptoms start, and are they improving or worsening?"),
    (19, "severity", "How severe are your symptoms overall on a 0-10 scale?"),
    (20, "progression", "Are the symptoms constant or do they come and go?"),
]


def _dedupe_questions(questions: list[FollowUpQuestion]) -> list[FollowUpQuestion]:
    seen_prompts: set[str] = set()
    deduped: list[FollowUpQuestion] = []
    for question in questions:
        key = question.prompt_text.lower().strip()
        if key in seen_prompts:
            continue
        seen_prompts.add(key)
        deduped.append(question)
    return deduped


def generate_follow_up_questions(
    extracted: ExtractedSymptomIntelligence,
    *,
    risk_level: SymptomRiskLevel,
    min_questions: int = 2,
    max_questions: int = 5,
) -> list[FollowUpQuestion]:
    symptom_set = {symptom.lower() for symptom in extracted.primary_symptoms}
    candidates: list[FollowUpQuestion] = []

    for symptom, questions in QUESTION_RULES.items():
        if symptom not in symptom_set:
            continue
        for priority, category, prompt_text in questions:
            adjusted_priority = max(1, priority - 2) if risk_level in {"high", "emergency"} else priority
            candidates.append(
                FollowUpQuestion(
                    prompt_text=prompt_text,
                    question_category=category,
                    priority=adjusted_priority,
                    symptom_focus=symptom,
                )
            )

    if not extracted.duration:
        candidates.append(
            FollowUpQuestion(
                prompt_text="How long have these symptoms been going on?",
                question_category="duration",
                priority=13,
                symptom_focus=None,
            )
        )

    if not extracted.severity:
        candidates.append(
            FollowUpQuestion(
                prompt_text="How severe are the symptoms right now on a 0-10 scale?",
                question_category="severity",
                priority=14,
                symptom_focus=None,
            )
        )

    if not extracted.location_body_area:
        candidates.append(
            FollowUpQuestion(
                prompt_text="Where in your body are the symptoms most noticeable?",
                question_category="location",
                priority=15,
                symptom_focus=None,
            )
        )

    if not candidates:
        for priority, category, prompt_text in GENERAL_QUESTIONS:
            candidates.append(
                FollowUpQuestion(
                    prompt_text=prompt_text,
                    question_category=category,
                    priority=priority,
                    symptom_focus=None,
                )
            )

    unique_questions = _dedupe_questions(candidates)
    prioritized = sorted(unique_questions, key=lambda item: (item.priority, item.prompt_text))

    capped = prioritized[:max_questions]
    if len(capped) >= min_questions:
        return capped

    for priority, category, prompt_text in GENERAL_QUESTIONS:
        fallback = FollowUpQuestion(
            prompt_text=prompt_text,
            question_category=category,
            priority=priority,
            symptom_focus=None,
        )
        if fallback.prompt_text.lower() in {item.prompt_text.lower() for item in capped}:
            continue
        capped.append(fallback)
        if len(capped) >= min_questions:
            break

    return capped[:max_questions]
