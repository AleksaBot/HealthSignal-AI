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

MEDICAL_ABBREVIATIONS: list[tuple[str, str]] = [
    (r"\bpt\b", "Patient"),
    (r"\bc/o\b", "complains of"),
    (r"\babd\b", "abdominal"),
    (r"\bpn\b", "pain"),
    (r"\bw/\b", "with"),
    (r"\bRLQ\b", "right lower quadrant"),
    (r"\bLLQ\b", "left lower quadrant"),
    (r"\bTTP\b", "tenderness to palpation"),
    (r"\bSOB\b", "shortness of breath"),
    (r"\bCP\b", "chest pain"),
    (r"\bHTN\b", "hypertension"),
    (r"\bDM\b", "diabetes mellitus"),
    (r"\bPRN\b", "as needed"),
    (r"\bBID\b", "twice daily"),
    (r"\bQD\b", "once daily"),
    (r"\bN/V\b", "nausea/vomiting"),
]


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _remove_robotic_summary_prefix(text: str) -> str:
    cleaned = _normalize_whitespace(text)
    return re.sub(r"^(in plain (english|language)\s*:\s*)", "", cleaned, flags=re.IGNORECASE)


def _expand_medical_abbreviations(text: str) -> str:
    expanded = text
    expanded = re.sub(r"\bx\s*(\d+)\s*d\b", r"for \1 days", expanded, flags=re.IGNORECASE)
    for pattern, replacement in MEDICAL_ABBREVIATIONS:
        expanded = re.sub(pattern, replacement, expanded, flags=re.IGNORECASE)
    return expanded


def _clean_note_text(note_text: str) -> tuple[str, bool]:
    expanded_text = _expand_medical_abbreviations(note_text)
    lines = [line.strip() for line in expanded_text.splitlines() if line.strip()]
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
        len(re.findall(pattern, expanded_text, flags=re.IGNORECASE)) for pattern in TEMPLATE_PATTERNS
    )
    bracket_ratio = len(re.findall(r"\[[^\]]+\]", expanded_text))
    likely_template = placeholder_hits + bracket_ratio >= 2

    return cleaned, likely_template


def _build_fallback_interpretation(cleaned_note: str, likely_template: bool) -> NoteInterpretationResponse:
    if not cleaned_note:
        summary = "This document appears to be mostly template or header text, so there is not enough patient-specific content to summarize."
    else:
        snippets = re.split(r"(?<=[.!?])\s+", cleaned_note)
        top = " ".join(snippets[:2]).strip()
        summary = top if top else "The note has limited clinical detail."

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

    summary = _remove_robotic_summary_prefix(
        _normalize_whitespace(_expand_medical_abbreviations(str(ai_payload.get("plain_english_summary", ""))))
    )
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


def _expand_context_values(value: Any) -> Any:
    if isinstance(value, str):
        return _expand_medical_abbreviations(value)
    if isinstance(value, list):
        return [_expand_context_values(item) for item in value]
    if isinstance(value, dict):
        return {key: _expand_context_values(item) for key, item in value.items()}
    return value


def _extract_follow_up_context(note_context: str, interpreted_note: dict[str, Any] | None) -> dict[str, Any]:
    extracted_symptoms: list[str] = []
    treatments: list[str] = []
    next_steps: list[str] = []
    interpreted_summary = ""

    if interpreted_note:
        interpreted_summary = _normalize_whitespace(str(interpreted_note.get("plain_english_summary", "")))
        treatments = [
            _normalize_whitespace(str(item.get("item", "")))
            for item in interpreted_note.get("medicines_treatments", [])
            if isinstance(item, dict) and _normalize_whitespace(str(item.get("item", "")))
        ][:5]
        next_steps = [
            _normalize_whitespace(str(step))
            for step in interpreted_note.get("next_steps", [])
            if _normalize_whitespace(str(step))
        ][:5]

    symptom_match = re.search(
        r"(complains of|reports|with|for)\s+([^.;]+)",
        note_context,
        flags=re.IGNORECASE,
    )
    if symptom_match:
        symptom_text = _normalize_whitespace(symptom_match.group(2))
        extracted_symptoms = [fragment.strip() for fragment in re.split(r",| and ", symptom_text) if fragment.strip()][:6]

    if not next_steps:
        note_steps: list[str] = []
        for pattern in [
            r"\b(follow[- ]?up[^.]*\.)",
            r"\b(return[^.]*\.)",
            r"\b(continue[^.]*\.)",
            r"\b(start[^.]*\.)",
        ]:
            for match in re.finditer(pattern, note_context, flags=re.IGNORECASE):
                step = _normalize_whitespace(match.group(1))
                if step and step not in note_steps:
                    note_steps.append(step)
        next_steps = note_steps[:5]

    return {
        "original_note_text": note_context,
        "interpreted_summary": interpreted_summary,
        "extracted_symptoms": extracted_symptoms,
        "treatments_medications": treatments,
        "next_steps": next_steps,
    }


