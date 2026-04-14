from __future__ import annotations

import json
import re
from typing import Any

from app.schemas.analyze import MedicalTermExplanation, NoteInterpretationResponse, TreatmentMention
from app.services.ai_provider import get_ai_provider

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

MEDICATION_HINTS: list[tuple[str, str]] = [
    (
        "metformin",
        "Metformin is commonly used to lower blood sugar in diabetes or prediabetes. In this note it may be listed to improve glucose control. It is often taken with food (usually once or twice daily). Common side effects include stomach upset, nausea, or diarrhea.",
    ),
    (
        "insulin",
        "Insulin helps lower blood sugar when the body cannot control glucose well enough on its own. In this note it may be included to improve glucose control. How it is taken depends on the insulin type (injection timing varies). Common side effects include low blood sugar and possible weight gain.",
    ),
    (
        "lisinopril",
        "Lisinopril is commonly used to lower blood pressure and can also help protect kidney function. In this note it may have been prescribed because blood pressure or kidney-risk concerns were mentioned. It is usually taken once daily. Common side effects include dizziness or dry cough.",
    ),
    (
        "losartan",
        "Losartan is used to lower blood pressure and may help protect the heart and kidneys. In this note it may be listed for blood pressure control or organ protection. It is typically taken once daily. Common side effects include dizziness or mild fatigue.",
    ),
    (
        "atorvastatin",
        "Atorvastatin helps lower LDL cholesterol and reduce cardiovascular risk. In this note it may have been prescribed because cholesterol or heart-risk concerns were noted. It is usually taken once daily. Common side effects include muscle aches or mild digestive upset.",
    ),
    (
        "amoxicillin",
        "Amoxicillin is an antibiotic used to treat common bacterial infections. In this note it may have been prescribed for a suspected or confirmed bacterial illness. It is often taken in divided doses across the day for a set number of days. Common side effects include nausea, diarrhea, or rash.",
    ),
]

HEADER_LINE_PATTERNS = [
    r"\b(phone|fax|tel|email|www\.|suite|ste\.?|avenue|street|road|blvd|zip)\b",
    r"\b(medical center|hospital|clinic|health system|department of)\b",
    r"\d{3}[-.\s]\d{3}[-.\s]\d{4}",
]

TEMPLATE_PATTERNS = [
    r"\[[^\]]*(name|date|month|day|year|provider|company|address)[^\]]*\]",
    r"\b(lorem ipsum|sample note|example note|template|insert .* here|your logo)\b",
    r"\b(patient'?s name|doctor'?s name|clinic name|company name)\b",
]


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _clean_note_text(note_text: str) -> tuple[str, bool]:
    lines = [line.strip() for line in note_text.splitlines() if line.strip()]
    filtered: list[str] = []

    for index, line in enumerate(lines):
        lowered = line.lower()
        looks_like_header = any(re.search(pattern, lowered) for pattern in HEADER_LINE_PATTERNS)
        if index < 8 and looks_like_header:
            continue
        filtered.append(line)

    cleaned = "\n".join(filtered)
    cleaned = re.sub(r"_{2,}|-{3,}|={3,}", " ", cleaned)

    for pattern in TEMPLATE_PATTERNS:
        cleaned = re.sub(pattern, " ", cleaned, flags=re.IGNORECASE)

    cleaned = _normalize_whitespace(cleaned)

    placeholder_hits = sum(
        len(re.findall(pattern, note_text, flags=re.IGNORECASE)) for pattern in TEMPLATE_PATTERNS
    )
    bracket_ratio = len(re.findall(r"\[[^\]]+\]", note_text))
    likely_template = placeholder_hits + bracket_ratio >= 2

    return cleaned, likely_template


def _build_fallback_interpretation(cleaned_note: str, likely_template: bool) -> NoteInterpretationResponse:
    if not cleaned_note:
        summary = "This document appears to be mostly template or header text, so there is not enough patient-specific content to summarize."
    else:
        snippets = re.split(r"(?<=[.!?])\s+", cleaned_note)
        top = " ".join(snippets[:2]).strip()
        summary = f"In plain language: {top}" if top else "The note has limited clinical detail."

    if likely_template:
        summary = f"{summary} It also looks like a generic template/example rather than a fully patient-specific note."

    lowered = cleaned_note.lower()
    meds = [
        TreatmentMention(item=name.title(), explanation=explanation)
        for name, explanation in MEDICATION_HINTS
        if re.search(rf"\b{re.escape(name)}\b", lowered)
    ]

    terms = [
        MedicalTermExplanation(term=term, plain_english=meaning)
        for term, meaning in TERM_EXPLANATIONS.items()
        if re.search(rf"\b{re.escape(term)}\b", lowered)
    ]

    next_steps: list[str] = []
    if re.search(r"\bfollow[- ]?up|return\b", lowered):
        next_steps.append("Confirm the follow-up timing and what should be reviewed at that visit.")
    if re.search(r"\blab|blood test|imaging|x-?ray|mri|ct\b", lowered):
        next_steps.append("Ask when ordered tests should be completed and when results will be discussed.")
    if re.search(r"\bstart|continue|take|dose\b", lowered):
        next_steps.append("Confirm how and when to take each medication, including common side effects to watch for.")
    if not next_steps:
        next_steps.append("Write down your top questions and confirm the plan at your next visit.")

    follow_up_questions = [
        "Can you confirm which parts of this note are most important for me right now?",
        "What specific changes should make me call your office sooner?",
    ]
    if meds:
        follow_up_questions.insert(0, f"Can you clarify how and when I should take {meds[0].item}?")

    return NoteInterpretationResponse(
        plain_english_summary=summary,
        medicines_treatments=meds,
        medical_terms_explained=terms[:6],
        next_steps=next_steps[:5],
        follow_up_questions=follow_up_questions[:5],
    )


