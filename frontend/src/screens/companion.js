// Screen 6: WEATHER + CLOCK — Minimal local time, calendar & simulated weather telemetry
// Connected to Flask API (/weather) with dedicated provider architecture.
// Designed for 320x240 landscape touchscreen with high-density minimal cyberpunk aesthetic.

import { weatherService } from "../weatherProvider.js";

export function renderCompanionScreen(container, state, appActions) {
  let weather = null; // null: loading, object: loaded
  let isLoading = true;
  let isOffline = false;
  let tempUnit = "F"; // "F" or "C"
  let activeView = "weather"; // "weather" (primary) or "timer" (companion pomodoro)

  let clockInterval = null;
  let weatherPollTimer = null;
  let timerInterval = null; // for optional pomodoro view
  let actionNotice = "";
  let noticeTimeout = null;

  function setNotice(msg) {
    actionNotice = msg;
    if (noticeTimeout) clearTimeout(noticeTimeout);
    noticeTimeout = setTimeout(() => {
      actionNotice = "";
      updateNoticeEl();
    }, 3500);
  }

  function updateNoticeEl() {
    const el = container.querySelector("#weather-notice-line");
    if (el) {
      el.textContent = actionNotice || "Simulation Mode: No external API keys or live telemetry connected.";
      el.classList.toggle("active", Boolean(actionNotice));
    }
  }

  function getLocalClockData() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const dayName = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
    return {
      timeStr: `${hh}:${mm}:${ss}`,
      dayName,
      dateStr,
      fullDateLine: `${dayName}, ${dateStr}`,
    };
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

  function formatTimerSeconds(totalSecs) {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async function fetchWeatherData(showLoading = false) {
    if (showLoading && weather === null) {
      isLoading = true;
      render();
    }

    try {
      let data = null;
      if (appActions?.api?.getWeather) {
        data = await appActions.api.getWeather();
      } else {
        data = await weatherService.fetchWeather();
      }

      const wasOffline = isOffline;
      isOffline = false;
      isLoading = false;
      weather = data;

      if (wasOffline) {
        appActions.logSerial("[API_SYNC] Weather telemetry reconnected to Flask API");
      }
      render();
    } catch (err) {
      isOffline = true;
      isLoading = false;
      appActions.logSerial(`[WEATHER_ERR] Failed to fetch weather: ${err.message}`);
      render();
    }
  }

  function updateClockDom() {
    const clockData = getLocalClockData();
    const timeEl = container.querySelector("#clock-digits-live");
    const dateEl = container.querySelector("#clock-date-live");
    if (timeEl) timeEl.textContent = clockData.timeStr;
    if (dateEl) dateEl.textContent = clockData.fullDateLine;
  }

  function startClock() {
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(() => {
      updateClockDom();
    }, 1000);
  }

  function render() {
    const clockData = getLocalClockData();

    // 1. Loading State (initial sync)
    if (isLoading && weather === null && !isOffline) {
      container.innerHTML = `
        <div class="screen-content screen-weather-clock">
          <div class="weather-loading-box">
            <span>⚡</span>
            <span>SYNCING TIME & WEATHER TELEMETRY...</span>
          </div>
        </div>
      `;
      return;
    }

    // 2. Pomodoro Sub-View (retaining companion timer feature)
    if (activeView === "timer") {
      renderTimerView();
      return;
    }

    // 3. Primary Weather + Clock View
    const data = weather || {};
    const loc = data.location || "DEMO LOCATION";
    const cond = data.condition || "Partly Cloudy";
    const condSymbol = data.condition_symbol || "⛅";
    const tempF = typeof data.temperature_f === "number" ? Math.round(data.temperature_f) : 72;
    const tempC = typeof data.temperature_c === "number" ? Math.round(data.temperature_c) : 22;
    const feelsF = typeof data.feels_like_f === "number" ? Math.round(data.feels_like_f) : 72;
    const feelsC = typeof data.feels_like_c === "number" ? Math.round(data.feels_like_c) : 22;
    const displayTemp = tempUnit === "F" ? `${tempF}°F` : `${tempC}°C`;
    const displayFeels = tempUnit === "F" ? `Feels ${feelsF}°F` : `Feels ${feelsC}°C`;
    const humidity = data.humidity_pct ?? 58;
    const windMph = data.wind_speed_mph ?? 8.5;
    const windDir = data.wind_direction || "NW";
    const pressure = data.pressure_hpa ?? 1014;
    const uvIndex = data.uv_index ?? 3;
    const lastSyncTime = formatTime(data.timestamp);
    const sourceStatus = data.data_source_status || "No live weather connection";

    container.innerHTML = `
      <div class="screen-content screen-weather-clock">
        <!-- Subheader: SIM Badge, Title, Demo Location, Unit Toggle -->
        <div class="wc-header-strip">
          <div class="wc-header-left">
            <span class="wc-sim-badge" title="Deterministic Simulation Mode">SIM</span>
            <span class="wc-title-label">WEATHER + CLOCK</span>
          </div>
          <div class="wc-header-right">
            <span class="wc-location-tag" id="weather-location-label">${loc}</span>
            <button class="mini-tool-btn" id="btn-toggle-unit" title="Switch °F / °C">${tempUnit === 'F' ? '°F' : '°C'}</button>
            <button class="mini-tool-btn" id="btn-refresh-weather" title="Refresh weather">⟳</button>
            <button class="mini-tool-btn secondary" id="btn-switch-timer" title="Focus Timer">⏱</button>
          </div>
        </div>

        <!-- Upper Dual Cards: Large Digital Clock & Primary Weather -->
        <div class="wc-upper-grid">
          <!-- Left: Large Digital Clock Card -->
          <div class="wc-card wc-clock-card">
            <div class="wc-card-micro-label">LOCAL SYSTEM CLOCK</div>
            <div class="clock-digits-hero" id="clock-digits-live">${clockData.timeStr}</div>
            <div class="clock-date-hero" id="clock-date-live">${clockData.fullDateLine}</div>
          </div>

          <!-- Right: Current Weather Telemetry Card -->
          <div class="wc-card wc-weather-card">
            <div class="wc-card-micro-label">
              <span>CONDITIONS</span>
              <span class="wc-condition-symbol">${condSymbol}</span>
            </div>
            ${isOffline ? `
              <!-- Offline State: Never display misleading zero values -->
              <div class="weather-offline-subcard">
                <div class="offline-wthr-title">WEATHER OFFLINE</div>
                <div class="offline-wthr-sub">BACKEND UNREACHABLE</div>
                <button class="cyber-btn xs secondary" id="btn-weather-retry" style="margin-top:2px;">RETRY</button>
              </div>
            ` : `
              <div class="weather-temp-hero" id="weather-temp-val">${displayTemp}</div>
              <div class="weather-condition-line" id="weather-cond-val">${cond}</div>
              <div class="weather-meta-line" id="weather-feels-val">${displayFeels} • UV ${uvIndex}</div>
            `}
          </div>
        </div>

        <!-- Lower Grid: 3 Atmospheric Telemetry Metric Cards -->
        <div class="wc-lower-grid">
          <div class="wc-metric-cell">
            <span class="wc-cell-label">HUMIDITY</span>
            <span class="wc-cell-val highlight" id="weather-humidity-val">${isOffline ? '--' : `${humidity}%`}</span>
            <span class="wc-cell-sub">RELATIVE</span>
          </div>
          <div class="wc-metric-cell">
            <span class="wc-cell-label">WIND SPEED</span>
            <span class="wc-cell-val" id="weather-wind-val">${isOffline ? '--' : `${windMph} mph`}</span>
            <span class="wc-cell-sub" id="weather-wind-dir">${isOffline ? '--' : `HEADING ${windDir}`}</span>
          </div>
          <div class="wc-metric-cell">
            <span class="wc-cell-label">BAROMETER</span>
            <span class="wc-cell-val accent" id="weather-pressure-val">${isOffline ? '--' : `${pressure} hPa`}</span>
            <span class="wc-cell-sub">${isOffline ? '--' : 'STABLE'}</span>
          </div>
        </div>

        <!-- Informational Notice Line -->
        <div class="wc-notice-line" id="weather-notice-line">
          ${actionNotice || `Simulation Mode: No external API keys or live telemetry connected.`}
        </div>

        <!-- Footer Strip: Data Source Status & Sync Timestamp -->
        <div class="wc-footer-strip">
          <div class="wc-footer-source">
            <span class="sim-dot">●</span>
            <span id="weather-source-status">${sourceStatus}</span>
          </div>
          <div class="wc-footer-meta">
            <span>SYNC: <strong id="weather-sync-time">${lastSyncTime}</strong></span>
          </div>
        </div>
      </div>
    `;

    // Bind event handlers
    const unitBtn = container.querySelector("#btn-toggle-unit");
    if (unitBtn) {
      unitBtn.addEventListener("click", () => {
        appActions.playClick();
        tempUnit = tempUnit === "F" ? "C" : "F";
        render();
      });
    }

    const refreshBtn = container.querySelector("#btn-refresh-weather");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        appActions.playClick();
        fetchWeatherData(true);
      });
    }

    const retryBtn = container.querySelector("#btn-weather-retry");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        appActions.playClick();
        fetchWeatherData(true);
      });
    }

    const switchTimerBtn = container.querySelector("#btn-switch-timer");
    if (switchTimerBtn) {
      switchTimerBtn.addEventListener("click", () => {
        appActions.playClick();
        if (typeof appActions.switchScreen === "function") {
          appActions.switchScreen(6);
        } else {
          activeView = "timer";
          render();
        }
      });
    }
  }

  function renderTimerView() {
    const { companion } = state;
    const pomodoro = companion?.pomodoro || {
      mode: "focus",
      durationMinutes: 25,
      remainingSeconds: 1500,
      isRunning: false,
      sessionsCompleted: 0,
    };
    const totalSecs = pomodoro.durationMinutes * 60;
    const ratio = Math.round(((totalSecs - pomodoro.remainingSeconds) / totalSecs) * 100);

    container.innerHTML = `
      <div class="screen-content screen-weather-clock">
        <div class="wc-header-strip">
          <div class="wc-header-left">
            <span class="wc-sim-badge">TIMER</span>
            <span class="wc-title-label">FOCUS COMPANION</span>
          </div>
          <div class="wc-header-right">
            <button class="cyber-btn xs secondary" id="btn-back-weather">◀ BACK TO CLOCK</button>
          </div>
        </div>

        <div class="focus-timer-section">
          <div class="timer-mode-line">
            <span class="mode-tag ${pomodoro.mode === 'focus' ? 'highlight' : 'accent'}">
              ${pomodoro.mode.toUpperCase()} MODE
            </span>
            <span class="sessions-tag">COMPLETED: ${pomodoro.sessionsCompleted}</span>
          </div>

          <div class="timer-display-digits">${formatTimerSeconds(pomodoro.remainingSeconds)}</div>

          <div class="mini-bar-track">
            <div class="mini-bar-fill" style="width: ${ratio}%; background: var(--accent-orange);"></div>
          </div>
        </div>

        <div class="timer-btn-row" style="margin-top:6px;">
          <button class="cyber-btn sm ${pomodoro.isRunning ? 'danger' : ''}" id="btn-timer-toggle">
            ${pomodoro.isRunning ? '⏸ PAUSE' : '▶ START'}
          </button>
          <button class="cyber-btn sm secondary" id="btn-timer-reset">
            ↺ RESET
          </button>
          <button class="cyber-btn sm secondary" id="btn-timer-mode">
            ${pomodoro.mode === 'focus' ? '☕ BREAK' : '🎯 FOCUS'}
          </button>
        </div>
      </div>
    `;

    const backBtn = container.querySelector("#btn-back-weather");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        appActions.playClick();
        activeView = "weather";
        render();
      });
    }

    const toggleBtn = container.querySelector("#btn-timer-toggle");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        appActions.playClick();
        pomodoro.isRunning = !pomodoro.isRunning;
        if (pomodoro.isRunning) {
          startPomodoro();
        } else {
          stopPomodoro();
        }
        render();
      });
    }

    const resetBtn = container.querySelector("#btn-timer-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        appActions.playClick();
        stopPomodoro();
        pomodoro.isRunning = false;
        pomodoro.remainingSeconds = pomodoro.durationMinutes * 60;
        render();
      });
    }

    const modeBtn = container.querySelector("#btn-timer-mode");
    if (modeBtn) {
      modeBtn.addEventListener("click", () => {
        appActions.playClick();
        stopPomodoro();
        pomodoro.isRunning = false;
        if (pomodoro.mode === "focus") {
          pomodoro.mode = "break";
          pomodoro.durationMinutes = 5;
        } else {
          pomodoro.mode = "focus";
          pomodoro.durationMinutes = 25;
        }
        pomodoro.remainingSeconds = pomodoro.durationMinutes * 60;
        render();
      });
    }
  }

  function startPomodoro() {
    stopPomodoro();
    timerInterval = setInterval(() => {
      const pomodoro = state.companion?.pomodoro;
      if (!pomodoro) return;
      if (pomodoro.remainingSeconds > 0) {
        pomodoro.remainingSeconds--;
        const digitsEl = container.querySelector(".timer-display-digits");
        const fillEl = container.querySelector(".mini-bar-fill");
        if (digitsEl) digitsEl.textContent = formatTimerSeconds(pomodoro.remainingSeconds);
        if (fillEl) {
          const totalSecs = pomodoro.durationMinutes * 60;
          const ratio = Math.round(((totalSecs - pomodoro.remainingSeconds) / totalSecs) * 100);
          fillEl.style.width = `${ratio}%`;
        }
      } else {
        stopPomodoro();
        pomodoro.isRunning = false;
        if (pomodoro.mode === "focus") {
          pomodoro.sessionsCompleted++;
        }
        appActions.playSuccess();
        appActions.logSerial("[TIMER] Focus interval completed!");
        render();
      }
    }, 1000);
  }

  function stopPomodoro() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // Initial setup: fetch weather & start clock ticker
  fetchWeatherData(true);
  startClock();

  // Poll weather every 10 seconds while screen is active (no duplicate timer)
  weatherPollTimer = setInterval(() => {
    fetchWeatherData(false);
  }, 10000);

  // State change subscription
  const unsubscribeState = appActions.onStateChange?.(() => {
    fetchWeatherData(false);
  });

  // Cleanup on unmount or screen transition
  return () => {
    if (clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }
    if (weatherPollTimer) {
      clearInterval(weatherPollTimer);
      weatherPollTimer = null;
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (noticeTimeout) {
      clearTimeout(noticeTimeout);
      noticeTimeout = null;
    }
    if (typeof unsubscribeState === "function") {
      unsubscribeState();
    }
  };
}

export const renderWeatherClockScreen = renderCompanionScreen;
