import json

from app.services.security import BCRYPT_PASSWORD_LENGTH_ERROR_MESSAGE
from fastapi.testclient import TestClient


def test_cors_preflight_signup_allows_localhost(client: TestClient):
    response = client.options(
        "/api/auth/signup",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_cors_preflight_login_allows_vercel_preview_origin(client: TestClient):
    preview_origin = "https://healthsignal-feature-123.vercel.app"
    response = client.options(
        "/api/auth/login",
        headers={
            "Origin": preview_origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == preview_origin
    assert response.headers["access-control-allow-credentials"] == "true"


def test_cors_preflight_auth_me_supports_authorization_header(client: TestClient):
    response = client.options(
        "/api/auth/me",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )

    assert response.status_code == 200
    allowed_headers = response.headers["access-control-allow-headers"].lower()
    assert "authorization" in allowed_headers


def test_health_endpoint(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "app_name" in payload


def test_auth_flow(client: TestClient):
    signup = client.post(
        "/api/auth/signup",
        json={"first_name": "User", "email": "user1@example.com", "password": "MySecure123"},
    )
    assert signup.status_code == 201
    assert signup.json()["first_name"] == "User"

    login = client.post(
        "/api/auth/login",
        json={"email": "user1@example.com", "password": "MySecure123"},
    )
    assert login.status_code == 200
    assert login.json()["token_type"] == "bearer"
    assert login.json()["access_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    assert me.status_code == 200
    assert me.json()["first_name"] == "User"


def test_auth_profile_security_updates(client: TestClient):
    signup = client.post(
        "/api/auth/signup",
        json={"first_name": "Profile", "email": "profile@example.com", "password": "MySecure123"},
    )
    assert signup.status_code == 201

    login = client.post(
        "/api/auth/login",
        json={"email": "profile@example.com", "password": "MySecure123"},
    )
    token = login.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    name_update = client.put("/api/auth/me/name", json={"first_name": "Profile Updated"}, headers=auth_headers)
    assert name_update.status_code == 200
    assert name_update.json()["first_name"] == "Profile Updated"

    bad_email_update = client.put(
        "/api/auth/me/email",
        json={"new_email": "new-email@example.com", "current_password": "wrong-password"},
        headers=auth_headers,
    )
    assert bad_email_update.status_code == 401

    email_update = client.put(
        "/api/auth/me/email",
        json={"new_email": "new-email@example.com", "current_password": "MySecure123"},
        headers=auth_headers,
    )
    assert email_update.status_code == 200
    assert email_update.json()["email"] == "new-email@example.com"

    password_update = client.put(
        "/api/auth/me/password",
        json={"current_password": "MySecure123", "new_password": "MySecure456"},
        headers=auth_headers,
    )
    assert password_update.status_code == 204

    old_login = client.post(
        "/api/auth/login",
        json={"email": "new-email@example.com", "password": "MySecure123"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/auth/login",
        json={"email": "new-email@example.com", "password": "MySecure456"},
    )
    assert new_login.status_code == 200


def test_forgot_reset_password_flow(client: TestClient):
    client.post(
        "/api/auth/signup",
        json={"first_name": "Reset", "email": "reset@example.com", "password": "MySecure123"},
    )

    forgot = client.post("/api/auth/forgot-password", json={"email": "reset@example.com"})
    assert forgot.status_code == 200
    payload = forgot.json()
    assert payload["message"]
    assert "dev_reset_link" in payload

    token = payload["dev_reset_link"].split("token=")[-1]
    reset = client.post("/api/auth/reset-password", json={"token": token, "new_password": "MySecure999"})
    assert reset.status_code == 200
    assert "Please sign in again" in reset.json()["message"]

    old_login = client.post("/api/auth/login", json={"email": "reset@example.com", "password": "MySecure123"})
    assert old_login.status_code == 401
    new_login = client.post("/api/auth/login", json={"email": "reset@example.com", "password": "MySecure999"})
    assert new_login.status_code == 200


def test_verify_email_flow(client: TestClient):
    signup = client.post(
        "/api/auth/signup",
        json={"first_name": "Verify", "email": "verify@example.com", "password": "MySecure123"},
    )
    assert signup.status_code == 201
    assert signup.json()["email_verified"] is False

    resend = client.post("/api/auth/verification/resend", json={"email": "verify@example.com"})
    assert resend.status_code == 200
    resend_payload = resend.json()
    token = resend_payload["dev_verification_link"].split("token=")[-1]

    verify = client.post("/api/auth/verify-email", json={"token": token})
    assert verify.status_code == 200

    login = client.post("/api/auth/login", json={"email": "verify@example.com", "password": "MySecure123"})
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email_verified"] is True


def test_signup_rejects_password_too_long(client: TestClient):
    long_password = "a" * 73
    signup = client.post(
        "/api/auth/signup",
        json={"first_name": "Long", "email": "long-password@example.com", "password": long_password},
    )

    assert signup.status_code == 400
    assert signup.json() == {"detail": BCRYPT_PASSWORD_LENGTH_ERROR_MESSAGE}


def test_login_rejects_password_too_long_without_500(client: TestClient):
    client.post(
        "/api/auth/signup",
        json={"first_name": "User", "email": "user2@example.com", "password": "MySecure123"},
    )

    long_password = "b" * 73
    login = client.post(
        "/api/auth/login",
        json={"email": "user2@example.com", "password": long_password},
    )

    assert login.status_code == 400
    assert login.json() == {"detail": BCRYPT_PASSWORD_LENGTH_ERROR_MESSAGE}


def test_analyze_endpoints_and_manual_report_save(client: TestClient, auth_headers: dict[str, str]):
    symptoms = client.post(
        "/api/analyze/symptoms",
        json={"symptoms": "Chest pain with shortness of breath"},
        headers=auth_headers,
    )
    assert symptoms.status_code == 200
    assert symptoms.json()["red_flags"]

    notes = client.post(
        "/api/analyze/notes",
        json={"note_text": "Patient has slurred speech and weakness since morning."},
        headers=auth_headers,
    )
    assert notes.status_code == 200
    notes_payload = notes.json()
    assert notes_payload["plain_english_summary"]
    assert "next_steps" in notes_payload

    risk = client.post(
        "/api/analyze/risk",
        json={
            "age": 62,
            "systolic_bp": 148,
            "diastolic_bp": 92,
            "fasting_glucose": 132,
            "hba1c": 6.8,
            "ldl_cholesterol": 170,
        },
        headers=auth_headers,
    )
    assert risk.status_code == 200

    save_report = client.post(
        "/api/reports/save",
        json={
            "report_type": "note-interpreter-text",
            "original_input_text": "Patient has slurred speech and weakness since morning.",
            "structured_data": {"plain_english_summary": notes_payload["plain_english_summary"]},
            "follow_up_qa": [{"question": "What should I ask my doctor?", "answer": "Ask about warning signs."}],
            "outputs": {"follow_up_questions": notes_payload["follow_up_questions"]},
        },
        headers=auth_headers,
    )
    assert save_report.status_code == 201
    assert save_report.json()["report_type"] == "note-interpreter-text"


def test_report_listing_and_retrieval(client: TestClient, auth_headers: dict[str, str]):
    client.post(
        "/api/reports/save",
        json={
            "report_type": "symptom-intake-guided",
            "original_input_text": "Severe headache and confusion for 2 hours",
            "structured_data": {"red_flags": ["confusion"]},
            "follow_up_qa": [{"question": "When did this start?", "answer": "2 hours ago"}],
            "outputs": {"risk_level": "high"},
        },
        headers=auth_headers,
    )

    listing = client.get("/api/reports", headers=auth_headers)
    assert listing.status_code == 200
    reports = listing.json()
    assert len(reports) == 1

    report_id = reports[0]["id"]
    detail = client.get(f"/api/reports/{report_id}", headers=auth_headers)
    assert detail.status_code == 200
    assert detail.json()["id"] == report_id


def test_note_file_analysis_success(client: TestClient, auth_headers: dict[str, str], monkeypatch):
    monkeypatch.setattr(
        "app.api.routes.extract_text_from_upload",
        lambda _: "Patient has dizziness and mild headache for two days.",
    )

    response = client.post(
        "/api/analyze/note-file",
        files={"file": ("note.pdf", b"fake-content", "application/pdf")},
        headers=auth_headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert "extracted_text" in payload
    assert payload["extracted_text"].startswith("Patient has dizziness")
    assert payload["plain_english_summary"]
    assert isinstance(payload["medicines_treatments"], list)


def test_note_file_analysis_rejects_unsupported_type(client: TestClient, auth_headers: dict[str, str]):
    response = client.post(
        "/api/analyze/note-file",
        files={"file": ("note.txt", b"hello", "text/plain")},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported file type. Please upload a PDF, PNG, JPG, or JPEG file."


def test_note_follow_up_success(client: TestClient, auth_headers: dict[str, str]):
    response = client.post(
        "/api/analyze/note-follow-up",
        json={
            "original_note_text": "Patient asked to continue metformin and follow up in two weeks.",
            "interpreted_note": "Patient asked to continue metformin and follow up in two weeks.",
            "question": "What should I clarify at follow-up?",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert "answer" in payload
    assert "follow" in payload["answer"].lower()


def test_note_follow_up_fallback_is_contextual(client: TestClient, auth_headers: dict[str, str]):
    response = client.post(
        "/api/analyze/note-follow-up",
        json={
            "original_note_text": "Patient complains of abdominal pain for 3 days with nausea and no vomiting. Follow up in 2 days.",
            "interpreted_note": json.dumps(
                {
                    "plain_english_summary": "Abdominal pain and nausea without vomiting.",
                    "medicines_treatments": [],
                    "next_steps": ["Monitor pain and hydration, and return if symptoms worsen."],
                }
            ),
            "question": "What is best to do when I have these symptoms?",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    payload = response.json()
    answer = payload["answer"].lower()
    assert "abdominal pain" in answer
    assert "nausea" in answer
    assert "monitor pain and hydration" in answer


def test_medication_tracker_v2_today_status_and_history(client: TestClient, auth_headers: dict[str, str]):
    profile_update = client.put(
        "/api/profile/health",
        json={
            "age": 32,
            "sex": "female",
            "height_cm": 170,
            "weight_kg": 64,
            "activity_level": "moderate",
            "smoking_vaping_status": "none",
            "alcohol_frequency": "monthly",
            "sleep_average_hours": 7,
            "stress_level": "moderate",
            "known_conditions": [],
            "current_medications": [],
            "medications": [
                {
                    "id": "med-test-1",
                    "name": "Metformin",
                    "dosage": "500mg",
                    "frequency": "daily",
                    "custom_frequency": None,
                    "time_of_day": "morning",
                    "notes": None,
                }
            ],
            "family_history": [],
            "systolic_bp": 120,
            "diastolic_bp": 80,
            "total_cholesterol": 180,
        },
        headers=auth_headers,
    )
    assert profile_update.status_code == 200

    adherence_update = client.put(
        "/api/profile/health/medications/today",
        json={"medication_id": "med-test-1", "status": "taken"},
        headers=auth_headers,
    )
    assert adherence_update.status_code == 200
    payload = adherence_update.json()
    assert payload["todays_medication_status"][0]["status"] == "taken"
    assert payload["recent_medication_events"][0]["status"] == "taken"


def test_momentum_history_and_summary(client: TestClient, auth_headers: dict[str, str]):
    payload = {
        "age": 38,
        "sex": "female",
        "height_cm": 170,
        "weight_kg": 72,
        "activity_level": "moderate",
        "smoking_vaping_status": "none",
        "alcohol_frequency": "monthly",
        "sleep_average_hours": 7.2,
        "stress_level": "moderate",
        "known_conditions": [],
        "current_medications": [],
        "medications": [],
        "family_history": [],
        "systolic_bp": 122,
        "diastolic_bp": 78,
        "total_cholesterol": 182,
        "medication_reminders_enabled": False,
        "medication_reminder_time": "08:00",
        "weekly_health_summary_enabled": True,
    }
    save = client.put("/api/profile/health", json=payload, headers=auth_headers)
    assert save.status_code == 200

    history = client.get("/api/momentum/history", headers=auth_headers)
    assert history.status_code == 200
    history_payload = history.json()
    assert len(history_payload["snapshots"]) >= 1
    assert "score" in history_payload["snapshots"][0]

    latest = client.get("/api/momentum/latest", headers=auth_headers)
    assert latest.status_code == 200
    assert latest.json()["snapshot"] is not None

    summary = client.get("/api/momentum/summary", headers=auth_headers)
    assert summary.status_code == 200
    assert summary.json()["trend_direction"] in {"Improving", "Stable", "Declining"}


def test_coach_query_returns_personalized_answer(client: TestClient, auth_headers: dict[str, str]):
    payload = {
        "age": 42,
        "sex": "male",
        "height_cm": 178,
        "weight_kg": 88,
        "activity_level": "low",
        "smoking_vaping_status": "none",
        "alcohol_frequency": "weekly",
        "sleep_average_hours": 5.8,
        "stress_level": "high",
        "known_conditions": ["hypertension"],
        "current_medications": [],
        "medications": [],
        "family_history": ["heart disease"],
        "systolic_bp": 138,
        "diastolic_bp": 86,
        "total_cholesterol": 210,
        "medication_reminders_enabled": False,
        "medication_reminder_time": "08:00",
        "weekly_health_summary_enabled": False,
    }
    client.put("/api/profile/health", json=payload, headers=auth_headers)
    response = client.post("/api/coach/query", json={"question": "How do I improve my score?"}, headers=auth_headers)
    assert response.status_code == 200
    answer = response.json()["answer"].lower()
    assert "momentum" in answer
    assert "score" in answer
