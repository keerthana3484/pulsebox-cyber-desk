// Screen 4: CLOUD COSTS — Minimal cloud spending, budget & telemetry
// Connected to Flask API (/costs, /costs/settings)
// Minimal 320x240 touchscreen view with live telemetry, daily trend bars,
// threshold pills, compact budget adjuster, and offline/loading states.

export function renderCloudCostsScreen(container, state, appActions) {
  let costs = null; // null: loading, object: loaded
  let isOffline = false;
  let isLoading = true;
  let isAdjusting = false;
  let isBusy = false;
  let pollTimer = null;
  let actionNotice = "";
  let noticeTimeout = null;

  function setNotice(msg) {
    actionNotice = msg;
    if (noticeTimeout) clearTimeout(noticeTimeout);
    noticeTimeout = setTimeout(() => {
      actionNotice = "";
      render();
    }, 3500);
  }

  function formatCurrency(val) {
    if (typeof val !== "number" || isNaN(val)) return "$0.00";
    return "$" + val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  async function fetchCosts(showLoading = false) {
    if (showLoading && costs === null) {
      isLoading = true;
      render();
    }

    try {
      const data = await appActions.api.getCosts();
      const wasOffline = isOffline;
      isOffline = false;
      isLoading = false;
      costs = data;

      if (wasOffline) {
        appActions.logSerial("[API_SYNC] Cloud Costs reconnected to Flask API");
      }
      render();
    } catch (err) {
      isOffline = true;
      isLoading = false;
      appActions.logSerial(`[COST_ERR] Failed to fetch costs: ${err.message}`);
      render();
    }
  }

  async function handleBudgetUpdate(newBudget) {
    if (isBusy) return;
    const num = parseFloat(newBudget);
    if (isNaN(num) || num <= 0) {
      appActions.playAlert();
      setNotice("[ERR] Budget must be a positive number > 0");
      render();
      return;
    }

    isBusy = true;
    appActions.playClick();
    try {
      const res = await appActions.api.updateCostBudget(num);
      appActions.playSuccess();
      appActions.logSerial(`[BUDGET_UPD] ${res.message || `Budget set to $${num}`}`);
      setNotice(res.message || `Budget updated to $${num}`);
      await fetchCosts(false);
      isAdjusting = false;
    } catch (err) {
      appActions.playAlert();
      appActions.logSerial(`[BUDGET_ERR] ${err.message}`);
      setNotice(`[ERR] ${err.message}`);
    } finally {
      isBusy = false;
      render();
    }
  }

  function render() {
    // 1. Loading State (initial sync)
    if (isLoading && costs === null && !isOffline) {
      container.innerHTML = `
        <div class="screen-content screen-costs-minimal">
          <div class="cost-loading-bar">
            <span>⚡</span>
            <span>SYNCING CLOUD COSTS...</span>
          </div>
        </div>
      `;
      return;
    }

    // 2. Offline State (backend unreachable, never falsely show $0.00 data)
    if (isOffline) {
      container.innerHTML = `
        <div class="screen-content screen-costs-minimal">
          <div class="cost-offline-container">
            <div class="offline-cost-icon">⚡</div>
            <div class="offline-cost-title">COST DATA OFFLINE</div>
            <div class="offline-cost-subtitle">BACKEND UNREACHABLE @ 127.0.0.1:5000</div>
            <div class="offline-cost-retry">RETRYING IN 3s • NAVIGATION ACTIVE</div>
            <button class="cyber-btn xs secondary" id="btn-cost-retry" style="margin-top:6px;">RETRY NOW</button>
          </div>
        </div>
      `;
      const retryBtn = container.querySelector("#btn-cost-retry");
      if (retryBtn) {
        retryBtn.addEventListener("click", () => {
          appActions.playClick();
          fetchCosts(true);
        });
      }
      return;
    }

    // 3. Normal Data Render
    const data = costs || {};
    const todaySpend = data.today_spend ?? 64.20;
    const monthSpend = data.month_spend ?? 1842.60;
    const monthlyBudget = data.monthly_budget ?? 2500.00;
    const budgetUsedPct = typeof data.budget_used_pct === "number" ? data.budget_used_pct : (monthlyBudget > 0 ? (monthSpend / monthlyBudget) * 100 : 100);
    const remainingBudget = typeof data.remaining_budget === "number" ? data.remaining_budget : Math.max(0, monthlyBudget - monthSpend);
    const budgetStatus = (data.budget_status || (budgetUsedPct < 75.0 ? "NORMAL" : budgetUsedPct < 100.0 ? "WARNING" : "BUDGET EXCEEDED")).toUpperCase();
    const dataSourceStatus = data.data_source_status || "No live billing connection";
    const dailyTrend = Array.isArray(data.daily_trend) ? data.daily_trend : [];
    const breakdown = Array.isArray(data.breakdown) ? data.breakdown : [];
    const updatedTime = formatTime(data.timestamp);

    // Threshold class
    let statusClass = "normal";
    if (budgetStatus === "WARNING") {
      statusClass = "warning";
    } else if (budgetStatus === "BUDGET EXCEEDED") {
      statusClass = "exceeded";
    }

    // Bar max for trend scaling
    const maxDaily = dailyTrend.reduce((m, p) => Math.max(m, p.amount || 0), 10.0);

    container.innerHTML = `
      <div class="screen-content screen-costs-minimal">
        <!-- Subheader: SIM Badge, Status Pill, Last Updated -->
        <div class="costs-top-header">
          <div class="costs-header-left">
            <span class="cost-sim-badge" title="Deterministic Simulation Mode">SIM</span>
            <span class="cost-header-title">CLOUD SPEND TELEMETRY</span>
          </div>
          <div class="costs-header-right">
            <span class="cost-status-pill ${statusClass}" id="cost-status-indicator">${budgetStatus}</span>
            <button class="mini-tool-btn" id="btn-refresh-costs" title="Refresh cost data">⟳</button>
          </div>
        </div>

        <!-- Metric Cards Grid: Today, Month, Budget, Remaining -->
        <div class="costs-metrics-grid">
          <div class="cost-metric-card">
            <span class="cost-metric-label">TODAY EST</span>
            <span class="cost-metric-val highlight" id="cost-today-val">${formatCurrency(todaySpend)}</span>
          </div>
          <div class="cost-metric-card">
            <span class="cost-metric-label">MONTH MTD</span>
            <span class="cost-metric-val" id="cost-month-val">${formatCurrency(monthSpend)}</span>
          </div>
          <div class="cost-metric-card budget-card">
            <div class="cost-label-with-tool">
              <span class="cost-metric-label">BUDGET</span>
              <button class="cost-edit-btn" id="btn-toggle-adjust" title="Adjust monthly budget">${isAdjusting ? '▲ CLOSE' : '⚙ SET'}</button>
            </div>
            <span class="cost-metric-val" id="cost-budget-val">${formatCurrency(monthlyBudget)}</span>
          </div>
          <div class="cost-metric-card">
            <span class="cost-metric-label">REMAINING (${budgetUsedPct.toFixed(1)}%)</span>
            <span class="cost-metric-val accent" id="cost-remaining-val">${formatCurrency(remainingBudget)}</span>
          </div>
        </div>

        <!-- Budget Progress Bar -->
        <div class="cost-bar-container">
          <div class="cost-bar-track">
            <div class="cost-bar-fill ${statusClass}" style="width: ${Math.min(100, Math.max(0, budgetUsedPct))}%;"></div>
          </div>
          <div class="cost-bar-labels">
            <span>${budgetUsedPct.toFixed(1)}% USED OF ${formatCurrency(monthlyBudget)}</span>
            <span>${data.days_remaining ?? 15}d REMAINING</span>
          </div>
        </div>

        <!-- Notice Banner (if any message) -->
        <div class="cost-notice-line ${actionNotice ? 'active' : ''}">
          ${actionNotice || `Threshold: Normal &lt;75% • Warning 75–99% • Exceeded ≥100%`}
        </div>

        <!-- Middle Section: EITHER Budget Adjuster OR (Daily Trend + Service Breakdown) -->
        ${isAdjusting ? `
          <!-- Compact Touchscreen Budget Adjuster -->
          <div class="cost-adjuster-panel">
            <div class="adjuster-header">
              <span>ADJUST MONTHLY BUDGET</span>
              <span class="adjuster-sub">QUICK PRESETS OR STEPPERS</span>
            </div>
            <!-- Quick Steppers & Presets Row -->
            <div class="adjuster-controls-row">
              <button class="cyber-btn xs secondary" id="btn-step-minus" title="Decrease budget by $250">-$250</button>
              <button class="cyber-btn xs secondary" id="btn-step-plus" title="Increase budget by $250">+$250</button>
              <button class="cyber-btn xs secondary preset-btn" data-preset="1500">$1.5k</button>
              <button class="cyber-btn xs secondary preset-btn" data-preset="2000">$2.0k</button>
              <button class="cyber-btn xs secondary preset-btn" data-preset="2500">$2.5k</button>
              <button class="cyber-btn xs secondary preset-btn" data-preset="3000">$3.0k</button>
            </div>
            <!-- Direct Custom Input Form -->
            <div class="adjuster-input-row">
              <span class="adjuster-input-prefix">$</span>
              <input type="number" id="input-custom-budget" class="cyber-number-input" value="${monthlyBudget.toFixed(0)}" step="50" min="1" max="100000" />
              <button class="cyber-btn xs" id="btn-apply-budget" ${isBusy ? 'disabled' : ''}>APPLY</button>
              <button class="cyber-btn xs secondary" id="btn-cancel-adjust">DONE</button>
            </div>
          </div>
        ` : `
          <!-- Daily Spending Trend Visualization (Compact 15-Bar Chart) -->
          <div class="cost-trend-section">
            <div class="cost-trend-header">
              <span>DAILY SPEND TREND (LAST 15 DAYS)</span>
              <span class="trend-today-label">TODAY: ${formatCurrency(todaySpend)}</span>
            </div>
            <div class="cost-trend-bars-wrap">
              ${dailyTrend.map((item, idx) => {
                const isToday = idx === dailyTrend.length - 1;
                const amt = item.amount || 0;
                const heightPct = Math.max(12, Math.round((amt / maxDaily) * 100));
                return `
                  <div class="cost-trend-bar-col ${isToday ? 'today-col' : ''}" title="Day ${item.day}: $${amt.toFixed(2)}${isToday ? ' (Today)' : ''}">
                    <div class="cost-trend-bar-fill ${isToday ? 'today-fill' : ''}" style="height: ${heightPct}%;"></div>
                    <span class="cost-trend-day-label">${item.day}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 4-Row Compact Service Breakdown -->
          <div class="cost-breakdown-compact">
            ${breakdown.map(item => `
              <div class="cost-breakdown-row">
                <div class="cat-name-group">
                  <span class="cat-dot" style="background: ${item.color || '#ff5722'};"></span>
                  <span class="cat-name">${item.name}</span>
                </div>
                <span class="cat-val">$${(item.amount || 0).toFixed(0)}</span>
                <span class="cat-pct">${(item.percentage || 0).toFixed(0)}%</span>
              </div>
            `).join('')}
          </div>
        `}

        <div class="thin-separator" style="margin: 2px 0;"></div>

        <!-- Footer: Data Source Connection & Sync Time -->
        <div class="costs-footer-strip">
          <div class="cost-footer-source">
            <span class="sim-dot">●</span>
            <span id="cost-source-status">${dataSourceStatus}</span>
          </div>
          <div class="cost-footer-meta">
            <span>SYNC: <strong id="cost-sync-time">${updatedTime}</strong></span>
          </div>
        </div>
      </div>
    `;

    // Event Listeners
    const refreshBtn = container.querySelector("#btn-refresh-costs");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        appActions.playClick();
        fetchCosts(true);
      });
    }

    const toggleAdjustBtn = container.querySelector("#btn-toggle-adjust");
    if (toggleAdjustBtn) {
      toggleAdjustBtn.addEventListener("click", () => {
        appActions.playClick();
        isAdjusting = !isAdjusting;
        render();
      });
    }

    // Adjuster listeners
    if (isAdjusting) {
      const cancelBtn = container.querySelector("#btn-cancel-adjust");
      if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
          appActions.playClick();
          isAdjusting = false;
          render();
        });
      }

      const applyBtn = container.querySelector("#btn-apply-budget");
      const inputBudget = container.querySelector("#input-custom-budget");
      if (applyBtn && inputBudget) {
        applyBtn.addEventListener("click", () => {
          handleBudgetUpdate(inputBudget.value);
        });
        inputBudget.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            handleBudgetUpdate(inputBudget.value);
          }
        });
      }

      const minusBtn = container.querySelector("#btn-step-minus");
      if (minusBtn) {
        minusBtn.addEventListener("click", () => {
          const nextVal = Math.max(100, monthlyBudget - 250);
          handleBudgetUpdate(nextVal);
        });
      }

      const plusBtn = container.querySelector("#btn-step-plus");
      if (plusBtn) {
        plusBtn.addEventListener("click", () => {
          const nextVal = monthlyBudget + 250;
          handleBudgetUpdate(nextVal);
        });
      }

      container.querySelectorAll(".preset-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const presetVal = parseFloat(btn.dataset.preset);
          if (presetVal) handleBudgetUpdate(presetVal);
        });
      });
    }
  }

  // Initial fetch immediately on screen open
  fetchCosts(true);

  // Poll costs every 3 seconds while screen is active
  pollTimer = setInterval(() => {
    fetchCosts(false);
  }, 3000);

  // Refresh immediately when cluster state changes
  const unsubscribeState = appActions.onStateChange(() => {
    fetchCosts(false);
  });

  // Cleanup on unmount
  return () => {
    if (pollTimer) clearInterval(pollTimer);
    if (noticeTimeout) clearTimeout(noticeTimeout);
    if (typeof unsubscribeState === "function") unsubscribeState();
  };
}
