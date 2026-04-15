from __future__ import annotations

from dataclasses import dataclass


@dataclass
class OverlapScore:
    precision: float
    recall: float
    f1: float


def _normalize_items(items: list[str]) -> set[str]:
    return {item.strip().lower() for item in items if item and item.strip()}


def field_overlap_score(truth: list[str], predicted: list[str]) -> OverlapScore:
    truth_set = _normalize_items(truth)
    predicted_set = _normalize_items(predicted)

    if not truth_set and not predicted_set:
        return OverlapScore(precision=1.0, recall=1.0, f1=1.0)
    if not truth_set:
        return OverlapScore(precision=0.0, recall=1.0, f1=0.0)
    if not predicted_set:
        return OverlapScore(precision=1.0, recall=0.0, f1=0.0)

    overlap = truth_set & predicted_set
    precision = len(overlap) / len(predicted_set)
    recall = len(overlap) / len(truth_set)
    f1 = 0.0 if (precision + recall) == 0 else (2 * precision * recall) / (precision + recall)
    return OverlapScore(precision=precision, recall=recall, f1=f1)


def intent_accuracy(expected: list[str], predicted: list[str]) -> float:
    if not expected:
        return 1.0 if not predicted else 0.0

    pairs = zip(expected, predicted)
    correct = sum(1 for exp, pred in pairs if exp == pred)
    return correct / len(expected)


def fact_presence_score(expected_facts: list[str], answer_text: str) -> float:
    if not expected_facts:
        return 1.0

    answer = answer_text.lower()
    matched = sum(1 for fact in expected_facts if fact.lower() in answer)
    return matched / len(expected_facts)
