// Screen 5: DEPLOY — Release pipeline, deployment status & ship controls
// Follows docs/UI_RULES.md: 1 hero element, max 3 text elements, <= 12 words on overview,
// tap-through detail view with [< BACK] button.

import {
  getItemIconSvg,
  buildVoxelButton,
} from "../voxelComponents.js";

export function renderDeployScreen(container, state, appActions, options = {}) {
  let isDeploying = false;
  let deployStep = 0;
  let deployLogs = [];
  let showDetail = options.initialShowDetail ?? false;

  function render() {
    const prod = state.deploy?.production || { version: "v1.4.2", commit: "a9f1b2c", branch: "main" };
    const staging = state.deploy?.staging || {
      version: "v1.4.3",
      commit: "b3c8e1a",
      author: "DevOps Bot",
      message: "Feat: optimize SPI bus transfers",
    };

    const rocketSvg = getItemIconSvg("rocket", 48);
    const compassSvg = getItemIconSvg("compass", 36);

    container.innerHTML = `
      <div class="screen-voxel-wrapper screen-content screen-deploy-minimal">
        <!-- 1. HERO OVERVIEW VIEW (Strict 1-Second Glanceable, <= 3 text elements, <= 12 words) -->
        <div class="screen-hero-view ${showDetail ? 'is-hidden' : ''}" id="hero-overview-stage">
          <div class="voxel-hero-visual">
            ${rocketSvg}
            <div style="display: flex; align-items: center; justify-content: center;">
              ${compassSvg}
            </div>
          </div>

          <div class="voxel-hero-metric status-nominal" id="deploy-hero-metric">
            ${prod.version} PROD
          </div>

          <div class="voxel-hero-status" id="deploy-hero-status">
            ${isDeploying ? `DEPLOYING STEP ${deployStep}/4` : 'READY TO SHIP'}
          </div>

          <div class="voxel-hero-actions">
            <button class="voxel-btn ${isDeploying ? 'variant-caution' : 'variant-secondary'}" id="btn-deploy-detail">
              ${isDeploying ? 'TERMINAL ▶' : 'PIPELINE ▶'}
            </button>
          </div>
        </div>

        <!-- 2. TAP-THROUGH DETAIL VIEW (Staging Target & Deployment Terminal) -->
        <div class="screen-detail-view ${showDetail ? 'is-active' : ''}">
          <!-- Navigation Back Row -->
          <div class="voxel-detail-nav-row">
            <button class="voxel-btn variant-secondary voxel-back-btn" id="btn-back-overview">
              ◀ BACK
            </button>
            <span class="voxel-detail-title">RELEASE PIPELINE</span>
            <span class="sim-tag-mini">[SIM]</span>
          </div>

          ${isDeploying ? `
            <!-- Active Pipeline Terminal View -->
            <div class="deploy-active-view" style="flex: 1; display: flex; flex-direction: column;">
              <div class="pipeline-status-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span class="pipeline-title highlight" style="font-size: 9px; font-weight: 700; color: #00E5FF;">
                  DEPLOYING ${staging.version}
                </span>
                <span class="step-tag" style="font-size: 8px; color: #E5B83B;">STEP ${deployStep}/4</span>
              </div>
              <div class="mini-bar-track" style="height: 6px; background: #05070D; border: 1px solid #162035; margin-bottom: 6px;">
                <div class="mini-bar-fill" style="width: ${(deployStep / 4) * 100}%; height: 100%; background: #FF6D00;"></div>
              </div>
              <div class="mini-terminal-box" style="flex: 1; background: #05070D; border: 1px solid #162035; padding: 6px; font-family: monospace; font-size: 8px; color: #00E676; overflow-y: auto;">
                ${deployLogs.map(log => `<div class="term-log-line">${log}</div>`).join('')}
                <div class="term-cursor" style="animation: blink 1s infinite;">█</div>
              </div>
            </div>
          ` : `
            <!-- Release Staging & Ship Controls -->
            <div class="deploy-overview-view" style="display: flex; flex-direction: column; gap: 6px;">
              <!-- Production Active Row -->
              <div class="deploy-status-row" style="display: flex; align-items: center; justify-content: space-between; background: #0B111E; padding: 4px 6px; border: 1px solid #162035;">
                <span class="dep-label" style="font-size: 8px; color: #94A3B8;">ACTIVE PROD:</span>
                <span class="dep-val green" style="font-size: 9px; font-weight: 700; color: #00E676;">${prod.version}</span>
                <span class="dep-hash" style="font-size: 8px; color: #64748B;">#${prod.commit}</span>
                <span class="dep-branch" style="font-size: 8px; color: #00BCD4;">(${prod.branch})</span>
              </div>

              <!-- Staging Target Box -->
              <div class="staging-block" style="background: #0B111E; padding: 6px; border: 1px solid #162035;">
                <div class="staging-title-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                  <span class="dep-label" style="font-size: 8px; color: #94A3B8;">READY TO SHIP:</span>
                  <span class="dep-val highlight" style="font-size: 9px; font-weight: 700; color: #00E5FF;">${staging.version}</span>
                  <span class="dep-hash" style="font-size: 8px; color: #64748B;">#${staging.commit}</span>
                </div>
                <div class="staging-msg-box" style="font-size: 8px; color: #E2E8F0; margin: 4px 0; font-style: italic;">
                  "${staging.message}"
                </div>
                <div class="staging-meta-row" style="display: flex; justify-content: space-between; font-size: 7px; color: #64748B;">
                  <span>BY: ${staging.author}</span>
                  <span style="color: #00E676;">STATUS: READY</span>
                </div>
              </div>

              <!-- Ship Control Button -->
              <div class="deploy-action-row" style="margin-top: 2px;">
                <button class="voxel-btn variant-primary" id="btn-ship-prod" style="width: 100%; height: 32px;">
                  🚀 SHIP ${staging.version} TO PRODUCTION
                </button>
              </div>
            </div>
          `}
        </div>
      </div>
    `;

    // Bind event handlers
    const detailBtn = container.querySelector("#btn-deploy-detail");
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

    const shipBtn = container.querySelector("#btn-ship-prod");
    if (shipBtn) {
      shipBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        startDeploySimulation();
      });
    }
  }

  function startDeploySimulation() {
    isDeploying = true;
    deployStep = 1;
    deployLogs = [`[INIT] Starting release pipeline for ${state.deploy.staging.version}...`];
    render();
    appActions.logSerial(`[DEPLOY] Pipeline initiated for ${state.deploy.staging.version}`);

    const steps = [
      { step: 1, log: "[1/4] Running pytest suite & firmware lint... 48/48 PASS", delay: 600 },
      { step: 2, log: "[2/4] Building ESP32 binary & Docker cluster image... DONE", delay: 700 },
      { step: 3, log: "[3/4] Rolling update across 6 cluster nodes... HEALTHY", delay: 800 },
      { step: 4, log: "[4/4] Ingress route swapped. Live metrics verified! 🚀", delay: 600 },
    ];

    let current = 0;
    function nextStep() {
      if (current < steps.length) {
        const item = steps[current];
        setTimeout(() => {
          deployStep = item.step;
          deployLogs.push(item.log);
          appActions.playBeep(880 + current * 120, 0.05);
          render();
          current++;
          nextStep();
        }, item.delay);
      } else {
        setTimeout(() => {
          appActions.playSuccess();
          appActions.logSerial(`[DEPLOY_SUCCESS] Version ${state.deploy.staging.version} is LIVE!`);
          state.deploy.production.version = state.deploy.staging.version;
          state.deploy.production.commit = state.deploy.staging.commit;
          state.deploy.production.deployedAt = "Just now";
          isDeploying = false;
          render();
        }, 600);
      }
    }

    nextStep();
  }

  render();
  return () => {};
}
