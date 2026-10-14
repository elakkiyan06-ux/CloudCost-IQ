import pytest
from backend.app.services.calculator import (
    calculate_single_resource,
    calculate_infrastructure_estimate,
    compare_configurations,
    DEFAULT_MONTHLY_HOURS
)

def test_hourly_resource_calculation():
    # AWS t4g.medium is $0.0336 / hour
    result = calculate_single_resource(
        resource_id="vm-aws-t4g-medium",
        quantity=1.0,
        usage_hours_per_month=730.0
    )
    assert result["resource_id"] == "vm-aws-t4g-medium"
    assert result["hourly_cost"] == 0.0336
    assert result["monthly_cost"] == round(0.0336 * 730.0, 2)  # 24.53
    assert result["annual_cost"] == round(result["monthly_cost"] * 12.0, 2)
    assert result["billing_unit"] == "per_hour"

def test_multiple_quantity_hourly():
    # 4 instances of AWS t4g.small ($0.0168/hr)
    result = calculate_single_resource(
        resource_id="vm-aws-t4g-small",
        quantity=4.0,
        usage_hours_per_month=730.0
    )
    expected_hourly = round(0.0168 * 4.0, 4)  # 0.0672
    assert result["hourly_cost"] == expected_hourly
    assert result["monthly_cost"] == round(expected_hourly * 730.0, 2)  # 49.06

def test_custom_usage_schedule():
    # Business hours only: 174 hours/month
    result = calculate_single_resource(
        resource_id="vm-aws-t4g-medium",
        quantity=2.0,
        usage_hours_per_month=174.0
    )
    expected_hourly = round(0.0336 * 2.0, 4)  # 0.0672
    expected_monthly = round(expected_hourly * 174.0, 2)  # 11.69
    assert result["usage_hours_per_month"] == 174.0
    assert result["monthly_cost"] == expected_monthly

def test_non_hourly_storage_calculation():
    # AWS EBS gp3 is $0.0800 / GB-month
    result = calculate_single_resource(
        resource_id="storage-ebs-gp3",
        quantity=500.0,  # 500 GB
        reference_hours_per_month=730.0
    )
    assert result["billing_unit"] == "per_gb_month"
    assert result["monthly_cost"] == 40.00  # 500 * 0.08
    assert result["annual_cost"] == 480.00  # 40 * 12
    assert result["hourly_cost"] == round(40.00 / 730.0, 4)

def test_request_based_serverless_calculation():
    # AWS Lambda requests: $0.20 per million requests
    result = calculate_single_resource(
        resource_id="serverless-lambda-requests",
        quantity=10.0  # 10 Million requests
    )
    assert result["billing_unit"] == "per_request_million"
    assert result["monthly_cost"] == 2.00  # 10 * 0.20
    assert result["annual_cost"] == 24.00

def test_zero_quantity_handling():
    result = calculate_single_resource(
        resource_id="vm-aws-t4g-medium",
        quantity=0.0,
        usage_hours_per_month=730.0
    )
    assert result["hourly_cost"] == 0.0
    assert result["monthly_cost"] == 0.0
    assert result["annual_cost"] == 0.0

def test_negative_quantity_raises_value_error():
    with pytest.raises(ValueError, match="Quantity must be non-negative"):
        calculate_single_resource(
            resource_id="vm-aws-t4g-medium",
            quantity=-2.0
        )

def test_invalid_hours_raises_value_error():
    with pytest.raises(ValueError, match="cannot exceed 744 hours"):
        calculate_single_resource(
            resource_id="vm-aws-t4g-medium",
            quantity=1.0,
            usage_hours_per_month=800.0
        )

def test_missing_resource_raises_value_error():
    with pytest.raises(ValueError, match="not found in pricing dataset"):
        calculate_single_resource(
            resource_id="non-existent-vm-999",
            quantity=1.0
        )

def test_full_infrastructure_estimate():
    items = [
        {"resource_id": "vm-aws-t4g-medium", "quantity": 2, "usage_hours_per_month": 730},
        {"resource_id": "storage-ebs-gp3", "quantity": 100, "usage_hours_per_month": 730},
        {"resource_id": "lb-aws-alb", "quantity": 1, "usage_hours_per_month": 730}
    ]
    est = calculate_infrastructure_estimate(items, scenario_name="Web Stack")
    assert est["resource_count"] == 3
    assert est["total_monthly_cost"] > 0
    assert est["total_annual_cost"] == round(est["total_monthly_cost"] * 12.0, 2)
    assert "compute" in est["category_breakdown"]
    assert "block_storage" in est["category_breakdown"]
    assert "load_balancers" in est["category_breakdown"]

def test_compare_configurations_savings():
    # Baseline: Monolith r6i.2xlarge ($0.504/hr * 730 = $367.92) + 500GB io2 ($62.50)
    config_a = {
        "scenario_name": "Heavy Baseline",
        "items": [
            {"resource_id": "vm-aws-r6i-2xlarge", "quantity": 1, "usage_hours_per_month": 730},
            {"resource_id": "storage-ebs-io2", "quantity": 500, "usage_hours_per_month": 730}
        ]
    }
    # Alternative: Right-sized t4g.medium ($0.0336 * 730 = $24.53) + 100GB gp3 ($8.00)
    config_b = {
        "scenario_name": "Optimized Stack",
        "items": [
            {"resource_id": "vm-aws-t4g-medium", "quantity": 1, "usage_hours_per_month": 730},
            {"resource_id": "storage-ebs-gp3", "quantity": 100, "usage_hours_per_month": 730}
        ]
    }
    comp = compare_configurations(config_a, config_b)
    assert comp["is_cheaper"] is True
    assert comp["monthly_savings"] > 0
    assert comp["percentage_savings"] > 80.0
    assert len(comp["top_savings_drivers"]) > 0
    assert "recommendation_summary" in comp

def test_compare_zero_baseline():
    # Edge case: Empty baseline vs some resources
    config_a = {"scenario_name": "Empty A", "items": []}
    config_b = {
        "scenario_name": "Active B",
        "items": [{"resource_id": "vm-aws-t4g-medium", "quantity": 1, "usage_hours_per_month": 730}]
    }
    comp = compare_configurations(config_a, config_b)
    assert comp["percentage_savings"] == 0.0
    assert comp["is_cheaper"] is False
    assert comp["monthly_savings"] < 0
