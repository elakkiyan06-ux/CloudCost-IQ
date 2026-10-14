from fastapi import APIRouter, HTTPException
from ..schemas.estimate import EstimateRequest
from ..schemas.optimization import OptimizationResponse
from ..services.optimizer import analyze_cost_optimizations

router = APIRouter()

@router.post("/optimize", response_model=OptimizationResponse)
def get_optimizations(payload: EstimateRequest):
    try:
        items_raw = [item.model_dump() for item in payload.items]
        result = analyze_cost_optimizations(
            items=items_raw,
            hours_per_month=payload.hours_per_month
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization analysis error: {str(e)}")
