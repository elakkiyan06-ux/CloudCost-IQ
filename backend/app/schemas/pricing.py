from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class PricingCategory(BaseModel):
    id: str
    name: str
    icon: Optional[str] = "server"

class ResourcePricing(BaseModel):
    id: str
    name: str
    category: str
    provider: str
    billing_unit: str
    unit_price: float = Field(ge=0.0)
    currency: str = "USD"
    description: str
    pricing_status: str = "illustrative"
    source_url: Optional[str] = None
    last_updated: str
    specs: Optional[Dict[str, Any]] = None

class PricingDatasetResponse(BaseModel):
    version: str
    currency: str
    disclaimer: str
    last_updated: str
    categories: List[PricingCategory]
    resources: List[ResourcePricing]
