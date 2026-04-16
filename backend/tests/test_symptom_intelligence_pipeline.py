from app.schemas.symptom_intelligence import SymptomInput
from app.services.symptom_condition_matcher import match_condition_categories
from app.services.symptom_extractor import extract_symptom_intelligence
from app.services.symptom_follow_up_engine import generate_follow_up_questions
from app.services.symptom_intelligence_pipeline import build_symptom_answer_plan
from app.services.symptom_risk_classifier import classify_symptom_risk


def test_symptom_extractor_parses_core_fields():
    text = "Severe chest pain and shortness of breath in chest for 2 hours with sweating and fainting"
    extracted = extract_symptom_intelligence(text)

    assert "chest pain" in extracted.primary_symptoms
    assert "shortness of breath" in extracted.primary_symptoms
    assert extracted.duration == "for 2 hours"
    assert extracted.severity == "severe"
    assert extracted.location_body_area == "chest"
    assert "sweating" in extracted.associated_symptoms
    assert "fainting" in extracted.red_flags


def test_symptom_risk_classifier_levels():
    emergency = extract_symptom_intelligence("chest pain and shortness of breath")
    assert classify_symptom_risk(emergency).risk_level == "emergency"

    high = extract_symptom_intelligence("severe headache for 1 day")
    assert classify_symptom_risk(high).risk_level == "high"

    moderate = extract_symptom_intelligence("cough and fever for 2 days")
    assert classify_symptom_risk(moderate).risk_level == "moderate"

    low = extract_symptom_intelligence("mild cough")
    assert classify_symptom_risk(low).risk_level == "low"


def test_condition_matcher_routes_expected_categories():
    neuro = extract_symptom_intelligence("headache dizziness and light sensitivity")
    cardio = extract_symptom_intelligence("chest pain with shortness of breath")
    gi = extract_symptom_intelligence("abdominal pain and nausea")

    assert "neurological/headache" in match_condition_categories(neuro)
    assert "cardiovascular/respiratory" in match_condition_categories(cardio)
    assert "GI/abdominal" in match_condition_categories(gi)


def test_follow_up_engine_major_symptom_groups():
    headache = extract_symptom_intelligence("headache for 2 days")
    headache_questions = generate_follow_up_questions(headache, risk_level="moderate")
    headache_prompts = [question.prompt_text.lower() for question in headache_questions]
    assert any("light" in prompt for prompt in headache_prompts)

    chest = extract_symptom_intelligence("chest pain")
    chest_questions = generate_follow_up_questions(chest, risk_level="high")
    chest_prompts = [question.prompt_text.lower() for question in chest_questions]
    assert any("pressure" in prompt or "sharp" in prompt for prompt in chest_prompts)

    abdominal = extract_symptom_intelligence("abdominal pain")
    abdominal_questions = generate_follow_up_questions(abdominal, risk_level="moderate")
    abdominal_prompts = [question.prompt_text.lower() for question in abdominal_questions]
    assert any("nausea" in prompt or "vomiting" in prompt for prompt in abdominal_prompts)

    dizzy = extract_symptom_intelligence("dizziness")
    dizzy_questions = generate_follow_up_questions(dizzy, risk_level="moderate")
    dizzy_prompts = [question.prompt_text.lower() for question in dizzy_questions]
    assert any("fainted" in prompt for prompt in dizzy_prompts)


def test_follow_up_engine_enforces_question_limit_and_minimum():
    extracted = extract_symptom_intelligence("chest pain headache dizziness abdominal pain")
    questions = generate_follow_up_questions(extracted, risk_level="high", min_questions=2, max_questions=5)

    assert 2 <= len(questions) <= 5


def test_follow_up_engine_prioritizes_order():
    extracted = extract_symptom_intelligence("chest pain")
    questions = generate_follow_up_questions(extracted, risk_level="emergency", max_questions=5)

    priorities = [question.priority for question in questions]
    assert priorities == sorted(priorities)
    assert questions[0].question_category == "severity"


def test_pipeline_builds_answer_plan_with_triage_and_intake_session():
    plan, intelligence = build_symptom_answer_plan(
        SymptomInput(symptom_text="Chest pain with shortness of breath for 30 minutes")
    )

    assert "cardiovascular/respiratory" in plan.categories
    assert "emergency" in plan.triage_recommendation.lower()
    assert intelligence["risk"].risk_level == "emergency"
    assert 2 <= len(plan.follow_up_questions) <= 5
    assert intelligence["intake_session"].follow_up_questions
