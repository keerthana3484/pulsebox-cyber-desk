// Main Simulator Application Controller
import { createMockState } from "./mockData.js";
import {
  playClickSound,
  playBeepSound,
  playSuccessChime,
  playAlertSound,
  setSoundEnabled,
  isSoundEnabled
} from "./audio.js";
import { PulseBotAnimator } from "./mascot.js";
import {
  getHealth,
  getState,
  simulateFailure,
  restoreServer,
  getIncidents,
  getCosts,
  getCostSettings,
  updateCostBudget,
  getWeather
} from "./api.js";

// Screen Renderers
import { renderHomeScreen } from "./screens/home.js";
import { renderServersScreen } from "./screens/servers.js";
import { renderIncidentsScreen } from "./screens/incidents.js";
import { renderCloudCostsScreen } from "./screens/cloudCosts.js";
import { renderDeployScreen } from "./screens/deploy.js";
import { renderCompanionScreen } from "./screens/companion.js";
import { renderFocusTimerScreen } from "./screens/focusTimer.js";
import { renderSettingsScreen } from "./screens/settings.js";

class PulseBoxSimulator {
  constructor() {
    this.state = createMockState();
    this.state.backendConnected = null; // null: initializing, true: connected, false: offline
    this.currentScreenIndex = 0;
    this.activeCleanup = null;
    this.isPoweredOn = true;
    this.isStandby = false;
    this.stateListeners = new Set();
    this.pollTimer = null;

    this.screens = [
      { id: "home", label: "HOME", title: "HOME", icon: "⌂", render: renderHomeScreen },
      { id: "servers", label: "SRV", title: "SERVERS", icon: "≡", render: renderServersScreen },
      { id: "incidents", label: "INC", title: "INCIDENTS", icon: "!", render: renderIncidentsScreen },
      { id: "cloudCosts", label: "COST", title: "CLOUD COSTS", icon: "$", render: renderCloudCostsScreen },
      { id: "deploy", label: "DEP", title: "DEPLOY", icon: "▲", render: renderDeployScreen },
      { id: "companion", label: "WTHR", title: "WEATHER + CLOCK", icon: "⛅", render: renderCompanionScreen },
      { id: "focusTimer", label: "TIME", title: "FOCUS TIMER", icon: "⏱", render: renderFocusTimerScreen },
      { id: "settings", label: "SET", title: "SETTINGS", icon: "⚙", render: renderSettingsScreen },
    ];

    this.dom = {
      viewport: document.getElementById("lcd-viewport"),
      screenTitle: document.getElementById("lcd-screen-title"),
      statusBarClock: document.getElementById("lcd-status-clock"),
      navContainer: document.getElementById("lcd-nav-bar"),
      scanlineLayer: document.getElementById("crt-scanlines"),
      tinBoxWrapper: document.getElementById("tin-box-wrapper"),
      serialStream: document.getElementById("serial-logs-stream"),
      ledRxTx: document.getElementById("led-rxtx"),
      ledStat: document.getElementById("led-stat"),
      ledPwr: document.getElementById("led-pwr"),
      lcdScreen: document.getElementById("lcd-screen"),
      simBadge: document.querySelector(".lcd-sim-badge"),
    };

    this.init();
  }

  init() {
    this.applySettings();
    this.renderNavBar();
    this.bindHardwareButtons();
    this.bindWorkbenchControls();
    this.startClockTicker();

    // Start 3-second background polling against Flask API
    this.startBackendPolling();

    // Initial boot sequence with full-screen PULSE-BOT animation
    this.bootSequence();

    this.logSerial("[BOOT] ESP32-S3 initialized @ 240MHz. Display: 320x240 ILI9341");
    this.logSerial("[SIM_READY] PulseBox minimal cyber desk operational.");
  }

