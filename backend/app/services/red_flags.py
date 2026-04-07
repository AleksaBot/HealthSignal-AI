from collections.abc import Iterable

RULES: dict[str, dict[str, list[str] | str]] = {
    "urgent_cardiovascular": {
        "all_terms": ["chest pain", "shortness of breath"],
        "message": "Urgent cardiovascular warning pattern detected (chest pain + shortness of breath)."
    },
    "stroke_warning": {
        "all_terms": ["slurred speech", "weakness"],
        "message": "Possible stroke pattern detected (slurred speech + weakness). Seek urgent evaluation."
    },
    "neurologic_risk": {
        "all_terms": ["severe headache", "confusion"],
        "message": "Neurological risk pattern detected (severe headache + confusion)."
    }
}


def detect_red_flags(text_fragments: Iterable[str]) -> list[str]:
    combined = " ".join(fragment.lower() for fragment in text_fragments)
    matched_flags: list[str] = []

    for rule in RULES.values():
        terms = rule["all_terms"]
        if all(term in combined for term in terms):
            matched_flags.append(str(rule["message"]))

    if not matched_flags:
        matched_flags.append("No explicit high-risk combination detected in current heuristic rule set.")

    return matched_flags
