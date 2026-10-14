/**
 * CloudCost IQ - Main Application Controller
 */
const App = {
  activeView: 'overview',
  theme: localStorage.getItem('cloudcost_theme') || 'dark',

  pricingData: null,
  categories: [],
  resources: [],

  // Active configurations in state
  estimatorItems: [],
  configAItems: [],
  configBItems: [],
  savedScenarios: [],

  // Current calculation results
  currentEstimate: null,
  currentComparison: null,
  currentOptimizations: null,

  async init() {
    this.applyTheme(this.theme);
    this.setupEventListeners();
    await this.loadPricingData();
    await this.loadScenarios();

    // Default to SaaS Web Stack template for immediate realistic initial load
    const defaultTemplate = window.ScenarioTemplates.getTemplate('template-saas-web');
    if (defaultTemplate) {
      this.estimatorItems = JSON.parse(JSON.stringify(defaultTemplate.items));
    }

    // Default Comparison configs: Heavy Baseline vs SaaS Web Stack
    const heavy = window.ScenarioTemplates.getTemplate('template-heavy-baseline');
    this.configAItems = heavy ? JSON.parse(JSON.stringify(heavy.items)) : [];
    this.configBItems = JSON.parse(JSON.stringify(this.estimatorItems));

    // Initial recalculation & render
    await this.recalculateAll();
    this.navigateTo('overview');
  },

  applyTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cloudcost_theme', theme);
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.innerHTML = theme === 'light'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    }
  },

  toggleTheme() {
    this.applyTheme(this.theme === 'light' ? 'dark' : 'light');
    // Refresh active charts with new theme colors
    this.renderCharts();
  },

  setupEventListeners() {
    // Navigation items
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = btn.getAttribute('data-view');
        if (view) this.navigateTo(view);
      });
    });

    // Mobile menu toggle
    const mobileToggle = document.getElementById('mobile-toggle');
    const sidebar = document.getElementById('sidebar');
    if (mobileToggle && sidebar) {
      mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Category filter in Pricing view
    const filterContainer = document.getElementById('pricing-category-filters');
    if (filterContainer) {
      filterContainer.addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;
        document.querySelectorAll('#pricing-category-filters .filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.filterPricingCatalog(pill.getAttribute('data-category'));
      });
    }

    // Search in Pricing view
    const pricingSearch = document.getElementById('pricing-search-input');
    if (pricingSearch) {
      pricingSearch.addEventListener('input', (e) => {
        this.searchPricingCatalog(e.target.value);
      });
    }

    // Add resource modal search & filters
    const modalSearch = document.getElementById('modal-resource-search');
    if (modalSearch) {
      modalSearch.addEventListener('input', (e) => {
        this.filterModalResources(e.target.value);
      });
    }
  },

  navigateTo(viewId) {
    this.activeView = viewId;

    // Update sidebar active class
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-view') === viewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Show corresponding view section
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const activeSec = document.getElementById(`view-${viewId}`);
    if (activeSec) {
      activeSec.classList.add('active');
    }

    // Close mobile sidebar if open
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');

    // Trigger view-specific rendering
    if (viewId === 'overview') {
      this.renderOverview();
    } else if (viewId === 'estimator') {
      this.renderEstimator();
    } else if (viewId === 'compare') {
      this.renderComparison();
    } else if (viewId === 'pricing') {
      this.renderPricingView();
    } else if (viewId === 'optimize') {
      this.renderOptimizations();
    } else if (viewId === 'reports') {
      this.renderReports();
    } else if (viewId === 'devops') {
      this.renderDevOpsStatus();
    }
  },

  async loadPricingData() {
    const data = await window.API.getPricing();
    if (data && data.resources) {
      this.pricingData = data;
      this.resources = data.resources;
      this.categories = data.categories || [];
      window.Calculator.initCatalog(this.resources);
    }
  },

  async loadScenarios() {
    const res = await window.API.getScenarios();
    if (res && res.scenarios) {
      this.savedScenarios = res.scenarios;
    }
  },

  async recalculateAll() {
    // 1. Calculate active estimator
    this.currentEstimate = await window.API.calculateEstimate({
      scenario_name: 'Current Infrastructure Estimate',
      items: this.estimatorItems,
      hours_per_month: 730
    });

    // 2. Calculate comparison
    this.currentComparison = await window.API.compareConfigs(
      { scenario_name: 'Configuration A (Baseline)', items: this.configAItems, hours_per_month: 730 },
      { scenario_name: 'Configuration B (Optimized)', items: this.configBItems, hours_per_month: 730 }
    );

    // 3. Calculate optimizations
    this.currentOptimizations = await window.API.getOptimizations({
      scenario_name: 'Optimization Run',
      items: this.estimatorItems,
      hours_per_month: 730
    });

    this.renderOverviewMetrics();
    this.renderCharts();
  },

  renderOverviewMetrics() {
    if (!this.currentEstimate) return;
    const est = this.currentEstimate;
    const opt = this.currentOptimizations;

    const elMonthly = document.getElementById('metric-total-monthly');
    const elHourly = document.getElementById('metric-total-hourly');
    const elAnnual = document.getElementById('metric-total-annual');
    const elSavings = document.getElementById('metric-potential-savings');
    const elCount = document.getElementById('metric-resource-count');
    const elTopCat = document.getElementById('metric-top-category');

    if (elMonthly) elMonthly.textContent = `$${est.total_monthly_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elHourly) elHourly.textContent = `$${est.total_hourly_cost.toFixed(4)}`;
    if (elAnnual) elAnnual.textContent = `$${est.total_annual_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elSavings) elSavings.textContent = `$${(opt ? opt.total_potential_savings : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elCount) elCount.textContent = est.resource_count;
    if (elTopCat) elTopCat.textContent = (est.most_expensive_category || 'N/A').replace(/_/g, ' ').toUpperCase();
  },

  renderCharts() {
    if (!this.currentEstimate) return;
    window.AppCharts.renderCostDistribution('chart-cost-distribution', this.currentEstimate.category_breakdown);
    window.AppCharts.renderCostProjection(
      'chart-cost-projection',
      this.currentEstimate.total_hourly_cost,
      this.currentEstimate.total_monthly_cost,
      this.currentEstimate.total_annual_cost
    );

    if (this.currentComparison) {
      window.AppCharts.renderComparisonChart('chart-comparison-categories', this.currentComparison.category_comparisons);
    }
  },

  renderOverview() {
    this.renderOverviewMetrics();
    this.renderCharts();
    this.renderRecentScenariosList();
  },

  renderRecentScenariosList() {
    const container = document.getElementById('overview-scenarios-list');
    if (!container) return;

    if (!this.savedScenarios || this.savedScenarios.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No saved scenarios yet. Build an estimate and save your infrastructure state.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Scenario Name</th>
              <th>Environment</th>
              <th>Resources</th>
              <th>Monthly Cost</th>
              <th>Annual Projection</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.savedScenarios.map(s => {
              const est = s.estimate;
              const monthly = est ? `$${est.total_monthly_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';
              const annual = est ? `$${est.total_annual_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';
              return `
                <tr>
                  <td>
                    <strong>${this.escapeHTML(s.name)}</strong>
                    <div style="font-size: 0.74rem; color: var(--text-muted);">${this.escapeHTML(s.description || '')}</div>
                  </td>
                  <td><span class="badge-status badge-identical">${this.escapeHTML(s.environment)}</span></td>
                  <td>${s.items ? s.items.length : 0} items</td>
                  <td class="cell-mono" style="color: var(--accent-cyan);">${monthly}</td>
                  <td class="cell-mono">${annual}</td>
                  <td>
                    <button class="btn btn-sm btn-secondary" onclick="App.loadScenarioIntoEstimator('${s.id}')">Load</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="App.deleteScenario('${s.id}')">Delete</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderEstimator() {
    const tableBody = document.getElementById('estimator-table-body');
    if (!tableBody) return;

    if (!this.currentEstimate || this.currentEstimate.items.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" class="empty-state">
            <h4>No resources configured in this estimate</h4>
            <p>Click "Add Resource" to select compute instances, databases, storage volumes, or networking components.</p>
            <button class="btn btn-primary" onclick="App.openAddResourceModal()">+ Add Your First Resource</button>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = this.currentEstimate.items.map((item, index) => {
      const providerClass = item.provider.toLowerCase().includes('aws') ? 'badge-aws' :
                           item.provider.toLowerCase().includes('gcp') ? 'badge-gcp' :
                           item.provider.toLowerCase().includes('azure') ? 'badge-azure' : 'badge-generic';
      return `
        <tr>
          <td>
            <strong>${this.escapeHTML(item.name)}</strong>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${item.resource_id}</div>
          </td>
          <td><span class="badge-provider ${providerClass}">${item.provider}</span></td>
          <td><span class="badge-status badge-identical">${item.category.replace(/_/g, ' ')}</span></td>
          <td class="cell-mono">$${item.unit_price.toFixed(4)} <span style="font-size:0.7rem; color:var(--text-muted);">/${item.billing_unit.replace('per_', '')}</span></td>
          <td style="width: 100px;">
            <input type="number" min="0" step="any" class="form-control form-control-sm" value="${item.quantity}" onchange="App.updateItemQuantity(${index}, this.value)" />
          </td>
          <td style="width: 150px;">
            <select class="form-control form-control-sm" onchange="App.updateItemHours(${index}, this.value)">
              <option value="730" ${item.usage_hours_per_month >= 700 ? 'selected' : ''}>Always-On (730h/mo)</option>
              <option value="174" ${item.usage_hours_per_month === 174 ? 'selected' : ''}>Business Hours (174h/mo)</option>
              <option value="160" ${item.usage_hours_per_month === 160 ? 'selected' : ''}>Dev Hours (160h/mo)</option>
              <option value="80" ${item.usage_hours_per_month === 80 ? 'selected' : ''}>Half-Time (80h/mo)</option>
            </select>
          </td>
          <td class="cell-mono">$${item.hourly_cost.toFixed(4)}</td>
          <td class="cell-mono" style="color: var(--accent-cyan); font-weight:700;">$${item.monthly_cost.toFixed(2)}</td>
          <td style="text-align: right;">
            <button class="btn btn-sm btn-secondary" title="Duplicate Resource" onclick="App.duplicateItem(${index})">⧉</button>
            <button class="btn btn-sm btn-outline-danger" title="Remove Resource" onclick="App.removeItem(${index})">✕</button>
          </td>
        </tr>
      `;
    }).join('');

    // Update bottom summary bar
    const sumMonthly = document.getElementById('estimator-summary-monthly');
    const sumAnnual = document.getElementById('estimator-summary-annual');
    if (sumMonthly) sumMonthly.textContent = `$${this.currentEstimate.total_monthly_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (sumAnnual) sumAnnual.textContent = `$${this.currentEstimate.total_annual_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  },

  updateItemQuantity(index, value) {
    const qty = Math.max(0, parseFloat(value) || 0);
    if (this.estimatorItems[index]) {
      this.estimatorItems[index].quantity = qty;
      this.recalculateAll().then(() => this.renderEstimator());
    }
  },

  updateItemHours(index, value) {
    const hrs = Math.max(0, Math.min(744, parseFloat(value) || 730));
    if (this.estimatorItems[index]) {
      this.estimatorItems[index].usage_hours_per_month = hrs;
      this.recalculateAll().then(() => this.renderEstimator());
    }
  },

  duplicateItem(index) {
    if (this.estimatorItems[index]) {
      const cloned = JSON.parse(JSON.stringify(this.estimatorItems[index]));
      cloned.custom_name = `${cloned.custom_name || cloned.resource_id} (Copy)`;
      this.estimatorItems.splice(index + 1, 0, cloned);
      this.recalculateAll().then(() => {
        this.renderEstimator();
        this.showToast('Resource duplicated', 'info');
      });
    }
  },

  removeItem(index) {
    if (this.estimatorItems[index]) {
      this.estimatorItems.splice(index, 1);
      this.recalculateAll().then(() => {
        this.renderEstimator();
        this.showToast('Resource removed', 'info');
      });
    }
  },

  clearAllEstimator() {
    if (confirm('Are you sure you want to clear all resources from this estimate?')) {
      this.estimatorItems = [];
      this.recalculateAll().then(() => {
        this.renderEstimator();
        this.showToast('Configuration reset', 'info');
      });
    }
  },

  renderComparison() {
    if (!this.currentComparison) return;
    const comp = this.currentComparison;

    // Header metrics
    const elSavings = document.getElementById('compare-monthly-savings');
    const elPct = document.getElementById('compare-pct-savings');
    const elA = document.getElementById('compare-total-a');
    const elB = document.getElementById('compare-total-b');
    const elRec = document.getElementById('compare-recommendation-text');
    const elTradeoffs = document.getElementById('compare-tradeoffs-text');

    if (elSavings) {
      elSavings.textContent = `$${Math.abs(comp.monthly_savings).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      elSavings.style.color = comp.monthly_savings >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
    }
    if (elPct) {
      elPct.textContent = `${comp.percentage_savings.toFixed(1)}% ${comp.monthly_savings >= 0 ? 'savings' : 'increase'}`;
    }
    if (elA) elA.textContent = `$${comp.config_a.total_monthly_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo`;
    if (elB) elB.textContent = `$${comp.config_b.total_monthly_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo`;
    if (elRec) elRec.textContent = comp.recommendation_summary;
    if (elTradeoffs) elTradeoffs.textContent = comp.tradeoffs_note;

    // Side-by-side Resource Diff Table
    const diffBody = document.getElementById('compare-diff-table-body');
    if (diffBody) {
      diffBody.innerHTML = comp.resource_diffs.map(d => {
        const statusBadge = d.status === 'cheaper_in_b' ? '<span class="badge-status badge-cheaper">Cheaper in B</span>' :
                            d.status === 'pricier_in_b' ? '<span class="badge-status badge-pricier">Pricier in B</span>' :
                            d.status === 'added_in_b' ? '<span class="badge-status badge-added">Added in B</span>' :
                            d.status === 'removed_in_b' ? '<span class="badge-status badge-removed">Removed in B</span>' :
                            '<span class="badge-status badge-identical">Identical</span>';

        const diffColor = d.monthly_difference < 0 ? 'var(--color-success)' : (d.monthly_difference > 0 ? 'var(--color-danger)' : 'var(--text-muted)');
        const diffPrefix = d.monthly_difference > 0 ? '+' : '';

        return `
          <tr>
            <td>
              <strong>${this.escapeHTML(d.name)}</strong>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${d.resource_id}</div>
            </td>
            <td><span class="badge-status badge-identical">${d.category.replace(/_/g, ' ')}</span></td>
            <td class="cell-mono">${d.config_a_qty} (${d.config_a_hours}h)</td>
            <td class="cell-mono">$${d.config_a_monthly.toFixed(2)}</td>
            <td class="cell-mono">${d.config_b_qty} (${d.config_b_hours}h)</td>
            <td class="cell-mono">$${d.config_b_monthly.toFixed(2)}</td>
            <td class="cell-mono" style="color: ${diffColor}; font-weight: 700;">${diffPrefix}$${d.monthly_difference.toFixed(2)}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      }).join('');
    }

    // Top Savings Drivers List
    const driversList = document.getElementById('compare-drivers-list');
    if (driversList) {
      if (comp.top_savings_drivers.length === 0) {
        driversList.innerHTML = '<p style="color:var(--text-muted);">No cost variance detected between configurations.</p>';
      } else {
        driversList.innerHTML = comp.top_savings_drivers.map(drv => `
          <div style="padding: 10px 14px; background: var(--bg-input); border-radius: var(--radius-md); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>${this.escapeHTML(drv.name)}</strong>
              <div style="font-size: 0.75rem; color: var(--text-secondary);">${drv.explanation}</div>
            </div>
            <div class="cell-mono" style="font-weight:700; color:${drv.monthly_difference < 0 ? 'var(--color-success)' : 'var(--color-danger)'};">
              ${drv.monthly_difference < 0 ? '-' : '+'}$${Math.abs(drv.monthly_difference).toFixed(2)}/mo
            </div>
          </div>
        `).join('');
      }
    }
  },

  renderOptimizations() {
    const container = document.getElementById('optimizations-list');
    if (!container) return;

    if (!this.currentOptimizations || this.currentOptimizations.recommendations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h4>No Optimization Issues Detected</h4>
          <p>Your current infrastructure configuration adheres to all active FinOps right-sizing and scheduling best practices.</p>
        </div>
      `;
      return;
    }

    const opt = this.currentOptimizations;
    const sumEl = document.getElementById('opt-total-savings-banner');
    if (sumEl) {
      sumEl.textContent = `$${opt.total_potential_savings.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }

    container.innerHTML = opt.recommendations.map(r => {
      const sevClass = `severity-${r.severity}`;
      return `
        <div class="rec-card ${sevClass}">
          <div class="rec-header">
            <div>
              <div class="rec-title">${this.escapeHTML(r.issue_detected)}</div>
              <span class="badge-status badge-${r.severity === 'high' ? 'pricier' : 'added'}" style="text-transform: uppercase;">${r.severity} Priority</span>
              <span class="badge-status badge-identical" style="margin-left:6px;">${r.category}</span>
            </div>
            <div class="rec-savings-badge">
              +$${r.estimated_monthly_savings.toFixed(2)}/mo
            </div>
          </div>
          <div class="rec-body">
            <p><strong>FinOps Reason:</strong> ${this.escapeHTML(r.reason)}</p>
            <div class="rec-action-box">
              <strong>Suggested Action:</strong> ${this.escapeHTML(r.suggested_action)}
            </div>
          </div>
          <div class="rec-meta">
            <div><strong>Assumptions:</strong> ${this.escapeHTML(r.calculation_assumptions)}</div>
            <div><strong>Confidence / Limitation:</strong> ${this.escapeHTML(r.confidence_note)}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderPricingView() {
    this.filterPricingCatalog(null);
  },

  filterPricingCatalog(category) {
    const list = category ? this.resources.filter(r => r.category === category) : this.resources;
    this.renderPricingTable(list);
  },

  searchPricingCatalog(query) {
    if (!query) {
      this.filterPricingCatalog(null);
      return;
    }
    const q = query.toLowerCase();
    const filtered = this.resources.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.provider.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q))
    );
    this.renderPricingTable(filtered);
  },

  renderPricingTable(items) {
    const tbody = document.getElementById('pricing-table-body');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><p>No resources found matching filter criteria.</p></td></tr>';
      return;
    }

    tbody.innerHTML = items.map(r => {
      const providerClass = r.provider.toLowerCase().includes('aws') ? 'badge-aws' :
                           r.provider.toLowerCase().includes('gcp') ? 'badge-gcp' :
                           r.provider.toLowerCase().includes('azure') ? 'badge-azure' : 'badge-generic';
      return `
        <tr>
          <td>
            <strong>${this.escapeHTML(r.name)}</strong>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${r.id}</div>
          </td>
          <td><span class="badge-provider ${providerClass}">${r.provider}</span></td>
          <td><span class="badge-status badge-identical">${r.category.replace(/_/g, ' ')}</span></td>
          <td class="cell-mono">$${r.unit_price.toFixed(4)} <span style="font-size:0.7rem; color:var(--text-muted);">/${r.billing_unit.replace('per_', '')}</span></td>
          <td><span style="font-size: 0.8rem; color: var(--text-secondary);">${this.escapeHTML(r.description || '')}</span></td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="App.addResourceToEstimator('${r.id}')">+ Add</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  renderReports() {
    const summaryCard = document.getElementById('reports-summary-preview');
    if (!summaryCard || !this.currentEstimate) return;

    const est = this.currentEstimate;
    summaryCard.innerHTML = `
      <div style="padding: 20px; background: var(--bg-card-solid); border: 1px solid var(--border-color); border-radius: var(--radius-lg);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:14px; margin-bottom:16px;">
          <div>
            <h3 style="font-size:1.25rem;">${this.escapeHTML(est.scenario_name)}</h3>
            <span style="font-size:0.75rem; color:var(--text-muted);">Generated on ${new Date().toLocaleString()} • Pricing Dataset v1.2.0 (Illustrative)</span>
          </div>
          <div style="text-align:right;">
            <div style="font-size:1.6rem; font-weight:800; color:var(--accent-cyan);" class="cell-mono">$${est.total_monthly_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">$${est.total_annual_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}/year projection</div>
          </div>
        </div>

        <h4 style="font-size:0.95rem; margin-bottom:10px;">Category Breakdown</h4>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:20px;">
          ${Object.entries(est.category_breakdown).map(([cat, cost]) => `
            <div style="background:var(--bg-input); padding:10px 14px; border-radius:var(--radius-md);">
              <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">${cat.replace(/_/g, ' ')}</div>
              <div class="cell-mono" style="font-weight:700; color:var(--text-primary);">$${cost.toFixed(2)}/mo</div>
            </div>
          `).join('')}
        </div>

        <h4 style="font-size:0.95rem; margin-bottom:10px;">Itemized Resource Manifest (${est.resource_count} items)</h4>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Category</th>
                <th>Unit Rate</th>
                <th>Quantity</th>
                <th>Usage</th>
                <th>Monthly</th>
                <th>Annual</th>
              </tr>
            </thead>
            <tbody>
              ${est.items.map(item => `
                <tr>
                  <td><strong>${this.escapeHTML(item.name)}</strong></td>
                  <td>${item.category}</td>
                  <td class="cell-mono">$${item.unit_price.toFixed(4)}</td>
                  <td>${item.quantity}</td>
                  <td>${item.usage_hours_per_month}h</td>
                  <td class="cell-mono" style="color:var(--accent-cyan);">$${item.monthly_cost.toFixed(2)}</td>
                  <td class="cell-mono">$${item.annual_cost.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async renderDevOpsStatus() {
    const health = await window.API.checkHealth();
    const sys = await window.API.getSystemInfo();

    const statusBadge = document.getElementById('devops-api-status-badge');
    const dbStatus = document.getElementById('devops-db-status');
    const uptime = document.getElementById('devops-uptime');
    const catalogCount = document.getElementById('devops-catalog-count');

    if (statusBadge) {
      statusBadge.textContent = (health.status || 'Active').toUpperCase();
      statusBadge.className = `badge-status ${health.status === 'healthy' ? 'badge-cheaper' : 'badge-pricier'}`;
    }
    if (dbStatus) dbStatus.textContent = health.database || 'Connected (SQLite persistent)';
    if (uptime) uptime.textContent = health.uptime_seconds ? `${health.uptime_seconds}s` : 'Active';
    if (catalogCount) catalogCount.textContent = `${this.resources.length} verified illustrative items`;

    const sysBox = document.getElementById('devops-sysinfo-content');
    if (sysBox && sys) {
      sysBox.innerHTML = `
        <div style="font-family: var(--font-mono); font-size: 0.82rem; background: var(--bg-input); padding: 16px; border-radius: var(--radius-md); line-height: 1.8;">
          <div><strong>App:</strong> ${sys.app_name}</div>
          <div><strong>Environment:</strong> ${sys.environment}</div>
          <div><strong>Python Runtime:</strong> ${sys.runtime.python_version} (${sys.runtime.os} ${sys.runtime.architecture})</div>
          <div><strong>Web Server:</strong> ${sys.deployment.web_server}</div>
          <div><strong>App Server:</strong> ${sys.deployment.app_server}</div>
          <div><strong>Deployment Target:</strong> ${sys.deployment.orchestration_target}</div>
        </div>
      `;
    }
  },

  // Modal Handlers
  openAddResourceModal() {
    const modal = document.getElementById('modal-add-resource');
    if (modal) {
      modal.classList.add('active');
      this.filterModalResources('');
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  filterModalResources(query) {
    const list = document.getElementById('modal-resource-catalog-list');
    if (!list) return;

    const q = (query || '').toLowerCase();
    const filtered = this.resources.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q)
    );

    list.innerHTML = filtered.map(r => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--border-color); background:var(--bg-input); margin-bottom:8px; border-radius:var(--radius-md);">
        <div>
          <strong>${this.escapeHTML(r.name)}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${r.category} • $${r.unit_price.toFixed(4)}/${r.billing_unit.replace('per_', '')}</div>
        </div>
        <button class="btn btn-sm btn-primary" onclick="App.addResourceToEstimator('${r.id}'); App.closeModal('modal-add-resource');">+ Add to Stack</button>
      </div>
    `).join('');
  },

  addResourceToEstimator(resourceId) {
    const res = this.resources.find(r => r.id === resourceId);
    if (!res) return;

    this.estimatorItems.push({
      resource_id: resourceId,
      custom_name: res.name,
      quantity: 1.0,
      usage_hours_per_month: 730.0
    });

    this.recalculateAll().then(() => {
      this.showToast(`Added '${res.name}' to estimate`, 'success');
      if (this.activeView === 'estimator') this.renderEstimator();
    });
  },

  openSaveScenarioModal() {
    const modal = document.getElementById('modal-save-scenario');
    if (modal) modal.classList.add('active');
  },

  async handleSaveScenarioSubmit(e) {
    e.preventDefault();
    const nameInput = document.getElementById('save-scenario-name');
    const envInput = document.getElementById('save-scenario-env');
    const descInput = document.getElementById('save-scenario-desc');

    if (!nameInput || !nameInput.value.trim()) {
      this.showToast('Please provide a scenario name', 'error');
      return;
    }

    const scenarioData = {
      name: nameInput.value.trim(),
      environment: envInput ? envInput.value : 'Production',
      description: descInput ? descInput.value.trim() : '',
      items: this.estimatorItems
    };

    const saved = await window.API.saveScenario(scenarioData);
    if (saved) {
      this.showToast(`Scenario '${saved.name}' saved to SQLite database`, 'success');
      this.closeModal('modal-save-scenario');
      await this.loadScenarios();
      if (this.activeView === 'overview') this.renderRecentScenariosList();
    } else {
      this.showToast('Failed to persist scenario', 'error');
    }
  },

  async loadScenarioIntoEstimator(scenarioId) {
    const s = this.savedScenarios.find(item => item.id === scenarioId);
    if (s && s.items) {
      this.estimatorItems = JSON.parse(JSON.stringify(s.items));
      await this.recalculateAll();
      this.navigateTo('estimator');
      this.showToast(`Loaded scenario '${s.name}' into Estimator`, 'info');
    }
  },

  async deleteScenario(scenarioId) {
    if (confirm('Delete this saved scenario from the database?')) {
      const res = await window.API.deleteScenario(scenarioId);
      if (res && res.success) {
        this.showToast('Scenario deleted', 'info');
        await this.loadScenarios();
        this.renderRecentScenariosList();
      }
    }
  },

  openLoadTemplateModal() {
    const modal = document.getElementById('modal-load-template');
    if (modal) {
      const container = document.getElementById('modal-templates-container');
      if (container) {
        container.innerHTML = window.ScenarioTemplates.templates.map(t => `
          <div style="background:var(--bg-input); padding:16px; border-radius:var(--radius-md); margin-bottom:12px; border:1px solid var(--border-color);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
              <div>
                <strong>${this.escapeHTML(t.name)}</strong>
                <span class="badge-status badge-identical" style="margin-left:8px;">${t.environment}</span>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-sm btn-secondary" onclick="App.applyTemplate('${t.id}', 'estimator')">Load in Estimator</button>
                <button class="btn btn-sm btn-secondary" onclick="App.applyTemplate('${t.id}', 'config_a')">Set as Config A</button>
                <button class="btn btn-sm btn-secondary" onclick="App.applyTemplate('${t.id}', 'config_b')">Set as Config B</button>
              </div>
            </div>
            <p style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:6px;">${this.escapeHTML(t.description)}</p>
            <div style="font-size:0.75rem; color:var(--text-muted);">${t.items.length} billable infrastructure components</div>
          </div>
        `).join('');
      }
      modal.classList.add('active');
    }
  },

  applyTemplate(templateId, target) {
    const tmpl = window.ScenarioTemplates.getTemplate(templateId);
    if (!tmpl) return;

    if (target === 'estimator') {
      this.estimatorItems = JSON.parse(JSON.stringify(tmpl.items));
      this.recalculateAll().then(() => {
        this.closeModal('modal-load-template');
        this.navigateTo('estimator');
        this.showToast(`Loaded '${tmpl.name}' into Estimator`, 'success');
      });
    } else if (target === 'config_a') {
      this.configAItems = JSON.parse(JSON.stringify(tmpl.items));
      this.recalculateAll().then(() => {
        this.closeModal('modal-load-template');
        this.navigateTo('compare');
        this.showToast(`Set Config A to '${tmpl.name}'`, 'info');
      });
    } else if (target === 'config_b') {
      this.configBItems = JSON.parse(JSON.stringify(tmpl.items));
      this.recalculateAll().then(() => {
        this.closeModal('modal-load-template');
        this.navigateTo('compare');
        this.showToast(`Set Config B to '${tmpl.name}'`, 'info');
      });
    }
  },

  exportJSON() {
    if (this.currentEstimate) {
      window.ExportService.downloadJSON(this.currentEstimate, `${this.currentEstimate.scenario_name.toLowerCase().replace(/\s+/g, '-')}.json`);
      this.showToast('JSON scenario configuration exported', 'success');
    }
  },

  exportCSV() {
    if (this.currentEstimate) {
      window.ExportService.downloadCSV(this.currentEstimate, 'cloudcost-iq-breakdown.csv');
      this.showToast('CSV cost breakdown exported', 'success');
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${this.escapeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
