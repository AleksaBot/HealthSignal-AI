from __future__ import annotations

import re
from typing import Iterable

from app.schemas.analyze import MedicalTermExplanation, NoteInterpretationResponse, TreatmentMention

MEDICATION_GUIDANCE: dict[str, str] = {
    "metformin": "often used to help lower blood sugar in diabetes",
    "insulin": "used to control blood sugar",
    "lisinopril": "commonly used for blood pressure or kidney protection",
    "losartan": "commonly used for blood pressure and heart/kidney support",
    "amlodipine": "used to treat high blood pressure",
    "atorvastatin": "used to lower cholesterol and reduce heart risk",
    "rosuvastatin": "used to lower cholesterol and reduce heart risk",
    "aspirin": "can be used to reduce blood clot risk in selected patients",
    "clopidogrel": "helps reduce blood clot risk",
    "albuterol": "a rescue inhaler for breathing symptoms",
    "levothyroxine": "used to replace thyroid hormone",
    "omeprazole": "used to reduce stomach acid",
    "amoxicillin": "an antibiotic used for bacterial infections",
}

TERM_EXPLANATIONS: dict[str, str] = {
    "hypertension": "high blood pressure",
    "hyperlipidemia": "high cholesterol or blood fats",
    "tachycardia": "faster-than-normal heart rate",
    "bradycardia": "slower-than-normal heart rate",
    "dyspnea": "shortness of breath",
    "edema": "swelling caused by fluid buildup",
    "neuropathy": "nerve damage that can cause numbness or pain",
    "hemoglobin a1c": "a 2-3 month average of blood sugar",
    "a1c": "a 2-3 month average of blood sugar",
    "creatinine": "a blood marker used to check kidney function",
    "egfr": "an estimate of kidney filtering function",
    "follow-up": "a return visit or check-in after this appointment",
}

NEXT_STEP_PATTERNS: list[tuple[str, str]] = [
    (r"\bfollow[- ]?up\b|\breturn\b|\brecheck\b", "Schedule or confirm the follow-up visit mentioned in the note."),
    (r"\bstart\b|\bbegin\b|\bcontinue\b|\btake\b|\bdose\b", "Take medicines exactly as written and ask before making any changes."),
    (r"\blab\b|\bblood test\b|\bimaging\b|\bx-?ray\b|\bmri\b|\bct\b", "Complete the ordered tests and review the results with your clinician."),
    (r"\bmonitor\b|\bwatch\b|\btrack\b|\blog\b", "Track the symptoms or home readings requested in the note."),
]


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _split_sentences(text: str) -> list[str]:
    cleaned = _normalize_whitespace(text)
    if not cleaned:
        return []
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", cleaned) if s.strip()]


def _detect_medicines(note_text: str) -> list[TreatmentMention]:
    lowered = note_text.lower()
    results: list[TreatmentMention] = []

    for med, explanation in MEDICATION_GUIDANCE.items():
        if re.search(rf"\b{re.escape(med)}\b", lowered):
            results.append(TreatmentMention(item=med.title(), explanation=explanation))

    instruction_patterns = {
        "Physical therapy": r"\bphysical therapy\b|\bpt\b",
        "Lifestyle changes": r"\bdiet\b|\bexercise\b|\blifestyle\b|\blow sodium\b",
        "Home monitoring": r"\bmonitor\b|\bhome bp\b|\bblood sugar log\b|\blog\b",
    }
    for label, pattern in instruction_patterns.items():
        if re.search(pattern, lowered):
            results.append(TreatmentMention(item=label, explanation="mentioned as part of the care plan"))

    deduped: dict[str, TreatmentMention] = {item.item.lower(): item for item in results}
    return list(deduped.values())


def _detect_terms(note_text: str) -> list[MedicalTermExplanation]:
    lowered = note_text.lower()
    terms: list[MedicalTermExplanation] = []
    for term, meaning in TERM_EXPLANATIONS.items():
        if re.search(rf"\b{re.escape(term)}\b", lowered):
            terms.append(MedicalTermExplanation(term=term, plain_english=meaning))
    return terms


def _build_summary(sentences: list[str]) -> str:
    if not sentences:
        return "The note text was too limited to summarize clearly."

    top = " ".join(sentences[:2])
    return (
        f"This note says: {top} "
        "It appears to describe current findings and the clinician's care plan, for education only."
    )


def _infer_next_steps(note_text: str) -> list[str]:
    lowered = note_text.lower()
    actions: list[str] = []
    for pattern, action in NEXT_STEP_PATTERNS:
        if re.search(pattern, lowered):
            actions.append(action)

    if not actions:
        actions.append("Review this note with your clinician to confirm what to do next.")

    return list(dict.fromkeys(actions))


def _build_follow_up_questions(
    medicines: Iterable[TreatmentMention],
    terms: Iterable[MedicalTermExplanation],
    next_steps: Iterable[str],
) -> list[str]:
    questions: list[str] = []

    meds = list(medicines)
    if meds:
        questions.append(f"What side effects should I watch for with {meds[0].item}?")

    terms_list = list(terms)
    if terms_list:
        questions.append(f"Can you explain what '{terms_list[0].term}' means for me specifically?")

    if any("tests" in step.lower() for step in next_steps):
        questions.append("When should I complete these tests and when will we review results?")

    questions.append("What symptoms should make me call your office sooner?")
    return questions[:4]


def interpret_note(note_text: str) -> NoteInterpretationResponse:
    normalized_note = _normalize_whitespace(note_text)
    sentences = _split_sentences(normalized_note)
    medicines = _detect_medicines(normalized_note)
    terms = _detect_terms(normalized_note)
    next_steps = _infer_next_steps(normalized_note)

    return NoteInterpretationResponse(
        plain_english_summary=_build_summary(sentences),
        medicines_treatments=medicines,
        medical_terms_explained=terms,
        next_steps=next_steps,
        follow_up_questions=_build_follow_up_questions(medicines, terms, next_steps),
    )


def answer_note_follow_up(interpreted_note: str, question: str) -> str:
    concise_question = _normalize_whitespace(question)
    context = _normalize_whitespace(interpreted_note)

    if len(context) < 20:
        return "I need more note context to answer. Please re-run interpretation first."

    return (
        "Based on the interpreted note, the safest next step is to confirm the exact plan directly with your clinician. "
        f"For your question ('{concise_question}'), focus on timing, medication instructions, and warning symptoms listed in your note."
    )
