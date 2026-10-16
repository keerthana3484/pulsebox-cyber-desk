// Screen: FOCUS TIMER — Dedicated Pomodoro Focus & Break Screen
// Precision timestamp-based timer, 100% offline, persistent across reloads.
// Optimized for 320x240 landscape touchscreen with high-contrast cyber aesthetic.

import {
  focusTimerService,
  FOCUS_PRESETS
} from "../timerService.js";

export function renderFocusTimerScreen(container, state, appActions) {
  let uiTicker = null;

  function formatTimeDigits(totalSecs) {
    const s = Math.max(0, Math.floor(totalSecs));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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

    container.innerHTML = `
      <div class="screen-content screen-focus-timer">
        <!-- Subheader: Tech Badge, Title, Session Info, Sound Toggle -->
        <div class="ft-header-strip">
          <div class="ft-header-left">
            <span class="ft-badge ${isFocus ? 'focus' : 'break'}">${isFocus ? 'FOC' : 'BRK'}</span>
            <span class="ft-title-label">FOCUS TIMER</span>
          </div>
          <div class="ft-header-right">
            <span class="ft-session-tag">SESS #${sessionNumber}</span>
            <span class="ft-completed-tag" title="Completed focus sessions">⚡ ${completedSessions} DONE</span>
            <button class="mini-tool-btn ft-sound-btn" id="btn-timer-mute" title="Toggle Audio SFX">
              ${soundEnabled ? '🔊' : '🔇'}
            </button>
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

        <!-- Completion Alert Banner (if recently completed) -->
        ${completionNotice ? `
          <div class="ft-completion-banner ${timerState.lastCompletedMode === 'focus' ? 'celebrate' : 'break-ready'}" id="ft-completion-box">
            <span class="ft-completion-icon">${timerState.lastCompletedMode === 'focus' ? '🎉' : '☕'}</span>
            <span class="ft-completion-msg">${escapeHtml(completionNotice)}</span>
            <button class="ft-banner-close-btn" id="btn-dismiss-completion" title="Dismiss">✕</button>
          </div>
        ` : ''}

        <!-- Confirmation Modal Overlay (for Discard Protection) -->
        ${pendingConfirm ? `
          <div class="ft-confirm-overlay" id="ft-confirm-dialog">
            <div class="ft-confirm-box">
              <div class="ft-confirm-title">⚠ DISCARD ACTIVE ${isFocus ? 'FOCUS' : 'BREAK'} SESSION?</div>
              <div class="ft-confirm-desc">Current session progress will be lost.</div>
              <div class="ft-confirm-btn-row">
                <button class="cyber-btn sm danger" id="btn-confirm-discard">CONFIRM</button>
                <button class="cyber-btn sm secondary" id="btn-cancel-discard">CANCEL</button>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Center Hero: Big Digital Clock & Progress Bar -->
        <div class="ft-hero-clock-box">
          <div class="ft-digits-hero ${isFocus ? 'digits-focus' : 'digits-break'}" id="ft-clock-digits">
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
              <button class="ft-preset-btn ${isFocus && focusPresetMinutes === preset ? 'active' : ''}" data-preset="${preset}">
                ${preset}m
              </button>
            `).join('')}
            <span class="ft-break-preset-tag ${!isFocus ? 'active' : ''}">BREAK: 5m</span>
          </div>
        </div>

        <!-- Main Action Controls Row -->
        <div class="ft-controls-row">
          <button class="cyber-btn sm ${isRunning ? 'warning' : 'primary'}" id="btn-timer-play-pause">
            ${isRunning ? '⏸ PAUSE' : (elapsedSeconds > 0 ? '▶ RESUME' : '▶ START')}
          </button>
          <button class="cyber-btn sm secondary" id="btn-timer-reset" title="Reset current session">
            ↺ RESET
          </button>
          <button class="cyber-btn sm secondary" id="btn-timer-skip" title="Skip to next session">
            ⏭ SKIP
          </button>
        </div>

        <!-- Footer Strip: Offline Local Engine Status -->
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
    `;

    bindEventHandlers();
  }

  function bindEventHandlers() {
    // 1. Play / Pause / Resume
    const playPauseBtn = container.querySelector("#btn-timer-play-pause");
    if (playPauseBtn) {
      playPauseBtn.addEventListener("click", () => {
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

    // 2. Reset
    const resetBtn = container.querySelector("#btn-timer-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        appActions.playClick();
        const res = focusTimerService.requestReset(false);
        if (res.requiresConfirmation) {
          appActions.logSerial("[TIMER] Reset confirmation requested (active session in progress).");
        } else {
          appActions.logSerial("[TIMER] Timer reset to default preset.");
        }
      });
    }

    // 3. Skip
    const skipBtn = container.querySelector("#btn-timer-skip");
    if (skipBtn) {
      skipBtn.addEventListener("click", () => {
        appActions.playClick();
        const res = focusTimerService.requestSkip(false);
        if (res.requiresConfirmation) {
          appActions.logSerial("[TIMER] Skip confirmation requested (active session in progress).");
        } else {
          appActions.logSerial("[TIMER] Skipped to next interval.");
        }
      });
    }

    // 4. Presets (15, 25, 45)
    container.querySelectorAll("[data-preset]").forEach(btn => {
      btn.addEventListener("click", () => {
        appActions.playClick();
        const minutes = parseInt(btn.dataset.preset, 10);
        focusTimerService.requestPreset(minutes, false);
      });
    });

    // 5. Sound / Mute Toggle
    const soundBtn = container.querySelector("#btn-timer-mute");
    if (soundBtn) {
      soundBtn.addEventListener("click", () => {
        const nextSound = focusTimerService.toggleSound();
        if (typeof appActions.toggleSound === "function") {
          appActions.toggleSound(nextSound);
        }
        appActions.playClick();
        appActions.logSerial(`[AUDIO] Audio SFX ${nextSound ? 'enabled' : 'muted'}.`);
      });
    }

    // 6. Confirmation Modal Actions
    const confirmBtn = container.querySelector("#btn-confirm-discard");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        appActions.playClick();
        focusTimerService.confirmPendingAction();
        appActions.logSerial("[TIMER] Discard confirmed.");
      });
    }

    const cancelBtn = container.querySelector("#btn-cancel-discard");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        appActions.playClick();
        focusTimerService.cancelPendingAction();
      });
    }

    // 7. Dismiss Completion Notice
    const dismissBtn = container.querySelector("#btn-dismiss-completion");
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        appActions.playClick();
        focusTimerService.dismissNotice();
      });
    }
  }

  // Fast DOM-only ticker to update digits and progress bar without re-rendering the whole DOM
  function updateDomFast() {
    focusTimerService.sync();
    const timerState = focusTimerService.getState();

    const digitsEl = container.querySelector("#ft-clock-digits");
    const progressFillEl = container.querySelector("#ft-progress-fill");
    const progressPctEl = container.querySelector("#ft-progress-pct");

    if (digitsEl) {
      digitsEl.textContent = formatTimeDigits(timerState.remainingSeconds);
    }

    if (progressFillEl || progressPctEl) {
      const totalSeconds = timerState.durationMinutes * 60;
      const elapsedSeconds = Math.max(0, totalSeconds - timerState.remainingSeconds);
      const pct = totalSeconds > 0 ? Math.min(100, Math.round((elapsedSeconds / totalSeconds) * 100)) : 0;

      if (progressFillEl) progressFillEl.style.width = `${pct}%`;
      if (progressPctEl) progressPctEl.textContent = `${pct}%`;
    }
  }

  // Initial render
  render();

  // Subscribe to service state changes (e.g. start/pause/reset/completion/confirmation)
  const unsubscribeService = focusTimerService.subscribe(() => {
    render();
  });

  // Start 1-second interval for live countdown display
  uiTicker = setInterval(() => {
    const s = focusTimerService.getState();
    if (s.isRunning) {
      updateDomFast();
    }
  }, 1000);

  // Return cleanup function to guarantee zero dangling timers or listeners on unmount
  return () => {
    if (uiTicker) {
      clearInterval(uiTicker);
      uiTicker = null;
    }
    if (typeof unsubscribeService === "function") {
      unsubscribeService();
    }
  };
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
