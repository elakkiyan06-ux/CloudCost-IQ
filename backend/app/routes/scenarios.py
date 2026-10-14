from fastapi import APIRouter, HTTPException
from ..schemas.scenario import ScenarioCreate, ScenarioResponse
from ..database import list_scenarios, get_scenario, save_scenario, delete_scenario
from ..services.calculator import calculate_infrastructure_estimate

router = APIRouter()

@router.get("/scenarios")
def get_all_scenarios():
    scenarios = list_scenarios()
    # Compute quick estimates for each scenario to display in dashboard
    enriched = []
    for s in scenarios:
        try:
            est = calculate_infrastructure_estimate(
                items=s.get("items", []),
                scenario_name=s["name"]
            )
            s["estimate"] = est
        except Exception:
            s["estimate"] = None
        enriched.append(s)
    return {"count": len(enriched), "scenarios": enriched}

@router.post("/scenarios")
def create_scenario(payload: ScenarioCreate):
    try:
        items_raw = [item.model_dump() for item in payload.items]
        new_scenario = save_scenario(
            name=payload.name,
            description=payload.description or "",
            environment=payload.environment or "Production",
            items=items_raw
        )
        # Attach estimate
        est = calculate_infrastructure_estimate(items=items_raw, scenario_name=new_scenario["name"])
        new_scenario["estimate"] = est
        return new_scenario
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to persist scenario: {str(e)}")

@router.get("/scenarios/{scenario_id}")
def get_single_scenario(scenario_id: str):
    s = get_scenario(scenario_id)
    if not s:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")
    try:
        s["estimate"] = calculate_infrastructure_estimate(
            items=s.get("items", []),
            scenario_name=s["name"]
        )
    except Exception:
        s["estimate"] = None
    return s

@router.delete("/scenarios/{scenario_id}")
def delete_single_scenario(scenario_id: str):
    deleted = delete_scenario(scenario_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")
    return {"success": True, "message": f"Scenario '{scenario_id}' successfully deleted."}
