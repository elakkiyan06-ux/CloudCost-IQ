from datetime import datetime, timezone
from typing import Dict, Any, List
from .pricing_loader import get_resource_by_id

def analyze_cost_optimizations(
    items: List[Dict[str, Any]],
    hours_per_month: float = 730.0
) -> Dict[str, Any]:
    """
    Evaluates rule-based FinOps optimization heuristics on configured infrastructure.
    Calculates tangible estimated monthly savings based on illustrative pricing.
    """
    recommendations: List[Dict[str, Any]] = []
    total_potential_savings = 0.0

    for item in items:
        res_id = item.get("resource_id", "")
        qty = float(item.get("quantity", 1.0))
        hrs = float(item.get("usage_hours_per_month", hours_per_month))
        res_meta = get_resource_by_id(res_id) or {}
        name = item.get("custom_name") or res_meta.get("name", res_id)
        category = res_meta.get("category", "")
        unit_price = float(res_meta.get("unit_price", 0.0))

        # Rule 1: Zero or Near-Zero Quantity Configured
        if qty == 0.0:
            recommendations.append({
                "rule_id": "OPT-ZERO-QTY",
                "resource_id": res_id,
                "resource_name": name,
                "category": category,
                "severity": "info",
                "issue_detected": f"Resource '{name}' is configured with 0 quantity",
                "reason": "Resource exists in configuration stack but incurs $0.00 billable cost.",
                "suggested_action": "Remove unused zero-quantity resources to keep infrastructure definitions clean and maintainable.",
                "estimated_monthly_savings": 0.0,
                "calculation_assumptions": "Quantity is already 0; removal cleans repository code.",
                "confidence_note": "High confidence. Zero quantity produces zero cost."
            })
            continue

        # Rule 2: Always-On Compute Scheduling (Dev/Staging Opportunity)
        if category == "compute" and hrs >= 700.0 and qty > 0:
            # If running 24/7 (730h), switching to 8x5 business schedule (174h) saves ~76%
            business_hours = 174.0
            scheduled_savings = (hrs - business_hours) * unit_price * qty
            if scheduled_savings >= 5.0:
                total_potential_savings += scheduled_savings
                recommendations.append({
                    "rule_id": "OPT-SCHEDULED-COMPUTE",
                    "resource_id": res_id,
                    "resource_name": name,
                    "category": category,
                    "severity": "medium",
                    "issue_detected": f"Always-on execution (730 hrs/mo) for '{name}'",
                    "reason": "If this instance hosts development, staging, or intermittent batch workloads, running continuously incurs unnecessary off-peak charges.",
                    "suggested_action": "Implement automated start/stop schedules (e.g. AWS Instance Scheduler or Lambda cron) to run 8 hours/day on weekdays (~174 hrs/mo).",
                    "estimated_monthly_savings": round(scheduled_savings, 2),
                    "calculation_assumptions": f"Switching from {hrs:.0f}h to 174h/month ({qty} instance(s) at ${unit_price:.4f}/hr).",
                    "confidence_note": "Estimated potential savings. Assumes workload can tolerate overnight and weekend shutdown."
                })

        # Rule 3: Oversized High-Spec Instance Right-Sizing
        if res_id in ("vm-aws-r6i-2xlarge", "vm-aws-m6i-xlarge") and qty > 0:
            # Suggest ARM Graviton2 or right-sized alternative
            # e.g., r6i-2xlarge ($0.504/hr) vs c6g-large ($0.068/hr) or m6i ($0.192)
            target_rate = 0.0680 if res_id == "vm-aws-c6g-large" else 0.0680
            rate_delta = (unit_price - target_rate)
            if rate_delta > 0:
                monthly_saving = rate_delta * hrs * qty
                total_potential_savings += monthly_saving
                recommendations.append({
                    "rule_id": "OPT-RIGHTSIZE-COMPUTE",
                    "resource_id": res_id,
                    "resource_name": name,
                    "category": category,
                    "severity": "high",
                    "issue_detected": f"High-tier compute instance '{name}' detected",
                    "reason": "Large x86 instances carry premium pricing. Many microservices and web APIs are over-provisioned during initial rollout.",
                    "suggested_action": "Benchmark CPU/RAM metrics and migrate to AWS Graviton ARM (e.g., c6g.large or t4g.medium) or split into smaller horizontal pods.",
                    "estimated_monthly_savings": round(monthly_saving, 2),
                    "calculation_assumptions": f"Migrating from ${unit_price:.4f}/hr to Graviton c6g.large at ${target_rate:.4f}/hr over {hrs:.0f} hrs.",
                    "confidence_note": "Requires load testing before deployment to verify application memory footprint."
                })

        # Rule 4: High-Cost Block Storage Allocation (Offload to Object Storage)
        if category == "block_storage" and qty >= 250.0:
            # Assume 50% of large block storage consists of static assets, logs, or archives
            # S3 standard is $0.023/GB vs EBS gp3 $0.080/GB
            offload_gb = qty * 0.50
            storage_diff_rate = unit_price - 0.0230
            if storage_diff_rate > 0:
                storage_saving = offload_gb * storage_diff_rate
                total_potential_savings += storage_saving
                recommendations.append({
                    "rule_id": "OPT-TIERED-STORAGE",
                    "resource_id": res_id,
                    "resource_name": name,
                    "category": category,
                    "severity": "medium",
                    "issue_detected": f"Large block storage volume ({qty:.0f} GB) provisioned",
                    "reason": "Block storage (EBS/PD) is 3.5x - 5x more costly than durable S3 object storage per gigabyte.",
                    "suggested_action": "Tier static media, persistent log archives, and database dumps to S3 Standard ($0.023/GB) or S3 Glacier ($0.004/GB).",
                    "estimated_monthly_savings": round(storage_saving, 2),
                    "calculation_assumptions": f"Offloading 50% ({offload_gb:.0f} GB) from ${unit_price:.3f}/GB to S3 at $0.023/GB.",
                    "confidence_note": "Assumes at least half of the volume data consists of non-active files."
                })

        # Rule 5: Multi-AZ Enterprise Database in Dev/Testing
        if res_id == "db-aws-rds-postgres-m6i-large-multiaz" and qty > 0:
            # Alternative: Single-AZ t4g.medium ($0.073/hr) vs Multi-AZ ($0.384/hr)
            alt_rate = 0.0730
            db_saving = (unit_price - alt_rate) * hrs * qty
            total_potential_savings += db_saving
            recommendations.append({
                "rule_id": "OPT-DB-MULTIAZ",
                "resource_id": res_id,
                "resource_name": name,
                "category": category,
                "severity": "high",
                "issue_detected": f"Premium Multi-AZ RDS instance configured (${unit_price:.3f}/hr)",
                "reason": "Multi-AZ synchronous replication doubles database hourly costs. While essential for mission-critical production, it is rarely justified in staging or dev.",
                "suggested_action": "Use Single-AZ RDS PostgreSQL (db.t4g.medium at $0.073/hr) for non-production environments with automated snapshot backups.",
                "estimated_monthly_savings": round(db_saving, 2),
                "calculation_assumptions": f"Downgrading from Multi-AZ ($0.384/hr) to Single-AZ ($0.073/hr) for {hrs:.0f} hours/mo.",
                "confidence_note": "Production environments with high availability SLAs should maintain Multi-AZ."
            })

        # Rule 6: Always-on Reserved Instance / Savings Plan Potential
        if category in ("compute", "databases") and hrs >= 700.0 and unit_price > 0.05 and qty > 0:
            # Typical 1-year No-Upfront Savings Plan yields ~30-33% discount
            commitment_saving = (unit_price * 0.32) * hrs * qty
            total_potential_savings += commitment_saving
            recommendations.append({
                "rule_id": "OPT-SAVINGS-PLAN",
                "resource_id": res_id,
                "resource_name": name,
                "category": category,
                "severity": "low",
                "issue_detected": f"Steady-state on-demand commitment for '{name}'",
                "reason": "Resource operates at 100% duty cycle on On-Demand billing rates.",
                "suggested_action": "Enroll in a 1-year Cloud Compute Savings Plan or Reserved Instance to lock in 30% - 35% discount with zero upfront capital.",
                "estimated_monthly_savings": round(commitment_saving, 2),
                "calculation_assumptions": f"Calculated as an estimated 32% discount on ${unit_price:.4f}/hr for {hrs:.0f} hours.",
                "confidence_note": "Applies to verified baseline production capacity only."
            })

        # Rule 7: Excessive Log Ingestion
        if res_id == "mon-cloudwatch-logs-ingest" and qty >= 100.0:
            # Suggest 30% reduction via log filtering and sampling
            log_saving = qty * 0.30 * unit_price
            total_potential_savings += log_saving
            recommendations.append({
                "rule_id": "OPT-LOG-INGESTION",
                "resource_id": res_id,
                "resource_name": name,
                "category": category,
                "severity": "medium",
                "issue_detected": f"High log volume ingestion ({qty:.0f} GB/month)",
                "reason": "Verbose debug logging and health check ping logs saturate ingestion pipelines and inflate monitoring costs.",
                "suggested_action": "Tune log levels to INFO in production, drop redundant ALB health check logs at source, and set 14-day retention limits.",
                "estimated_monthly_savings": round(log_saving, 2),
                "calculation_assumptions": f"30% volume reduction ({qty * 0.3:.0f} GB) at ${unit_price:.2f}/GB.",
                "confidence_note": "Telemetry estimate based on typical web application noise reduction."
            })

    # Sort recommendations by highest potential savings first
    recommendations.sort(key=lambda r: r["estimated_monthly_savings"], reverse=True)

    return {
        "total_potential_savings": round(total_potential_savings, 2),
        "recommendations_count": len(recommendations),
        "recommendations": recommendations,
        "analyzed_at": datetime.now(timezone.utc).isoformat()
    }
