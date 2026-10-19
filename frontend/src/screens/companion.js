// Screen 6: WEATHER + CLOCK — Voxel time, calendar & atmospheric telemetry
// Connected to Flask API (/weather) with dedicated provider architecture.
// Follows docs/UI_RULES.md: 1 hero element, max 3 text elements, <= 12 words on overview,
// dynamic Day/Night sky behavior, tap-through detail view with [< BACK] button.

import { weatherService } from "../weatherProvider.js";
import {
  getVoxelSunSvg,
  getVoxelMoonSvg,
  getVoxelCloudSvg,
  getItemIconSvg,
  buildVoxelButton,
} from "../voxelComponents.js";

export function renderCompanionScreen(container, state, appActions, options = {}) {
  let weather = null; // null: loading, object: loaded
  let isLoading = true;
  let isOffline = false;
  let tempUnit = "F"; // "F" or "C"
  let activeView = "weather"; // "weather" (primary) or "timer" (companion pomodoro)
  let showDetail = options.initialShowDetail ?? false;

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
      hour: now.getHours(),
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
    const timeEls = container.querySelectorAll(".clock-digits-live, #clock-digits-live");
    timeEls.forEach(el => {
      el.textContent = clockData.timeStr;
    });
    const dateEl = container.querySelector("#clock-date-live");
    if (dateEl) dateEl.textContent = clockData.fullDateLine;
    const heroTime = container.querySelector("#weather-clock-time");
    if (heroTime) heroTime.textContent = clockData.timeStr.slice(0, 5);
  }

  function startClock() {
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(() => {
      updateClockDom();
    }, 1000);
  }

  function render() {
    const clockData = getLocalClockData();
    const isDay = options.forceSkyMode === "day"
      ? true
      : options.forceSkyMode === "night"
      ? false
      : (state?.isDay ?? (clockData.hour >= 6 && clockData.hour < 18));

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

    // 2. Primary Weather + Clock Data Preparation
    const data = weather || {};
    const loc = data.location || "DEMO LOCATION";
    const cond = data.condition || "Partly Cloudy";
    const liveCondWord = (cond.split(/\s+/).pop() || "CLEAR").toUpperCase();
    const condSymbol = data.condition_symbol || (isDay ? "⛅" : "🌙");
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
    const uvIndex = data.uv_index ?? (isDay ? 3 : 0);
    const lastSyncTime = formatTime(data.timestamp);
    const sourceStatus = data.data_source_status || "No live weather connection";

    container.innerHTML = `
      <div class="screen-voxel-wrapper screen-content screen-weather-clock">
        <!-- 1. HERO OVERVIEW VIEW (Strict 1-Second Glanceable, <= 3 text elements, <= 12 words) -->
        <div class="screen-hero-view ${showDetail ? 'is-hidden' : ''}" id="hero-overview-stage">
          <div class="voxel-sky-hero ${isDay ? 'day-sky' : 'night-sky'}">
            ${isDay ? `
              <div style="display:flex; align-items:center; gap:8px; z-index:2;">
                ${getVoxelSunSvg(28)}
                ${getVoxelCloudSvg(36, 14)}
              </div>
            ` : `
              <div class="voxel-sky-stars"></div>
              <div style="display:flex; align-items:center; gap:8px; z-index:2;">
                ${getVoxelMoonSvg(28)}
              </div>
            `}
          </div>

          <div class="voxel-hero-metric ${isOffline ? 'status-alert' : 'status-nominal'}" id="weather-overview-badge">
            ${isOffline ? 'OFFLINE' : `${displayTemp} ${liveCondWord}`}
          </div>

          <div class="voxel-hero-actions">
            <button class="voxel-btn variant-secondary voxel-tap-arrow-btn" id="btn-companion-detail" aria-label="Details">▶</button>
          </div>
        </div>

        <!-- 2. TAP-THROUGH DETAIL VIEW (Rich Atmospheric Telemetry & Unit Toggles) -->
        <div class="screen-detail-view ${showDetail ? 'is-active' : ''}">
          <!-- Navigation Back Row -->
          <div class="voxel-detail-nav-row">
            <button class="voxel-btn variant-secondary voxel-back-btn" id="btn-back-overview">
              ◀ BACK
            </button>
            <span class="voxel-detail-title">WEATHER + CLOCK</span>
            <span class="sim-tag-mini">[SIM]</span>
          </div>

          <!-- Detail Header Strip: Location & Toggle -->
          <div class="wc-header-strip" style="margin-bottom: 4px;">
            <div class="wc-header-left">
              <span class="wc-sim-badge" title="Deterministic Simulation Mode">SIM</span>
              <span class="wc-location-tag" id="weather-location-label">${loc}</span>
            </div>
            <div class="wc-header-right">
              <button class="mini-tool-btn voxel-btn variant-secondary" id="btn-toggle-unit" title="Switch °F / °C">${tempUnit === 'F' ? '°F' : '°C'}</button>
              <button class="mini-tool-btn voxel-btn variant-secondary" id="btn-refresh-weather" title="Refresh weather">⟳</button>
            </div>
          </div>

          <!-- Upper Dual Cards: Large Digital Clock & Primary Weather -->
          <div class="wc-upper-grid">
            <!-- Left: Digital Clock Card with Date -->
            <div class="wc-card wc-clock-card">
              <div class="wc-card-micro-label">LOCAL SYSTEM CLOCK</div>
              <div class="clock-digits-hero" id="clock-digits-live">${clockData.timeStr}</div>
              <div class="clock-date-hero" id="clock-date-live">${clockData.fullDateLine}</div>
            </div>

            <!-- Right: Weather Telemetry Card -->
            <div class="wc-card wc-weather-card">
              <div class="wc-card-micro-label">
                <span>CONDITIONS</span>
                <span class="wc-condition-symbol">${condSymbol}</span>
              </div>
              ${isOffline ? `
                <div class="weather-offline-subcard">
                  <div class="offline-wthr-title">WEATHER OFFLINE</div>
                  <div class="offline-wthr-sub">BACKEND UNREACHABLE</div>
                  <button class="cyber-btn xs secondary voxel-btn variant-secondary" id="btn-weather-retry" style="margin-top:2px;">RETRY</button>
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
      </div>
    `;

    // 3. Event Listeners
    const detailBtn = container.querySelector("#btn-companion-detail");
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

    const unitBtn = container.querySelector("#btn-toggle-unit");
    if (unitBtn) {
      unitBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        tempUnit = tempUnit === "F" ? "C" : "F";
        render();
      });
    }

    const refreshBtn = container.querySelector("#btn-refresh-weather");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        fetchWeatherData(true);
      });
    }

    const retryBtn = container.querySelector("#btn-weather-retry");
    if (retryBtn) {
      retryBtn.addEventListener("click", (e) => {
        e?.stopPropagation?.();
        appActions.playClick();
        fetchWeatherData(true);
      });
    }
  }

  // Initial load & Tickers
  fetchWeatherData();
  startClock();

  if (weatherPollTimer) clearInterval(weatherPollTimer);
  weatherPollTimer = setInterval(() => {
    fetchWeatherData(false);
  }, 30000);

  // Return cleanup function to prevent timer leaks
  return () => {
    if (clockInterval) clearInterval(clockInterval);
    if (weatherPollTimer) clearInterval(weatherPollTimer);
    if (timerInterval) clearInterval(timerInterval);
    if (noticeTimeout) clearTimeout(noticeTimeout);
  };
}
