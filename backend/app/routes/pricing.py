from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from ..services.pricing_loader import load_pricing_data, get_resource_by_id, list_resources, list_categories

router = APIRouter()

@router.get("/pricing")
def get_pricing(category: Optional[str] = Query(None, description="Filter resources by category ID")):
    pricing = load_pricing_data()
    resources = list_resources(category=category)
    return {
        "version": pricing.get("version", "1.2.0"),
        "currency": pricing.get("currency", "USD"),
        "disclaimer": pricing.get("disclaimer"),
        "last_updated": pricing.get("last_updated"),
        "category_filter": category,
        "count": len(resources),
        "categories": list_categories(),
        "resources": resources
    }

@router.get("/pricing/categories")
def get_categories():
    return {
        "categories": list_categories()
    }

@router.get("/pricing/{resource_id}")
def get_single_resource(resource_id: str):
    res = get_resource_by_id(resource_id)
    if not res:
        raise HTTPException(
            status_code=404,
            detail=f"Resource '{resource_id}' not found in pricing catalog."
        )
    return res