  subscribeStateChange(fn) {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  notifyStateChange() {
    this.stateListeners.forEach(fn => {
      try {
        fn(this.state);
      } catch (err) {
        console.error("State listener error:", err);
      }
    });
  }

  startBackendPolling() {
    // Initial fetch immediately
    this.fetchBackendState().catch(() => {});

    // Poll every 3 seconds
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      if (this.isPoweredOn && !this.isStandby) {
        this.fetchBackendState().catch(() => {});
      }
    }, 3000);
  }

  async fetchBackendState() {
    try {
      const data = await getState();
      const wasOffline = this.state.backendConnected === false;

      this.state.backendConnected = true;
      this.state.system.overallHealth = data.overall_health;
      this.state.system.serverCount = data.server_count;
      this.state.system.failedServerCount = data.failed_server_count;
      this.state.system.onlineServerCount = data.online_server_count;
      this.state.system.averageLatencyMs = data.average_latency_ms;
      this.state.system.lastEvent = data.last_event;

      // Update servers array with backend source of truth
      if (Array.isArray(data.servers)) {
        data.servers.forEach(ds => {
          let existing = this.state.servers.find(s => s.id === ds.id);
          if (existing) {
            existing.status = ds.status;
            existing.latencyMs = ds.latency_ms;
            existing.name = ds.name;
            existing.role = ds.role;
            if (!existing.history) existing.history = [];
            existing.history.push(ds.latency_ms);
            if (existing.history.length > 10) existing.history.shift();
          } else {
            this.state.servers.push({
              ...ds,
              latencyMs: ds.latency_ms,
              history: [ds.latency_ms],
            });
          }
        });
      }

      // Update status bar badge
      if (this.dom.simBadge) {
        this.dom.simBadge.textContent = "SIM";
        this.dom.simBadge.className = "lcd-sim-badge";
        this.dom.simBadge.title = "Connected to Flask API @ 127.0.0.1:5000";
      }

      if (wasOffline) {
        this.logSerial("[API_SYNC] Reconnected to Flask API @ 127.0.0.1:5000");
      }

      this.notifyStateChange();
      return data;
    } catch (err) {
      const wasOnline = this.state.backendConnected !== false;
      this.state.backendConnected = false;
      this.state.system.overallHealth = "OFFLINE";
      this.state.system.lastEvent = `Backend connection error: ${err.message}`;

      if (this.dom.simBadge) {
        this.dom.simBadge.textContent = "OFFLINE";
        this.dom.simBadge.className = "lcd-sim-badge offline";
        this.dom.simBadge.title = "Flask API offline @ 127.0.0.1:5000";
      }

      if (wasOnline) {
        this.logSerial(`[API_OFFLINE] Cannot reach Flask API: ${err.message}`);
      }

      this.notifyStateChange();
      throw err;
    }
  }

  async refreshBackendState() {
    this.flickerRxTxLed();
    return await this.fetchBackendState();
  }

  getAppActions() {
    return {
      playClick: () => this.playClick(),
      playBeep: (f, d) => this.playBeep(f, d),
      playSuccess: () => this.playSuccess(),
      playAlert: () => this.playAlert(),
      logSerial: (msg) => this.logSerial(msg),
      toggleSound: (enabled) => this.toggleSound(enabled),
      applySettings: () => this.applySettings(),
      resetToDefaults: () => this.resetToDefaults(),
      switchScreen: (idx) => this.switchScreen(idx),
      enterStandby: () => this.enterStandby(),
      api: {
        getHealth,
        getState,
        simulateFailure,
        restoreServer,
        getIncidents,
        getCosts,
        getCostSettings,
        updateCostBudget,
        getWeather,
      },
      refreshBackendState: () => this.refreshBackendState(),
      onStateChange: (fn) => this.subscribeStateChange(fn),
    };
  }

  renderNavBar() {
    if (!this.dom.navContainer) return;
    this.dom.navContainer.innerHTML = this.screens.map((screen, idx) => `
      <button class="nav-tab-btn ${idx === this.currentScreenIndex ? 'active' : ''}" data-index="${idx}" title="${screen.title}">
        <span class="tab-label">${screen.label}</span>
      </button>
    `).join('');

    this.dom.navContainer.querySelectorAll(".nav-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index, 10);
        this.switchScreen(idx);
      });
    });
  }

  switchScreen(index) {
    if (!this.isPoweredOn || this.isStandby) return;
    if (index < 0) index = this.screens.length - 1;
    if (index >= this.screens.length) index = 0;

    this.currentScreenIndex = index;
    const currentScreen = this.screens[index];

    this.playClick();
    this.flickerRxTxLed();

    // Clean up previous screen listeners/tickers
    if (typeof this.activeCleanup === "function") {
      this.activeCleanup();
      this.activeCleanup = null;
    }

    // Ensure nav bar is visible
    if (this.dom.navContainer) {
      this.dom.navContainer.style.display = "flex";
    }

    // Update screen title in LCD status bar
    if (this.dom.screenTitle) {
      this.dom.screenTitle.textContent = currentScreen.title;
    }

    // Update active nav tab
    if (this.dom.navContainer) {
      this.dom.navContainer.querySelectorAll(".nav-tab-btn").forEach((btn, idx) => {
        btn.classList.toggle("active", idx === index);
      });
    }

    // Render screen
    if (this.dom.viewport) {
      this.activeCleanup = currentScreen.render(
        this.dom.viewport,
        this.state,
        this.getAppActions()
      );
    }

    this.logSerial(`[NAV] Screen [${index + 1}/${this.screens.length}]: ${currentScreen.title}`);
  }

  bindHardwareButtons() {
    // Physical Prev Button
    const btnPrev = document.getElementById("hw-btn-prev");
    if (btnPrev) {
      btnPrev.addEventListener("click", () => {
        if (this.isStandby) {
          this.wakeUp();
        } else {
          this.switchScreen(this.currentScreenIndex - 1);
        }
      });
    }

    // Physical Next Button
    const btnNext = document.getElementById("hw-btn-next");
    if (btnNext) {
      btnNext.addEventListener("click", () => {
        if (this.isStandby) {
          this.wakeUp();
        } else {
          this.switchScreen(this.currentScreenIndex + 1);
        }
      });
    }

    // Physical Action Button
    const btnAction = document.getElementById("hw-btn-action");
    if (btnAction) {
      btnAction.addEventListener("click", () => {
        if (this.isStandby) {
          this.wakeUp();
          return;
        }
        this.playClick();
        this.logSerial(`[HW_BTN] ACTION trigger on ${this.screens[this.currentScreenIndex].label}`);
        const primaryBtn = this.dom.viewport?.querySelector(".cyber-btn:not(.secondary)");
        if (primaryBtn) {
          primaryBtn.click();
        } else {
          this.playBeep(1200, 0.05);
        }
      });
    }

    // Power Toggle Switch
    const btnPower = document.getElementById("hw-toggle-power");
    if (btnPower) {
      btnPower.addEventListener("click", () => {
        this.togglePower();
      });
    }
  }

  togglePower() {
    this.playClick();

    if (this.isStandby) {
      this.wakeUp();
      return;
    }

    if (this.isPoweredOn) {
      // Shutdown sequence
      this.isPoweredOn = false;
      if (typeof this.activeCleanup === "function") {
        this.activeCleanup();
        this.activeCleanup = null;
      }

      if (this.dom.screenTitle) this.dom.screenTitle.textContent = "SHUTDOWN";
      if (this.dom.navContainer) this.dom.navContainer.style.display = "none";

      this.logSerial("[POWER] Power-off initiated. Playing shutdown sequence...");
      PulseBotAnimator.playShutdownAnimation(this.dom.viewport, () => {
        if (this.dom.ledPwr) this.dom.ledPwr.style.background = "#1a1e26";
        if (this.dom.lcdScreen) this.dom.lcdScreen.style.filter = "brightness(0)";
        this.logSerial("[POWER] System power rail offline.");
      });
    } else {
      // Power on
      this.isPoweredOn = true;
      if (this.dom.ledPwr) this.dom.ledPwr.style.background = "var(--accent-amber)";
      if (this.dom.lcdScreen) this.dom.lcdScreen.style.filter = "brightness(1)";
      this.logSerial("[POWER] Power rail energized. Booting ESP32...");
      this.bootSequence();
    }
  }

  bootSequence() {
    if (this.dom.screenTitle) this.dom.screenTitle.textContent = "BOOT";
    if (this.dom.navContainer) this.dom.navContainer.style.display = "none";

    PulseBotAnimator.playBootAnimation(this.dom.viewport, () => {
      this.playSuccess();
      if (this.dom.navContainer) this.dom.navContainer.style.display = "flex";
      this.switchScreen(this.currentScreenIndex);
    });
  }

  enterStandby() {
    this.isStandby = true;
    if (typeof this.activeCleanup === "function") {
      this.activeCleanup();
      this.activeCleanup = null;
    }

    if (this.dom.screenTitle) this.dom.screenTitle.textContent = "STANDBY";
    if (this.dom.navContainer) this.dom.navContainer.style.display = "none";

    this.logSerial("[STANDBY] Entering low-power sleep mode with PULSE-BOT standby face.");
    PulseBotAnimator.renderStandbyScreen(this.dom.viewport, () => {
      this.wakeUp();
    });
  }

  wakeUp() {
    this.playClick();
    this.logSerial("[WAKE] Wake signal received. Restoring display...");

    PulseBotAnimator.playWakeAnimation(this.dom.viewport, () => {
      this.isStandby = false;
      this.isPoweredOn = true;
      if (this.dom.navContainer) this.dom.navContainer.style.display = "flex";
      this.switchScreen(this.currentScreenIndex);
    });
  }

  bindWorkbenchControls() {
    // Zoom / Scale switcher buttons
    document.querySelectorAll(".scale-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.playClick();
        document.querySelectorAll(".scale-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const scale = btn.dataset.scale;
        this.setZoomScale(scale);
      });
    });

    // Sound toggle in top header
    const soundToggle = document.getElementById("wb-sound-toggle");
    if (soundToggle) {
      soundToggle.addEventListener("click", () => {
        const nextState = !isSoundEnabled();
        this.toggleSound(nextState);
        soundToggle.textContent = nextState ? "🔊 SFX ON" : "🔇 MUTED";
        soundToggle.classList.toggle("active", nextState);
        this.playClick();
      });
    }

    // Direct Screen jump shortcuts in header
    document.querySelectorAll(".screen-jump-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetIdx = parseInt(btn.dataset.target, 10);
        if (this.isStandby) this.wakeUp();
        this.switchScreen(targetIdx);
      });
    });
  }

  setZoomScale(scale) {
    if (!this.dom.tinBoxWrapper) return;
    this.dom.tinBoxWrapper.className = `tin-box-wrapper scale-${scale}`;
  }

  startClockTicker() {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);
      if (this.dom.statusBarClock) {
        this.dom.statusBarClock.textContent = timeStr;
      }
    };
    updateTime();
    setInterval(updateTime, 1000);
  }

  applySettings() {
    if (this.dom.scanlineLayer) {
      this.dom.scanlineLayer.classList.toggle("disabled", !this.state.settings.crtScanlines);
    }
    document.body.setAttribute("data-theme", this.state.settings.colorTheme);
    if (this.dom.lcdScreen) {
      this.dom.lcdScreen.style.filter = `brightness(${this.state.settings.screenBrightness / 100})`;
    }
    setSoundEnabled(this.state.settings.soundEnabled);
  }

  resetToDefaults() {
    this.state = createMockState();
    this.applySettings();
    this.switchScreen(0);
    this.refreshBackendState().catch(() => {});
    this.logSerial("[FACTORY_RESET] Defaults restored.");
  }

  toggleSound(enabled) {
    this.state.settings.soundEnabled = enabled;
    setSoundEnabled(enabled);
  }

  playClick() {
    playClickSound();
  }

  playBeep(freq, dur) {
    playBeepSound(freq, dur);
  }

  playSuccess() {
    playSuccessChime();
  }

  playAlert() {
    playAlertSound();
  }

  flickerRxTxLed() {
    if (!this.dom.ledRxTx) return;
    this.dom.ledRxTx.style.background = "#fff";
    this.dom.ledRxTx.style.boxShadow = "0 0 10px #fff";
    setTimeout(() => {
      this.dom.ledRxTx.style.background = "var(--accent-orange)";
      this.dom.ledRxTx.style.boxShadow = "0 0 7px var(--accent-orange)";
    }, 60);
  }

  logSerial(message) {
    if (!this.dom.serialStream) return;
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + "." + String(now.getMilliseconds()).padStart(3, '0');

    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.innerHTML = `<span class="timestamp">[${timeStr}]</span> <span class="log-text">${escapeHtml(message)}</span>`;

    this.dom.serialStream.appendChild(entry);
    this.dom.serialStream.scrollTop = this.dom.serialStream.scrollHeight;

    while (this.dom.serialStream.children.length > 80) {
      this.dom.serialStream.removeChild(this.dom.serialStream.firstChild);
    }
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.addEventListener("DOMContentLoaded", () => {
  window.pulseBox = new PulseBoxSimulator();
});
