// Screen: FOCUS TIMER — Dedicated Pomodoro Focus & Break Screen
// Precision timestamp-based timer, 100% offline, persistent across reloads.
// Follows docs/UI_RULES.md: 1 hero element, max 3 text elements, <= 12 words on overview,
// tap-through detail view with [< BACK] button.

import {
  focusTimerService,
  FOCUS_PRESETS
} from "../timerService.js";
import {
  buildVoxelButton,
  buildXpBar,
} from "../voxelComponents.js";

export function renderFocusTimerScreen(container, state, appActions, options = {}) {
  let uiTicker = null;
  let showDetail = options.initialShowDetail ?? false;

  function formatTimeDigits(totalSecs) {
    const s = Math.max(0, Math.floor(totalSecs));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function render() {
    const timerState = focusTimerService.getState();
    const {
      mode,
      focusPresetMinutes,
      durationMinutes,
      remainingSeconds,
      isRunning,
      sessionNumber,
      completedSessions,
      completionNotice,
      pendingConfirm,
      soundEnabled,
    } = timerState;

    const totalSeconds = durationMinutes * 60;
    const elapsedSeconds = Math.max(0, totalSeconds - remainingSeconds);
    const progressPct = totalSeconds > 0 ? Math.min(100, Math.round((elapsedSeconds / totalSeconds) * 100)) : 0;
    const isFocus = mode === "focus";
    const timeDisplay = formatTimeDigits(remainingSeconds);

    const xpFillHtml = buildXpBar({
      current: progressPct,
      max: 100,
      level: sessionNumber
    });

    container.innerHTML = `
      <div class="screen-voxel-wrapper screen-content screen-focus-timer">
        <!-- 1. HERO OVERVIEW VIEW (Strict 1-Second Glanceable, <= 3 text elements, <= 12 words) -->
        <div class="screen-hero-view ${showDetail ? 'is-hidden' : ''}" id="hero-overview-stage">
          <div class="voxel-hero-visual" style="flex-direction: column; width: 85%; max-width: 240px; gap: 8px;">
            <div class="ft-digits-hero ${isFocus ? 'digits-focus' : 'digits-break'}" id="ft-clock-digits" style="font-size: 32px; font-weight: 700; letter-spacing: 2px;">
              ${timeDisplay}
            </div>
            <div style="width: 100%;">
              ${xpFillHtml}
            </div>
          </div>
          <div class="voxel-hero-actions">
            <button class="voxel-btn ${isRunning ? 'variant-caution' : 'variant-primary'}" id="btn-hero-timer-toggle">
              ${isRunning ? 'PAUSE' : (elapsedSeconds > 0 ? 'RESUME' : 'START')}
            </button>
            <button class="voxel-btn variant-secondary voxel-tap-arrow-btn" id="btn-timer-detail" aria-label="Details">
              ▶
            </button>
          </div>
        </div>

        <!-- 2. TAP-THROUGH DETAIL VIEW (Full Controls, Presets & Session Stats) -->
        <div class="screen-detail-view ${showDetail ? 'is-active' : ''}">
          <!-- Navigation Back Row -->
          <div class="voxel-detail-nav-row">
            <button class="voxel-btn variant-secondary voxel-back-btn" id="btn-back-overview">
              ◀ BACK
            </button>
            <span class="voxel-detail-title">TIMER CONTROLS</span>
            <button class="mini-tool-btn ft-sound-btn voxel-btn variant-secondary" id="btn-timer-mute" title="Toggle Audio SFX" style="font-size: 9px; padding: 2px 6px;">
              ${soundEnabled ? '🔊' : '🔇'}
            </button>
          </div>

          <!-- Subheader: Tech Badge, Title, Session Info -->
          <div class="ft-header-strip">
            <div class="ft-header-left">
              <span class="ft-badge ${isFocus ? 'focus' : 'break'}">${isFocus ? 'FOC' : 'BRK'}</span>
              <span class="ft-title-label">FOCUS TIMER</span>
            </div>
            <div class="ft-header-right">
              <span class="ft-session-tag">SESS #${sessionNumber}</span>
              <span class="ft-completed-tag" title="Completed focus sessions">⚡ ${completedSessions} DONE</span>
            </div>
          </div>

          <!-- Mode Indicator Banner -->
          <div class="ft-mode-strip">
            <div class="ft-mode-pill ${isFocus ? 'mode-focus' : 'mode-break'}">
              <span class="ft-pulse-dot"></span>
              <span id="ft-mode-label">${isFocus ? 'FOCUS MODE' : 'BREAK MODE'}</span>
              <span class="ft-mode-target">(${durationMinutes}m target)</span>
            </div>
            <div class="ft-status-pill ${isRunning ? 'running' : 'idle'}">
              ${isRunning ? 'ACTIVE' : (elapsedSeconds > 0 ? 'PAUSED' : 'IDLE')}
            </div>
          </div>

          <!-- Completion Alert Banner -->
          ${completionNotice ? `
            <div class="ft-completion-banner ${timerState.lastCompletedMode === 'focus' ? 'celebrate' : 'break-ready'}" id="ft-completion-box">
              <span class="ft-completion-icon">${timerState.lastCompletedMode === 'focus' ? '🎉' : '☕'}</span>
              <span class="ft-completion-msg">${escapeHtml(completionNotice)}</span>
              <button class="ft-banner-close-btn" id="btn-dismiss-completion" title="Dismiss">✕</button>
            </div>
          ` : ''}

          <!-- Confirmation Modal Overlay -->
          ${pendingConfirm ? `
            <div class="ft-confirm-overlay" id="ft-confirm-dialog">
              <div class="ft-confirm-box">
                <div class="ft-confirm-title">⚠ DISCARD ACTIVE ${isFocus ? 'FOCUS' : 'BREAK'} SESSION?</div>
                <div class="ft-confirm-desc">Current session progress will be lost.</div>
                <div class="ft-confirm-btn-row">
                  <button class="cyber-btn sm danger voxel-btn variant-danger" id="btn-confirm-discard">CONFIRM</button>
                  <button class="cyber-btn sm secondary voxel-btn variant-secondary" id="btn-cancel-discard">CANCEL</button>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Compact Digital Clock & Progress Bar -->
          <div class="ft-hero-clock-box">
            <div class="ft-digits-hero ${isFocus ? 'digits-focus' : 'digits-break'}">
              ${timeDisplay}
            </div>
            <div class="ft-progress-track">
              <div class="ft-progress-bar ${isFocus ? 'bar-focus' : 'bar-break'}" id="ft-progress-fill" style="width: ${progressPct}%;"></div>
            </div>
          </div>

          <!-- Presets Row (15m, 25m, 45m) -->
          <div class="ft-presets-row">
            <span class="ft-presets-label">PRESETS:</span>
            <div class="ft-presets-group">
              ${FOCUS_PRESETS.map(preset => `
                <button class="ft-preset-btn voxel-btn variant-secondary ${isFocus && focusPresetMinutes === preset ? 'active is-selected' : ''}" data-preset="${preset}">
                  ${preset}m
                </button>
              `).join('')}
              <span class="ft-break-preset-tag ${!isFocus ? 'active' : ''}">BREAK: 5m</span>
            </div>
          </div>

          <!-- Main Action Controls Row -->
          <div class="ft-controls-row">
            <button class="cyber-btn sm voxel-btn ${isRunning ? 'variant-caution warning' : 'variant-primary primary'}" id="btn-timer-play-pause">
              ${isRunning ? '⏸ PAUSE' : (elapsedSeconds > 0 ? '▶ RESUME' : '▶ START')}
            </button>
            <button class="cyber-btn sm secondary voxel-btn variant-secondary" id="btn-timer-reset" title="Reset current session">
              ↺ RESET
            </button>
            <button class="cyber-btn sm secondary voxel-btn variant-secondary" id="btn-timer-skip" title="Skip to next session">
              ⏭ SKIP
            </button>
          </div>

          <!-- Footer Strip -->
          <div class="ft-footer-strip">
            <div class="ft-footer-status">
              <span class="sim-dot">●</span>
              <span>OFFLINE LOCAL TIMER • DEADLINE PRECISION</span>
            </div>
            <div class="ft-footer-pct">
              <span id="ft-progress-pct">${progressPct}%</span>
            </div>
          </div>
        </div>
      </div>
    `;

    bindEventHandlers();
  }

  function bindEventHandlers() {
    // Overview Navigation
    const heroStage = container.querySelector("#hero-overview-stage");
    if (heroStage) {
      heroStage.addEventListener("click", () => {
        appActions.playClick();
        showDetail = true;
        render();
      });
    }

    const detailBtn = container.querySelector("#btn-timer-detail");
    if (detailBtn) {
      detailBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        showDetail = true;
        render();
      });
    }

    const heroToggleBtn = container.querySelector("#btn-hero-timer-toggle");
    if (heroToggleBtn) {
      heroToggleBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        const current = focusTimerService.getState();
        if (current.isRunning) {
          focusTimerService.pause();
          appActions.logSerial("[TIMER] Focus timer paused.");
        } else {
          focusTimerService.start();
          appActions.logSerial(`[TIMER] ${current.mode.toUpperCase()} timer started (${current.durationMinutes}m).`);
        }
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

    // Detail Action Handlers
    const playPauseBtn = container.querySelector("#btn-timer-play-pause");
    if (playPauseBtn) {
      playPauseBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        const current = focusTimerService.getState();
        if (current.isRunning) {
          focusTimerService.pause();
          appActions.logSerial("[TIMER] Focus timer paused.");
        } else {
          focusTimerService.start();
          appActions.logSerial(`[TIMER] ${current.mode.toUpperCase()} timer started (${current.durationMinutes}m).`);
        }
      });
    }

    const resetBtn = container.querySelector("#btn-timer-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        const res = focusTimerService.requestReset(false);
        if (res.requiresConfirmation) {
          appActions.logSerial("[TIMER] Reset confirmation requested (active session in progress).");
        } else {
          appActions.logSerial("[TIMER] Timer reset to default preset.");
        }
      });
    }

    const skipBtn = container.querySelector("#btn-timer-skip");
    if (skipBtn) {
      skipBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        const res = focusTimerService.requestSkip(false);
        if (res.requiresConfirmation) {
          appActions.logSerial("[TIMER] Skip confirmation requested (active session in progress).");
        } else {
          appActions.logSerial("[TIMER] Skipped to next interval.");
        }
      });
    }

    container.querySelectorAll("[data-preset]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        const minutes = parseInt(btn.dataset.preset, 10);
        focusTimerService.requestPreset(minutes, false);
      });
    });

    const soundBtn = container.querySelector("#btn-timer-mute");
    if (soundBtn) {
      soundBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        const current = focusTimerService.getState();
        focusTimerService.toggleSound(!current.soundEnabled);
      });
    }

    const dismissBtn = container.querySelector("#btn-dismiss-completion");
    if (dismissBtn) {
      dismissBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        focusTimerService.dismissNotice();
      });
    }

    const confirmDiscardBtn = container.querySelector("#btn-confirm-discard");
    if (confirmDiscardBtn) {
      confirmDiscardBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        focusTimerService.confirmPendingAction();
        appActions.logSerial("[TIMER] Discard confirmed.");
      });
    }

    const cancelDiscardBtn = container.querySelector("#btn-cancel-discard");
    if (cancelDiscardBtn) {
      cancelDiscardBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        focusTimerService.cancelPendingAction();
        appActions.logSerial("[TIMER] Discard cancelled.");
      });
    }
  }

  // Subscribe to service state changes
  const unsubscribeService = focusTimerService.subscribe(() => {
    render();
  });

  // Register interval ticker for UI smooth countdown updates
  uiTicker = setInterval(() => {
    const current = focusTimerService.getState();
    if (current.isRunning) {
      render();
    }
  }, 1000);

  // Initial render
  render();

  // Cleanup on unmount
  return () => {
    if (uiTicker) clearInterval(uiTicker);
    if (typeof unsubscribeService === "function") unsubscribeService();
  };
}
