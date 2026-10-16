/**
 * API client module for PulseBox Cyber Desk simulator.
 * Communicates with the local Flask backend at http://127.0.0.1:5000.
 */

const API_BASE = "http://127.0.0.1:5000";
const REQUEST_TIMEOUT_MS = 2500;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * GET /health
 * Verifies backend connectivity and retrieves service health.
 */
export async function getHealth() {
  const res = await fetchWithTimeout(`${API_BASE}/health`, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return await res.json();
}

/**
 * GET /state
 * Retrieves current simulated cluster state, overall health, and node telemetry.
 */
export async function getState() {
  const res = await fetchWithTimeout(`${API_BASE}/state`, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Failed to fetch state: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * POST /simulate-failure
 * Simulates a server failure on a specific node or auto-selects the first online node.
 */
export async function simulateFailure(serverId = null) {
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  };
  if (serverId) {
    options.body = JSON.stringify({ server_id: serverId });
  }

  const res = await fetchWithTimeout(`${API_BASE}/simulate-failure`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Failed to inject failure: HTTP ${res.status}`);
  }
  return data;
}

/**
 * POST /restore
 * Restores simulated servers to healthy online status.
 * If serverId is provided, restores that specific server. If null, restores all 6 servers.
 */
export async function restoreServer(serverId = null) {
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  };
  if (serverId) {
    options.body = JSON.stringify({ server_id: serverId });
  }

  const res = await fetchWithTimeout(`${API_BASE}/restore`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Failed to restore server: HTTP ${res.status}`);
  }
  return data;
}

/**
 * GET /incidents
 * Retrieves in-memory incident history from backend (newest first).
 */
export async function getIncidents() {
  const res = await fetchWithTimeout(`${API_BASE}/incidents`, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Failed to fetch incidents: HTTP ${res.status}`);
  }
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.incidents)) return data.incidents;
  return [];
}

/**
 * GET /costs
 * Retrieves current cloud cost summary, daily trend, budget status, and simulation metadata.
 */
export async function getCosts() {
  const res = await fetchWithTimeout(`${API_BASE}/costs`, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Failed to fetch cloud costs: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * GET /costs/settings
 * Retrieves cloud budget configuration.
 */
export async function getCostSettings() {
  const res = await fetchWithTimeout(`${API_BASE}/costs/settings`, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Failed to fetch cost settings: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * POST /costs/settings
 * Updates monthly cloud budget.
 * @param {number|string} monthlyBudget - New positive numeric budget
 */
export async function updateCostBudget(monthlyBudget) {
  const res = await fetchWithTimeout(`${API_BASE}/costs/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ monthly_budget: monthlyBudget }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Failed to update budget: HTTP ${res.status}`);
  }
  return data;
}

/**
 * GET /weather
 * Retrieves simulated weather telemetry, conditions, humidity, and wind.
 */
export async function getWeather() {
  const res = await fetchWithTimeout(`${API_BASE}/weather`, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Failed to fetch weather: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * POST /reset
 * Resets simulated cluster, clears incident history, restores default cost budget,
 * and resets weather provider.
 */
export async function resetBackend() {
  const res = await fetchWithTimeout(`${API_BASE}/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Failed to reset backend: HTTP ${res.status}`);
  }
  return data;
}

/**
 * POST /record-health-check
 * Records an individual health-check result for a simulated server.
 * Used to test consecutive-failure thresholds without waiting for real infrastructure.
 * @param {string} serverId - Server ID (e.g. "srv-api")
 * @param {"failed"|"online"} [status="failed"] - Health check outcome
 */
export async function recordHealthCheck(serverId, status = "failed") {
  const res = await fetchWithTimeout(`${API_BASE}/record-health-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ server_id: serverId, status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Failed to record health check: HTTP ${res.status}`);
  }
  return data;
}


