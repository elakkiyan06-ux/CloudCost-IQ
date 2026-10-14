import pytest
from backend.app.services.pricing_loader import load_pricing_data, list_resources, list_categories

def test_pricing_dataset_loads_and_has_keys():
    data = load_pricing_data(force_reload=True)
    assert "version" in data
    assert "currency" in data
    assert data["currency"] == "USD"
    assert "categories" in data
    assert "resources" in data
    assert len(data["resources"]) >= 20

def test_pricing_entries_schema_integrity():
    resources = list_resources()
    categories = {c["id"] for c in list_categories()}

    required_keys = [
        "id", "name", "category", "provider", "billing_unit",
        "unit_price", "currency", "description", "pricing_status", "last_updated"
    ]

    for res in resources:
        for k in required_keys:
            assert k in res, f"Resource {res.get('id')} missing key '{k}'"
        assert res["category"] in categories, f"Resource {res['id']} category '{res['category']}' not in categories list"
        assert isinstance(res["unit_price"], (int, float))
        assert res["unit_price"] >= 0
        assert res["pricing_status"] in ("illustrative", "representative")

def test_filter_by_category():
    compute_resources = list_resources(category="compute")
    assert len(compute_resources) > 0
    for r in compute_resources:
        assert r["category"] == "compute"

    db_resources = list_resources(category="databases")
    assert len(db_resources) > 0
    for r in db_resources:
        assert r["category"] == "databases"
