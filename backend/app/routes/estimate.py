from fastapi import APIRouter, HTTPException
from ..schemas.estimate import EstimateRequest, EstimateResponse
from ..services.calculator import calculate_infrastructure_estimate

router = APIRouter()

@router.post("/estimate", response_model=EstimateResponse)
def estimate_cost(payload: EstimateRequest):
    try:
        items_raw = [item.model_dump() for item in payload.items]
        result = calculate_infrastructure_estimate(
            items=items_raw,
            scenario_name=payload.scenario_name or "Infrastructure Estimate",
            reference_hours_per_month=payload.hours_per_month,
            currency=payload.currency
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cost estimation error: {str(e)}")
