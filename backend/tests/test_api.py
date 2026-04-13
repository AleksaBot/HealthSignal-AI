from app.services.security import BCRYPT_PASSWORD_LENGTH_ERROR_MESSAGE
from fastapi.testclient import TestClient


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


def test_analyze_endpoints_create_reports(client: TestClient, auth_headers: dict[str, str]):
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


def test_report_listing_and_retrieval(client: TestClient, auth_headers: dict[str, str]):
    client.post(
        "/api/analyze/symptoms",
        json={"symptoms": "Severe headache and confusion for 2 hours"},
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
    assert payload["likely_categories"]


def test_note_file_analysis_rejects_unsupported_type(client: TestClient, auth_headers: dict[str, str]):
    response = client.post(
        "/api/analyze/note-file",
        files={"file": ("note.txt", b"hello", "text/plain")},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported file type. Please upload a PDF, PNG, JPG, or JPEG file."
