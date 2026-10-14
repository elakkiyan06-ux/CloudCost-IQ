from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from .pricing_loader import get_resource_by_id, list_categories

DEFAULT_MONTHLY_HOURS = 730.0

def calculate_single_resource(
    resource_id: str,
    quantity: float,
    usage_hours_per_month: Optional[float] = None,
    custom_name: Optional[str] = None,
    reference_hours_per_month: float = DEFAULT_MONTHLY_HOURS,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Calculates hourly, monthly, and annual costs for a single resource.
    Supports billing-unit-aware calculations for both hourly and non-hourly resources.
    """
    if quantity < 0:
        raise ValueError(f"Quantity must be non-negative. Received {quantity}")

    hours = usage_hours_per_month if usage_hours_per_month is not None else reference_hours_per_month
    if hours < 0:
        raise ValueError(f"Usage hours per month must be non-negative. Received {hours}")
    if hours > 744:
        raise ValueError(f"Usage hours per month cannot exceed 744 hours (max in 31-day month). Received {hours}")

    resource = get_resource_by_id(resource_id)
    if not resource:
        raise ValueError(f"Resource with ID '{resource_id}' not found in pricing dataset")

    unit_price = float(resource.get("unit_price", 0.0))
    billing_unit = resource.get("billing_unit", "per_hour")
    name = custom_name or resource.get("name", resource_id)
    category = resource.get("category", "unknown")
    provider = resource.get("provider", "Generic Cloud")

    # Billing-unit-aware cost calculations
    if billing_unit in ("per_hour", "per_cluster_hour"):
        hourly_cost = unit_price * quantity
        monthly_cost = hourly_cost * hours
    elif billing_unit in ("per_gb_month", "per_request_million", "per_gb_ingested", "per_gb_second"):
        # Quantity represents units consumed over the month (e.g. GB stored, Millions of requests, GB logs ingested)
        monthly_cost = unit_price * quantity
        hourly_cost = monthly_cost / reference_hours_per_month if reference_hours_per_month > 0 else 0.0
    else:
        # Fallback for generic rates
        hourly_cost = unit_price * quantity
        monthly_cost = hourly_cost * hours

    monthly_cost = round(monthly_cost, 2)
    annual_cost = round(monthly_cost * 12.0, 2)

    return {
        "resource_id": resource_id,
        "name": name,
        "category": category,
        "provider": provider,
        "billing_unit": billing_unit,
        "unit_price": round(unit_price, 6),
        "quantity": round(quantity, 4),
        "usage_hours_per_month": round(hours, 2),
        "hourly_cost": round(hourly_cost, 4),
        "monthly_cost": monthly_cost,
        "annual_cost": annual_cost,
        "pricing_status": resource.get("pricing_status", "illustrative"),
        "notes": notes or ""
    }

def calculate_infrastructure_estimate(
    items: List[Dict[str, Any]],
    scenario_name: str = "Infrastructure Estimate",
    reference_hours_per_month: float = DEFAULT_MONTHLY_HOURS,
    currency: str = "USD"
) -> Dict[str, Any]:
    """
    Calculates total infrastructure estimate from a list of resource items.
    Aggregates category breakdowns, identifies highest cost category, and computes totals.
    """
    calculated_items: List[Dict[str, Any]] = []
    category_totals: Dict[str, float] = {}

    total_hourly = 0.0
    total_monthly = 0.0

    for item in items:
        res_id = item.get("resource_id")
        qty = float(item.get("quantity", 1.0))
        hrs = item.get("usage_hours_per_month")
        c_name = item.get("custom_name")
        c_notes = item.get("notes")

        cost_item = calculate_single_resource(
            resource_id=res_id,
            quantity=qty,
            usage_hours_per_month=hrs,
            custom_name=c_name,
            reference_hours_per_month=reference_hours_per_month,
            notes=c_notes
        )
        calculated_items.append(cost_item)

        total_hourly += cost_item["hourly_cost"]
        total_monthly += cost_item["monthly_cost"]

        cat = cost_item["category"]
        category_totals[cat] = category_totals.get(cat, 0.0) + cost_item["monthly_cost"]

    total_annual = total_monthly * 12.0

    # Determine highest cost category
    most_expensive_cat = None
    if category_totals:
        most_expensive_cat = max(category_totals, key=lambda k: category_totals[k])
        if category_totals[most_expensive_cat] == 0:
            most_expensive_cat = None

    # Round category totals
    rounded_category_totals = {k: round(v, 2) for k, v in category_totals.items()}

    return {
        "scenario_name": scenario_name,
        "currency": currency,
        "hours_per_month": reference_hours_per_month,
        "total_hourly_cost": round(total_hourly, 4),
        "total_monthly_cost": round(total_monthly, 2),
        "total_annual_cost": round(total_annual, 2),
        "resource_count": len(calculated_items),
        "most_expensive_category": most_expensive_cat,
        "category_breakdown": rounded_category_totals,
        "items": calculated_items,
        "calculated_at": datetime.now(timezone.utc).isoformat()
    }

def compare_configurations(
    config_a_data: Dict[str, Any],
    config_b_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Compares Configuration A (Baseline) and Configuration B (Optimized / Target).
    Produces side-by-side differences, percentage savings, and driver analysis.
    """
    est_a = calculate_infrastructure_estimate(
        items=config_a_data.get("items", []),
        scenario_name=config_a_data.get("scenario_name", "Configuration A (Baseline)"),
        reference_hours_per_month=float(config_a_data.get("hours_per_month", DEFAULT_MONTHLY_HOURS)),
        currency=config_a_data.get("currency", "USD")
    )

    est_b = calculate_infrastructure_estimate(
        items=config_b_data.get("items", []),
        scenario_name=config_b_data.get("scenario_name", "Configuration B (Alternative)"),
        reference_hours_per_month=float(config_b_data.get("hours_per_month", DEFAULT_MONTHLY_HOURS)),
        currency=config_b_data.get("currency", "USD")
    )

    hourly_diff = est_b["total_hourly_cost"] - est_a["total_hourly_cost"]
    monthly_diff = est_b["total_monthly_cost"] - est_a["total_monthly_cost"]
    annual_diff = est_b["total_annual_cost"] - est_a["total_annual_cost"]

    # Savings is positive when B is cheaper than A
    monthly_savings = est_a["total_monthly_cost"] - est_b["total_monthly_cost"]
    baseline = est_a["total_monthly_cost"]

    if baseline > 0:
        pct_savings = (monthly_savings / baseline) * 100.0
    else:
        pct_savings = 0.0

    # Build category level comparison
    all_categories = sorted(list(set(list(est_a["category_breakdown"].keys()) + list(est_b["category_breakdown"].keys()))))
    cat_meta = {c["id"]: c["name"] for c in list_categories()}

    category_comparisons = []
    for cat in all_categories:
        cost_a = est_a["category_breakdown"].get(cat, 0.0)
        cost_b = est_b["category_breakdown"].get(cat, 0.0)
        diff = cost_b - cost_a
        pct_cat = ((cost_a - cost_b) / cost_a * 100.0) if cost_a > 0 else (0.0 if cost_b == 0 else -100.0)
        category_comparisons.append({
            "category_id": cat,
            "category_name": cat_meta.get(cat, cat.replace("_", " ").title()),
            "config_a_monthly": round(cost_a, 2),
            "config_b_monthly": round(cost_b, 2),
            "difference": round(diff, 2),
            "percentage_change": round(pct_cat, 1)
        })

    # Resource by resource comparison
    items_a_map = {item["resource_id"]: item for item in est_a["items"]}
    items_b_map = {item["resource_id"]: item for item in est_b["items"]}
    all_res_ids = list(dict.fromkeys([i["resource_id"] for i in est_a["items"]] + [i["resource_id"] for i in est_b["items"]]))

    resource_diffs = []
    savings_drivers = []

    for res_id in all_res_ids:
        item_a = items_a_map.get(res_id)
        item_b = items_b_map.get(res_id)

        name = (item_b or item_a)["name"]
        cat = (item_b or item_a)["category"]
        b_unit = (item_b or item_a)["billing_unit"]

        qty_a = item_a["quantity"] if item_a else 0.0
        qty_b = item_b["quantity"] if item_b else 0.0
        hrs_a = item_a["usage_hours_per_month"] if item_a else 0.0
        hrs_b = item_b["usage_hours_per_month"] if item_b else 0.0
        cost_a = item_a["monthly_cost"] if item_a else 0.0
        cost_b = item_b["monthly_cost"] if item_b else 0.0
        diff = cost_b - cost_a
        item_savings = cost_a - cost_b

        if item_a and not item_b:
            status = "removed_in_b"
        elif not item_a and item_b:
            status = "added_in_b"
        elif cost_b < cost_a:
            status = "cheaper_in_b"
        elif cost_b > cost_a:
            status = "pricier_in_b"
        else:
            status = "identical"

        diff_record = {
            "resource_id": res_id,
            "name": name,
            "category": cat,
            "billing_unit": b_unit,
            "config_a_qty": qty_a,
            "config_b_qty": qty_b,
            "config_a_hours": hrs_a,
            "config_b_hours": hrs_b,
            "config_a_monthly": round(cost_a, 2),
            "config_b_monthly": round(cost_b, 2),
            "monthly_difference": round(diff, 2),
            "status": status
        }
        resource_diffs.append(diff_record)

        if abs(diff) > 0.01:
            savings_drivers.append({
                "resource_id": res_id,
                "name": name,
                "monthly_savings": round(item_savings, 2),
                "monthly_difference": round(diff, 2),
                "explanation": f"{'Reduced' if item_savings > 0 else 'Increased'} spending by ${abs(diff):.2f}/mo ({status.replace('_', ' ')})"
            })

    # Sort top savings drivers by largest absolute difference
    savings_drivers.sort(key=lambda x: abs(x["monthly_difference"]), reverse=True)

    # Engineering recommendation summary
    if monthly_savings > 0:
        rec_summary = (
            f"Configuration B reduces estimated cloud expenditure by ${monthly_savings:,.2f}/month "
            f"({pct_savings:.1f}% reduction). Top contributor: {savings_drivers[0]['name'] if savings_drivers else 'Multiple resources'}."
        )
    elif monthly_savings < 0:
        rec_summary = (
            f"Configuration B increases estimated cloud expenditure by ${abs(monthly_savings):,.2f}/month "
            f"({abs(pct_savings):.1f}% increase). Review provisioned capacity and high-cost tiers."
        )
    else:
        rec_summary = "Both configurations yield identical estimated monthly costs ($0.00 difference)."

    tradeoffs_note = (
        "Note: Lower cost configurations may impact redundancy, throughput, or availability SLA. "
        "Validate compute sizing, failover topology, and latency SLAs before committing architecture changes in production."
    )

    return {
        "config_a": est_a,
        "config_b": est_b,
        "hourly_difference": round(hourly_diff, 4),
        "monthly_difference": round(monthly_diff, 2),
        "annual_difference": round(annual_diff, 2),
        "monthly_savings": round(monthly_savings, 2),
        "percentage_savings": round(pct_savings, 2),
        "is_cheaper": monthly_savings > 0,
        "category_comparisons": category_comparisons,
        "resource_diffs": resource_diffs,
        "top_savings_drivers": savings_drivers[:5],
        "recommendation_summary": rec_summary,
        "tradeoffs_note": tradeoffs_note
    }
