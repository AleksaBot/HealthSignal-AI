from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.answer_router import build_answer_plan
from app.services.eval_scoring import fact_presence_score, field_overlap_score, intent_accuracy
from app.services.ml_intent_classifier import DEFAULT_INTENT_MODEL_PATH, load_intent_classifier, predict_with_intent_classifier
from app.services.note_extractor import extract_note_intelligence
from app.services.question_intent import classify_question_intent, classify_question_intent_rule

DATASET_PATH = ROOT / "data" / "note_eval_seed.jsonl"
FIELDS = [
    "symptoms",
    "medications",
    "tests_ordered",
    "referrals",
    "follow_up_actions",
    "warning_signs",
    "diagnoses_or_conditions",
    "duration_or_timing",
]


@dataclass
class ExampleResult:
    index: int
    extraction_f1_avg: float
    intent_acc: float
    fact_score: float
    passed: bool


@dataclass
class LabelAccuracy:
    correct: int = 0
    total: int = 0

    @property
    def accuracy(self) -> float:
        return (self.correct / self.total) if self.total else 0.0


def load_eval_dataset(path: Path = DATASET_PATH) -> list[dict]:
    records: list[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            raw = line.strip()
            if not raw:
                continue
            records.append(json.loads(raw))
    return records


def _compose_routed_answer(plan_facts: list[str], missing_message: str | None) -> str:
    if missing_message:
        return missing_message
    if not plan_facts:
        return ""
    return " ".join(plan_facts)


def evaluate_dataset(records: list[dict]) -> tuple[list[ExampleResult], dict[str, dict[str, float]], list[str], dict[str, LabelAccuracy], float]:
    field_totals = {field: {"precision": 0.0, "recall": 0.0, "f1": 0.0} for field in FIELDS}
    intent_mismatches: list[str] = []
    label_accuracy: dict[str, LabelAccuracy] = {}
    results: list[ExampleResult] = []
    pipeline_score_total = 0.0

    for idx, record in enumerate(records, start=1):
        note_text = record["note_text"]
        extracted_truth = record["extracted_truth"]
        sample_questions = record.get("sample_questions", [])
        expected_intents = record.get("intent_labels", [])
        expected_facts = record.get("expected_answer_facts", [])

        predicted_extraction = extract_note_intelligence(note_text).model_dump()
        extraction_scores = []

        for field in FIELDS:
            score = field_overlap_score(extracted_truth.get(field, []), predicted_extraction.get(field, []))
            extraction_scores.append(score.f1)
            field_totals[field]["precision"] += score.precision
            field_totals[field]["recall"] += score.recall
            field_totals[field]["f1"] += score.f1

        predicted_intents = [classify_question_intent(question) for question in sample_questions]
        for q_index, (expected, predicted) in enumerate(zip(expected_intents, predicted_intents), start=1):
            label_stats = label_accuracy.setdefault(expected, LabelAccuracy())
            label_stats.total += 1
            if expected == predicted:
                label_stats.correct += 1
            if expected != predicted:
                intent_mismatches.append(
                    f"example={idx} question={q_index} expected={expected} predicted={predicted}"
                )

        routed_segments: list[str] = []
        extracted_model = extract_note_intelligence(note_text)
        for question in sample_questions:
            intent = classify_question_intent(question)
            plan = build_answer_plan(extracted=extracted_model, intent=intent, question=question)
            routed_segments.append(_compose_routed_answer(plan.facts, plan.missing_message))

        routed_answer_text = " ".join(routed_segments)

        avg_extraction_f1 = sum(extraction_scores) / len(FIELDS)
        q_intent_acc = intent_accuracy(expected_intents, predicted_intents)
        fact_score = fact_presence_score(expected_facts, routed_answer_text)
        pipeline_score = (avg_extraction_f1 + q_intent_acc + fact_score) / 3
        pipeline_score_total += pipeline_score
        passed = avg_extraction_f1 >= 0.65 and q_intent_acc >= 0.8 and fact_score >= 0.6

        results.append(
            ExampleResult(
                index=idx,
                extraction_f1_avg=avg_extraction_f1,
                intent_acc=q_intent_acc,
                fact_score=fact_score,
                passed=passed,
            )
        )

    denom = max(len(records), 1)
    field_metric_averages = {
        field: {
            "precision": metrics["precision"] / denom,
            "recall": metrics["recall"] / denom,
            "f1": metrics["f1"] / denom,
        }
        for field, metrics in field_totals.items()
    }
    overall_pipeline_score = pipeline_score_total / denom
    return results, field_metric_averages, intent_mismatches, label_accuracy, overall_pipeline_score


def build_benchmark_report(
    *,
    benchmark_name: str,
    dataset_size: int,
    results: list[ExampleResult],
    field_metrics: dict[str, dict[str, float]],
    intent_mismatches: list[str],
    label_accuracy: dict[str, LabelAccuracy],
    overall_pipeline_score: float,
) -> dict[str, object]:
    return {
        "benchmark_name": benchmark_name,
        "generated_at_utc": datetime.now(UTC).isoformat(),
        "dataset_size": dataset_size,
        "overall_pipeline_score": round(overall_pipeline_score, 4),
        "pass_count": sum(1 for result in results if result.passed),
        "field_metrics": field_metrics,
        "intent_label_accuracy": {
            label: {
                "correct": stats.correct,
                "total": stats.total,
                "accuracy": round(stats.accuracy, 4),
            }
            for label, stats in sorted(label_accuracy.items())
        },
        "intent_mismatches": intent_mismatches,
        "per_example": [
            {
                "example": result.index,
                "extract_f1": round(result.extraction_f1_avg, 4),
                "intent_acc": round(result.intent_acc, 4),
                "fact_score": round(result.fact_score, 4),
                "passed": result.passed,
            }
            for result in results
        ],
    }


def compare_intent_backends(records: list[dict], ml_model_path: Path) -> dict[str, object]:
    rule_total = 0
    rule_correct = 0
    ml_total = 0
    ml_correct = 0
    per_label_rule: dict[str, LabelAccuracy] = {}
    per_label_ml: dict[str, LabelAccuracy] = {}
    mismatches: list[str] = []

    model = load_intent_classifier(ml_model_path)

    for idx, record in enumerate(records, start=1):
        questions = record.get("sample_questions", [])
        labels = record.get("intent_labels", [])
        for q_idx, (question, expected) in enumerate(zip(questions, labels), start=1):
            rule_pred = classify_question_intent_rule(question)
            ml_pred = predict_with_intent_classifier(question, model)

            rule_total += 1
            ml_total += 1

            rule_stats = per_label_rule.setdefault(expected, LabelAccuracy())
            rule_stats.total += 1
            if rule_pred == expected:
                rule_correct += 1
                rule_stats.correct += 1

            ml_stats = per_label_ml.setdefault(expected, LabelAccuracy())
            ml_stats.total += 1
            if ml_pred == expected:
                ml_correct += 1
                ml_stats.correct += 1

            if rule_pred != ml_pred:
                mismatches.append(
                    f"example={idx} question={q_idx} expected={expected} rule={rule_pred} ml={ml_pred}"
                )

    rule_acc = (rule_correct / rule_total) if rule_total else 0.0
    ml_acc = (ml_correct / ml_total) if ml_total else 0.0
    recommendation = "ml" if ml_acc > rule_acc else "rule"

    return {
        "overall_rule_accuracy": round(rule_acc, 4),
        "overall_ml_accuracy": round(ml_acc, 4),
        "per_label_rule_accuracy": {
            label: {"correct": stats.correct, "total": stats.total, "accuracy": round(stats.accuracy, 4)}
            for label, stats in sorted(per_label_rule.items())
        },
        "per_label_ml_accuracy": {
            label: {"correct": stats.correct, "total": stats.total, "accuracy": round(stats.accuracy, 4)}
            for label, stats in sorted(per_label_ml.items())
        },
        "rule_vs_ml_prediction_mismatches": mismatches,
        "recommended_backend_on_current_dataset": recommendation,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate note intelligence extraction, intent, and routing.")
    parser.add_argument("--dataset", type=Path, default=DATASET_PATH, help="Path to note eval dataset jsonl file.")
    parser.add_argument("--output-json", type=Path, default=None, help="Optional output path for benchmark JSON report.")
    parser.add_argument("--benchmark-name", default="rule_baseline_v1", help="Benchmark label for report tracking.")
    parser.add_argument("--compare-ml", action="store_true", help="Compare rule-based intents with a trained ML classifier.")
    parser.add_argument("--ml-model-path", type=Path, default=DEFAULT_INTENT_MODEL_PATH, help="Path to trained ML intent classifier artifact.")
    args = parser.parse_args()

    records = load_eval_dataset(args.dataset)
    results, field_metric_averages, intent_mismatches, label_accuracy, overall_pipeline_score = evaluate_dataset(records)

    print("=== Note Intelligence Evaluation ===")
    print(f"Dataset size: {len(records)} examples")

    print("\nExtraction metrics by field:")
    for field, metrics in field_metric_averages.items():
        print(f"- {field}: precision={metrics['precision']:.2f} recall={metrics['recall']:.2f} f1={metrics['f1']:.2f}")

    print("\nIntent classification mismatches:")
    if not intent_mismatches:
        print("- none")
    else:
        for mismatch in intent_mismatches:
            print(f"- {mismatch}")

    print("\nIntent accuracy by label:")
    for label, stats in sorted(label_accuracy.items()):
        print(f"- {label}: {stats.correct}/{stats.total} ({stats.accuracy:.2%})")

    print("\nPer-example summary:")
    for result in results:
        status = "PASS" if result.passed else "FAIL"
        print(
            f"- example {result.index}: {status} "
            f"(extract_f1={result.extraction_f1_avg:.2f}, intent_acc={result.intent_acc:.2f}, facts={result.fact_score:.2f})"
        )

    total_pass = sum(1 for result in results if result.passed)
    print(f"\nOverall: {total_pass}/{len(results)} examples passed")
    print(f"Overall pipeline score: {overall_pipeline_score:.3f}")

    report = build_benchmark_report(
        benchmark_name=args.benchmark_name,
        dataset_size=len(records),
        results=results,
        field_metrics=field_metric_averages,
        intent_mismatches=intent_mismatches,
        label_accuracy=label_accuracy,
        overall_pipeline_score=overall_pipeline_score,
    )
    if args.output_json:
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        args.output_json.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"Saved benchmark report JSON to: {args.output_json}")

    if args.compare_ml:
        comparison = compare_intent_backends(records, args.ml_model_path)
        print("\nIntent backend comparison:")
        print(
            f"- Rule accuracy: {comparison['overall_rule_accuracy']:.4f} | "
            f"ML accuracy: {comparison['overall_ml_accuracy']:.4f}"
        )
        print(f"- Recommended backend on current dataset: {comparison['recommended_backend_on_current_dataset']}")
        if args.output_json:
            merged = {**report, "intent_backend_comparison": comparison}
            args.output_json.write_text(json.dumps(merged, indent=2), encoding="utf-8")
            print(f"Updated benchmark report with comparison data: {args.output_json}")


if __name__ == "__main__":
    main()
