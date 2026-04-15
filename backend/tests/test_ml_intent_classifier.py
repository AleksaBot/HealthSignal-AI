from pathlib import Path

from app.services.ml_intent_classifier import (
    IntentExample,
    load_intent_examples_from_eval_dataset,
    save_intent_classifier,
    train_intent_classifier,
    load_intent_classifier,
    predict_with_intent_classifier,
)
from scripts.eval_note_intelligence import compare_intent_backends, load_eval_dataset


def test_load_intent_examples_from_eval_dataset_has_pairs():
    examples = load_intent_examples_from_eval_dataset()
    assert len(examples) >= 100
    assert all(example.question for example in examples)
    assert all(example.label for example in examples)


def test_train_and_predict_intent_classifier_smoke(tmp_path: Path):
    examples = [
        IntentExample(question="What medicine am I taking?", label="medication"),
        IntentExample(question="Were any tests ordered?", label="tests"),
        IntentExample(question="Do I have a referral?", label="referrals"),
        IntentExample(question="What symptoms are listed?", label="symptoms"),
        IntentExample(question="Is this dangerous?", label="seriousness"),
        IntentExample(question="What warning signs should I watch for?", label="warning_signs"),
    ]
    model = train_intent_classifier(examples)

    artifact_path = tmp_path / "intent_classifier.joblib"
    save_intent_classifier(model, artifact_path)

    loaded = load_intent_classifier(artifact_path)
    pred = predict_with_intent_classifier("What tests should I do?", loaded)
    assert pred in {
        "medication",
        "symptoms",
        "warning_signs",
        "seriousness",
        "next_steps",
        "tests",
        "referrals",
        "definitions",
        "general",
    }


def test_compare_intent_backends_includes_summary(tmp_path: Path):
    dataset = load_eval_dataset()
    examples = load_intent_examples_from_eval_dataset()
    model = train_intent_classifier(examples)

    artifact_path = tmp_path / "intent_classifier.joblib"
    save_intent_classifier(model, artifact_path)

    comparison = compare_intent_backends(dataset, artifact_path)

    assert "overall_rule_accuracy" in comparison
    assert "overall_ml_accuracy" in comparison
    assert "recommended_backend_on_current_dataset" in comparison
