/**
 * CloudCost IQ - Report & Data Export Service
 * Generates verified JSON scenarios, CSV breakdowns, and printable HTML/PDF executive reports.
 */
const ExportService = {
  downloadJSON(data, filename = 'cloudcost-iq-scenario.json') {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    this.triggerDownload(blob, filename);
  },

  downloadCSV(estimate, filename = 'cloudcost-iq-breakdown.csv') {
    const items = estimate.items || [];
    const headers = [
      'Resource ID',
      'Resource Name',
      'Category',
      'Provider',
      'Billing Unit',
      'Unit Price ($)',
      'Quantity',
      'Usage Hours/Month',
      'Hourly Cost ($)',
      'Monthly Cost ($)',
      'Annual Cost ($)',
      'Pricing Status'
    ];

    const rows = items.map(item => [
      `"${item.resource_id}"`,
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.category}"`,
      `"${item.provider}"`,
      `"${item.billing_unit}"`,
      item.unit_price,
      item.quantity,
      item.usage_hours_per_month,
      item.hourly_cost,
      item.monthly_cost,
      item.annual_cost,
      `"${item.pricing_status}"`
    ]);

    // Add totals row
    rows.push([]);
    rows.push([
      '"TOTALS"',
      `"${estimate.scenario_name}"`,
      '""',
      '""',
      '""',
      '""',
      estimate.resource_count,
      estimate.hours_per_month,
      estimate.total_hourly_cost,
      estimate.total_monthly_cost,
      estimate.total_annual_cost,
      '"Calculated by CloudCost IQ"'
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    this.triggerDownload(blob, filename);
  },

  triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  printExecutiveReport() {
    window.print();
  }
};

window.ExportService = ExportService;
