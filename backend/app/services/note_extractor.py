from __future__ import annotations

import re

from app.schemas.note_intelligence import ExtractedNoteIntelligence

SYMPTOM_TERMS = [
    "abdominal pain",
    "headache",
    "fatigue",
    "nausea",
    "vomiting",
    "dizziness",
    "shortness of breath",
    "chest pain",
    "cough",
    "fever",
    "swelling",
    "palpitations",
]

MEDICATION_TERMS = [
    "metformin",
    "insulin",
    "lisinopril",
    "losartan",
    "atorvastatin",
    "amoxicillin",
    "ibuprofen",
    "acetaminophen",
]

TEST_TERMS = ["cbc", "cmp", "a1c", "mri", "ct", "x-ray", "ultrasound", "blood test", "lab"]

REFERRAL_TERMS = ["neurology", "cardiology", "endocrinology", "gastroenterology", "physical therapy"]

DIAGNOSIS_TERMS = [
    "hypertension",
    "diabetes",
    "migraine",
    "anxiety",
    "hyperlipidemia",
    "infection",
    "neuropathy",
]

WARNING_PATTERNS = [
    r"seek (urgent|emergency) care[^.]*",
    r"go to (the )?er[^.]*",
    r"call .* (if|for) [^.]*",
    r"red flag[^.]*",
    r"worsen(ing)?[^.]*",
]

DURATION_PATTERNS = [
    r"\bfor\s+\d+\s+(day|days|week|weeks|month|months)\b",
    r"\bx\s*\d+\s*d\b",
    r"\bin\s+\d+\s+(day|days|week|weeks|month|months)\b",
    r"\bwithin\s+\d+\s+(hour|hours|day|days)\b",
    r"\b(today|tomorrow|next week|next month|follow-up in \d+\s+days?)\b",
]

FOLLOW_UP_PATTERNS = [
    r"(follow[- ]?up[^.]*)",
    r"(return[^.]*)",
    r"(continue[^.]*)",
    r"(start[^.]*)",
    r"(monitor[^.]*)",
]


def _collect_terms(text: str, terms: list[str]) -> list[str]:
    found: list[str] = []
    for term in terms:
        if re.search(rf"\b{re.escape(term)}\b", text, flags=re.IGNORECASE):
            found.append(term)
    return found


def _collect_pattern_matches(text: str, patterns: list[str]) -> list[str]:
    matches: list[str] = []
    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            value = re.sub(r"\s+", " ", match.group(0)).strip(" .")
            if value and value.lower() not in {item.lower() for item in matches}:
                matches.append(value)
    return matches


def extract_note_intelligence(note_text: str) -> ExtractedNoteIntelligence:
    compact_text = re.sub(r"\s+", " ", note_text).strip()
    lowered = compact_text.lower()

    symptoms = _collect_terms(lowered, SYMPTOM_TERMS)
    medications = _collect_terms(lowered, MEDICATION_TERMS)
    tests_ordered = _collect_terms(lowered, TEST_TERMS)
    referrals = _collect_terms(lowered, REFERRAL_TERMS)
    diagnoses_or_conditions = _collect_terms(lowered, DIAGNOSIS_TERMS)

    follow_up_actions = _collect_pattern_matches(compact_text, FOLLOW_UP_PATTERNS)
    warning_signs = _collect_pattern_matches(compact_text, WARNING_PATTERNS)
    duration_or_timing = _collect_pattern_matches(lowered, DURATION_PATTERNS)

    return ExtractedNoteIntelligence(
        symptoms=symptoms,
        medications=medications,
        tests_ordered=tests_ordered,
        referrals=referrals,
        follow_up_actions=follow_up_actions,
        warning_signs=warning_signs,
        diagnoses_or_conditions=diagnoses_or_conditions,
        duration_or_timing=duration_or_timing,
    )
