/**
 * EmbeddedScreenSimulator - Core engine for the 320x240 landscape touchscreen simulator.
 * Simulates the native interface intended for the physical ESP32 + 2.8" SPI touchscreen.
 */

import { createMockState } from "./mockData.js";
import {
  playClickSound,
  playBeepSound,
  playSuccessChime,
  playAlertSound,
  setSoundEnabled,
  isSoundEnabled,
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
  getWeather,
  resetBackend,
  recordHealthCheck,
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

export class EmbeddedScreenSimulator {
  constructor(options = {}) {
    this.state = createMockState();
    this.state.backendConnected = null; // null: initializing, true: online, false: offline
    this.currentScreenIndex = 0;
    this.activeCleanup = null;
    this.isPoweredOn = true;
    this.isStandby = false;
    this.stateListeners = new Set();
    this.pollTimer = null;
    this.clockTimer = null;
    this.logListeners = new Set();

    // Last simulated resistive touch coordinate (0..319, 0..239)
    this.touchInfo = {
      x: 160,
      y: 120,
      pressure: 0,
      isTouching: false,
    };

    this.screens = [
      { id: "home", label: "HOME", title: "SYSTEM STATUS", icon: "⌂", render: renderHomeScreen },
      { id: "servers", label: "SRV", title: "CLUSTER NODES", icon: "≡", render: renderServersScreen },
      { id: "incidents", label: "INC", title: "INCIDENT LOG", icon: "!", render: renderIncidentsScreen },
      { id: "cloudCosts", label: "COST", title: "CLOUD COSTS", icon: "$", render: renderCloudCostsScreen },
      { id: "deploy", label: "DEP", title: "RELEASE PIPELINE", icon: "▲", render: renderDeployScreen },
      { id: "companion", label: "WTHR", title: "WEATHER + CLOCK", icon: "⛅", render: renderCompanionScreen },
      { id: "focusTimer", label: "TIME", title: "FOCUS TIMER", icon: "⏱", render: renderFocusTimerScreen },
      { id: "settings", label: "SET", title: "DEVICE CONFIG", icon: "⚙", render: renderSettingsScreen },
    ];

    // DOM references passed via options or queried
    this.dom = {
      viewport: options.viewport || null,
      screenTitle: options.screenTitle || null,
      statusBarClock: options.statusBarClock || null,
      navContainer: options.navContainer || null,
      lcdScreen: options.lcdScreen || null,
      simBadge: options.simBadge || null,
      ledRxTx: options.ledRxTx || null,
      ledStat: options.ledStat || null,
      ledPwr: options.ledPwr || null,
      touchHud: options.touchHud || null,
    };
  }

  init(skipBootAnimation = false) {
    this.applySettings();
    this.renderNavBar();
    this.startClockTicker();
    this.startBackendPolling();
    this.bootSequence(null, skipBootAnimation);
    this.log("[BOOT] ESP32 ILI9341 320x240 standalone display simulator ready.");
  }

  subscribeStateChange(fn) {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  notifyStateChange() {
    this.stateListeners.forEach((fn) => {
      try {
        fn(this.state);
      } catch (err) {
        console.error("State listener error:", err);
      }
    });
  }

  onLog(fn) {
    this.logListeners.add(fn);
    return () => this.logListeners.delete(fn);
  }

  log(msg) {
    this.logListeners.forEach((fn) => {
      try {
        fn(msg);
      } catch (err) {
        console.error("Log listener error:", err);
      }
    });
  }

  getAppActions() {
    return {
      playClick: () => this.playClick(),
      playBeep: (f, d) => this.playBeep(f, d),
      playSuccess: () => this.playSuccess(),
      playAlert: () => this.playAlert(),
      logSerial: (msg) => this.log(msg),
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
        resetBackend,
        recordHealthCheck,
      },
      refreshBackendState: () => this.refreshBackendState(),
      onStateChange: (fn) => this.subscribeStateChange(fn),
    };
  }

  renderNavBar() {
    if (!this.dom.navContainer) return;
    this.dom.navContainer.innerHTML = this.screens
      .map(
        (screen, idx) => `
        <button class="nav-tab-btn ${idx === this.currentScreenIndex ? "active" : ""}" data-index="${idx}" title="${screen.title}">
          <span class="tab-label">${screen.label}</span>
        </button>
      `
      )
      .join("");

    this.dom.navContainer.querySelectorAll(".nav-tab-btn").forEach((btn) => {
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

    if (this.dom.navContainer) {
      this.dom.navContainer.style.display = "flex";
      this.dom.navContainer.querySelectorAll(".nav-tab-btn").forEach((btn, idx) => {
        btn.classList.toggle("active", idx === index);
      });
    }

    if (this.dom.screenTitle) {
      this.dom.screenTitle.textContent = currentScreen.title;
    }

    if (this.dom.viewport && typeof currentScreen.render === "function") {
      this.activeCleanup = currentScreen.render(
        this.dom.viewport,
        this.state,
        this.getAppActions()
      );
    }

    this.log(`[NAV] Display screen [${index + 1}/${this.screens.length}]: ${currentScreen.title}`);
  }

  nextScreen(skipAnimation = false) {
    if (this.isStandby) {
      this.wakeUp(skipAnimation);
    } else {
      this.switchScreen(this.currentScreenIndex + 1);
    }
  }

  prevScreen(skipAnimation = false) {
    if (this.isStandby) {
      this.wakeUp(skipAnimation);
    } else {
      this.switchScreen(this.currentScreenIndex - 1);
    }
  }

  triggerAction(skipAnimation = false) {
    if (this.isStandby) {
      this.wakeUp(skipAnimation);
      return;
    }
    this.playClick();
    this.log(`[ACTION_BTN] Trigger on screen ${this.screens[this.currentScreenIndex].label}`);

    // If active screen has a primary button, click it; otherwise play acknowledgment beep
    const primaryBtn = this.dom.viewport?.querySelector(".cyber-btn:not(.secondary)");
    if (primaryBtn) {
      primaryBtn.click();
    } else {
      this.playBeep(1200, 0.05);
    }
  }

  togglePower(skipAnimation = false) {
    this.playClick();

    if (this.isStandby) {
      this.wakeUp(skipAnimation);
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

      this.log("[POWER] Power-off initiated. Playing shutdown sequence...");
      if (skipAnimation || !this.dom.viewport) {
        if (this.dom.ledPwr) this.dom.ledPwr.style.background = "#1a1e26";
        if (this.dom.lcdScreen) this.dom.lcdScreen.style.filter = "brightness(0)";
        this.log("[POWER] Display power rail offline.");
        return;
      }

      PulseBotAnimator.playShutdownAnimation(this.dom.viewport, () => {
        if (this.dom.ledPwr) this.dom.ledPwr.style.background = "#1a1e26";
        if (this.dom.lcdScreen) this.dom.lcdScreen.style.filter = "brightness(0)";
        this.log("[POWER] Display power rail offline.");
      });
    } else {
      // Power on
      this.isPoweredOn = true;
      if (this.dom.ledPwr) this.dom.ledPwr.style.background = "var(--accent-amber)";
      if (this.dom.lcdScreen) this.dom.lcdScreen.style.filter = "brightness(1)";
      this.log("[POWER] Display energized. Booting ILI9341...");
      this.bootSequence(null, skipAnimation);
    }
  }

  bootSequence(onComplete, skipAnimation = false) {
    if (this.dom.screenTitle) this.dom.screenTitle.textContent = "BOOT";
    if (this.dom.navContainer) this.dom.navContainer.style.display = "none";

    if (skipAnimation || !this.dom.viewport) {
      if (this.dom.navContainer) this.dom.navContainer.style.display = "flex";
      this.switchScreen(this.currentScreenIndex);
      if (typeof onComplete === "function") onComplete();
      return;
    }

    PulseBotAnimator.playBootAnimation(this.dom.viewport, () => {
      this.playSuccess();
      if (this.dom.navContainer) this.dom.navContainer.style.display = "flex";
      this.switchScreen(this.currentScreenIndex);
      if (typeof onComplete === "function") onComplete();
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

    this.log("[STANDBY] Entering low-power sleep mode with PULSE-BOT standby face.");
    if (this.dom.viewport) {
      PulseBotAnimator.renderStandbyScreen(this.dom.viewport, () => {
        this.wakeUp();
      });
    }
  }

  wakeUp(skipAnimation = false) {
    this.playClick();
    this.isStandby = false;
    this.isPoweredOn = true;
    this.log("[WAKE] Wake interrupt detected. Restoring display...");

    if (skipAnimation || !this.dom.viewport) {
      if (this.dom.navContainer) this.dom.navContainer.style.display = "flex";
      this.switchScreen(this.currentScreenIndex);
      return;
    }

    PulseBotAnimator.playWakeAnimation(this.dom.viewport, () => {
      if (this.dom.navContainer) this.dom.navContainer.style.display = "flex";
      this.switchScreen(this.currentScreenIndex);
    });
  }

  handleTouch(x, y, isDown = true) {
    // Clamps to 320x240 landscape coordinates
    const clampedX = Math.max(0, Math.min(319, Math.round(x)));
    const clampedY = Math.max(0, Math.min(239, Math.round(y)));
    const pressure = isDown ? 240 : 0;

    this.touchInfo = {
      x: clampedX,
      y: clampedY,
      pressure,
      isTouching: isDown,
    };

    if (this.dom.touchHud) {
      this.dom.touchHud.textContent = `TOUCH: X=${clampedX}, Y=${clampedY} (P: ${pressure})`;
      this.dom.touchHud.classList.toggle("active", isDown);
    }

    return this.touchInfo;
  }

  startClockTicker() {
    const updateTime = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      if (this.dom.statusBarClock) {
        this.dom.statusBarClock.textContent = `${hh}:${mm}`;
      }
    };
    updateTime();
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = setInterval(updateTime, 1000);
  }

  startBackendPolling() {
    this.fetchBackendState().catch(() => {});
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

      if (Array.isArray(data.servers)) {
        data.servers.forEach((ds) => {
          let existing = this.state.servers.find((s) => s.id === ds.id);
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

      if (this.dom.simBadge) {
        this.dom.simBadge.textContent = "SIM";
        this.dom.simBadge.className = "lcd-sim-badge";
        this.dom.simBadge.title = "Connected to Flask API @ 127.0.0.1:5000";
      }

      if (wasOffline) {
        this.log("[API_SYNC] Reconnected to Flask API @ 127.0.0.1:5000");
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
        this.log(`[API_OFFLINE] Cannot reach Flask API: ${err.message}`);
      }

      this.notifyStateChange();
      throw err;
    }
  }

  async refreshBackendState() {
    this.flickerRxTxLed();
    return await this.fetchBackendState();
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

  applySettings() {
    const { settings } = this.state;
    if (document.body) {
      document.body.dataset.theme = settings.colorTheme;
    }
    if (this.dom.lcdScreen) {
      this.dom.lcdScreen.style.filter = `brightness(${settings.screenBrightness / 100})`;
    }
    setSoundEnabled(settings.soundEnabled);
  }

  async resetToDefaults() {
    this.state = createMockState();
    this.applySettings();
    this.switchScreen(0);
    this.log("[RESET] Device reset to default state.");
    if (this.state.backendConnected) {
      try {
        await resetBackend();
        await this.refreshBackendState();
        this.log("[RESET] Flask backend cluster state, incidents, budget, and weather reset to defaults.");
      } catch (err) {
        this.log(`[RESET_WARN] Backend reset error: ${err.message}`);
      }
    }
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

  destroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (typeof this.activeCleanup === "function") {
      this.activeCleanup();
      this.activeCleanup = null;
    }
    this.stateListeners.clear();
    this.logListeners.clear();
  }
}
