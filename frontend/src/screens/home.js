// Screen 1: HOME — System status and telemetry linked to Flask API
// Follows docs/UI_RULES.md: 1 hero element, max 3 text elements, <= 12 words on overview,
// tap-through detail view with [< BACK] button.

import {
  getPulseBotMascotSvg,
  getItemIconSvg,
  buildVoxelButton,
} from "../voxelComponents.js";

export function renderHomeScreen(container, state, appActions, options = {}) {
  let isChecking = false;
  let showDetail = options.initialShowDetail ?? false;

  function formatUptime(seconds) {
    if (!seconds && seconds !== 0) return "--";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}H ${mins}M`;
  }

  function render() {
    const isConnected = state.backendConnected === true;
    const isOffline = state.backendConnected === false;

    // Backend response as single source of truth
    const overallHealth = isConnected ? state.system.overallHealth : "OFFLINE";
    const serverCount = isConnected ? (state.system.serverCount ?? state.servers.length) : 6;
    const failedCount = isConnected ? (state.system.failedServerCount ?? 0) : 0;
    const onlineCount = isConnected ? (state.system.onlineServerCount ?? serverCount) : 0;
    const avgLatency = isConnected ? `${state.system.averageLatencyMs ?? 0}ms` : "-- ms";
    const isNominal = !isOffline && overallHealth === "NOMINAL" && failedCount === 0;

    const uptimeStr = formatUptime(state.system.uptimeSeconds);
    const heapKb = Math.round((state.system.freeHeapBytes || 221184) / 1024);

    const mascotExp = state.mascotMood || (isNominal ? "happy" : "worried");
    const mascotSvg = getPulseBotMascotSvg(mascotExp, 48);
    const shieldSvg = getItemIconSvg(isNominal ? "shield" : "battery", 36);

    const displayMsg = isOffline
      ? "BACKEND OFFLINE: Unable to reach Flask API @ 127.0.0.1:5000. Retrying..."
      : state.system.lastEvent || "All subsystems nominal. Cluster synchronized with Flask API.";

    container.innerHTML = `
      <div class="screen-voxel-wrapper screen-content screen-home-minimal">
        <!-- 1. HERO OVERVIEW VIEW (Strict 1-Second Glanceable, <= 3 text elements, <= 12 words) -->
        <div class="screen-hero-view ${showDetail ? 'is-hidden' : ''}" id="hero-overview-stage">
          <div class="voxel-hero-visual">
            ${mascotSvg}
            <div style="display: flex; align-items: center; justify-content: center;">
              ${shieldSvg}
            </div>
          </div>

          <div class="voxel-hero-metric ${isNominal ? 'status-nominal' : isOffline ? 'status-alert' : 'status-warning'}" id="home-hero-metric">
            ${isOffline ? 'SYS OFFLINE' : isNominal ? 'SYS NOMINAL' : 'SYS DEGRADED'}
          </div>

          <div class="voxel-hero-actions">
            <button class="voxel-btn ${isNominal ? 'variant-secondary' : 'variant-danger'} voxel-tap-arrow-btn" id="btn-home-detail" aria-label="Details">
              ▶
            </button>
          </div>
        </div>

        <!-- 2. TAP-THROUGH DETAIL VIEW (2x2 Telemetry Grid & Diagnostic Controls) -->
        <div class="screen-detail-view ${showDetail ? 'is-active' : ''}">
          <!-- Navigation Back Row -->
          <div class="voxel-detail-nav-row">
            <button class="voxel-btn variant-secondary voxel-back-btn" id="btn-back-overview">
              ◀ BACK
            </button>
            <span class="voxel-detail-title">SYSTEM TELEMETRY</span>
            <span class="sim-tag-mini">UP ${uptimeStr}</span>
          </div>

          <!-- 2x2 Telemetry Grid -->
          <div class="home-metrics-grid" style="margin-bottom: 4px;">
            <div class="metric-cell">
              <span class="cell-label">SERVICES</span>
              <div class="cell-value-row">
                <span class="cell-val ${isNominal ? 'green' : 'red'}">${onlineCount}/${serverCount}</span>
                <span class="cell-sub">${isOffline ? 'OFFLINE' : failedCount > 0 ? `${failedCount} FAILED` : 'NOMINAL'}</span>
              </div>
            </div>

            <div class="metric-cell">
              <span class="cell-label">AVG LATENCY</span>
              <div class="cell-value-row">
                <span class="cell-val highlight">${avgLatency}</span>
                <span class="cell-sub">${isOffline ? 'NO SYNC' : 'API SYNCED'}</span>
              </div>
            </div>

            <div class="metric-cell">
              <span class="cell-label">FREE HEAP</span>
              <div class="cell-value-row">
                <span class="cell-val">${heapKb}K</span>
                <span class="cell-sub">/ 328K</span>
              </div>
            </div>

            <div class="metric-cell">
              <span class="cell-label">LINK / RSSI</span>
              <div class="cell-value-row">
                <span class="cell-val">${state.system.wifiRssi || -48}dBm</span>
                <span class="cell-sub">${state.system.wifiSsid || 'PulseNet-5G'}</span>
              </div>
            </div>
          </div>

          <!-- System Message Box -->
          <div class="sys-msg-row ${isOffline ? 'offline-banner' : ''}" style="margin-bottom: 4px;">
            <span class="msg-prefix">${isOffline ? '[ERR]' : '[SYS]'}</span>
            <span class="msg-body" id="home-sys-msg">${displayMsg}</span>
          </div>

          <!-- Bottom Diagnostic Touch Controls -->
          <div class="home-actions-row" style="display:flex; gap:6px;">
            <button class="voxel-btn variant-primary xs" id="btn-run-diag" ${isChecking ? 'disabled' : ''} style="flex:1;">
              ⚡ ${isChecking ? 'TESTING...' : 'DIAGNOSTICS'}
            </button>
            <button class="voxel-btn variant-secondary xs" id="btn-quick-ping" ${isChecking ? 'disabled' : ''} style="flex:1;">
              📡 SYNC / PING
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind event handlers
    const detailBtn = container.querySelector("#btn-home-detail");
    if (detailBtn) {
      detailBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        showDetail = true;
        render();
      });
    }

    const backBtn = container.querySelector("#btn-back-overview");
    if (backBtn) {
      backBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        showDetail = false;
        render();
      });
    }

    const diagBtn = container.querySelector("#btn-run-diag");
    if (diagBtn) {
      diagBtn.addEventListener("click", async (e) => {
        e?.stopPropagation?.();
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

    const pingBtn = container.querySelector("#btn-quick-ping");
    if (pingBtn) {
      pingBtn.addEventListener("click", async (e) => {
        e?.stopPropagation?.();
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
