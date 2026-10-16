// Screen 7: SETTINGS — Compact settings rows, power controls & hardware config

export function renderSettingsScreen(container, state, appActions) {
  function render() {
    const { settings } = state;

    container.innerHTML = `
      <div class="screen-content screen-settings-minimal">
        <div class="settings-compact-list">
          <!-- Scanlines -->
          <div class="setting-item-row">
            <span class="set-label">CRT SCANLINES</span>
            <button class="toggle-pill ${settings.crtScanlines ? 'active' : ''}" id="btn-toggle-scanlines">
              ${settings.crtScanlines ? 'ON' : 'OFF'}
            </button>
          </div>

          <div class="thin-separator"></div>

          <!-- Color Theme -->
          <div class="setting-item-row">
            <span class="set-label">PHOSPHOR</span>
            <div class="pill-group">
              <button class="pill-btn ${settings.colorTheme === 'amber-orange' ? 'active' : ''}" data-theme="amber-orange">AMBER</button>
              <button class="pill-btn ${settings.colorTheme === 'phosphor-green' ? 'active' : ''}" data-theme="phosphor-green">MATRIX</button>
              <button class="pill-btn ${settings.colorTheme === 'cyber-cyan' ? 'active' : ''}" data-theme="cyber-cyan">CYAN</button>
            </div>
          </div>

          <div class="thin-separator"></div>

          <!-- Audio -->
          <div class="setting-item-row">
            <span class="set-label">AUDIO SFX</span>
            <button class="toggle-pill ${settings.soundEnabled ? 'active' : ''}" id="btn-toggle-sound">
              ${settings.soundEnabled ? 'ON' : 'MUTED'}
            </button>
          </div>

          <div class="thin-separator"></div>

          <!-- Brightness -->
          <div class="setting-item-row">
            <span class="set-label">BRIGHTNESS</span>
            <div class="pill-group">
              <button class="pill-btn ${settings.screenBrightness === 40 ? 'active' : ''}" data-bright="40">40%</button>
              <button class="pill-btn ${settings.screenBrightness === 70 ? 'active' : ''}" data-bright="70">70%</button>
              <button class="pill-btn ${settings.screenBrightness === 100 ? 'active' : ''}" data-bright="100">100%</button>
            </div>
          </div>

          <div class="thin-separator"></div>

          <!-- Power Standby & Factory Reset -->
          <div class="setting-item-row actions-row">
            <button class="cyber-btn xs secondary" id="btn-enter-standby">
              <span class="btn-icon">⏻</span> SLEEP / STANDBY
            </button>
            <button class="cyber-btn xs danger" id="btn-reset-data">
              <span class="btn-icon">↺</span> RESET DEFAULTS
            </button>
          </div>
        </div>
      </div>
    `;

    // Scanlines
    const scanlineBtn = container.querySelector("#btn-toggle-scanlines");
    if (scanlineBtn) {
      scanlineBtn.addEventListener("click", () => {
        appActions.playClick();
        settings.crtScanlines = !settings.crtScanlines;
        appActions.applySettings();
        render();
      });
    }

    // Audio
    const soundBtn = container.querySelector("#btn-toggle-sound");
    if (soundBtn) {
      soundBtn.addEventListener("click", () => {
        settings.soundEnabled = !settings.soundEnabled;
        appActions.toggleSound(settings.soundEnabled);
        appActions.playClick();
        render();
      });
    }

    // Themes
    container.querySelectorAll("[data-theme]").forEach(btn => {
      btn.addEventListener("click", () => {
        appActions.playClick();
        settings.colorTheme = btn.dataset.theme;
        appActions.applySettings();
        render();
      });
    });

    // Brightness
    container.querySelectorAll("[data-bright]").forEach(btn => {
      btn.addEventListener("click", () => {
        appActions.playClick();
        settings.screenBrightness = parseInt(btn.dataset.bright, 10);
        appActions.applySettings();
        render();
      });
    });

    // Standby action
    const standbyBtn = container.querySelector("#btn-enter-standby");
    if (standbyBtn) {
      standbyBtn.addEventListener("click", () => {
        appActions.playClick();
        appActions.enterStandby();
      });
    }

    // Reset Defaults
    const resetBtn = container.querySelector("#btn-reset-data");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        appActions.playClick();
        if (confirm("Reset simulator to factory defaults?")) {
          appActions.resetToDefaults();
          appActions.playSuccess();
          render();
        }
      });
    }
  }

  render();
  return () => {};
}
