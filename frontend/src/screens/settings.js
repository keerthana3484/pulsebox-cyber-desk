// Screen 7: SETTINGS — Device configuration, display parameters & system controls
// Follows docs/UI_RULES.md: 1 hero element, max 3 text elements, <= 12 words on overview,
// tap-through detail view with [< BACK] button.

import {
  getItemIconSvg,
  getPulseBotMascotSvg,
  buildVoxelButton,
} from "../voxelComponents.js";

export function renderSettingsScreen(container, state, appActions, options = {}) {
  let showDetail = options.initialShowDetail ?? false;

  function render() {
    const { settings } = state;
    const wrenchSvg = getItemIconSvg("wrench", 48);
    const batterySvg = getItemIconSvg("battery", 36);

    container.innerHTML = `
      <div class="screen-voxel-wrapper screen-content screen-settings-minimal">
        <!-- 1. HERO OVERVIEW VIEW (Strict 1-Second Glanceable, <= 3 text elements, <= 12 words) -->
        <div class="screen-hero-view ${showDetail ? 'is-hidden' : ''}" id="hero-overview-stage">
          <div class="voxel-hero-visual">
            ${wrenchSvg}
            <div style="display: flex; align-items: center; justify-content: center;">
              ${batterySvg}
            </div>
          </div>

          <div class="voxel-hero-metric status-nominal" id="settings-hero-metric">
            DEVICE CONFIG
          </div>

          <div class="voxel-hero-status" id="settings-hero-status">
            SYSTEM READY
          </div>

          <div class="voxel-hero-actions">
            <button class="voxel-btn variant-secondary" id="btn-settings-detail">
              SETTINGS ▶
            </button>
          </div>
        </div>

        <!-- 2. TAP-THROUGH DETAIL VIEW (Full Device Settings Panel) -->
        <div class="screen-detail-view ${showDetail ? 'is-active' : ''}">
          <!-- Navigation Back Row -->
          <div class="voxel-detail-nav-row">
            <button class="voxel-btn variant-secondary voxel-back-btn" id="btn-back-overview">
              ◀ BACK
            </button>
            <span class="voxel-detail-title">DEVICE CONFIG</span>
            <span class="sim-tag-mini">[ESP32]</span>
          </div>

          <div class="settings-compact-list" style="display: flex; flex-direction: column; gap: 4px;">
            <!-- CRT Scanlines -->
            <div class="setting-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #0B111E; padding: 3px 6px; border: 1px solid #162035;">
              <span class="set-label" style="font-size: 8px; color: #94A3B8;">CRT SCANLINES</span>
              <button class="toggle-pill voxel-btn ${settings.crtScanlines ? 'variant-primary' : 'variant-secondary'} xs" id="btn-toggle-scanlines" style="min-width: 44px; padding: 2px 6px;">
                ${settings.crtScanlines ? 'ON' : 'OFF'}
              </button>
            </div>

            <!-- Audio SFX -->
            <div class="setting-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #0B111E; padding: 3px 6px; border: 1px solid #162035;">
              <span class="set-label" style="font-size: 8px; color: #94A3B8;">AUDIO SFX</span>
              <button class="toggle-pill voxel-btn ${settings.soundEnabled ? 'variant-primary' : 'variant-secondary'} xs" id="btn-toggle-sound" style="min-width: 44px; padding: 2px 6px;">
                ${settings.soundEnabled ? 'ON' : 'MUTED'}
              </button>
            </div>

            <!-- Phosphor Theme -->
            <div class="setting-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #0B111E; padding: 3px 6px; border: 1px solid #162035;">
              <span class="set-label" style="font-size: 8px; color: #94A3B8;">THEME</span>
              <div class="pill-group" style="display: flex; gap: 4px;">
                <button class="pill-btn voxel-btn ${settings.colorTheme === 'amber-orange' ? 'variant-primary' : 'variant-secondary'} xs" data-theme="amber-orange" style="padding: 2px 4px; font-size: 7px;">AMBER</button>
                <button class="pill-btn voxel-btn ${settings.colorTheme === 'phosphor-green' ? 'variant-primary' : 'variant-secondary'} xs" data-theme="phosphor-green" style="padding: 2px 4px; font-size: 7px;">MATRIX</button>
                <button class="pill-btn voxel-btn ${settings.colorTheme === 'cyber-cyan' ? 'variant-primary' : 'variant-secondary'} xs" data-theme="cyber-cyan" style="padding: 2px 4px; font-size: 7px;">CYAN</button>
              </div>
            </div>

            <!-- Brightness -->
            <div class="setting-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #0B111E; padding: 3px 6px; border: 1px solid #162035;">
              <span class="set-label" style="font-size: 8px; color: #94A3B8;">BRIGHTNESS</span>
              <div class="pill-group" style="display: flex; gap: 4px;">
                <button class="pill-btn voxel-btn ${settings.screenBrightness === 40 ? 'variant-primary' : 'variant-secondary'} xs" data-bright="40" style="padding: 2px 4px; font-size: 7px;">40%</button>
                <button class="pill-btn voxel-btn ${settings.screenBrightness === 70 ? 'variant-primary' : 'variant-secondary'} xs" data-bright="70" style="padding: 2px 4px; font-size: 7px;">70%</button>
                <button class="pill-btn voxel-btn ${settings.screenBrightness === 100 ? 'variant-primary' : 'variant-secondary'} xs" data-bright="100" style="padding: 2px 4px; font-size: 7px;">100%</button>
              </div>
            </div>

            <!-- Standby & Reset Actions -->
            <div class="setting-item-row actions-row" style="display: flex; gap: 6px; margin-top: 4px;">
              <button class="voxel-btn variant-secondary xs" id="btn-enter-standby" style="flex: 1; height: 30px;">
                ⏻ STANDBY
              </button>
              <button class="voxel-btn variant-danger xs" id="btn-reset-data" style="flex: 1; height: 30px;">
                ↺ RESET
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind event handlers
    const detailBtn = container.querySelector("#btn-settings-detail");
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

    // Scanlines
    const scanlineBtn = container.querySelector("#btn-toggle-scanlines");
    if (scanlineBtn) {
      scanlineBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        settings.crtScanlines = !settings.crtScanlines;
        appActions.applySettings();
        render();
      });
    }

    // Audio
    const soundBtn = container.querySelector("#btn-toggle-sound");
    if (soundBtn) {
      soundBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        settings.soundEnabled = !settings.soundEnabled;
        appActions.toggleSound(settings.soundEnabled);
        appActions.playClick();
        render();
      });
    }

    // Themes
    container.querySelectorAll("[data-theme]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        settings.colorTheme = btn.dataset.theme;
        appActions.applySettings();
        render();
      });
    });

    // Brightness
    container.querySelectorAll("[data-bright]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        settings.screenBrightness = parseInt(btn.dataset.bright, 10);
        appActions.applySettings();
        render();
      });
    });

    // Standby action
    const standbyBtn = container.querySelector("#btn-enter-standby");
    if (standbyBtn) {
      standbyBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        appActions.enterStandby();
      });
    }

    // Reset Defaults (Destructive Action: Enforce Hold-to-Confirm for >= 1.5s)
    const resetBtn = container.querySelector("#btn-reset-data");
    if (resetBtn) {
      let holdTimer = null;
      let holdStart = 0;
      const HOLD_DURATION_MS = 1500;

      const cancelHold = () => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
          resetBtn.textContent = "↺ RESET";
          resetBtn.classList.remove("holding");
        }
      };

      const startHold = (e) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        holdStart = Date.now();
        resetBtn.textContent = "HOLD 1.5s...";
        resetBtn.classList.add("holding");
        appActions.playBeep(440, 50);

        holdTimer = setTimeout(() => {
          holdTimer = null;
          appActions.logSerial(`[AUDIT_LOG] ${new Date().toISOString()} | ACTION: RESET_DEFAULTS | USER: TOUCH_HOLD | STATUS: CONFIRMED`);
          appActions.resetToDefaults();
          appActions.playSuccess();
          resetBtn.textContent = "RESET OK!";
          setTimeout(() => render(), 400);
        }, HOLD_DURATION_MS);
      };

      resetBtn.addEventListener("pointerdown", startHold);
      resetBtn.addEventListener("pointerup", cancelHold);
      resetBtn.addEventListener("pointerleave", cancelHold);
      resetBtn.addEventListener("pointercancel", cancelHold);
      // Fallback click notification if user just taps without holding
      resetBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        if (Date.now() - holdStart < HOLD_DURATION_MS) {
          resetBtn.textContent = "HOLD 1.5s!";
          setTimeout(() => {
            if (!holdTimer) resetBtn.textContent = "↺ RESET";
          }, 1200);
        }
      });
    }
  }

  render();
  return () => {};
}
