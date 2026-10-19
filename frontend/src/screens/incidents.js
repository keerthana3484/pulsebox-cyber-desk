import { isBrowserEnvironment } from "../api.js";
import {
  getPulseBotMascotSvg,
  getItemIconSvg,
  buildVoxelButton,
} from "../voxelComponents.js";

// Screen 3: INCIDENTS — Connected to Flask API (/incidents)
// Follows docs/UI_RULES.md: 1 hero element, max 3 text elements, <= 12 words on overview,
// tap-through detail view with [< BACK] button.

export function renderIncidentsScreen(container, state, appActions, options = {}) {
  let incidents = null; // null: loading, []: empty, [...]: loaded
  let selectedIncidentId = null;
  let isOffline = false;
  let isLoading = true;
  let pollTimer = null;
  let isTriageBusy = false;
  let showDetail = options.initialShowDetail ?? false;
  let actionNotice = "";
  let noticeTimeout = null;
  const isBrowser = isBrowserEnvironment();

  function setNotice(msg) {
    actionNotice = msg;
    if (noticeTimeout) clearTimeout(noticeTimeout);
    noticeTimeout = setTimeout(() => {
      actionNotice = "";
      render();
    }, 3500);
  }

  function formatTime(isoStr) {
    if (!isoStr) return "--:--:--";
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return String(isoStr).slice(11, 19) || String(isoStr);
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      const ss = String(d.getUTCSeconds()).padStart(2, "0");
      return `${hh}:${mm}:${ss}Z`;
    } catch {
      return String(isoStr);
    }
  }

  async function fetchIncidents(showLoading = false) {
    if (showLoading && incidents === null) {
      isLoading = true;
      render();
    }

    try {
      const data = await appActions.api.getIncidents();
      const rawList = Array.isArray(data) ? data : (data?.incidents || []);

      // Sort newest first by created_at (or created_timestamp)
      const sorted = [...rawList].sort((a, b) => {
        const ta = new Date(a.created_at || a.created_timestamp || 0).getTime();
        const tb = new Date(b.created_at || b.created_timestamp || 0).getTime();
        return tb - ta;
      });

      const wasOffline = isOffline;
      isOffline = false;
      isLoading = false;
      incidents = sorted;

      // Maintain selection or select newest
      if (sorted.length > 0) {
        const stillExists = sorted.some(i => i.id === selectedIncidentId);
        if (!selectedIncidentId || !stillExists) {
          selectedIncidentId = sorted[0].id;
        }
      } else {
        selectedIncidentId = null;
      }

      if (wasOffline) {
        appActions.logSerial("[API_SYNC] Incidents reconnected to Flask API");
      }

      render();
    } catch (err) {
      isOffline = true;
      isLoading = false;
      appActions.logSerial(`[INC_ERR] Failed to fetch incidents: ${err.message}`);
      render();
    }
  }

  function render() {
    // 1. Loading State (initial sync)
    if (isLoading && incidents === null && !isOffline) {
      container.innerHTML = `
        <div class="screen-content screen-incidents-minimal">
          <div class="inc-loading-bar">
            <span>⚡</span>
            <span>SYNCING INCIDENTS...</span>
          </div>
        </div>
      `;
      return;
    }

    // 2. Offline State (backend unreachable, never falsely show empty log)
    if (isOffline) {
      container.innerHTML = `
        <div class="screen-content screen-incidents-minimal">
          <div class="incident-offline-container">
            <div class="offline-inc-icon">⚡</div>
            <div class="offline-inc-title">INCIDENT DATA OFFLINE</div>
            <div class="offline-inc-subtitle">BACKEND UNREACHABLE @ 127.0.0.1:5000</div>
            <div class="offline-inc-retry">RETRYING IN 3s • NAVIGATION ACTIVE</div>
            <button class="cyber-btn xs secondary voxel-btn variant-secondary" id="btn-manual-retry" style="margin-top:6px;">RETRY NOW</button>
            <button class="voxel-btn variant-secondary" id="btn-retry-incidents" style="display:none;">RETRY</button>
          </div>
        </div>
      `;
      const retryBtn = container.querySelector("#btn-manual-retry");
      if (retryBtn) {
        retryBtn.addEventListener("click", () => {
          appActions.playClick();
          fetchIncidents(true);
        });
      }
      return;
    }

    const currentList = incidents || [];
    const openIncidents = currentList.filter(i => i.status !== "RESOLVED");
    const openCount = openIncidents.length;
    const isNominal = openCount === 0;

    const mascotExp = state.mascotMood || (isNominal ? "happy" : "worried");
    const mascotSvg = getPulseBotMascotSvg(mascotExp, 48);
    const shieldSvg = getItemIconSvg(isNominal ? "shield" : "potion", 36);

    const selected = currentList.find(i => i.id === selectedIncidentId) || currentList[0] || null;
    const isResolved = selected?.status === "RESOLVED";

    container.innerHTML = `
      <div class="screen-voxel-wrapper screen-content screen-incidents-minimal">
        <!-- 1. HERO OVERVIEW VIEW (Strict 1-Second Glanceable, <= 3 text elements, <= 12 words) -->
        <div class="screen-hero-view ${showDetail ? 'is-hidden' : ''}" id="hero-overview-stage">
          <div class="voxel-hero-visual">
            ${mascotSvg}
            <div style="display: flex; align-items: center; justify-content: center;">
              ${shieldSvg}
            </div>
          </div>
          <div class="voxel-hero-metric ${isNominal ? 'status-nominal' : 'status-alert'}">
            ${isNominal ? 'ALL CLEAR' : 'UH OH'}
          </div>
          <div class="voxel-hero-actions">
            <button class="voxel-btn ${isNominal ? 'variant-secondary' : 'variant-danger'} voxel-tap-arrow-btn" id="btn-incidents-detail" aria-label="Details">
              ▶
            </button>
          </div>
        </div>

        <!-- 2. TAP-THROUGH DETAIL VIEW (Split Incident Feed & Triage) -->
        <div class="screen-detail-view ${showDetail ? 'is-active' : ''}">
          <!-- Navigation Back Row -->
          <div class="voxel-detail-nav-row">
            <button class="voxel-btn variant-secondary voxel-back-btn" id="btn-back-overview">
              ◀ BACK
            </button>
            <span class="voxel-detail-title">INCIDENT LOG</span>
            <span class="sim-tag-mini">[SIMULATION]</span>
          </div>

          ${currentList.length === 0 ? `
            <!-- Empty Incident Log State -->
            <div class="empty-incident-container" style="padding: 12px 6px; text-align: center;">
              <div class="empty-inc-icon" style="font-size: 20px; color: #00E676;">✓</div>
              <div class="empty-inc-title" style="font-size: 11px; font-weight: 700; color: #00E676; margin: 4px 0;">EMPTY INCIDENT LOG</div>
              <div class="empty-inc-subtitle" style="font-size: 8px; color: #94A3B8;">ALL 6 SIMULATED CLUSTER NODES NOMINAL</div>
              <div class="empty-inc-sim-badge" style="font-size: 8px; color: #E5B83B; margin-top: 4px;">SIMULATION MODE • 0 ACTIVE OUTAGES</div>
              <div class="action-notice-line ${actionNotice ? 'active' : ''}" style="margin-top:6px;">
                ${actionNotice || 'Threshold: 3 consecutive failed health checks trigger alert'}
              </div>
            </div>
          ` : `
            <div class="incidents-split-view">
              <!-- Left: Compact Incidents Feed (Newest first) -->
              <div class="incident-list-col">
                <div class="col-micro-label" style="display: flex; justify-content: space-between; align-items: center;">
                  <span>ALERTS (${currentList.length})</span>
                  <button class="mini-tool-btn voxel-btn variant-secondary" id="btn-refresh-inc" title="Refresh incidents" style="font-size: 8px; padding: 2px 4px;">⟳</button>
                </div>
                <div class="incident-rows-wrap">
                  ${currentList.map(inc => {
                    const isItemSel = inc.id === selected?.id;
                    const itemResolved = inc.status === "RESOLVED";
                    const sev = (inc.severity || "CRITICAL").toLowerCase();
                    const failCount = inc.consecutive_failure_count ?? 3;
                    const srvDisplay = inc.server_name || inc.server_id || "Node";
                    const timeDisplay = formatTime(inc.created_at || inc.created_timestamp);

                    return `
                      <div class="inc-row-item ${isItemSel ? 'selected' : ''} ${itemResolved ? 'resolved-item' : 'open-item'}" data-id="${inc.id}">
                        <span class="inc-pill ${itemResolved ? 'resolved' : 'critical'}">${itemResolved ? 'RES' : 'CRIT'}</span>
                        <div class="inc-info-block">
                          <div class="inc-row-top">
                            <span class="inc-row-id">${inc.id}</span>
                            <span class="inc-row-status ${itemResolved ? 'resolved' : 'open'}">${inc.status}</span>
                          </div>
                          <div class="inc-row-sub">
                            <span class="inc-row-srv" title="${srvDisplay}">${srvDisplay}</span>
                            <span class="inc-row-meta">F:${failCount} • ${timeDisplay}</span>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Vertical Separator -->
              <div class="vertical-separator"></div>

              <!-- Right: Incident Detail & Triage Action -->
              <div class="incident-detail-col">
                ${selected ? `
                  <div class="inc-head-line">
                    <span class="inc-pill ${isResolved ? 'resolved' : 'critical'}">${selected.severity || 'CRITICAL'}</span>
                    <span class="inc-id-tag">${selected.id}</span>
                    <span class="inc-status-pill ${isResolved ? 'resolved' : 'open'}">${selected.status}</span>
                  </div>

                  <div class="inc-service-label">
                    <span>SERVER: <strong class="accent">${selected.server_name || selected.server_id}</strong></span>
                    <span class="inc-streak-badge">[${selected.consecutive_failure_count ?? 3} FAILS]</span>
                  </div>

                  <div class="inc-detail-text">
                    ${selected.message || selected.detail || `Server reached ${selected.consecutive_failure_count} consecutive failed health checks`}
                  </div>

                  <div class="inc-meta-block">
                    <div class="inc-meta-row">
                      <span>CREATED:</span>
                      <strong>${formatTime(selected.created_at || selected.created_timestamp)}</strong>
                    </div>
                    <div class="inc-meta-row">
                      <span>${isResolved ? 'RESOLVED:' : 'STATE:'}</span>
                      <strong class="${isResolved ? 'green' : 'red'}">
                        ${isResolved ? formatTime(selected.resolved_at || selected.resolution_timestamp) : 'ACTIVE OUTAGE'}
                      </strong>
                    </div>
                  </div>

                  <div class="inc-action-line">
                    <span class="sim-tag-mini">[SIMULATION]</span>
                    <div class="inc-btn-wrap">
                      ${!isResolved ? `
                        <button class="cyber-btn xs secondary voxel-btn variant-primary" id="btn-resolve-node" ${isTriageBusy || isBrowser ? 'disabled' : ''} title="${isBrowser ? 'Authorization required: Direct browser mutation disabled for security' : ''}">
                          ${isTriageBusy ? 'WAIT...' : 'RESTORE'}
                        </button>
                        ${isBrowser ? `<div class="auth-notice-sub" style="font-size: 8px; color: #ff9800; margin-top: 2px;">[AUTH REQUIRED] Restore disabled</div>` : ''}
                      ` : `
                        <span class="inc-resolved-tag">RESOLVED ✓</span>
                      `}
                    </div>
                  </div>
                ` : `
                  <div class="empty-state">SELECT INCIDENT</div>
                `}
              </div>
            </div>
          `}
        </div>
      </div>
    `;

    // Overview Navigation
    const heroStage = container.querySelector("#hero-overview-stage");
    if (heroStage) {
      heroStage.addEventListener("click", () => {
        appActions.playClick();
        showDetail = true;
        render();
      });
    }

    const detailBtn = container.querySelector("#btn-incidents-detail");
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

    // Detail View Event Bindings
    container.querySelectorAll(".inc-row-item").forEach(item => {
      item.addEventListener("click", () => {
        appActions.playClick();
        selectedIncidentId = item.dataset.id;
        render();
      });
    });

    const refreshBtn = container.querySelector("#btn-refresh-inc");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        fetchIncidents(true);
      });
    }

    const restoreNodeBtn = container.querySelector("#btn-resolve-node");
    if (restoreNodeBtn && selected && !isResolved) {
      restoreNodeBtn.addEventListener("click", async (e) => {
        e?.stopPropagation?.();
        if (isTriageBusy) return;
        if (isBrowser) {
          appActions.playAlert();
          setNotice("[AUTH REQUIRED] Direct browser mutation disabled");
          return;
        }
        appActions.playClick();
        isTriageBusy = true;
        render();

        try {
          const targetServerId = selected.server_id;
          await appActions.api.restoreServer(targetServerId);
          appActions.playSuccess();
          appActions.logSerial(`[INC_RESTORE] Restored ${selected.server_name} (${targetServerId}). Incident resolved.`);
          setNotice(`[OK] Restored ${selected.server_name}`);
          await appActions.refreshBackendState();
          await fetchIncidents();
        } catch (err) {
          appActions.playAlert();
          appActions.logSerial(`[INC_RESTORE_ERR] ${err.message}`);
          setNotice(`[ERR] ${err.message}`);
        } finally {
          isTriageBusy = false;
          render();
        }
      });
    }
  }

  fetchIncidents(true);

  pollTimer = setInterval(() => {
    fetchIncidents(false);
  }, 3000);

  const unsubscribeState = appActions.onStateChange(() => {
    fetchIncidents(false);
  });

  return () => {
    if (pollTimer) clearInterval(pollTimer);
    if (noticeTimeout) clearTimeout(noticeTimeout);
    if (typeof unsubscribeState === "function") unsubscribeState();
  };
}