def _build_contextual_follow_up_fallback(
    *,
    question: str,
    follow_up_context: dict[str, Any],
    likely_template: bool,
) -> str:
    intent = _detect_follow_up_intent(question)
    details: list[str] = []
    symptom_bits = follow_up_context.get("extracted_symptoms") or []
    next_steps = follow_up_context.get("next_steps") or []
    treatment_bits = follow_up_context.get("treatments_medications") or []

    if intent == "medication":
        if treatment_bits:
            details.append(
                f"The note mentions {', '.join(treatment_bits[:2])}; ask your clinician to confirm the exact purpose, dose, and timing for your plan."
            )
        else:
            details.append(
                "This note does not clearly mention a medication, so I cannot explain a medicine based on this document."
            )
    elif intent in {"actions_now", "next_steps"}:
        if next_steps:
            details.append(f"Right now, the most useful next action is to {next_steps[0][0].lower() + next_steps[0][1:]}")
        else:
            details.append("Right now, follow the documented plan, keep notes on symptom changes, and contact your care team if things are unclear.")
    elif intent == "symptoms":
        if symptom_bits:
            details.append(f"The note highlights symptoms such as {', '.join(symptom_bits[:3])}. Track whether these improve or worsen.")
        else:
            details.append("This note does not clearly list symptoms, so monitor any new or worsening changes and ask your care team for symptom-specific guidance.")
    elif intent == "warning_signs":
        if symptom_bits:
            details.append(f"Warning signs to watch for include worsening or persistent {', '.join(symptom_bits[:3])}, especially if symptoms escalate quickly.")
        else:
            details.append("Warning signs include severe pain, trouble breathing, persistent vomiting, fainting, high fever, or bleeding.")
    elif intent == "seriousness":
        details.append("This note alone cannot confirm how serious the condition is, but it does provide clues about current risk and follow-up needs.")
        if symptom_bits:
            details.append(f"Pay attention to whether {', '.join(symptom_bits[:3])} are improving or getting worse over time.")
    elif intent == "tests":
        details.append("The note does not clearly provide enough test detail to explain specific results or test purpose.")
    elif intent == "diagnosis":
        details.append("The note does not clearly document a specific diagnosis/condition that I can explain with confidence.")
    elif intent == "definition":
        details.append("The note does not clearly define the specific term you asked about, so confirm the exact wording with your clinician.")
    else:
        if symptom_bits:
            details.append(f"Based on this note, keep track of {', '.join(symptom_bits[:3])}.")
        else:
            details.append("Based on this note, follow the documented plan closely and monitor how you feel day to day.")

    if treatment_bits:
        details.append(f"Continue the treatments mentioned ({', '.join(treatment_bits[:3])}) exactly as documented.")

    if next_steps:
        details.append(f"Practical next step: {next_steps[0]}")
    else:
        details.append("Practical next step: confirm timing of follow-up, tests, and what changes should trigger a call sooner.")

    caution_needed = bool(
        re.search(
            r"\b(chest pain|shortness of breath|faint|severe|worsen|bleeding|high fever|vomiting)\b",
            " ".join(symptom_bits + [question]),
            flags=re.IGNORECASE,
        )
    )
    if caution_needed:
        details.append("If symptoms become severe, rapidly worsen, or new warning signs appear, seek urgent care right away.")
    elif likely_template:
        details.append("Some parts of the note look templated, so verify unclear details at your next clinical check-in.")

    return " ".join(details)


