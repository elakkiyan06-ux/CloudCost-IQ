# Multi-stage production Dockerfile for CloudCost IQ Backend
# Stage 1: Build & Dependencies
FROM python:3.12-slim AS builder

WORKDIR /build

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY backend/requirements.txt .
RUN pip install --upgrade pip && \
    pip install --default-timeout=100 --prefix=/install -r requirements.txt

# Stage 2: Production Minimal Image
FROM python:3.12-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/install/bin:$PATH" \
    PYTHONPATH="/app:/app/backend" \
    SQLITE_DB_PATH="/app/data/cloudcost.db" \
    PRICING_DATA_PATH="/app/data/pricing.json"

# Create non-root system user and persistent directories
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/bash -m appuser && \
    mkdir -p /app/data /app/backend /app/frontend && \
    chown -R appuser:appgroup /app

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy application files
COPY --chown=appuser:appgroup backend /app/backend
COPY --chown=appuser:appgroup data /app/data
COPY --chown=appuser:appgroup frontend /app/frontend

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; exit(0 if urllib.request.urlopen('http://localhost:8000/api/health').getcode() == 200 else 1)"

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
