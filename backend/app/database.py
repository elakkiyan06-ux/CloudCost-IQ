import sqlite3
import json
import os
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

def get_db_path() -> Path:
    env_path = os.getenv("SQLITE_DB_PATH")
    if env_path:
        p = Path(env_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p
    # Standard location in project data directory
    data_dir = Path(__file__).resolve().parent.parent.parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "cloudcost.db"

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS scenarios (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        environment TEXT DEFAULT 'Production',
        items_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)
    conn.commit()

    # Check if empty, seed pre-configured DevOps scenarios
    cursor.execute("SELECT COUNT(*) FROM scenarios")
    count = cursor.fetchone()[0]
    if count == 0:
        seed_scenarios(cursor)
        conn.commit()

    conn.close()

def seed_scenarios(cursor: sqlite3.Cursor):
    now = datetime.now(timezone.utc).isoformat()
    
    seeds = [
        {
            "id": "scenario-seed-1",
            "name": "Standard Production Web Application",
            "description": "Standard high-availability web service with ALB, 2x t4g.medium app servers, RDS PostgreSQL, S3 storage, and CloudWatch.",
            "environment": "Production",
            "items": [
                {"resource_id": "lb-aws-alb", "custom_name": "Public Ingress ALB", "quantity": 1, "usage_hours_per_month": 730},
                {"resource_id": "vm-aws-t4g-medium", "custom_name": "API Web Instances", "quantity": 2, "usage_hours_per_month": 730},
                {"resource_id": "storage-ebs-gp3", "custom_name": "API Root Volumes", "quantity": 100, "usage_hours_per_month": 730},
                {"resource_id": "db-aws-rds-postgres-t4g-medium", "custom_name": "Primary PostgreSQL DB", "quantity": 1, "usage_hours_per_month": 730},
                {"resource_id": "storage-s3-standard", "custom_name": "Static Uploads S3", "quantity": 250, "usage_hours_per_month": 730},
                {"resource_id": "net-egress-internet-gb", "custom_name": "Internet Egress Bandwidth", "quantity": 300, "usage_hours_per_month": 730},
                {"resource_id": "mon-cloudwatch-metrics", "custom_name": "App Metrics", "quantity": 2, "usage_hours_per_month": 730}
            ]
        },
        {
            "id": "scenario-seed-2",
            "name": "Scheduled Dev & Staging Environment",
            "description": "Cost-optimized non-production environment scheduled for business hours (174h/mo) with Single-AZ database and smaller instances.",
            "environment": "Staging",
            "items": [
                {"resource_id": "vm-aws-t4g-small", "custom_name": "Staging App Instance", "quantity": 1, "usage_hours_per_month": 174},
                {"resource_id": "storage-ebs-gp3", "custom_name": "Staging Root Disk", "quantity": 40, "usage_hours_per_month": 730},
                {"resource_id": "db-aws-rds-postgres-t4g-micro", "custom_name": "Dev Micro PostgreSQL", "quantity": 1, "usage_hours_per_month": 174},
                {"resource_id": "storage-s3-ia", "custom_name": "Staging S3 Bucket", "quantity": 50, "usage_hours_per_month": 730}
            ]
        },
        {
            "id": "scenario-seed-3",
            "name": "Enterprise High-Performance Cluster (Heavy Baseline)",
            "description": "Heavy baseline stack featuring memory-optimized r6i compute, Multi-AZ RDS, and uncompressed log ingestion.",
            "environment": "Enterprise",
            "items": [
                {"resource_id": "lb-aws-alb", "custom_name": "Multi-Region ALB", "quantity": 2, "usage_hours_per_month": 730},
                {"resource_id": "vm-aws-r6i-2xlarge", "custom_name": "Monolithic Backend VMs", "quantity": 2, "usage_hours_per_month": 730},
                {"resource_id": "storage-ebs-io2", "custom_name": "High-IOPS DB Disks", "quantity": 500, "usage_hours_per_month": 730},
                {"resource_id": "db-aws-rds-postgres-m6i-large-multiaz", "custom_name": "Multi-AZ Postgres", "quantity": 1, "usage_hours_per_month": 730},
                {"resource_id": "mon-cloudwatch-logs-ingest", "custom_name": "Verbose Log Stream", "quantity": 200, "usage_hours_per_month": 730}
            ]
        }
    ]

    for s in seeds:
        cursor.execute(
            "INSERT INTO scenarios (id, name, description, environment, items_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (s["id"], s["name"], s["description"], s["environment"], json.dumps(s["items"]), now, now)
        )

def list_scenarios() -> List[Dict[str, Any]]:
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, description, environment, items_json, created_at, updated_at FROM scenarios ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "name": r["name"],
            "description": r["description"] or "",
            "environment": r["environment"] or "Production",
            "items": json.loads(r["items_json"]),
            "created_at": r["created_at"],
            "updated_at": r["updated_at"]
        })
    return result

def get_scenario(scenario_id: str) -> Optional[Dict[str, Any]]:
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, description, environment, items_json, created_at, updated_at FROM scenarios WHERE id = ?", (scenario_id,))
    r = cursor.fetchone()
    conn.close()

    if not r:
        return None

    return {
        "id": r["id"],
        "name": r["name"],
        "description": r["description"] or "",
        "environment": r["environment"] or "Production",
        "items": json.loads(r["items_json"]),
        "created_at": r["created_at"],
        "updated_at": r["updated_at"]
    }

def save_scenario(name: str, description: str, environment: str, items: List[Dict[str, Any]]) -> Dict[str, Any]:
    init_db()
    conn = get_connection()
    cursor = conn.cursor()

    scenario_id = f"scenario-{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    items_json = json.dumps(items)

    cursor.execute(
        "INSERT INTO scenarios (id, name, description, environment, items_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (scenario_id, name, description, environment, items_json, now, now)
    )
    conn.commit()
    conn.close()

    return {
        "id": scenario_id,
        "name": name,
        "description": description,
        "environment": environment,
        "items": items,
        "created_at": now,
        "updated_at": now
    }

def delete_scenario(scenario_id: str) -> bool:
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM scenarios WHERE id = ?", (scenario_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted
