from app.services.answer_router import build_answer_plan
from app.services.note_extractor import extract_note_intelligence
from app.services.question_intent import classify_question_intent


def test_note_extractor_handles_three_note_types():
    urgent_note = (
        "Patient reports abdominal pain and nausea for 3 days. Continue metformin. "
        "Order CBC and ultrasound. Follow-up in 1 week. Seek urgent care for worsening pain."
    )
    referral_note = "Assessment migraine. Referred to neurology. MRI ordered. Return in 2 weeks."
    chronic_note = "Diagnosis hypertension and diabetes. Start lisinopril daily. A1c lab ordered."

    urgent = extract_note_intelligence(urgent_note)
    referral = extract_note_intelligence(referral_note)
    chronic = extract_note_intelligence(chronic_note)

    assert "abdominal pain" in urgent.symptoms
    assert "metformin" in urgent.medications
    assert "cbc" in urgent.tests_ordered
    assert urgent.warning_signs

    assert "neurology" in referral.referrals
    assert "mri" in referral.tests_ordered

    assert "hypertension" in chronic.diagnoses_or_conditions
    assert "diabetes" in chronic.diagnoses_or_conditions


def test_question_intent_classifier_supports_required_categories():
    assert classify_question_intent("What medicine am I taking?") == "medication"
    assert classify_question_intent("Which symptoms are listed?") == "symptoms"
    assert classify_question_intent("What warning signs should worry me?") == "warning_signs"
    assert classify_question_intent("Is this serious?") == "seriousness"
    assert classify_question_intent("What should I do next?") == "next_steps"
    assert classify_question_intent("What tests were ordered?") == "tests"
    assert classify_question_intent("Was I referred to a specialist?") == "referrals"
    assert classify_question_intent("What does this diagnosis mean?") == "definitions"


def test_answer_router_missing_medication_behavior():
    extracted = extract_note_intelligence("Patient has headache for 2 days. Follow-up in one week.")
    plan = build_answer_plan(extracted=extracted, intent="medication", question="What medicine do I take?")
    assert not plan.can_answer_from_note
    assert "does not mention a medication" in (plan.missing_message or "").lower()


def test_answer_router_tests_present_behavior():
    extracted = extract_note_intelligence("Order MRI and blood test. Follow-up in 2 weeks.")
    plan = build_answer_plan(extracted=extracted, intent="tests", question="What tests were ordered?")
    assert plan.can_answer_from_note
    assert any("mri" in fact.lower() for fact in plan.facts)


def test_answer_router_referral_present_behavior():
    extracted = extract_note_intelligence("Referred to neurology for further evaluation.")
    plan = build_answer_plan(extracted=extracted, intent="referrals", question="Any specialist referral?")
    assert plan.can_answer_from_note
    assert any("neurology" in fact.lower() for fact in plan.facts)


def test_answer_router_symptom_warning_behavior():
    extracted = extract_note_intelligence(
        "Patient has cough and fever. Seek urgent care for worsening shortness of breath."
    )
    symptoms_plan = build_answer_plan(extracted=extracted, intent="symptoms", question="What symptoms are there?")
    warning_plan = build_answer_plan(
        extracted=extracted,
        intent="warning_signs",
        question="What warning signs should I watch for?",
    )

    assert symptoms_plan.can_answer_from_note
    assert any("symptoms" in fact.lower() for fact in symptoms_plan.facts)
    assert warning_plan.can_answer_from_note
    assert any("warning" in fact.lower() or "monitor" in fact.lower() for fact in warning_plan.facts)
