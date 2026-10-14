import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_api_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["app"] == "CloudCost IQ"
    assert data["database"] == "connected"
    assert data["pricing_dataset"]["resources_available"] > 0

def test_api_system_info():
    res = client.get("/api/system/info")
    assert res.status_code == 200
    data = res.json()
    assert "runtime" in data
    assert "deployment" in data

def test_api_pricing():
    res = client.get("/api/pricing")
    assert res.status_code == 200
    data = res.json()
    assert "resources" in data
    assert len(data["resources"]) > 0

def test_api_pricing_single_and_404():
    res = client.get("/api/pricing/vm-aws-t4g-medium")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "vm-aws-t4g-medium"
    assert data["unit_price"] > 0

    res_missing = client.get("/api/pricing/non-existent-vm-999")
    assert res_missing.status_code == 404

def test_api_estimate_endpoint():
    payload = {
        "scenario_name": "Test API Estimate",
        "currency": "USD",
        "hours_per_month": 730,
        "items": [
            {"resource_id": "vm-aws-t4g-medium", "quantity": 2, "usage_hours_per_month": 730},
            {"resource_id": "storage-ebs-gp3", "quantity": 100, "usage_hours_per_month": 730}
        ]
    }
    res = client.post("/api/estimate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["scenario_name"] == "Test API Estimate"
    assert data["total_monthly_cost"] > 0
    assert len(data["items"]) == 2

def test_api_compare_endpoint():
    payload = {
        "config_a": {
            "scenario_name": "Config A (Baseline)",
            "items": [
                {"resource_id": "vm-aws-r6i-2xlarge", "quantity": 1, "usage_hours_per_month": 730}
            ]
        },
        "config_b": {
            "scenario_name": "Config B (Optimized)",
            "items": [
                {"resource_id": "vm-aws-t4g-medium", "quantity": 1, "usage_hours_per_month": 730}
            ]
        }
    }
    res = client.post("/api/compare", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["is_cheaper"] is True
    assert data["monthly_savings"] > 0
    assert data["percentage_savings"] > 0

def test_api_optimize_endpoint():
    payload = {
        "scenario_name": "Optimize Test",
        "items": [
            {"resource_id": "vm-aws-r6i-2xlarge", "quantity": 1, "usage_hours_per_month": 730},
            {"resource_id": "storage-ebs-gp3", "quantity": 500, "usage_hours_per_month": 730}
        ]
    }
    res = client.post("/api/optimize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["recommendations_count"] > 0
    assert data["total_potential_savings"] > 0

def test_api_scenarios_crud():
    # 1. List scenarios (seeded items exist)
    res = client.get("/api/scenarios")
    assert res.status_code == 200
    initial_count = res.json()["count"]
    assert initial_count >= 1

    # 2. Create new scenario
    new_scenario = {
        "name": "Integration Test Scenario",
        "description": "Created during pytest automated test run",
        "environment": "Test",
        "items": [
            {"resource_id": "vm-aws-t4g-small", "quantity": 1, "usage_hours_per_month": 730}
        ]
    }
    create_res = client.post("/api/scenarios", json=new_scenario)
    assert create_res.status_code == 200
    created = create_res.json()
    scenario_id = created["id"]
    assert created["name"] == "Integration Test Scenario"

    # 3. Get single scenario
    get_res = client.get(f"/api/scenarios/{scenario_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == scenario_id
    assert get_res.json()["estimate"] is not None

    # 4. Delete scenario
    del_res = client.delete(f"/api/scenarios/{scenario_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 5. Verify deletion
    verify_res = client.get(f"/api/scenarios/{scenario_id}")
    assert verify_res.status_code == 404

def test_api_validation_error():
    # Negative quantity should trigger 422 Unprocessable Entity
    bad_payload = {
        "items": [
            {"resource_id": "vm-aws-t4g-medium", "quantity": -5.0}
        ]
    }
    res = client.post("/api/estimate", json=bad_payload)
    assert res.status_code == 422
