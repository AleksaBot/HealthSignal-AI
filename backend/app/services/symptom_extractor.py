from __future__ import annotations

import re

from app.schemas.symptom_intelligence import ExtractedSymptomIntelligence

PRIMARY_SYMPTOMS = [
    "headache",
    "dizziness",
    "light sensitivity",
    "chest pain",
    "shortness of breath",
    "abdominal pain",
    "nausea",
    "vomiting",
    "fever",
    "cough",
    "confusion",
    "weakness",
    "palpitations",
]

ASSOCIATED_SYMPTOMS = [
    "fatigue",
    "chills",
    "diarrhea",
    "blurred vision",
    "sweating",
    "tingling",
]

BODY_AREA_TERMS = [
    "head",
    "chest",
    "abdomen",
    "stomach",
    "back",
    "neck",
    "throat",
    "arm",
    "leg",
]

SEVERITY_PATTERNS: list[tuple[str, str]] = [
    (r"\b(worst|excruciating|unbearable|severe)\b", "severe"),
    (r"\b(moderate|persistent)\b", "moderate"),
    (r"\b(mild|slight)\b", "mild"),
]

DURATION_PATTERNS = [
    r"\bfor\s+\d+\s+(minute|minutes|hour|hours|day|days|week|weeks|month|months)\b",
    r"\bsince\s+(yesterday|today|this morning|last night|\d+\s+(minute|minutes|hour|hours|day|days|week|weeks))\b",
    r"\bstarted\s+\d+\s+(minute|minutes|hour|hours|day|days)\s+ago\b",
]

RED_FLAG_TERMS = [
    "fainting",
    "passed out",
    "severe shortness of breath",
    "cannot breathe",
    "slurred speech",
    "one-sided weakness",
    "crushing chest pain",
    "blood in vomit",
    "black stool",
]


def _collect_terms(text: str, terms: list[str]) -> list[str]:
    found: list[str] = []
    for term in terms:
        if re.search(rf"\b{re.escape(term)}\b", text, flags=re.IGNORECASE):
            found.append(term)
    return found


def _first_match(text: str, patterns: list[str]) -> str | None:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return re.sub(r"\s+", " ", match.group(0)).strip()
    return None


def _extract_severity(text: str) -> str | None:
    for pattern, severity in SEVERITY_PATTERNS:
        if re.search(pattern, text, flags=re.IGNORECASE):
            return severity
    return None


def extract_symptom_intelligence(symptom_text: str) -> ExtractedSymptomIntelligence:
    compact_text = re.sub(r"\s+", " ", symptom_text).strip()
    lowered = compact_text.lower()

    primary_symptoms = _collect_terms(lowered, PRIMARY_SYMPTOMS)
    associated = _collect_terms(lowered, ASSOCIATED_SYMPTOMS)
    red_flags = _collect_terms(lowered, RED_FLAG_TERMS)

    duration = _first_match(lowered, DURATION_PATTERNS)
    severity = _extract_severity(lowered)

    location = None
    for term in BODY_AREA_TERMS:
        if re.search(rf"\b{re.escape(term)}\b", lowered, flags=re.IGNORECASE):
            location = term
            break

    return ExtractedSymptomIntelligence(
        primary_symptoms=primary_symptoms,
        duration=duration,
        severity=severity,
        location_body_area=location,
        associated_symptoms=associated,
        red_flags=red_flags,
    )
