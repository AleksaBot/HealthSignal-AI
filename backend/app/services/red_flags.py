from __future__ import annotations

RED_FLAG_RULES: list[tuple[set[str], str]] = [
    (
        {"chest pain", "shortness of breath"},
        "Chest pain with shortness of breath can represent a medical emergency; seek immediate in-person evaluation.",
    ),
    (
        {"slurred speech", "weakness"},
        "Slurred speech with weakness may indicate an acute neurologic event; call emergency services now.",
    ),
    (
        {"severe headache", "confusion"},
        "Severe headache with confusion can be dangerous and needs urgent medical assessment.",
    ),
]


def evaluate_red_flags(text: str) -> list[str]:
    lowered = text.lower()
    findings: list[str] = []

    for terms, message in RED_FLAG_RULES:
        if all(term in lowered for term in terms):
            findings.append(message)

    if not findings:
        findings.append("No explicit emergency phrase pair detected in this educational heuristic pass.")

    return findings
