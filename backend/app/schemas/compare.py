from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from .estimate import EstimateRequest, EstimateResponse

class ResourceDiffItem(BaseModel):
    resource_id: str
    name: str
    category: str
    billing_unit: str
    config_a_qty: float
    config_b_qty: float
    config_a_hours: float
    config_b_hours: float
    config_a_monthly: float
    config_b_monthly: float
    monthly_difference: float  # config_b - config_a (negative means B is cheaper)
    status: str  # 'cheaper_in_b', 'pricier_in_b', 'identical', 'added_in_b', 'removed_in_b'

class CategoryComparison(BaseModel):
    category_id: str
    category_name: str
    config_a_monthly: float
    config_b_monthly: float
    difference: float  # config_b - config_a
    percentage_change: float

class CompareRequest(BaseModel):
    config_a: EstimateRequest
    config_b: EstimateRequest

class CompareResponse(BaseModel):
    config_a: EstimateResponse
    config_b: EstimateResponse
    hourly_difference: float
    monthly_difference: float  # negative means B is cheaper
    annual_difference: float
    monthly_savings: float     # positive when B is cheaper than A
    percentage_savings: float  # (savings / config_a) * 100
    is_cheaper: bool
    category_comparisons: List[CategoryComparison]
    resource_diffs: List[ResourceDiffItem]
    top_savings_drivers: List[Dict[str, Any]]
    recommendation_summary: str
    tradeoffs_note: str