def _detect_follow_up_intent(question: str) -> str:
    lowered = question.lower()
    if re.search(r"\b(medicine|medication|drug|treatment|prescription|pill)\b", lowered):
        return "medication"
    if re.search(r"\b(worry|warning sign|red flag|emergency|danger)\b", lowered):
        return "warning_signs"
    if re.search(r"\b(symptom|symptoms|feel|pain|nausea|vomiting|dizzy|fatigue|fever)\b", lowered):
        return "symptoms"
    if re.search(r"\b(test|tests|lab|labs|blood work|blood test|scan|imaging|x-?ray|ct|mri|result)\b", lowered):
        return "tests"
    if re.search(r"\b(diagnosis|diagnosed|condition|disease|disorder|what do i have|what is wrong)\b", lowered):
        return "diagnosis"
    if re.search(r"\b(what does .* mean|what is .*|define|definition|explain this term|meaning)\b", lowered):
        return "definition"
    if re.search(r"\b(right now|what should i do|what do i do|next step|immediately|today)\b", lowered):
        return "actions_now"
    if re.search(r"\b(next step|next steps|what should i do|plan)\b", lowered):
        return "next_steps"
    if re.search(r"\b(serious|severity|how bad|dangerous|risk)\b", lowered):
        return "seriousness"
    return "general"


def _has_pattern(text: str, patterns: list[str]) -> bool:
    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns)


def _get_context_availability(
    *,
    note_context: str,
    interpreted_note: dict[str, Any] | None,
    follow_up_context: dict[str, Any],
) -> dict[str, bool]:
    lowered_note = note_context.lower()
    treatments = follow_up_context.get("treatments_medications") or []
    next_steps = follow_up_context.get("next_steps") or []
    symptoms = follow_up_context.get("extracted_symptoms") or []
    summary = _normalize_whitespace(str(follow_up_context.get("interpreted_summary", ""))).lower()

    interpreted_terms: list[dict[str, Any]] = []
    if interpreted_note:
        raw_terms = interpreted_note.get("medical_terms_explained", [])
        if isinstance(raw_terms, list):
            interpreted_terms = [term for term in raw_terms if isinstance(term, dict)]

    has_medications = bool(treatments)
    has_symptoms = bool(symptoms) or _has_pattern(
        lowered_note,
        [
            r"\bpain\b",
            r"\bnausea\b",
            r"\bvomit",
            r"\bfever\b",
            r"\bcough\b",
            r"\bfatigue\b",
            r"\bdizzy",
            r"\bshortness of breath\b",
            r"\bswelling\b",
        ],
    )
    has_warning_signs = _has_pattern(
        lowered_note,
        [r"\bworsen", r"\bseek urgent", r"\bemergency", r"\bred flag", r"\bcall.*(office|doctor)", r"\bsevere"],
    ) or _has_pattern(summary, [r"warning", r"red flag", r"urgent", r"seek care"])
    has_tests = _has_pattern(
        lowered_note,
        [r"\blab", r"\bblood test", r"\bimaging", r"\bx-?ray", r"\bct\b", r"\bmri\b", r"\bultrasound", r"\bresults?"],
    )
    has_diagnoses = _has_pattern(
        lowered_note,
        [r"\bdiagnos", r"\bimpression", r"\bassessment", r"\bcondition", r"\bsyndrome", r"\bdisease"],
    ) or bool(interpreted_terms)
    has_terms = bool(interpreted_terms) or _has_pattern(summary, [r"\bmeans\b", r"\bcalled\b", r"\balso known as\b"])

    return {
        "medications": has_medications,
        "symptoms": has_symptoms,
        "next_steps": bool(next_steps),
        "warning_signs": has_warning_signs,
        "tests": has_tests,
        "diagnoses": has_diagnoses,
        "definitions": has_terms,
    }


