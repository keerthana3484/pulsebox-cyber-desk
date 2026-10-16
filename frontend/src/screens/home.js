// Screen 1: HOME — Real-time telemetry linked to Flask backend API

export function renderHomeScreen(container, state, appActions) {
  let isChecking = false;

  function formatUptime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  }

  function render() {
    const isConnected = state.backendConnected === true;
    const isOffline = state.backendConnected === false;

    // Use backend response as single source of truth for cluster state
    const overallHealth = isConnected ? state.system.overallHealth : "OFFLINE";
    const serverCount = isConnected ? (state.system.serverCount ?? state.servers.length) : "--";
    const failedCount = isConnected ? (state.system.failedServerCount ?? 0) : "--";
    const onlineCount = isConnected ? (state.system.onlineServerCount ?? 0) : "--";
    const avgLatency = isConnected ? `${state.system.averageLatencyMs ?? 0}ms` : "-- ms";

    const healthColorClass = isOffline
      ? "red"
      : overallHealth === "NOMINAL"
      ? "green"
      : overallHealth === "DEGRADED"
      ? "amber"
      : "red";

    const uptimeStr = formatUptime(state.system.uptimeSeconds);
    const heapKb = Math.round(state.system.freeHeapBytes / 1024);

    const displayMsg = isOffline
      ? "BACKEND OFFLINE: Unable to reach Flask API @ 127.0.0.1:5000. Retrying..."
      : state.system.lastEvent || "All subsystems nominal. Cluster synchronized with Flask API.";

    container.innerHTML = `
      <div class="screen-content screen-home-minimal">
        <!-- Top Status Strip -->
        <div class="minimal-strip">
          <div class="status-indicator-group">
            <span class="status-dot ${healthColorClass}"></span>
            <span class="strip-title ${isOffline ? 'red-text' : ''}">
              ${isOffline ? 'BACKEND OFFLINE' : `SYS ${overallHealth}`}
            </span>
          </div>
          <span class="strip-meta">UP: ${uptimeStr}</span>
          <span class="strip-meta highlight">${state.system.coreTempC}°C</span>
          <span class="strip-meta">${state.system.batteryVoltage}V</span>
        </div>

        <div class="thin-separator"></div>

        <!-- 2x2 Dense Telemetry Grid (Driven by API) -->
        <div class="home-metrics-grid">
          <div class="metric-cell">
            <span class="cell-label">SERVICES (SIMULATED)</span>
            <div class="cell-value-row">
              <span class="cell-val ${healthColorClass}">${onlineCount}/${serverCount}</span>
              <span class="cell-sub">
                ${isOffline ? 'DISCONNECTED' : failedCount > 0 ? `${failedCount} FAILED` : 'ALL NOMINAL'}
              </span>
            </div>
          </div>

          <div class="metric-cell">
            <span class="cell-label">AVG LATENCY</span>
            <div class="cell-value-row">
              <span class="cell-val ${!isOffline && parseFloat(avgLatency) > 50 ? 'amber' : 'highlight'}">
                ${avgLatency}
              </span>
              <span class="cell-sub">${isOffline ? 'NO SYNC' : 'API SYNCED'}</span>
            </div>
          </div>

          <div class="metric-cell">
            <span class="cell-label">FREE HEAP</span>
            <div class="cell-value-row">
              <span class="cell-val">${heapKb}K</span>
              <span class="cell-sub">/ 328K (66%)</span>
            </div>
          </div>

          <div class="metric-cell">
            <span class="cell-label">LINK / RSSI</span>
            <div class="cell-value-row">
              <span class="cell-val">${state.system.wifiRssi}dBm</span>
              <span class="cell-sub">${state.system.wifiSsid}</span>
            </div>
          </div>
        </div>

        <div class="thin-separator"></div>

        <!-- System Message Box -->
        <div class="sys-msg-row ${isOffline ? 'offline-banner' : ''}">
          <span class="msg-prefix">${isOffline ? '[ERR]' : '[SYS]'}</span>
          <span class="msg-body" id="home-sys-msg">${displayMsg}</span>
        </div>

        <!-- Bottom Touch Actions -->
        <div class="home-actions-row">
          <button class="cyber-btn sm" id="btn-run-diag" ${isChecking ? 'disabled' : ''}>
            <span class="btn-icon">⚡</span> ${isChecking ? 'TESTING...' : 'DIAGNOSTICS'}
          </button>
          <button class="cyber-btn sm secondary" id="btn-quick-ping" ${isChecking ? 'disabled' : ''}>
            <span class="btn-icon">📡</span> SYNC / PING
          </button>
        </div>
      </div>
    `;

    // Bind Diagnostics button: runs health check against Flask API
    const diagBtn = container.querySelector("#btn-run-diag");
    if (diagBtn) {
      diagBtn.addEventListener("click", async () => {
        appActions.playClick();
        isChecking = true;
        render();

        try {
          const t0 = performance.now();
          const health = await appActions.api.getHealth();
          const rtt = Math.round(performance.now() - t0);
          state.system.lastEvent = `Diagnostics PASS: Backend v${health.version} online (RTT: ${rtt}ms)`;
          appActions.playSuccess();
          appActions.logSerial(`[SYS_DIAG] Flask API healthy. Uptime: ${health.uptime_seconds}s (RTT: ${rtt}ms)`);
        } catch (err) {
          state.system.lastEvent = `Diagnostics FAIL: ${err.message}`;
          appActions.playAlert();
          appActions.logSerial(`[SYS_DIAG_ERR] ${err.message}`);
        } finally {
          isChecking = false;
          render();
        }
      });
    }

    // Bind Ping button: forces immediate refresh of state from Flask API
    const pingBtn = container.querySelector("#btn-quick-ping");
    if (pingBtn) {
      pingBtn.addEventListener("click", async () => {
        appActions.playClick();
        isChecking = true;
        render();

        try {
          const t0 = performance.now();
          await appActions.refreshBackendState();
          const rtt = Math.round(performance.now() - t0);
          state.system.lastEvent = `Sync complete: Cluster state refreshed (RTT: ${rtt}ms)`;
          appActions.playBeep(980, 0.05);
          appActions.logSerial(`[NET_SYNC] Synced state from Flask API in ${rtt}ms`);
        } catch (err) {
          state.system.lastEvent = `Sync FAIL: ${err.message}`;
          appActions.playAlert();
          appActions.logSerial(`[NET_SYNC_ERR] ${err.message}`);
        } finally {
          isChecking = false;
          render();
        }
      });
    }
  }

  // Initial render
  render();

  // Subscribe to live backend polling state changes
  const unsubscribe = appActions.onStateChange(() => {
    render();
  });

  return () => {
    if (typeof unsubscribe === "function") unsubscribe();
  };
}
