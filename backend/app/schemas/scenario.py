from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from .estimate import ResourceInput, EstimateResponse

class ScenarioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = ""
    environment: str = Field(default="Production")
    items: List[ResourceInput] = Field(default_factory=list)

class ScenarioResponse(BaseModel):
    id: str
    name: str
    description: str
    environment: str
    created_at: str
    updated_at: str
    items: List[ResourceInput]
    estimate: Optional[EstimateResponse] = None
