from fastapi import APIRouter, HTTPException
from ..schemas.compare import CompareRequest, CompareResponse
from ..services.calculator import compare_configurations

router = APIRouter()

@router.post("/compare", response_model=CompareResponse)
def compare_infrastructures(payload: CompareRequest):
    try:
        config_a_dict = {
            "scenario_name": payload.config_a.scenario_name,
            "currency": payload.config_a.currency,
            "hours_per_month": payload.config_a.hours_per_month,
            "items": [item.model_dump() for item in payload.config_a.items]
        }
        config_b_dict = {
            "scenario_name": payload.config_b.scenario_name,
            "currency": payload.config_b.currency,
            "hours_per_month": payload.config_b.hours_per_month,
            "items": [item.model_dump() for item in payload.config_b.items]
        }
        result = compare_configurations(config_a_dict, config_b_dict)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison calculation error: {str(e)}")
