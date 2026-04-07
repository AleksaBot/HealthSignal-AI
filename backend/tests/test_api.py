import os
from pathlib import Path

from fastapi.testclient import TestClient

# Configure test DB before importing app settings.
os.environ["DATABASE_URL"] = "sqlite:///./healthsignal_test.db"

from app.db.session import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


def setup_module():
    db_path = Path("healthsignal_test.db")
    if db_path.exists():
        db_path.unlink()
    Base.metadata.create_all(bind=engine)


client = TestClient(app)


def _signup_and_token(email: str = "test@example.com", password: str = "Password123") -> str:
    response = client.post("/api/auth/signup", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["token"]


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_auth_and_analysis_and_report_flow():
    token = _signup_and_token()
    headers = {"Authorization": f"Bearer {token}"}

    symptom_payload = {"symptoms": "I have chest pain and shortness of breath since morning"}
    symptom_response = client.post("/api/analyze/symptoms", json=symptom_payload, headers=headers)
    assert symptom_response.status_code == 200
    symptom_data = symptom_response.json()
    assert symptom_data["report_id"] > 0
    assert len(symptom_data["red_flags"]) >= 1

    note_payload = {"note_text": "Patient reports severe headache and confusion with acute onset."}
    note_response = client.post("/api/analyze/notes", json=note_payload, headers=headers)
    assert note_response.status_code == 200

    risk_payload = {
        "age": 62,
        "systolic_bp": 155,
        "diastolic_bp": 95,
        "fasting_glucose": 132,
        "hba1c": 6.8,
        "ldl_cholesterol": 160
    }
    risk_response = client.post("/api/analyze/risk", json=risk_payload, headers=headers)
    assert risk_response.status_code == 200

    reports_response = client.get("/api/reports", headers=headers)
    assert reports_response.status_code == 200
    reports = reports_response.json()
    assert len(reports) >= 3

    latest_id = reports[0]["id"]
    report_response = client.get(f"/api/reports/{latest_id}", headers=headers)
    assert report_response.status_code == 200
    assert report_response.json()["id"] == latest_id
