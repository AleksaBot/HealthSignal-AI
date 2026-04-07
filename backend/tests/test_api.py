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
        json={"email": "user1@example.com", "password": "MySecure123"},
    )
    assert signup.status_code == 201

    login = client.post(
        "/api/auth/login",
        json={"email": "user1@example.com", "password": "MySecure123"},
    )
    assert login.status_code == 200
    assert login.json()["token_type"] == "bearer"
    assert login.json()["access_token"]


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
