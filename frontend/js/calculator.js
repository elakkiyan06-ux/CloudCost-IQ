/**
 * CloudCost IQ - Client-Side Calculation Engine & FinOps Optimizer
 * Replicates backend Python calculation logic for instantaneous UI response and offline resilience.
 */
const Calculator = {
  pricingCatalog: {},

  initCatalog(resources) {
    if (Array.isArray(resources)) {
      this.pricingCatalog = {};
      resources.forEach(r => {
        this.pricingCatalog[r.id] = r;
      });
    }
  },

  calculateSingle(item, referenceHours = 730.0) {
    const resId = item.resource_id;
    const res = this.pricingCatalog[resId] || {
      id: resId,
      name: item.custom_name || resId,
      category: 'compute',
      provider: 'Generic Cloud',
      billing_unit: 'per_hour',
      unit_price: 0.05,
      pricing_status: 'illustrative'
    };

    const qty = Math.max(0, parseFloat(item.quantity) || 0);
    const hours = item.usage_hours_per_month !== undefined ? Math.min(744, Math.max(0, parseFloat(item.usage_hours_per_month) || 0)) : referenceHours;
    const unitPrice = parseFloat(res.unit_price) || 0;
    const billingUnit = res.billing_unit || 'per_hour';

    let hourlyCost = 0.0;
    let monthlyCost = 0.0;

    if (billingUnit === 'per_hour' || billingUnit === 'per_cluster_hour') {
      hourlyCost = unitPrice * qty;
      monthlyCost = hourlyCost * hours;
    } else if (['per_gb_month', 'per_request_million', 'per_gb_ingested', 'per_gb_second'].includes(billingUnit)) {
      monthlyCost = unitPrice * qty;
      hourlyCost = referenceHours > 0 ? (monthlyCost / referenceHours) : 0;
    } else {
      hourlyCost = unitPrice * qty;
      monthlyCost = hourlyCost * hours;
    }

    monthlyCost = Math.round(monthlyCost * 100) / 100;
    const annualCost = Math.round(monthlyCost * 12 * 100) / 100;

    return {
      resource_id: resId,
      name: item.custom_name || res.name || resId,
      category: res.category || 'compute',
      provider: res.provider || 'Generic Cloud',
      billing_unit: billingUnit,
      unit_price: unitPrice,
      quantity: qty,
      usage_hours_per_month: hours,
      hourly_cost: Math.round(hourlyCost * 10000) / 10000,
      monthly_cost: monthlyCost,
      annual_cost: annualCost,
      pricing_status: res.pricing_status || 'illustrative',
      notes: item.notes || ''
    };
  },

  calculateEstimate(payload) {
    const items = payload.items || [];
    const refHours = parseFloat(payload.hours_per_month) || 730.0;
    const calculatedItems = items.map(i => this.calculateSingle(i, refHours));

    let totalHourly = 0;
    let totalMonthly = 0;
    const categoryTotals = {};

    calculatedItems.forEach(item => {
      totalHourly += item.hourly_cost;
      totalMonthly += item.monthly_cost;
      categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.monthly_cost;
    });

    totalMonthly = Math.round(totalMonthly * 100) / 100;
    const totalAnnual = Math.round(totalMonthly * 12 * 100) / 100;

    let mostExpensiveCat = null;
    let maxCost = 0;
    for (const [cat, val] of Object.entries(categoryTotals)) {
      categoryTotals[cat] = Math.round(val * 100) / 100;
      if (val > maxCost) {
        maxCost = val;
        mostExpensiveCat = cat;
      }
    }

    return {
      scenario_name: payload.scenario_name || 'Infrastructure Estimate',
      currency: payload.currency || 'USD',
      hours_per_month: refHours,
      total_hourly_cost: Math.round(totalHourly * 10000) / 10000,
      total_monthly_cost: totalMonthly,
      total_annual_cost: totalAnnual,
      resource_count: calculatedItems.length,
      most_expensive_category: mostExpensiveCat,
      category_breakdown: categoryTotals,
      items: calculatedItems,
      calculated_at: new Date().toISOString()
    };
  },

  compare(configAData, configBData) {
    const estA = this.calculateEstimate(configAData);
    const estB = this.calculateEstimate(configBData);

    const hourlyDiff = Math.round((estB.total_hourly_cost - estA.total_hourly_cost) * 10000) / 10000;
    const monthlyDiff = Math.round((estB.total_monthly_cost - estA.total_monthly_cost) * 100) / 100;
    const annualDiff = Math.round((estB.total_annual_cost - estA.total_annual_cost) * 100) / 100;
    const monthlySavings = Math.round((estA.total_monthly_cost - estB.total_monthly_cost) * 100) / 100;

    const pctSavings = estA.total_monthly_cost > 0
      ? Math.round((monthlySavings / estA.total_monthly_cost) * 10000) / 100
      : 0;

    // Category comparisons
    const allCats = Array.from(new Set([...Object.keys(estA.category_breakdown), ...Object.keys(estB.category_breakdown)]));
    const catComps = allCats.map(cat => {
      const a = estA.category_breakdown[cat] || 0;
      const b = estB.category_breakdown[cat] || 0;
      const diff = Math.round((b - a) * 100) / 100;
      const pct = a > 0 ? Math.round(((a - b) / a) * 1000) / 10 : (b === 0 ? 0 : -100);
      return {
        category_id: cat,
        category_name: cat.replace('_', ' ').toUpperCase(),
        config_a_monthly: a,
        config_b_monthly: b,
        difference: diff,
        percentage_change: pct
      };
    });

    // Resource diffs
    const mapA = {};
    estA.items.forEach(i => mapA[i.resource_id] = i);
    const mapB = {};
    estB.items.forEach(i => mapB[i.resource_id] = i);

    const allResIds = Array.from(new Set([...Object.keys(mapA), ...Object.keys(mapB)]));
    const resDiffs = [];
    const drivers = [];

    allResIds.forEach(id => {
      const itemA = mapA[id];
      const itemB = mapB[id];
      const base = itemB || itemA;

      const costA = itemA ? itemA.monthly_cost : 0;
      const costB = itemB ? itemB.monthly_cost : 0;
      const diff = Math.round((costB - costA) * 100) / 100;
      const itemSav = Math.round((costA - costB) * 100) / 100;

      let status = 'identical';
      if (itemA && !itemB) status = 'removed_in_b';
      else if (!itemA && itemB) status = 'added_in_b';
      else if (costB < costA) status = 'cheaper_in_b';
      else if (costB > costA) status = 'pricier_in_b';

      resDiffs.push({
        resource_id: id,
        name: base.name,
        category: base.category,
        billing_unit: base.billing_unit,
        config_a_qty: itemA ? itemA.quantity : 0,
        config_b_qty: itemB ? itemB.quantity : 0,
        config_a_hours: itemA ? itemA.usage_hours_per_month : 0,
        config_b_hours: itemB ? itemB.usage_hours_per_month : 0,
        config_a_monthly: costA,
        config_b_monthly: costB,
        monthly_difference: diff,
        status: status
      });

      if (Math.abs(diff) > 0.01) {
        drivers.push({
          resource_id: id,
          name: base.name,
          monthly_savings: itemSav,
          monthly_difference: diff,
          explanation: `${itemSav > 0 ? 'Reduced' : 'Increased'} spending by $${Math.abs(diff).toFixed(2)}/mo (${status.replace(/_/g, ' ')})`
        });
      }
    });

    drivers.sort((x, y) => Math.abs(y.monthly_difference) - Math.abs(x.monthly_difference));

    let recSummary = '';
    if (monthlySavings > 0) {
      recSummary = `Configuration B reduces estimated cloud expenditure by $${monthlySavings.toFixed(2)}/month (${pctSavings.toFixed(1)}% reduction). Top contributor: ${drivers[0] ? drivers[0].name : 'Optimized resources'}.`;
    } else if (monthlySavings < 0) {
      recSummary = `Configuration B increases estimated cloud expenditure by $${Math.abs(monthlySavings).toFixed(2)}/month (${Math.abs(pctSavings).toFixed(1)}% increase). Review high-spec tiers.`;
    } else {
      recSummary = 'Both configurations yield identical estimated monthly costs ($0.00 difference).';
    }

    return {
      config_a: estA,
      config_b: estB,
      hourly_difference: hourlyDiff,
      monthly_difference: monthlyDiff,
      annual_difference: annualDiff,
      monthly_savings: monthlySavings,
      percentage_savings: pctSavings,
      is_cheaper: monthlySavings > 0,
      category_comparisons: catComps,
      resource_diffs: resDiffs,
      top_savings_drivers: drivers.slice(0, 5),
      recommendation_summary: recSummary,
      tradeoffs_note: 'Note: Cost reduction configurations should be validated against required workload memory, CPU, and SLA redundancy.'
    };
  },

  optimize(payload) {
    const items = payload.items || [];
    const recs = [];
    let totalSavings = 0;

    items.forEach(item => {
      const resId = item.resource_id;
      const res = this.pricingCatalog[resId] || {};
      const qty = parseFloat(item.quantity) || 0;
      const hrs = parseFloat(item.usage_hours_per_month) || 730;
      const unitPrice = parseFloat(res.unit_price) || 0;
      const name = item.custom_name || res.name || resId;

      if (qty === 0) {
        recs.push({
          rule_id: 'OPT-ZERO-QTY',
          resource_id: resId,
          resource_name: name,
          category: res.category || 'compute',
          severity: 'info',
          issue_detected: `Resource '${name}' is configured with 0 quantity`,
          reason: 'Incurs $0 cost but clutters infrastructure stack.',
          suggested_action: 'Remove zero-quantity items to keep definitions concise.',
          estimated_monthly_savings: 0,
          calculation_assumptions: 'Item produces $0 billable cost.',
          confidence_note: 'High confidence'
        });
      }

      if (res.category === 'compute' && hrs >= 700 && qty > 0) {
        const schedSavings = (hrs - 174) * unitPrice * qty;
        if (schedSavings >= 5) {
          totalSavings += schedSavings;
          recs.push({
            rule_id: 'OPT-SCHEDULED-COMPUTE',
            resource_id: resId,
            resource_name: name,
            category: 'compute',
            severity: 'medium',
            issue_detected: `Always-on compute (${hrs} hrs/mo) for '${name}'`,
            reason: 'Development or staging environments do not need to run overnight or weekends.',
            suggested_action: 'Schedule instances for 8x5 business hours (174h/mo) using automated cron schedules.',
            estimated_monthly_savings: Math.round(schedSavings * 100) / 100,
            calculation_assumptions: `Switching from ${hrs}h to 174h (${qty} instance(s) at $${unitPrice.toFixed(4)}/hr).`,
            confidence_note: 'Assumes workload can tolerate off-peak downtime.'
          });
        }
      }

      if (['vm-aws-r6i-2xlarge', 'vm-aws-m6i-xlarge'].includes(resId) && qty > 0) {
        const altRate = 0.0680;
        const save = (unitPrice - altRate) * hrs * qty;
        totalSavings += save;
        recs.push({
          rule_id: 'OPT-RIGHTSIZE-COMPUTE',
          resource_id: resId,
          resource_name: name,
          category: 'compute',
          severity: 'high',
          issue_detected: `High-spec instance '${name}' detected`,
          reason: 'Premium x86 instance types often run underutilized.',
          suggested_action: 'Migrate to ARM Graviton (c6g.large) or right-size CPU/RAM cores.',
          estimated_monthly_savings: Math.round(save * 100) / 100,
          calculation_assumptions: `Downgrading from $${unitPrice.toFixed(4)} to $${altRate.toFixed(4)}/hr.`,
          confidence_note: 'Benchmark memory requirements before migrating.'
        });
      }

      if (res.category === 'block_storage' && qty >= 250) {
        const offload = qty * 0.5;
        const save = offload * (unitPrice - 0.023);
        if (save > 0) {
          totalSavings += save;
          recs.push({
            rule_id: 'OPT-TIERED-STORAGE',
            resource_id: resId,
            resource_name: name,
            category: 'block_storage',
            severity: 'medium',
            issue_detected: `Large block storage volume (${qty} GB)`,
            reason: 'Block SSD storage is significantly more expensive than object storage.',
            suggested_action: 'Tier static files, backups, and user uploads to S3 Standard ($0.023/GB).',
            estimated_monthly_savings: Math.round(save * 100) / 100,
            calculation_assumptions: `Moving 50% (${offload} GB) to S3 object storage.`,
            confidence_note: 'Assumes half of storage consists of unattached or static assets.'
          });
        }
      }
    });

    recs.sort((a, b) => b.estimated_monthly_savings - a.estimated_monthly_savings);

    return {
      total_potential_savings: Math.round(totalSavings * 100) / 100,
      recommendations_count: recs.length,
      recommendations: recs,
      analyzed_at: new Date().toISOString()
    };
  }
};

window.Calculator = Calculator;
