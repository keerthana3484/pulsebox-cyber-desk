// Screen 5: DEPLOY — Minimal deployment status, release queue & ship controls

export function renderDeployScreen(container, state, appActions) {
  let isDeploying = false;
  let deployStep = 0;
  let deployLogs = [];

  function render() {
    container.innerHTML = `
      <div class="screen-content screen-deploy-minimal">
        ${isDeploying ? `
          <!-- Active Pipeline Terminal -->
          <div class="deploy-active-view">
            <div class="pipeline-status-row">
              <span class="pipeline-title highlight">DEPLOYING ${state.deploy.staging.version}</span>
              <span class="step-tag">STEP ${deployStep}/4</span>
            </div>
            <div class="mini-bar-track">
              <div class="mini-bar-fill" style="width: ${(deployStep / 4) * 100}%; background: var(--accent-orange);"></div>
            </div>
            <div class="mini-terminal-box">
              ${deployLogs.map(log => `<div class="term-log-line">${log}</div>`).join('')}
              <div class="term-cursor">█</div>
            </div>
          </div>
        ` : `
          <!-- Minimal Release Overview -->
          <div class="deploy-overview-view">
            <!-- Production Status -->
            <div class="deploy-status-row">
              <span class="dep-label">ACTIVE PROD:</span>
              <span class="dep-val green">${state.deploy.production.version}</span>
              <span class="dep-hash">#${state.deploy.production.commit}</span>
              <span class="dep-branch">(${state.deploy.production.branch})</span>
            </div>

            <div class="thin-separator"></div>

            <!-- Staging Target -->
            <div class="staging-block">
              <div class="staging-title-row">
                <span class="dep-label">READY TO SHIP:</span>
                <span class="dep-val highlight">${state.deploy.staging.version}</span>
                <span class="dep-hash">#${state.deploy.staging.commit}</span>
              </div>
              <div class="staging-msg-box">
                "${state.deploy.staging.message}"
              </div>
              <div class="staging-meta-row">
                <span>AUTHOR: ${state.deploy.staging.author}</span>
                <span>STATUS: READY</span>
              </div>
            </div>

            <div class="thin-separator"></div>

            <!-- Ship Control -->
            <div class="deploy-action-row">
              <button class="cyber-btn deploy-ship-btn" id="btn-ship-prod">
                <span class="btn-icon">🚀</span> SHIP ${state.deploy.staging.version} TO PRODUCTION
              </button>
            </div>
          </div>
        `}
      </div>
    `;

    const shipBtn = container.querySelector("#btn-ship-prod");
    if (shipBtn) {
      shipBtn.addEventListener("click", () => {
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