def _coerce_treatments(items: Any) -> list[TreatmentMention]:
    if not isinstance(items, list):
        return []
    out: list[TreatmentMention] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        name = _normalize_whitespace(str(item.get("item", "")))
        explanation = _normalize_whitespace(str(item.get("explanation", "")))
        if name and explanation:
            out.append(TreatmentMention(item=name[:80], explanation=explanation[:240]))
    return out[:8]


def _coerce_terms(items: Any) -> list[MedicalTermExplanation]:
    if not isinstance(items, list):
        return []
    out: list[MedicalTermExplanation] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        term = _normalize_whitespace(str(item.get("term", "")))
        plain = _normalize_whitespace(str(item.get("plain_english", "")))
        if term and plain:
            out.append(MedicalTermExplanation(term=term[:80], plain_english=plain[:240]))
    return out[:8]


def interpret_note(note_text: str) -> NoteInterpretationResponse:
    cleaned_note, likely_template = _clean_note_text(note_text)
    provider = get_ai_provider()

    system_prompt = (
        "You are a patient-centered medical-note explainer. "
        "Rewrite the note in natural, everyday language for a patient who may be anxious or unfamiliar with medical terms. "
        "Do not diagnose. Do not invent facts beyond the note. "
        "Avoid robotic/legal phrasing and avoid repeating the note word-for-word. "
        "Medication explanations must include: what it is for, why it may be listed in this note, typical use frequency if known/general, and common simple side effects. "
        "Use concise, warm, practical language. "
        "Return valid JSON with keys: plain_english_summary, medicines_treatments, medical_terms_explained, next_steps, follow_up_questions."
    )
    user_prompt = (
        "Interpret this note using plain language and concise bullet-like outputs. "
        "For plain_english_summary, translate the clinical meaning into a true patient-friendly explanation (not a copy of the note). "
        "If it appears templated/generic, clearly state that in plain_english_summary. "
        "Avoid header/address/company text.\n\n"
        f"Likely template: {likely_template}\n"
        f"Cleaned note text:\n{cleaned_note or '[EMPTY]'}"
    )

    ai_payload = provider.generate_json(system_prompt=system_prompt, user_prompt=user_prompt)
    if not ai_payload:
        return _build_fallback_interpretation(cleaned_note, likely_template)

    summary = _normalize_whitespace(str(ai_payload.get("plain_english_summary", "")))
    if likely_template and "template" not in summary.lower():
        summary = f"{summary} This document also appears to include template/example language."

    if not summary:
        return _build_fallback_interpretation(cleaned_note, likely_template)

    next_steps = [
        _normalize_whitespace(str(step))
        for step in ai_payload.get("next_steps", [])
        if _normalize_whitespace(str(step))
    ][:6]
    follow_up_questions = [
        _normalize_whitespace(str(q))
        for q in ai_payload.get("follow_up_questions", [])
        if _normalize_whitespace(str(q))
    ][:6]

    if not next_steps or not follow_up_questions:
        fallback = _build_fallback_interpretation(cleaned_note, likely_template)
        if not next_steps:
            next_steps = fallback.next_steps
        if not follow_up_questions:
            follow_up_questions = fallback.follow_up_questions

    return NoteInterpretationResponse(
        plain_english_summary=summary,
        medicines_treatments=_coerce_treatments(ai_payload.get("medicines_treatments")),
        medical_terms_explained=_coerce_terms(ai_payload.get("medical_terms_explained")),
        next_steps=next_steps,
        follow_up_questions=follow_up_questions,
    )


def _truncate(text: str, limit: int = 2800) -> str:
    compact = _normalize_whitespace(text)
    return compact if len(compact) <= limit else compact[:limit]


def answer_note_follow_up(original_note_text: str, interpreted_note: str, question: str) -> str:
    provider = get_ai_provider()
    concise_question = _normalize_whitespace(question)
    note_context, likely_template = _clean_note_text(original_note_text)

    if len(note_context) < 20:
        return "I need more of the original note text to answer clearly. Please include the note and try again."

    parsed_interpretation: dict[str, Any] | None = None
    try:
        candidate = json.loads(interpreted_note)
        if isinstance(candidate, dict):
            parsed_interpretation = candidate
    except json.JSONDecodeError:
        parsed_interpretation = None

    structured_context = json.dumps(parsed_interpretation or {"summary": interpreted_note}, ensure_ascii=False)

    system_prompt = (
        "You are a conversational follow-up assistant answering patient questions about a medical note. "
        "Lead with a direct, contextual answer grounded in the note. "
        "If relevant, briefly explain the condition or medication in practical language. "
        "Use minimal safety language; include a short caution only when needed for uncertainty/high-risk guidance. "
        "Ground every answer in the provided note/interpretation. "
        "If uncertain, say what is unclear. Never diagnose. Never create medication instructions that are not stated."
    )
    user_prompt = (
        f"User question: {concise_question}\n\n"
        f"Original note (cleaned): {_truncate(note_context)}\n\n"
        f"Structured interpretation: {_truncate(structured_context)}\n"
        f"Likely template note: {likely_template}\n"
        "Answer in 3-5 sentences in plain, natural English. Start with the direct answer first."
    )

    ai_answer = provider.generate_text(system_prompt=system_prompt, user_prompt=user_prompt)
    if ai_answer:
        return _truncate(ai_answer, 900)

    template_clause = (
        " This note also appears to include template/example language, so details may not be patient-specific."
        if likely_template
        else ""
    )
    return (
        f"From this note, I can explain the plan but I cannot verify details that are not written.{template_clause} "
        f"For your question ('{concise_question}'), a practical next step is to confirm timing, medication details, and warning symptoms at your next clinical follow-up."
    )
