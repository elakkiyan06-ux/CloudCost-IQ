/**
 * CloudCost IQ - REST API Client
 */
const API = {
  baseUrl: window.location.origin.includes('http') ? '' : 'http://localhost:8000',

  async checkHealth() {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`);
      if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('API health check error, running in local fallback mode:', err);
      return { status: 'fallback', app: 'CloudCost IQ (Local Fallback)' };
    }
  },

  async getPricing(category = null) {
    try {
      const url = category ? `${this.baseUrl}/api/pricing?category=${encodeURIComponent(category)}` : `${this.baseUrl}/api/pricing`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch pricing: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Failed to load pricing from API, using fallback catalog:', err);
      return null;
    }
  },

  async calculateEstimate(payload) {
    try {
      const res = await fetch(`${this.baseUrl}/api/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || `Estimate failed: ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.warn('API estimate failed, falling back to client-side calculator:', err);
      return window.Calculator ? window.Calculator.calculateEstimate(payload) : null;
    }
  },

  async compareConfigs(configA, configB) {
    try {
      const res = await fetch(`${this.baseUrl}/api/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_a: configA, config_b: configB })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || `Comparison failed: ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.warn('API compare failed, falling back to client-side calculator:', err);
      return window.Calculator ? window.Calculator.compare(configA, configB) : null;
    }
  },

  async getOptimizations(payload) {
    try {
      const res = await fetch(`${this.baseUrl}/api/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Optimization failed: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('API optimize failed, falling back to client heuristics:', err);
      return window.Calculator ? window.Calculator.optimize(payload) : null;
    }
  },

  async getScenarios() {
    try {
      const res = await fetch(`${this.baseUrl}/api/scenarios`);
      if (!res.ok) throw new Error(`Failed to list scenarios: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('API list scenarios failed:', err);
      return { count: 0, scenarios: [] };
    }
  },

  async saveScenario(scenarioData) {
    try {
      const res = await fetch(`${this.baseUrl}/api/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenarioData)
      });
      if (!res.ok) throw new Error(`Failed to save scenario: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('API save scenario failed:', err);
      return null;
    }
  },

  async deleteScenario(scenarioId) {
    try {
      const res = await fetch(`${this.baseUrl}/api/scenarios/${encodeURIComponent(scenarioId)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error(`Failed to delete scenario: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('API delete scenario failed:', err);
      return null;
    }
  },

  async getSystemInfo() {
    try {
      const res = await fetch(`${this.baseUrl}/api/system/info`);
      if (!res.ok) throw new Error(`Failed to get system info: ${res.status}`);
      return await res.json();
    } catch (err) {
      return null;
    }
  }
};

window.API = API;
