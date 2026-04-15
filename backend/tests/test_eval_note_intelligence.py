from app.services.eval_scoring import fact_presence_score, field_overlap_score, intent_accuracy
from scripts.eval_note_intelligence import (
    DATASET_PATH,
    build_benchmark_report,
    evaluate_dataset,
    load_eval_dataset,
)


def test_field_overlap_score_computes_partial_match():
    score = field_overlap_score(["metformin", "insulin"], ["metformin", "lisinopril"])
    assert round(score.precision, 2) == 0.5
    assert round(score.recall, 2) == 0.5
    assert round(score.f1, 2) == 0.5


def test_intent_accuracy_works_for_mixed_predictions():
    expected = ["medication", "tests", "referrals"]
    predicted = ["medication", "general", "referrals"]
    assert intent_accuracy(expected, predicted) == 2 / 3


def test_fact_presence_score_checks_substrings():
    answer = "Tests mentioned: cbc, ultrasound. Referral targets in note: neurology."
    score = fact_presence_score(["cbc", "ultrasound", "neurology"], answer)
    assert score == 1.0


def test_eval_dataset_loader_and_runner():
    dataset = load_eval_dataset(DATASET_PATH)
    assert len(dataset) >= 40

    results, field_scores, mismatches, label_accuracy, overall_score = evaluate_dataset(dataset)

    assert results
    assert set(field_scores.keys()) == {
        "symptoms",
        "medications",
        "tests_ordered",
        "referrals",
        "follow_up_actions",
        "warning_signs",
        "diagnoses_or_conditions",
        "duration_or_timing",
    }
    assert isinstance(mismatches, list)
    assert isinstance(label_accuracy, dict)
    assert 0.0 <= overall_score <= 1.0


def test_build_benchmark_report_structure():
    dataset = load_eval_dataset(DATASET_PATH)
    results, field_scores, mismatches, label_accuracy, overall_score = evaluate_dataset(dataset)
    report = build_benchmark_report(
        benchmark_name="unit_test",
        dataset_size=len(dataset),
        results=results,
        field_metrics=field_scores,
        intent_mismatches=mismatches,
        label_accuracy=label_accuracy,
        overall_pipeline_score=overall_score,
    )

    assert report["benchmark_name"] == "unit_test"
    assert report["dataset_size"] == len(dataset)
    assert "field_metrics" in report
    assert "intent_label_accuracy" in report
    assert "overall_pipeline_score" in report
