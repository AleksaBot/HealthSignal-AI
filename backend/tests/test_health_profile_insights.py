from fastapi.testclient import TestClient


def test_health_profile_persists_and_reads_back(client: TestClient, auth_headers: dict[str, str]):
    payload = {
        "age": 41,
        "sex": "female",
        "height_cm": 168,
        "weight_kg": 84,
        "activity_level": "low",
        "smoking_vaping_status": "daily",
        "alcohol_frequency": "weekly",
        "sleep_average_hours": 5.5,
        "stress_level": "high",
        "known_conditions": ["hypertension"],
        "current_medications": ["lisinopril"],
        "family_history": ["heart disease"],
        "systolic_bp": 138,
        "diastolic_bp": 88,
        "total_cholesterol": 210,
    }

    update_response = client.put("/api/profile/health", json=payload, headers=auth_headers)
    assert update_response.status_code == 200
    body = update_response.json()
    assert body["age"] == 41
    assert body["updated_at"] is not None

    read_response = client.get("/api/profile/health", headers=auth_headers)
    assert read_response.status_code == 200
    read_body = read_response.json()
    assert read_body["smoking_vaping_status"] == "daily"
    assert read_body["family_history"] == ["heart disease"]


def test_health_profile_insights_returns_expected_sections(client: TestClient, auth_headers: dict[str, str]):
    client.put(
        "/api/profile/health",
        json={
            "age": 55,
            "height_cm": 170,
            "weight_kg": 95,
            "activity_level": "low",
            "smoking_vaping_status": "daily",
            "sleep_average_hours": 5,
            "stress_level": "very_high",
            "family_history": ["type 2 diabetes"],
        },
        headers=auth_headers,
    )

    response = client.post("/api/profile/health/insights", headers=auth_headers)
    assert response.status_code == 200

    body = response.json()
    assert "overall_health_snapshot" in body
    assert "cardiovascular_caution" in body
    assert body["cardiovascular_caution"]["level"] in {"watch", "caution"}
    assert body["top_priorities_for_improvement"]


def test_health_profile_insights_requires_core_profile_fields(client: TestClient, auth_headers: dict[str, str]):
    client.put("/api/profile/health", json={"activity_level": "active"}, headers=auth_headers)

    response = client.post("/api/profile/health/insights", headers=auth_headers)
    assert response.status_code == 400
    assert "age, height, and weight" in response.json()["detail"]
