from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class ResourceInput(BaseModel):
    resource_id: str
    custom_name: Optional[str] = None
    quantity: float = Field(default=1.0, ge=0.0)
    usage_hours_per_month: float = Field(default=730.0, ge=0.0, le=744.0)
    notes: Optional[str] = None

class ResourceCostItem(BaseModel):
    resource_id: str
    name: str
    category: str
    provider: str
    billing_unit: str
    unit_price: float
    quantity: float
    usage_hours_per_month: float
    hourly_cost: float
    monthly_cost: float
    annual_cost: float
    pricing_status: str = "illustrative"
    notes: Optional[str] = None

class EstimateRequest(BaseModel):
    scenario_name: Optional[str] = "Untitled Infrastructure Estimate"
    currency: str = "USD"
    hours_per_month: float = Field(default=730.0, gt=0.0, le=744.0)
    items: List[ResourceInput] = Field(default_factory=list)

class EstimateResponse(BaseModel):
    scenario_name: str
    currency: str = "USD"
    hours_per_month: float
    total_hourly_cost: float
    total_monthly_cost: float
    total_annual_cost: float
    resource_count: int
    most_expensive_category: Optional[str] = None
    category_breakdown: Dict[str, float] = Field(default_factory=dict)
    items: List[ResourceCostItem] = Field(default_factory=list)
    calculated_at: str
