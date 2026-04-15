from app.services.note_interpreter import answer_note_follow_up, interpret_note


def test_interpret_note_detects_template_language():
    note = """
    ACME HEALTH SYSTEM
    123 Main Street, Springfield, ST 00000
    Phone: 555-123-1212
    [Patient's Name] was seen on [Month Day, Year].
    Continue metformin and return in 2 weeks.
    """

    result = interpret_note(note)

    assert "template" in result.plain_english_summary.lower()
    assert any("metformin" in item.item.lower() for item in result.medicines_treatments)


def test_follow_up_needs_original_note_text():
    answer = answer_note_follow_up("short", "{}", "What should I ask?")
    assert "need more" in answer.lower()


def test_interpret_note_expands_common_medical_abbreviations():
    note = "Pt c/o abd pn x3d in RLQ with TTP and N/V."

    result = interpret_note(note)

    summary = result.plain_english_summary.lower()
    assert "patient complains of abdominal pain for 3 days" in summary
    assert "right lower quadrant" in summary
    assert "tenderness to palpation" in summary
    assert "nausea/vomiting" in summary
    assert "pt c/o abd pn" not in summary


def test_interpret_note_fallback_summary_has_no_plain_english_prefix(monkeypatch):
    class FakeProvider:
        def generate_json(self, *, system_prompt: str, user_prompt: str):
            del system_prompt, user_prompt
            return None

    monkeypatch.setattr("app.services.note_interpreter.get_ai_provider", lambda: FakeProvider())

    result = interpret_note("Patient has abdominal pain and nausea for two days.")
    assert not result.plain_english_summary.lower().startswith("in plain english:")
    assert not result.plain_english_summary.lower().startswith("in plain language:")


def test_interpret_note_ai_summary_has_no_plain_english_prefix(monkeypatch):
    class FakeProvider:
        def generate_json(self, *, system_prompt: str, user_prompt: str):
            del system_prompt, user_prompt
            return {
                "plain_english_summary": "In plain English: Patient has abdominal pain and nausea.",
                "medicines_treatments": [],
                "medical_terms_explained": [],
                "next_steps": ["Follow up in 2 days."],
                "follow_up_questions": ["What should I watch for?"],
            }

    monkeypatch.setattr("app.services.note_interpreter.get_ai_provider", lambda: FakeProvider())

    result = interpret_note("Patient has abdominal pain and nausea for two days.")
    assert result.plain_english_summary.startswith("Patient has abdominal pain and nausea.")


def test_follow_up_prompt_uses_expanded_note_context(monkeypatch):
    captured: dict[str, str] = {}

    class FakeProvider:
        def generate_json(self, *, system_prompt: str, user_prompt: str):
            del system_prompt, user_prompt
            return None

        def generate_text(self, *, system_prompt: str, user_prompt: str):
            del system_prompt
            captured["prompt"] = user_prompt
            return "Expanded context answer."

    monkeypatch.setattr("app.services.note_interpreter.get_ai_provider", lambda: FakeProvider())

    answer = answer_note_follow_up(
        "Pt c/o abd pn x3d w/ no emesis and RLQ TTP.",
        '{"plain_english_summary": "Pt c/o abd pn x3d w/ RLQ TTP and no emesis."}',
        "Give more detail on symptoms",
    )

    assert answer == "Expanded context answer."
    prompt = captured["prompt"]
    assert "Patient complains of abdominal pain for 3 days" in prompt
    assert "no emesis" in prompt
    assert "right lower quadrant" in prompt
    assert "tenderness to palpation" in prompt


def test_follow_up_fallback_varies_by_question_intent(monkeypatch):
    class FakeProvider:
        def generate_json(self, *, system_prompt: str, user_prompt: str):
            del system_prompt, user_prompt
            return None

        def generate_text(self, *, system_prompt: str, user_prompt: str):
            del system_prompt, user_prompt
            return ""

    monkeypatch.setattr("app.services.note_interpreter.get_ai_provider", lambda: FakeProvider())
    note = "Patient complains of abdominal pain for 3 days with nausea. Continue metformin. Follow up in 2 days."

    actions_answer = answer_note_follow_up(note, "{}", "What should I do right now?")
    warning_answer = answer_note_follow_up(note, "{}", "What symptoms should worry me?")
    serious_answer = answer_note_follow_up(note, "{}", "Could this be serious?")

    assert actions_answer != warning_answer
    assert warning_answer != serious_answer
    assert "right now" in actions_answer.lower()
    assert "warning signs" in warning_answer.lower()
    assert "serious" in serious_answer.lower()


def test_follow_up_gates_missing_medication_category(monkeypatch):
    class FakeProvider:
        def generate_json(self, *, system_prompt: str, user_prompt: str):
            del system_prompt, user_prompt
            return None

        def generate_text(self, *, system_prompt: str, user_prompt: str):
            del system_prompt, user_prompt
            return "generic fallback that should not be used"

    monkeypatch.setattr("app.services.note_interpreter.get_ai_provider", lambda: FakeProvider())

    note = "Patient reports fatigue and mild headache for 2 days. Increase hydration and follow up in 48 hours."
    interpreted = '{"plain_english_summary":"Fatigue and headache were noted with follow-up advised.","medicines_treatments":[],"next_steps":["Follow up in 48 hours"],"medical_terms_explained":[]}'

    answer = answer_note_follow_up(note, interpreted, "What does this medicine do?")

    assert "does not clearly mention a medication" in answer.lower()
    assert "generic fallback" not in answer.lower()


def test_follow_up_answers_vary_for_required_questions(monkeypatch):
    class FakeProvider:
        def generate_json(self, *, system_prompt: str, user_prompt: str):
            del system_prompt, user_prompt
            return None

        def generate_text(self, *, system_prompt: str, user_prompt: str):
            del system_prompt, user_prompt
            return ""

    monkeypatch.setattr("app.services.note_interpreter.get_ai_provider", lambda: FakeProvider())

    note = "Patient reports abdominal pain and nausea for 3 days. Follow up in 2 days if not improving."
    interpreted = '{"plain_english_summary":"Abdominal pain and nausea are being monitored.","medicines_treatments":[],"next_steps":["Follow up in 2 days if not improving"],"medical_terms_explained":[]}'

    symptoms_answer = answer_note_follow_up(note, interpreted, "What symptoms should worry me?")
    medication_answer = answer_note_follow_up(note, interpreted, "What does this medicine do?")
    actions_answer = answer_note_follow_up(note, interpreted, "What should I do right now?")
    serious_answer = answer_note_follow_up(note, interpreted, "Is this serious?")

    assert "warning signs" in symptoms_answer.lower()
    assert "does not clearly mention a medication" in medication_answer.lower()
    assert "right now" in actions_answer.lower()
    assert "serious" in serious_answer.lower()
    assert len({symptoms_answer, medication_answer, actions_answer, serious_answer}) == 4
