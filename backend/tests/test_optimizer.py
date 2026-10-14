import pytest
from backend.app.services.optimizer import analyze_cost_optimizations

def test_scheduled_compute_rule():
    items = [
        {"resource_id": "vm-aws-t4g-medium", "quantity": 1, "usage_hours_per_month": 730}
    ]
    result = analyze_cost_optimizations(items)
    rules = [r["rule_id"] for r in result["recommendations"]]
    assert "OPT-SCHEDULED-COMPUTE" in rules
    assert result["total_potential_savings"] > 0

def test_rightsize_compute_rule():
    items = [
        {"resource_id": "vm-aws-r6i-2xlarge", "quantity": 1, "usage_hours_per_month": 730}
    ]
    result = analyze_cost_optimizations(items)
    rules = [r["rule_id"] for r in result["recommendations"]]
    assert "OPT-RIGHTSIZE-COMPUTE" in rules

def test_storage_tiering_rule():
    items = [
        {"resource_id": "storage-ebs-gp3", "quantity": 500, "usage_hours_per_month": 730}
    ]
    result = analyze_cost_optimizations(items)
    rules = [r["rule_id"] for r in result["recommendations"]]
    assert "OPT-TIERED-STORAGE" in rules

def test_multiaz_db_rule():
    items = [
        {"resource_id": "db-aws-rds-postgres-m6i-large-multiaz", "quantity": 1, "usage_hours_per_month": 730}
    ]
    result = analyze_cost_optimizations(items)
    rules = [r["rule_id"] for r in result["recommendations"]]
    assert "OPT-DB-MULTIAZ" in rules

def test_zero_quantity_rule():
    items = [
        {"resource_id": "vm-aws-t4g-micro", "quantity": 0, "usage_hours_per_month": 730}
    ]
    result = analyze_cost_optimizations(items)
    rules = [r["rule_id"] for r in result["recommendations"]]
    assert "OPT-ZERO-QTY" in rules
