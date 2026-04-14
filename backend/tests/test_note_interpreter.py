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
