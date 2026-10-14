import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse

from .database import init_db
from .services.pricing_loader import load_pricing_data
from .routes import (
    health_router,
    pricing_router,
    estimate_router,
    compare_router,
    optimize_router,
    scenarios_router,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize SQLite DB and pre-load pricing catalog
    init_db()
    load_pricing_data()
    yield
    # Shutdown logic if needed

app = FastAPI(
    title="CloudCost IQ — Cloud Resource Cost Estimator & Optimization API",
    description=(
        "Production-grade FinOps & DevOps API for cloud resource cost estimation, "
        "side-by-side dual architecture comparison, and rule-based cost optimization."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# CORS configuration
allowed_origins_raw = os.getenv("CORS_ORIGINS", "*")
allowed_origins = [orig.strip() for orig in allowed_origins_raw.split(",")] if allowed_origins_raw != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(health_router, prefix="/api", tags=["System & Health"])
app.include_router(pricing_router, prefix="/api", tags=["Pricing Catalog"])
app.include_router(estimate_router, prefix="/api", tags=["Cost Estimation"])
app.include_router(compare_router, prefix="/api", tags=["Configuration Comparison"])
app.include_router(optimize_router, prefix="/api", tags=["FinOps Optimization"])
app.include_router(scenarios_router, prefix="/api", tags=["Scenarios & Persistence"])

# Static Frontend mounting for standalone local runs and Docker
frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"
if frontend_dir.exists():
    if (frontend_dir / "css").exists():
        app.mount("/css", StaticFiles(directory=str(frontend_dir / "css")), name="css")
    if (frontend_dir / "js").exists():
        app.mount("/js", StaticFiles(directory=str(frontend_dir / "js")), name="js")
    if (frontend_dir / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(frontend_dir / "assets")), name="assets")

    # Serve index.html at root
    @app.get("/", include_in_schema=False)
    async def serve_index():
        index_file = frontend_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"message": "CloudCost IQ API is running. Visit /docs for API documentation."}

    # Mount remaining static files as fallback
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend_root")
else:
    @app.get("/", include_in_schema=False)
    async def root_redirect():
        return RedirectResponse(url="/docs")

