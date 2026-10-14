from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class OptimizationRecommendation(BaseModel):
    rule_id: str
    resource_id: Optional[str] = None
    resource_name: Optional[str] = None
    category: str
    severity: str  # "info", "warning", "high", "critical"
    issue_detected: str
    reason: str
    suggested_action: str
    estimated_monthly_savings: float
    calculation_assumptions: str
    confidence_note: str

class OptimizationResponse(BaseModel):
    total_potential_savings: float
    recommendations_count: int
    recommendations: List[OptimizationRecommendation]
    analyzed_at: str
