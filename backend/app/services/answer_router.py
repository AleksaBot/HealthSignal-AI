from __future__ import annotations

from app.schemas.note_intelligence import AnswerPlan, ExtractedNoteIntelligence, QuestionIntent


def _join_items(items: list[str], *, limit: int = 3) -> str:
    return ", ".join(items[:limit])


def build_answer_plan(
    *,
    extracted: ExtractedNoteIntelligence,
    intent: QuestionIntent,
    question: str,
) -> AnswerPlan:
    del question

    if intent == "medication":
        if not extracted.medications:
            return AnswerPlan(
                intent=intent,
                can_answer_from_note=False,
                response_focus="medication",
                missing_message="This note does not mention a medication or treatment, so I cannot explain one based on this document.",
            )
        return AnswerPlan(
            intent=intent,
            can_answer_from_note=True,
            response_focus="medication",
            facts=[f"Medications listed: {_join_items(extracted.medications)}."],
        )

    if intent == "tests":
        if not extracted.tests_ordered:
            return AnswerPlan(
                intent=intent,
                can_answer_from_note=False,
                response_focus="tests",
                missing_message="This note does not mention any specific tests or ordered lab work.",
            )
        return AnswerPlan(
            intent=intent,
            can_answer_from_note=True,
            response_focus="tests",
            facts=[f"Tests mentioned: {_join_items(extracted.tests_ordered)}."],
        )

    if intent == "referrals":
        if not extracted.referrals:
            return AnswerPlan(
                intent=intent,
                can_answer_from_note=False,
                response_focus="referrals",
                missing_message="This note does not mention a specialist referral.",
            )
        return AnswerPlan(
            intent=intent,
            can_answer_from_note=True,
            response_focus="referrals",
            facts=[f"Referral targets in note: {_join_items(extracted.referrals)}."],
        )

    if intent == "symptoms":
        if not extracted.symptoms:
            return AnswerPlan(
                intent=intent,
                can_answer_from_note=False,
                response_focus="symptoms",
                missing_message="This note does not clearly list symptoms to answer that question directly.",
            )
        return AnswerPlan(
            intent=intent,
            can_answer_from_note=True,
            response_focus="symptoms",
            facts=[f"Symptoms in note: {_join_items(extracted.symptoms)}."],
        )

    if intent == "warning_signs":
        if extracted.warning_signs:
            return AnswerPlan(
                intent=intent,
                can_answer_from_note=True,
                response_focus="warning_signs",
                facts=[f"Warning guidance in note: {_join_items(extracted.warning_signs, limit=2)}."],
            )
        if extracted.symptoms:
            return AnswerPlan(
                intent=intent,
                can_answer_from_note=True,
                response_focus="warning_signs",
                facts=[f"Symptoms to monitor: {_join_items(extracted.symptoms)}."],
            )
        return AnswerPlan(
            intent=intent,
            can_answer_from_note=False,
            response_focus="warning_signs",
            missing_message="This note does not clearly describe warning signs or symptom progression.",
        )

    if intent == "next_steps":
        if not extracted.follow_up_actions:
            return AnswerPlan(
                intent=intent,
                can_answer_from_note=False,
                response_focus="next_steps",
                missing_message="This note does not clearly include immediate next-step instructions.",
            )
        return AnswerPlan(
            intent=intent,
            can_answer_from_note=True,
            response_focus="next_steps",
            facts=[f"Follow-up actions documented: {_join_items(extracted.follow_up_actions, limit=2)}."],
        )

    if intent == "seriousness":
        if extracted.diagnoses_or_conditions or extracted.symptoms:
            facts: list[str] = []
            if extracted.diagnoses_or_conditions:
                facts.append(f"Conditions mentioned: {_join_items(extracted.diagnoses_or_conditions)}.")
            if extracted.symptoms:
                facts.append(f"Active symptoms: {_join_items(extracted.symptoms)}.")
            return AnswerPlan(
                intent=intent,
                can_answer_from_note=True,
                response_focus="seriousness",
                facts=facts,
            )
        return AnswerPlan(
            intent=intent,
            can_answer_from_note=False,
            response_focus="seriousness",
            missing_message="This note does not provide enough condition detail to judge seriousness.",
        )

    if intent == "definitions":
        if extracted.diagnoses_or_conditions:
            return AnswerPlan(
                intent=intent,
                can_answer_from_note=True,
                response_focus="definitions",
                facts=[f"Potential terms to explain: {_join_items(extracted.diagnoses_or_conditions)}."],
            )
        return AnswerPlan(
            intent=intent,
            can_answer_from_note=False,
            response_focus="definitions",
            missing_message="This note does not clearly define the term you asked about.",
        )

    general_facts: list[str] = []
    if extracted.symptoms:
        general_facts.append(f"Symptoms: {_join_items(extracted.symptoms)}.")
    if extracted.follow_up_actions:
        general_facts.append(f"Next actions: {_join_items(extracted.follow_up_actions, limit=2)}.")

    return AnswerPlan(
        intent="general",
        can_answer_from_note=bool(general_facts),
        response_focus="general",
        facts=general_facts,
        missing_message=None if general_facts else "This note has limited detail for a specific follow-up answer.",
    )
