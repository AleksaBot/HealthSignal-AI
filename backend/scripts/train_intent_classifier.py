from __future__ import annotations

import argparse
import random
from collections import Counter, defaultdict
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.ml_intent_classifier import (
    DEFAULT_EVAL_DATASET_PATH,
    DEFAULT_INTENT_MODEL_PATH,
    IntentExample,
    load_intent_examples_from_eval_dataset,
    predict_with_intent_classifier,
    save_intent_classifier,
    train_intent_classifier,
)


def _accuracy(expected: list[str], predicted: list[str]) -> float:
    if not expected:
        return 0.0
    correct = sum(1 for exp, pred in zip(expected, predicted) if exp == pred)
    return correct / len(expected)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train TF-IDF centroid intent classifier")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_EVAL_DATASET_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_INTENT_MODEL_PATH)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    examples = load_intent_examples_from_eval_dataset(args.dataset)
    labels = [example.label for example in examples]
    print(f"Loaded {len(examples)} intent examples from {args.dataset}")
    print(f"Label distribution: {dict(Counter(labels))}")

    random.seed(args.seed)
    shuffled = examples[:]
    random.shuffle(shuffled)
    split_idx = max(1, int(0.75 * len(shuffled)))

    train_examples = shuffled[:split_idx]
    test_examples = shuffled[split_idx:]

    model = train_intent_classifier(train_examples)
    y_true = [example.label for example in test_examples]
    y_pred = [predict_with_intent_classifier(example.question, model) for example in test_examples]

    holdout_acc = _accuracy(y_true, y_pred)
    print(f"Holdout accuracy: {holdout_acc:.4f}")

    per_label = defaultdict(lambda: {"correct": 0, "total": 0})
    for expected, predicted in zip(y_true, y_pred):
        per_label[expected]["total"] += 1
        if expected == predicted:
            per_label[expected]["correct"] += 1

    print("Per-label holdout accuracy:")
    for label, stats in sorted(per_label.items()):
        total = stats["total"] or 1
        print(f"- {label}: {stats['correct']}/{stats['total']} ({stats['correct']/total:.2%})")

    full_model = train_intent_classifier(examples)
    save_intent_classifier(full_model, args.output)
    print(f"Saved trained intent classifier to {args.output}")


if __name__ == "__main__":
    main()
