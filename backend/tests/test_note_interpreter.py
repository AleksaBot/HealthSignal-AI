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
