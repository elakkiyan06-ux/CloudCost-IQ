import sys
import platform
import time
from datetime import datetime, timezone
from fastapi import APIRouter
from ..database import get_connection
from ..services.pricing_loader import load_pricing_data

router = APIRouter()
START_TIME = time.time()

@router.get("/health")
def get_health():
    db_status = "connected"
    try:
        conn = get_connection()
        conn.execute("SELECT 1")
        conn.close()
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    pricing_count = 0
    pricing_status = "loaded"
    try:
        pricing = load_pricing_data()
        pricing_count = len(pricing.get("resources", []))
    except Exception as e:
        pricing_status = f"error: {str(e)}"

    return {
        "status": "healthy" if db_status == "connected" and pricing_status == "loaded" else "degraded",
        "app": "CloudCost IQ",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_status,
        "pricing_dataset": {
            "status": pricing_status,
            "resources_available": pricing_count,
            "version": "1.2.0"
        },
        "uptime_seconds": round(time.time() - START_TIME, 1)
    }

@router.get("/system/info")
def get_system_info():
    return {
        "app_name": "CloudCost IQ — Cloud Resource Cost Estimator & Optimization Platform",
        "environment": "DevOps Hackathon Production Candidate",
        "runtime": {
            "python_version": sys.version.split(" ")[0],
            "os": platform.system(),
            "os_release": platform.release(),
            "architecture": platform.machine()
        },
        "deployment": {
            "web_server": "Nginx Reverse Proxy",
            "app_server": "Uvicorn (FastAPI ASGI)",
            "container_runtime": "Docker & Docker Compose",
            "orchestration_target": "Ubuntu AWS EC2 VM"
        },
        "features": [
            "10 Cloud Resource Categories",
            "Real-time Billing-Unit-Aware Cost Calculation Engine",
            "Side-by-Side Dual Configuration Comparison",
            "Rule-Based FinOps Cost Optimization Engine",
            "SQLite Scenario Persistence",
            "JSON / CSV / Printable Report Exports",
            "REST API with Interactive OpenAPI Swagger Docs"
        ]
    }
