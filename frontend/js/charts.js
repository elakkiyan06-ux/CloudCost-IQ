/**
 * CloudCost IQ - Chart.js Visualization Layer
 */
const AppCharts = {
  distributionChart: null,
  projectionChart: null,
  comparisonChart: null,

  getColorPalette() {
    return [
      '#00f2fe', '#3b82f6', '#8b5cf6', '#10b981',
      '#f59e0b', '#ec4899', '#06b6d4', '#6366f1',
      '#14b8a6', '#f43f5e'
    ];
  },

  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
      textColor: isDark ? '#94a3b8' : '#475569',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? '#111827' : '#ffffff',
      tooltipText: isDark ? '#f8fafc' : '#0f172a',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
    };
  },

  renderCostDistribution(canvasId, categoryBreakdown) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === 'undefined') return;

    if (this.distributionChart) {
      this.distributionChart.destroy();
      this.distributionChart = null;
    }

    const labels = Object.keys(categoryBreakdown).map(k => k.replace(/_/g, ' ').toUpperCase());
    const data = Object.values(categoryBreakdown);
    const theme = this.getThemeColors();
    const colors = this.getColorPalette();

    if (data.length === 0 || data.every(v => v === 0)) {
      ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
      return;
    }

    this.distributionChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 2,
          borderColor: theme.borderColor,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: theme.textColor,
              font: { family: 'Inter', size: 11, weight: '500' },
              padding: 12,
              boxWidth: 12,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.borderColor,
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function(context) {
                const val = context.raw || 0;
                return ` $${val.toFixed(2)}/mo (${context.label})`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  },

  renderCostProjection(canvasId, hourly, monthly, annual) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === 'undefined') return;

    if (this.projectionChart) {
      this.projectionChart.destroy();
      this.projectionChart = null;
    }

    const theme = this.getThemeColors();
    const daily = hourly * 24;

    this.projectionChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Hourly', 'Daily (24h)', 'Monthly (730h)', 'Annual (12m)'],
        datasets: [{
          label: 'Estimated Cost ($ USD)',
          data: [hourly, daily, monthly, annual],
          backgroundColor: [
            'rgba(0, 242, 254, 0.75)',
            'rgba(59, 130, 246, 0.75)',
            'rgba(139, 92, 246, 0.75)',
            'rgba(16, 185, 129, 0.75)'
          ],
          borderRadius: 8,
          borderWidth: 1,
          borderColor: theme.borderColor
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { family: 'Inter', size: 11 } }
          },
          y: {
            type: 'logarithmic',
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textColor,
              font: { family: 'JetBrains Mono', size: 10 },
              callback: function(val) {
                return '$' + val;
              }
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.borderColor,
            borderWidth: 1,
            callbacks: {
              label: function(ctx) {
                return ` Estimated: $${ctx.raw.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              }
            }
          }
        }
      }
    });
  },

  renderComparisonChart(canvasId, categoryComparisons) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === 'undefined') return;

    if (this.comparisonChart) {
      this.comparisonChart.destroy();
      this.comparisonChart = null;
    }

    const theme = this.getThemeColors();
    const labels = categoryComparisons.map(c => c.category_name);
    const dataA = categoryComparisons.map(c => c.config_a_monthly);
    const dataB = categoryComparisons.map(c => c.config_b_monthly);

    this.comparisonChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Config A (Baseline)',
            data: dataA,
            backgroundColor: 'rgba(239, 68, 68, 0.65)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'Config B (Optimized)',
            data: dataB,
            backgroundColor: 'rgba(16, 185, 129, 0.65)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { family: 'Inter', size: 10 } }
          },
          y: {
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textColor,
              font: { family: 'JetBrains Mono', size: 10 },
              callback: function(val) { return '$' + val; }
            }
          }
        },
        plugins: {
          legend: {
            labels: { color: theme.textColor, font: { family: 'Inter', size: 11, weight: '600' } }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.borderColor,
            borderWidth: 1,
            callbacks: {
              label: function(ctx) {
                return ` ${ctx.dataset.label}: $${ctx.raw.toFixed(2)}/mo`;
              }
            }
          }
        }
      }
    });
  }
};

window.AppCharts = AppCharts;
