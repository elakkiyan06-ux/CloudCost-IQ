#!/usr/bin/env bash
# ==============================================================================
# CloudCost IQ - Automated Rollback Procedure
# Restores previous database backup and restarts the last known stable container state
# ==============================================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cloudcost-iq}"
cd "${APP_DIR}"

echo "============================================================"
echo "⚠️ Initiating CloudCost IQ Rollback Procedure"
echo "Date: $(date -u)"
echo "============================================================"

# Stop failed containers
echo "🛑 Stopping current containers..."
docker compose stop || true

# Find latest database backup if exists
LATEST_BACKUP=$(ls -t "${APP_DIR}/data"/cloudcost.db.bak.* 2>/dev/null | head -n 1 || true)
if [ -n "${LATEST_BACKUP}" ] && [ -f "${LATEST_BACKUP}" ]; then
  echo "🔄 Restoring database from backup: ${LATEST_BACKUP}..."
  cp "${LATEST_BACKUP}" "${APP_DIR}/data/cloudcost.db"
fi

# Rebuild and restart containers
echo "🚀 Restarting containers in safe configuration..."
docker compose up -d

echo "🩺 Verifying rollback state..."
sleep 5
if curl -sf http://localhost/api/health >/dev/null 2>&1; then
  echo "✅ Rollback completed successfully. System is operating."
else
  echo "🚨 CRITICAL: Service remains degraded after rollback. Inspecting container logs:"
  docker compose logs --tail=50
fi