def _build_missing_category_response(
    *,
    intent: str,
    availability: dict[str, bool],
    follow_up_context: dict[str, Any],
) -> str | None:
    if intent == "medication" and not availability["medications"]:
        summary = _normalize_whitespace(str(follow_up_context.get("interpreted_summary", "")))
        suffix = f" This note focuses on: {summary}" if summary else ""
        return (
            "This note does not clearly mention a medication, so I cannot explain a medicine based on this document."
            f"{suffix}"
        ).strip()
    if intent == "symptoms" and not availability["symptoms"]:
        return "This note does not clearly list specific symptoms, so I cannot point to symptom-based concerns from this document."
    if intent == "warning_signs" and not (availability["warning_signs"] or availability["symptoms"]):
        return "This note does not clearly describe warning signs or symptom progression, so I cannot identify specific red flags from this document."
    if intent in {"actions_now", "next_steps"} and not availability["next_steps"]:
        return "This note does not clearly include immediate next-step instructions, so I cannot give a document-specific action list from it."
    if intent == "tests" and not availability["tests"]:
        return "This note does not clearly mention tests or results, so I cannot explain test-related details from this document."
    if intent == "diagnosis" and not availability["diagnoses"]:
        return "This note does not clearly state a diagnosis or condition, so I cannot explain one based on this document."
    if intent == "definition" and not availability["definitions"]:
        return "This note does not clearly define that medical term, so I cannot give a document-specific definition from this text."
    if intent == "seriousness" and not (availability["diagnoses"] or availability["symptoms"]):
        return "This note does not provide enough condition detail to judge seriousness from the document alone."
    return None


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

    follow_up_context = _extract_follow_up_context(note_context, parsed_interpretation)
    intent = _detect_follow_up_intent(concise_question)
    availability = _get_context_availability(
        note_context=note_context,
        interpreted_note=parsed_interpretation,
        follow_up_context=follow_up_context,
    )
    missing_category_response = _build_missing_category_response(
        intent=intent,
        availability=availability,
        follow_up_context=follow_up_context,
    )
    if missing_category_response:
        return missing_category_response

    if parsed_interpretation:
        structured_context = json.dumps(_expand_context_values(parsed_interpretation), ensure_ascii=False)
    else:
        structured_context = json.dumps(
            {"summary": _expand_medical_abbreviations(interpreted_note)},
            ensure_ascii=False,
        )

    system_prompt = (
        "You are a conversational follow-up assistant answering patient questions about a medical note. "
        "The user question is the top priority: answer the exact question asked before adding general context. "
        "Do not switch topics. If the user asks about medicines, answer medicine-specific content only. "
        "If the requested category is missing, state that clearly instead of guessing. "
        "Lead with a direct, contextual answer grounded in the note. "
        "If relevant, briefly explain the condition or medication in practical language. "
        "Use minimal safety language; include a short caution only when needed for uncertainty/high-risk guidance. "
        "Ground every answer in the provided note/interpretation. "
        "If uncertain, say what is unclear. Never diagnose. Never create medication instructions that are not stated. "
        "Do not reuse a generic template response across different questions."
    )
    user_prompt = (
        f"User question: {concise_question}\n\n"
        f"Detected question intent: {intent}\n"
        f"Context availability flags: {json.dumps(availability, ensure_ascii=False)}\n"
        f"Original note (cleaned): {_truncate(note_context)}\n\n"
        f"Interpreted summary: {_truncate(str(follow_up_context.get('interpreted_summary', '')))}\n"
        f"Extracted symptoms: {_truncate(json.dumps(follow_up_context.get('extracted_symptoms', []), ensure_ascii=False), 500)}\n"
        f"Treatments/medications: {_truncate(json.dumps(follow_up_context.get('treatments_medications', []), ensure_ascii=False), 500)}\n"
        f"Next steps: {_truncate(json.dumps(follow_up_context.get('next_steps', []), ensure_ascii=False), 500)}\n"
        f"Structured interpretation: {_truncate(structured_context)}\n"
        f"Likely template note: {likely_template}\n"
        "Answer in 3-5 sentences in plain, natural English. Start with the direct answer first. "
        "Use the intent label to choose the angle of your response (actions, warning signs, seriousness, or general clarification)."
    )

    ai_answer = provider.generate_text(system_prompt=system_prompt, user_prompt=user_prompt)
    if ai_answer:
        return _truncate(ai_answer, 900)

    return _build_contextual_follow_up_fallback(
        question=concise_question,
        follow_up_context=follow_up_context,
        likely_template=likely_template,
    )
