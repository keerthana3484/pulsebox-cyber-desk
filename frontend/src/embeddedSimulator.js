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
  playLevelUpSound,
  playRecoveryChime,
  playGentleAlertSound,
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
import { buildHotbarNavigation } from "./voxelComponents.js";

export class EmbeddedScreenSimulator {
  constructor(options = {}) {
    this.state = createMockState();
    this.state.backendConnected = null; // null: initializing, true: online, false: offline
    this.currentScreenIndex = 0;
    this.activeCleanup = null;
    this.isPoweredOn = true;
    this.isStandby = false;
    this.isDemoMode = false;
    this.demoStep = 0;
    this.demoTimer = null;
    this.mockIncidents = [];
    this.stateListeners = new Set();
    this.pollTimer = null;
    this.clockTimer = null;
    this.idleTicker = null;
    this.idleTick = 0;
    this.lastKnownFailedCount = null;
    this.recoveryMoodTimer = null;
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
    this.startIdleAnimationTicker();

    // Check if Demo Mode should be active by default:
    const isUrlDemo = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "true";
    const isSavedDemo = typeof localStorage !== "undefined" && localStorage.getItem("pulsebox_demo_mode") === "true";
    const isStaticHosted = typeof window !== "undefined" && window.location.hostname && !["localhost", "127.0.0.1"].includes(window.location.hostname);

    if (isUrlDemo || isSavedDemo || isStaticHosted) {
      this.enableDemoMode(false);
    } else {
      this.startBackendPolling();
    }

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
      playLevelUp: () => this.playLevelUp(),
      playRecoveryChime: () => this.playRecoveryChime(),
      playGentleAlert: () => this.playGentleAlert(),
      triggerRecoveryCelebration: () => this.triggerRecoveryCelebration(),
      triggerIncidentAlert: () => this.triggerIncidentAlert(),
      logSerial: (msg) => this.log(msg),
      toggleSound: (enabled) => this.toggleSound(enabled),
      applySettings: () => this.applySettings(),
      resetToDefaults: () => this.resetToDefaults(),
      switchScreen: (idx) => this.switchScreen(idx),
      enterStandby: () => this.enterStandby(),
      toggleDemoMode: (force) => this.toggleDemoMode(force),
      isDemoMode: () => this.isDemoMode,
      api: {
        getHealth: async () => {
          if (this.isDemoMode) {
            return { status: "healthy", service: "pulsebox-demo", uptime_seconds: this.state.system.uptimeSeconds };
          }
          return getHealth();
        },
        getState: async () => {
          if (this.isDemoMode) {
            return {
              overall_health: this.state.system.overallHealth,
              server_count: this.state.system.serverCount,
              failed_server_count: this.state.system.failedServerCount,
              online_server_count: this.state.system.onlineServerCount,
              average_latency_ms: this.state.system.averageLatencyMs,
              last_event: this.state.system.lastEvent,
              servers: this.state.servers.map(s => ({
                id: s.id,
                name: s.name,
                role: s.role,
                status: s.status,
                latency_ms: s.latencyMs,
              })),
            };
          }
          return getState();
        },
        simulateFailure: async (serverId) => {
          if (this.isDemoMode) {
            const srv = this.state.servers.find(s => s.id === serverId) || this.state.servers[0];
            if (srv) {
              srv.status = "failed";
              srv.latencyMs = 999;
            }
            this.state.system.failedServerCount = this.state.servers.filter(s => s.status === "failed").length;
            this.state.system.onlineServerCount = this.state.servers.filter(s => s.status === "online").length;
            this.state.system.overallHealth = "DEGRADED";
            this.state.mascotMood = "worried";
            this.playGentleAlert();
            this.renderCurrentScreen();
            return { status: "success", server: srv };
          }
          return simulateFailure(serverId);
        },
        restoreServer: async (serverId = null) => {
          if (this.isDemoMode) {
            if (serverId) {
              const srv = this.state.servers.find(s => s.id === serverId);
              if (srv) srv.status = "online";
            } else {
              this.state.servers.forEach(s => s.status = "online");
            }
            this.state.system.failedServerCount = this.state.servers.filter(s => s.status === "failed").length;
            this.state.system.onlineServerCount = this.state.servers.filter(s => s.status === "online").length;
            if (this.state.system.failedServerCount === 0) {
              this.state.system.overallHealth = "NOMINAL";
              this.triggerRecoveryCelebration();
            } else {
              this.renderCurrentScreen();
            }
            return { status: "success" };
          }
          return restoreServer(serverId);
        },
        getIncidents: async () => {
          if (this.isDemoMode) {
            return this.mockIncidents;
          }
          return getIncidents();
        },
        getCosts: async () => {
          if (this.isDemoMode) {
            const cc = this.state.cloudCosts;
            return {
              today_spend: 64.20,
              month_spend: cc.currentSpend,
              monthly_budget: cc.monthlyBudget,
              budget_used_pct: Math.round((cc.currentSpend / cc.monthlyBudget) * 1000) / 10,
              remaining_budget: Math.max(0, cc.monthlyBudget - cc.currentSpend),
              budget_status: cc.currentSpend > cc.monthlyBudget ? "BUDGET EXCEEDED" : (cc.currentSpend / cc.monthlyBudget > 0.85 ? "WARNING" : "NORMAL"),
              daily_trend: cc.dailyTrend.map((v, i) => ({ day: i + 1, amount: v })),
              breakdown: cc.breakdown,
              days_remaining: cc.daysRemaining,
              timestamp: new Date().toISOString(),
            };
          }
          return getCosts();
        },
        getCostSettings: async () => {
          if (this.isDemoMode) {
            return { monthly_budget: this.state.cloudCosts.monthlyBudget };
          }
          return getCostSettings();
        },
        updateCostBudget: async (newBudget) => {
          if (this.isDemoMode) {
            this.state.cloudCosts.monthlyBudget = Number(newBudget);
            return { status: "success", monthly_budget: Number(newBudget) };
          }
          return updateCostBudget(newBudget);
        },
        getWeather: async () => {
          if (this.isDemoMode) {
            return {
              location: "DEMO LOCATION",
              condition: "Partly Cloudy",
              condition_symbol: "⛅",
              temperature_f: 72,
              temperature_c: 22,
              feels_like_f: 72,
              feels_like_c: 22,
              humidity_pct: 58,
              wind_speed_mph: 8.5,
              wind_direction: "NW",
              pressure_hpa: 1014,
              uv_index: 3,
              simulation_mode: true,
            };
          }
          return getWeather();
        },
        resetBackend: async () => {
          if (this.isDemoMode) {
            this.applyDemoState(0);
            return { status: "success" };
          }
          return resetBackend();
        },
        recordHealthCheck: async (payload) => {
          if (this.isDemoMode) return { status: "recorded" };
          return recordHealthCheck(payload);
        },
      },
      refreshBackendState: () => this.refreshBackendState(),
      onStateChange: (fn) => this.subscribeStateChange(fn),
    };
  }

  renderNavBar() {
    if (!this.dom.navContainer) return;
    const items = this.screens.map((s) => ({ label: s.label, icon: s.icon }));
    this.dom.navContainer.innerHTML = buildHotbarNavigation({
      activeIndex: this.currentScreenIndex,
      items,
    });

    this.dom.navContainer.querySelectorAll(".voxel-hotbar-slot, .nav-tab-btn").forEach((btn) => {
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

    const prevIndex = this.currentScreenIndex;
    const isForward = index >= prevIndex;
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
      this.dom.navContainer.querySelectorAll(".voxel-hotbar-slot, .nav-tab-btn").forEach((btn, idx) => {
        btn.classList.toggle("is-active", idx === index);
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

      // Trigger 8-step block wipe / slide transition
      const wipeClass = isForward ? "voxel-block-wipe-forward" : "voxel-block-wipe-backward";
      this.dom.viewport.classList.remove("voxel-block-wipe-forward", "voxel-block-wipe-backward");
      void this.dom.viewport.offsetWidth; // trigger reflow
      this.dom.viewport.classList.add(wipeClass);

      setTimeout(() => {
        this.dom.viewport?.classList.remove(wipeClass);
      }, 250);
    }

    this.log(`[NAV] Display screen [${index + 1}/${this.screens.length}]: ${currentScreen.title}`);
  }

  renderCurrentScreen() {
    if (!this.isPoweredOn || this.isStandby || !this.dom.viewport) return;
    const currentScreen = this.screens[this.currentScreenIndex];
    if (typeof currentScreen.render === "function") {
      if (typeof this.activeCleanup === "function") {
        this.activeCleanup();
        this.activeCleanup = null;
      }
      this.activeCleanup = currentScreen.render(
        this.dom.viewport,
        this.state,
        this.getAppActions()
      );
    }
  }

  startIdleAnimationTicker() {
    if (this.idleTicker) clearInterval(this.idleTicker);
    // 6 FPS (~166ms) idle cycle updating only dirty regions
    this.idleTicker = setInterval(() => {
      this.tickIdleDirtyRegions();
    }, 166);
  }

  tickIdleDirtyRegions() {
    if (!this.isPoweredOn || this.isStandby || !this.dom.viewport) return;
    this.idleTick = (this.idleTick + 1) % 48;

    // 1. Dirty Region A: Antenna Beacon Glow / Pulse (6-frame stepped cycle)
    const beacons = this.dom.viewport.querySelectorAll(".pulse-beacon");
    if (beacons.length > 0) {
      const beaconOpacities = ["0.45", "0.65", "0.85", "1.0", "0.85", "0.60"];
      const op = beaconOpacities[this.idleTick % 6];
      beacons.forEach((b) => {
        b.setAttribute("opacity", op);
      });
    }

    // 2. Dirty Region B: Mascot Eye Blink (Stepped retro blink every ~6s)
    const eyeGroups = this.dom.viewport.querySelectorAll(".mascot-eyes");
    if (eyeGroups.length > 0) {
      const isBlinkFrame = (this.idleTick % 36) >= 34; // frames 34 and 35 (approx 330ms blink)
      eyeGroups.forEach((eg) => {
        if (isBlinkFrame) {
          if (!eg.dataset.isBlinking) {
            eg.dataset.isBlinking = "true";
            eg.dataset.origContent = eg.innerHTML;
            const svg = eg.closest(".pulsebot-mascot-svg");
            const isWorried = svg?.classList.contains("expression-worried");
            const color = isWorried ? "#FFB300" : "#00E676";
            eg.innerHTML = `
              <rect x="7" y="11" width="5" height="1" fill="${color}" />
              <rect x="16" y="11" width="5" height="1" fill="${color}" />
            `;
          }
        } else if (eg.dataset.isBlinking) {
          delete eg.dataset.isBlinking;
          if (eg.dataset.origContent) {
            eg.innerHTML = eg.dataset.origContent;
            delete eg.dataset.origContent;
          }
        }
      });
    }

    // 3. Dirty Region C: Sky Stars Twinkle (Companion screen)
    const starLayers = this.dom.viewport.querySelectorAll(".voxel-sky-stars");
    if (starLayers.length > 0) {
      const starOp = (this.idleTick % 4 === 0) ? "0.75" : "1.0";
      starLayers.forEach((sl) => {
        if (sl.style.opacity !== starOp) sl.style.opacity = starOp;
      });
    }
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

  setTheme(theme) {
    if (!this.state.settings) this.state.settings = {};
    this.state.settings.colorTheme = theme;
    this.state.settings.theme = theme;
    if (typeof document !== "undefined" && document.body) {
      if (document.body.dataset) {
        document.body.dataset.theme = theme;
      }
      if (typeof document.body.setAttribute === "function") {
        document.body.setAttribute("data-theme", theme);
      }
      if (document.body.classList) {
        if (theme === "day") {
          document.body.classList.add("day-mode");
        } else {
          document.body.classList.remove("day-mode");
        }
      }
    }
    this.renderCurrentScreen();
  }

  handleDoubleTap() {
    if (this.isStandby) {
      this.wakeUp(true);
    }
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

      const prevFailed = this.lastKnownFailedCount;
      const currentFailed = data.failed_server_count ?? 0;
      this.lastKnownFailedCount = currentFailed;

      if (prevFailed !== null) {
        // Transition A: Healthy -> Incident
        if (prevFailed === 0 && currentFailed > 0) {
          this.triggerIncidentAlert();
        }
        // Transition B: Incident -> Recovery
        else if (prevFailed > 0 && currentFailed === 0) {
          this.triggerRecoveryCelebration();
        }
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

  triggerRecoveryCelebration() {
    this.playRecoveryChime();
    this.state.mascotMood = "celebrating";
    this.log("[RECOVERY] Subsystems restored! 0 failed nodes. PulseBot -> celebrating.");
    this.renderCurrentScreen();

    if (this.recoveryMoodTimer) clearTimeout(this.recoveryMoodTimer);
    this.recoveryMoodTimer = setTimeout(() => {
      if (this.state.mascotMood === "celebrating") {
        this.state.mascotMood = "happy";
        this.renderCurrentScreen();
      }
    }, 4500);
  }

  triggerIncidentAlert() {
    this.playGentleAlert();
    this.state.mascotMood = "worried";
    this.log("[ALERT] Incident detected! PulseBot -> worried.");
    this.renderCurrentScreen();
  }

  toggleDemoMode(force = null) {
    const nextState = force !== null ? Boolean(force) : !this.isDemoMode;
    if (nextState) {
      this.enableDemoMode();
    } else {
      this.disableDemoMode();
    }
    return this.isDemoMode;
  }

  enableDemoMode(playSound = true) {
    if (playSound) this.playClick();
    this.isDemoMode = true;
    try {
      localStorage.setItem("pulsebox_demo_mode", "true");
    } catch {}

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.state.backendConnected = true;

    if (this.dom.simBadge) {
      this.dom.simBadge.textContent = "DEMO";
      this.dom.simBadge.className = "lcd-sim-badge demo";
      this.dom.simBadge.title = "Autonomous Demo Mode (Zero backend required)";
    }

    this.log("[DEMO] Autonomous Demo Mode ENABLED. Cycling: Healthy -> Incident -> Recovery.");
    this.demoStep = 0;
    this.applyDemoState(0);
    this.startDemoCycle();
    this.notifyStateChange();
  }

  disableDemoMode(playSound = true) {
    if (playSound) this.playClick();
    this.isDemoMode = false;
    try {
      localStorage.setItem("pulsebox_demo_mode", "false");
    } catch {}

    if (this.demoTimer) {
      clearInterval(this.demoTimer);
      this.demoTimer = null;
    }

    if (this.dom.simBadge) {
      this.dom.simBadge.textContent = this.state.backendConnected ? "SIM" : "OFFLINE";
      this.dom.simBadge.className = this.state.backendConnected ? "lcd-sim-badge" : "lcd-sim-badge offline";
      this.dom.simBadge.title = "Connected to Flask API @ 127.0.0.1:5000";
    }

    this.log("[DEMO] Demo Mode DISABLED. Resuming Flask backend sync.");
    this.startBackendPolling();
    this.notifyStateChange();
  }

  startDemoCycle() {
    if (this.demoTimer) clearInterval(this.demoTimer);
    // Cycle every 10 seconds through Healthy (0) -> Incident (1) -> Recovery (2)
    this.demoTimer = setInterval(() => {
      if (!this.isDemoMode || !this.isPoweredOn || this.isStandby) return;
      this.demoStep = (this.demoStep + 1) % 3;
      this.applyDemoState(this.demoStep);
      this.notifyStateChange();
    }, 10000);
  }

  applyDemoState(step) {
    if (step === 0) {
      // 1. HEALTHY / NOMINAL
      this.state.system.overallHealth = "NOMINAL";
      this.state.system.failedServerCount = 0;
      this.state.system.onlineServerCount = 6;
      this.state.system.serverCount = 6;
      this.state.system.averageLatencyMs = 21;
      this.state.system.lastEvent = "All 6 node health checks OK. Latency 21ms.";
      this.state.servers.forEach((s, idx) => {
        s.status = "online";
        s.latencyMs = [24, 18, 12, 2, 31, 45][idx] || 20;
        if (!s.history) s.history = [];
        s.history.push(s.latencyMs);
        if (s.history.length > 10) s.history.shift();
      });
      this.state.mascotMood = "happy";
      this.mockIncidents = [];
      this.log("[DEMO] Step 1/3: HEALTHY — All 6 nodes online, nominal telemetry.");
      this.renderCurrentScreen();
    } else if (step === 1) {
      // 2. INCIDENT / DEGRADED
      this.state.system.overallHealth = "DEGRADED";
      this.state.system.failedServerCount = 2;
      this.state.system.onlineServerCount = 4;
      this.state.system.serverCount = 6;
      this.state.system.averageLatencyMs = 184;
      this.state.system.lastEvent = "ALERT: Ingress node srv-api timed out (F:3). Edge fleet latency spike.";
      if (this.state.servers[0]) {
        this.state.servers[0].status = "failed";
        this.state.servers[0].latencyMs = 999;
      }
      if (this.state.servers[5]) {
        this.state.servers[5].status = "failed";
        this.state.servers[5].latencyMs = 450;
      }
      this.state.mascotMood = "worried";
      this.mockIncidents = [
        {
          id: "INC-001",
          server_id: "srv-api",
          server_name: "API Gateway",
          severity: "CRITICAL",
          status: "OPEN",
          consecutive_failure_count: 3,
          created_at: new Date().toISOString(),
          message: "Node reached 3 consecutive failed health checks",
        },
        {
          id: "INC-002",
          server_id: "srv-edge",
          server_name: "Edge Worker Fleet",
          severity: "WARNING",
          status: "OPEN",
          consecutive_failure_count: 2,
          created_at: new Date(Date.now() - 60000).toISOString(),
          message: "Elevated p99 latency observed in US-East-1 region",
        },
      ];
      this.playGentleAlert();
      this.log("[DEMO] Step 2/3: INCIDENT — 2 nodes down, PulseBot worried, gentle alert SFX.");
      this.renderCurrentScreen();
    } else if (step === 2) {
      // 3. RECOVERY / CELEBRATION
      this.state.system.overallHealth = "NOMINAL";
      this.state.system.failedServerCount = 0;
      this.state.system.onlineServerCount = 6;
      this.state.system.serverCount = 6;
      this.state.system.averageLatencyMs = 23;
      this.state.system.lastEvent = "Recovery confirmed: All 6 cluster nodes online.";
      this.state.servers.forEach((s, idx) => {
        s.status = "online";
        s.latencyMs = [22, 17, 11, 2, 28, 42][idx] || 20;
        if (!s.history) s.history = [];
        s.history.push(s.latencyMs);
        if (s.history.length > 10) s.history.shift();
      });
      this.state.mascotMood = "celebrating";
      this.mockIncidents.forEach((i) => (i.status = "RESOLVED"));
      this.playRecoveryChime();
      this.log("[DEMO] Step 3/3: RECOVERY — Restored 6/6 nodes, PulseBot celebrating with party hat.");
      this.renderCurrentScreen();

      if (this.recoveryMoodTimer) clearTimeout(this.recoveryMoodTimer);
      this.recoveryMoodTimer = setTimeout(() => {
        if (this.state.mascotMood === "celebrating") {
          this.state.mascotMood = "happy";
          this.renderCurrentScreen();
        }
      }, 4500);
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

  playLevelUp() {
    playLevelUpSound();
  }

  playRecoveryChime() {
    playRecoveryChime();
  }

  playGentleAlert() {
    playGentleAlertSound();
  }

  destroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.idleTicker) clearInterval(this.idleTicker);
    if (this.demoTimer) clearInterval(this.demoTimer);
    if (this.recoveryMoodTimer) clearTimeout(this.recoveryMoodTimer);
    if (typeof this.activeCleanup === "function") {
      this.activeCleanup();
      this.activeCleanup = null;
    }
    this.stateListeners.clear();
    this.logListeners.clear();
  }
}
