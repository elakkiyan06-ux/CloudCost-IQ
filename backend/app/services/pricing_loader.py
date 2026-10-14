import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional

_CACHED_PRICING: Optional[Dict[str, Any]] = None

def get_pricing_data_path() -> Path:
    env_path = os.getenv("PRICING_DATA_PATH")
    if env_path and Path(env_path).exists():
        return Path(env_path)
    
    # Check standard locations
    # 1. When running from backend/ or project root
    candidate_paths = [
        Path(__file__).resolve().parent.parent.parent.parent / "data" / "pricing.json",
        Path(__file__).resolve().parent.parent.parent / "data" / "pricing.json",
        Path("data/pricing.json").resolve(),
        Path("../data/pricing.json").resolve(),
    ]
    for p in candidate_paths:
        if p.exists():
            return p
            
    # Default fallback to expected path
    return candidate_paths[0]

def load_pricing_data(force_reload: bool = False) -> Dict[str, Any]:
    global _CACHED_PRICING
    if _CACHED_PRICING is not None and not force_reload:
        return _CACHED_PRICING

    path = get_pricing_data_path()
    if not path.exists():
        raise FileNotFoundError(f"Pricing dataset not found at {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Index by resource ID for fast lookup
    data["resources_by_id"] = {res["id"]: res for res in data.get("resources", [])}
    _CACHED_PRICING = data
    return _CACHED_PRICING

def get_resource_by_id(resource_id: str) -> Optional[Dict[str, Any]]:
    pricing = load_pricing_data()
    return pricing.get("resources_by_id", {}).get(resource_id)

def list_resources(category: Optional[str] = None) -> List[Dict[str, Any]]:
    pricing = load_pricing_data()
    resources = pricing.get("resources", [])
    if category:
        return [r for r in resources if r.get("category") == category]
    return resources

def list_categories() -> List[Dict[str, Any]]:
    pricing = load_pricing_data()
    return pricing.get("categories", [])
