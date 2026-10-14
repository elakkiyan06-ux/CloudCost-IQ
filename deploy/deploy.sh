#!/usr/bin/env bash
# ==============================================================================
# CloudCost IQ - Automated Deployment Script for Ubuntu AWS EC2 Virtual Machines
# ==============================================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cloudcost-iq}"
ENV_FILE="${APP_DIR}/.env"
MAX_HEALTH_ATTEMPTS=12
SLEEP_INTERVAL=5

echo "============================================================"
echo "🚀 Starting CloudCost IQ Automated Deployment"
echo "Target Directory: ${APP_DIR}"
echo "Date: $(date -u)"
echo "============================================================"

# Step 1: Ensure system prerequisites are installed
command -v docker >/dev/null 2>&1 || {
  echo "⚠️ Docker is not installed. Installing Docker engine..."
  sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
  sudo systemctl enable --now docker
  sudo usermod -aG docker "$USER"
}

command -v docker compose >/dev/null 2>&1 || {
  echo "⚠️ Docker Compose plugin not found. Installing..."
  sudo apt-get update && sudo apt-get install -y docker-compose-v2
}

# Step 2: Ensure target directory exists
if [ ! -d "${APP_DIR}" ]; then
  echo "📁 Creating application directory at ${APP_DIR}..."
  sudo mkdir -p "${APP_DIR}"
  sudo chown -R "$USER":"$USER" "${APP_DIR}"
fi

cd "${APP_DIR}"

# Step 3: Setup environment configuration if missing
if [ ! -f "${ENV_FILE}" ]; then
  if [ -f ".env.example" ]; then
    echo "📋 Copying .env.example to .env..."
    cp .env.example "${ENV_FILE}"
  else
    echo "⚙️ Creating minimal default .env file..."
    cat <<EOF > "${ENV_FILE}"
PORT=8000
ENVIRONMENT=production
SQLITE_DB_PATH=/app/data/cloudcost.db
PRICING_DATA_PATH=/app/data/pricing.json
CORS_ORIGINS=*
EOF
  fi
fi

# Step 4: Ensure persistent data directory has correct permissions
mkdir -p "${APP_DIR}/data"
chmod 775 "${APP_DIR}/data"

# Step 5: Backup current state before deploying
echo "💾 Backing up current database..."
if [ -f "${APP_DIR}/data/cloudcost.db" ]; then
  cp "${APP_DIR}/data/cloudcost.db" "${APP_DIR}/data/cloudcost.db.bak.$(date +%s)"
fi

# Step 6: Build and launch containers
echo "📦 Building and starting Docker containers..."
docker compose pull || true
docker compose up -d --build --remove-orphans

# Step 7: Automated Health Check Verification
echo "🩺 Performing post-deployment health check..."
ATTEMPTS=0
HEALTHY=false

while [ $ATTEMPTS -lt $MAX_HEALTH_ATTEMPTS ]; do
  ATTEMPTS=$((ATTEMPTS + 1))
  echo "Attempt $ATTEMPTS of $MAX_HEALTH_ATTEMPTS: Checking http://localhost/api/health..."
  
  if curl -sf http://localhost/api/health >/dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  sleep $SLEEP_INTERVAL
done

if [ "$HEALTHY" = true ]; then
  echo "============================================================"
  echo "✅ Deployment Successful!"
  echo "CloudCost IQ is healthy and serving requests."
  echo "Endpoints:"
  echo " - Web Application: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'localhost')/"
  echo " - API Documentation: http://localhost/docs"
  echo " - Health Status: http://localhost/api/health"
  echo "============================================================"
  exit 0
else
  echo "❌ Health check failed after $MAX_HEALTH_ATTEMPTS attempts."
  echo "Initiating automated rollback..."
  if [ -f "${APP_DIR}/deploy/rollback.sh" ]; then
    bash "${APP_DIR}/deploy/rollback.sh"
  else
    docker compose logs --tail=50
    docker compose restart
  fi
  exit 1
fi
