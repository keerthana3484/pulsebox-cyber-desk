import { isBrowserEnvironment } from "../api.js";
import {
  buildHeartBar,
  getPulseBotMascotSvg,
  buildVoxelButton,
} from "../voxelComponents.js";

// Screen 2: SERVERS — Cluster health connected to Flask API (FAIL & RESTORE controls)
// Follows docs/UI_RULES.md: 1 hero element, max 3 text elements, <= 12 words on overview,
// tap-through detail view with [< BACK] button.

export function renderServersScreen(container, state, appActions, options = {}) {
  let selectedServerId = state.servers?.[0]?.id || "srv-api";
  let isProcessing = false;
  let actionNotice = "";
  let noticeTimeout = null;
  let showDetail = options.initialShowDetail ?? false;
  const isBrowser = isBrowserEnvironment();

  function setNotice(msg, isError = false) {
    actionNotice = msg;
    if (noticeTimeout) clearTimeout(noticeTimeout);
    noticeTimeout = setTimeout(() => {
      actionNotice = "";
      render();
    }, 4000);
  }

  function render() {
    const isOffline = state.backendConnected === false;
    const serverList = state.servers || [];
    const totalCount = serverList.length || 6;
    const failedNodes = serverList.filter(s => s.status === "failed");
    const failedCount = failedNodes.length;
    const healthyCount = totalCount - failedCount;
    const isClusterHealthy = failedCount === 0 && !isOffline;

    const selected = serverList.find(s => s.id === selectedServerId) || serverList[0] || {
      id: "srv-api",
      name: "API Gateway",
      status: "unknown",
      latencyMs: 0,
      role: "Public Ingress",
      history: [0]
    };

    const isFailed = selected.status === "failed";
    const statusText = isOffline ? "NO SYNC" : selected.status.toUpperCase();
    const statusColor = isOffline ? "red" : isFailed ? "red" : "green";

    // Voxel health points (10 max, scaled from 6 nodes)
    const hp = isOffline ? 0 : Math.round((healthyCount / totalCount) * 10);
    const mascotExpression = state.mascotMood || (isOffline ? "worried" : (failedCount > 0 ? "worried" : "happy"));
    const mascotSvg = getPulseBotMascotSvg(mascotExpression, 48);
    const heartBarHtml = buildHeartBar({ current: hp, max: 10 });

    const heroMetricText = isOffline ? "NO SYNC" : `${healthyCount}/${totalCount} ONLINE`;
    const heroStatusText = isOffline ? "BACKEND OFFLINE" : (failedCount > 0 ? `${failedCount} DOWN` : "ALL NOMINAL");

    container.innerHTML = `
      <div class="screen-voxel-wrapper screen-content screen-servers-minimal">
        <!-- 1. HERO OVERVIEW VIEW (Strict 1-Second Glanceable, <= 3 text elements, <= 12 words) -->
        <div class="screen-hero-view ${showDetail ? 'is-hidden' : ''}" id="hero-overview-stage">
          <div class="voxel-hero-visual">
            ${mascotSvg}
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
              ${heartBarHtml}
            </div>
          </div>
          <div class="voxel-hero-metric ${isClusterHealthy ? 'status-nominal' : 'status-alert'}">
            ${heroMetricText}
          </div>
          <div class="voxel-hero-actions">
            <button class="voxel-btn ${failedCount > 0 ? 'variant-danger' : 'variant-secondary'} voxel-tap-arrow-btn" id="btn-cluster-detail" aria-label="Details">
              ▶
            </button>
          </div>
        </div>

        <!-- 2. TAP-THROUGH DETAIL VIEW (Split-View Inspector) -->
        <div class="screen-detail-view ${showDetail ? 'is-active' : ''}">
          <div class="voxel-detail-nav-row">
            <button class="voxel-btn variant-secondary voxel-back-btn" id="btn-back-overview">
              ◀ BACK
            </button>
            <span class="voxel-detail-title">NODE TELEMETRY</span>
            <span class="sim-tag-mini">${heroStatusText}</span>
          </div>

          <div class="servers-split-view">
            <!-- Left: Node Selector -->
            <div class="server-list-col">
              <div class="server-rows-wrap">
                ${serverList.map(srv => {
                  const isSelected = srv.id === selectedServerId;
                  const nodeFailed = srv.status === "failed";
                  const dotColor = isOffline ? "amber" : nodeFailed ? "red" : "green";
                  return `
                    <div class="server-row-item ${isSelected ? 'selected' : ''}" data-id="${srv.id}">
                      <span class="status-dot ${dotColor}"></span>
                      <span class="srv-row-name">${srv.name}</span>
                      <span class="srv-row-lat ${nodeFailed ? 'amber' : ''}">${isOffline ? '--' : `${srv.latencyMs}ms`}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Vertical Divider -->
            <div class="vertical-separator"></div>

            <!-- Right: Selected Node Telemetry & API Controls -->
            <div class="server-detail-col">
              <div class="node-header">
                <span class="node-title">${selected.name}</span>
                <span class="node-badge ${statusColor}">${statusText}</span>
              </div>

              <div class="node-stats-line">
                <span>ID: <strong class="accent">${selected.id}</strong></span>
                <span>LAT: <strong class="highlight">${isOffline ? '--' : `${selected.latencyMs}ms`}</strong></span>
              </div>
              <div class="node-stats-line">
                <span>ROLE: ${(selected.role || '').split('/')[0].trim()}</span>
                <span>STATE: <strong class="${statusColor}">${selected.status}</strong></span>
              </div>

              <!-- Action Status Banner -->
              <div class="action-notice-line ${actionNotice ? 'active' : ''}">
                ${actionNotice || (isOffline ? '[ERR] Backend offline' : isBrowser ? '[AUTH REQUIRED] Direct mutation disabled' : 'Ready for test injection')}
              </div>

              <!-- Compact Latency Sparkline -->
              <div class="mini-spark-container">
                <svg class="mini-spark-svg" viewBox="0 0 100 18" preserveAspectRatio="none">
                  ${getSparklineSvg(selected.history || [selected.latencyMs])}
                </svg>
              </div>

              <!-- Action Controls (FAIL & RESTORE) -->
              <div class="node-actions-row">
                <button class="voxel-btn sm variant-danger cyber-btn xs danger" id="btn-fail-node" ${isProcessing || isFailed || isOffline || isBrowser ? 'disabled' : ''} title="${isBrowser ? 'Authorization required: Direct browser mutation disabled for security' : ''}">
                  <span class="btn-icon">⚡</span> ${isProcessing ? 'WAIT...' : 'FAIL'}
                </button>
                <button class="voxel-btn sm variant-secondary cyber-btn xs secondary" id="btn-restore-node" ${isProcessing || isOffline || isBrowser ? 'disabled' : ''} title="${isBrowser ? 'Authorization required: Direct browser mutation disabled for security' : ''}">
                  <span class="btn-icon">↺</span> ${isProcessing ? 'WAIT...' : 'RESTORE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Navigation between Overview & Detail
    const heroStage = container.querySelector("#hero-overview-stage");
    if (heroStage) {
      heroStage.addEventListener("click", (e) => {
        appActions.playClick();
        showDetail = true;
        render();
      });
    }

    const detailBtn = container.querySelector("#btn-cluster-detail");
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
      backBtn.addEventListener("click", () => {
        appActions.playClick();
        showDetail = false;
        render();
      });
    }

    // Row selection in Detail View
    container.querySelectorAll(".server-row-item").forEach(item => {
      item.addEventListener("click", () => {
        appActions.playClick();
        selectedServerId = item.dataset.id;
        render();
      });
    });

    // FAIL action: triggers POST /simulate-failure with server_id
    const failBtn = container.querySelector("#btn-fail-node");
    if (failBtn) {
      failBtn.addEventListener("click", async (e) => {
        e?.stopPropagation?.();
        if (isProcessing) return;
        if (isBrowser) {
          appActions.playAlert();
          setNotice("[AUTH REQUIRED] Direct browser mutation disabled", true);
          return;
        }
        appActions.playClick();
        isProcessing = true;
        render();

        try {
          const res = await appActions.api.simulateFailure(selected.id);
          appActions.playAlert();
          setNotice(`[OK] Failed ${selected.name}`);
          appActions.logSerial(`[SIM_FAIL] ${selected.name} (${selected.id}) set to FAILED via API`);
          await appActions.refreshBackendState();
        } catch (err) {
          appActions.playAlert();
          setNotice(`[ERR] ${err.message}`, true);
          appActions.logSerial(`[SIM_FAIL_ERR] ${err.message}`);
        } finally {
          isProcessing = false;
          render();
        }
      });
    }

    // RESTORE action: triggers POST /restore with server_id
    const restoreBtn = container.querySelector("#btn-restore-node");
    if (restoreBtn) {
      restoreBtn.addEventListener("click", async (e) => {
        e?.stopPropagation?.();
        if (isProcessing) return;
        if (isBrowser) {
          appActions.playAlert();
          setNotice("[AUTH REQUIRED] Direct browser mutation disabled", true);
          return;
        }
        appActions.playClick();
        isProcessing = true;
        render();

        try {
          const res = await appActions.api.restoreServer(selected.id);
          appActions.playSuccess();
          setNotice(`[OK] Restored ${selected.name}`);
          appActions.logSerial(`[RESTORE] ${selected.name} (${selected.id}) restored via API`);
          await appActions.refreshBackendState();
        } catch (err) {
          appActions.playAlert();
          setNotice(`[ERR] ${err.message}`, true);
          appActions.logSerial(`[RESTORE_ERR] ${err.message}`);
        } finally {
          isProcessing = false;
          render();
        }
      });
    }
  }

  function getSparklineSvg(history) {
    if (!history || history.length === 0) return '';
    const min = Math.min(...history);
    const max = Math.max(...history, min + 4);
    const points = history.map((val, idx) => {
      const x = (idx / Math.max(1, history.length - 1)) * 100;
      const y = 16 - ((val - min) / (max - min || 1)) * 14;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return `
      <polyline points="${points}" fill="none" stroke="#FF5722" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      ${history.map((val, idx) => {
        const x = (idx / Math.max(1, history.length - 1)) * 100;
        const y = 16 - ((val - min) / (max - min || 1)) * 14;
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.2" fill="#FFB300" />`;
      }).join('')}
    `;
  }

  // Initial render
  render();

  // Subscribe to live polling updates
  const unsubscribe = appActions.onStateChange(() => {
    render();
  });

  return () => {
    if (noticeTimeout) clearTimeout(noticeTimeout);
    if (typeof unsubscribe === "function") unsubscribe();
  };
}
