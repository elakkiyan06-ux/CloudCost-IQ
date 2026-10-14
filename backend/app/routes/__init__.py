from .health import router as health_router
from .pricing import router as pricing_router
from .estimate import router as estimate_router
from .compare import router as compare_router
from .optimize import router as optimize_router
from .scenarios import router as scenarios_router

__all__ = [
    "health_router",
    "pricing_router",
    "estimate_router",
    "compare_router",
    "optimize_router",
    "scenarios_router"
]
