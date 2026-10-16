/**
 * Weather Provider Module for PulseBox Cyber Desk.
 * Decouples weather fetching logic from screen presentation,
 * allowing simulated data initially and future live weather adapters (e.g. OpenWeatherMap).
 */

import { getWeather as fetchWeatherFromApi } from "./api.js";

/**
 * Base abstract interface for weather providers.
 */
export class BaseWeatherProvider {
  async getWeather() {
    throw new Error("getWeather() must be implemented by subclass.");
  }

  get providerName() {
    return "base";
  }

  get isSimulation() {
    return true;
  }
}

/**
 * API Weather Provider: retrieves weather telemetry from Flask backend (/weather).
 */
export class ApiWeatherProvider extends BaseWeatherProvider {
  async getWeather() {
    return await fetchWeatherFromApi();
  }

  get providerName() {
    return "flask-backend";
  }

  get isSimulation() {
    return true;
  }
}

/**
 * Standalone Simulated Weather Provider: in-memory deterministic fallback.
 * Never presents simulated weather as live data.
 */
export class SimulatedWeatherProvider extends BaseWeatherProvider {
  get providerName() {
    return "simulated";
  }

  get isSimulation() {
    return true;
  }

  async getWeather() {
    return {
      location: "DEMO LOCATION",
      temperature_c: 22.0,
      temperature_f: 71.6,
      feels_like_c: 22.5,
      feels_like_f: 72.5,
      condition: "Partly Cloudy",
      condition_code: "partly_cloudy",
      condition_symbol: "⛅",
      humidity_pct: 58,
      wind_speed_mph: 8.5,
      wind_speed_kmh: 13.7,
      wind_direction: "NW",
      pressure_hpa: 1014,
      uv_index: 3,
      air_quality: "24 AQI (Good)",
      source: "simulated",
      data_source_status: "No live weather connection",
      simulation_mode: true,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Adapter stub for future OpenWeatherMap integration.
 */
export class OpenWeatherMapProvider extends BaseWeatherProvider {
  get providerName() {
    return "openweathermap";
  }

  get isSimulation() {
    return false;
  }

  async getWeather() {
    throw new Error("Live OpenWeatherMap provider is not yet connected.");
  }
}

/**
 * Service orchestrator managing active provider and formatting helpers.
 */
export class WeatherService {
  constructor(provider = new ApiWeatherProvider()) {
    this.provider = provider;
  }

  setProvider(provider) {
    this.provider = provider;
  }

  async fetchWeather() {
    return await this.provider.getWeather();
  }

  formatTemp(tempF, tempC, unit = "F") {
    if (unit === "C") {
      const c = typeof tempC === "number" ? tempC : ((tempF - 32) * 5) / 9;
      return `${Math.round(c)}°C`;
    }
    const f = typeof tempF === "number" ? tempF : (tempC * 9) / 5 + 32;
    return `${Math.round(f)}°F`;
  }

  getConditionSymbol(code = "") {
    const map = {
      clear_day: "☀️",
      clear_night: "🌙",
      partly_cloudy: "⛅",
      cloudy: "☁️",
      overcast: "☁️",
      fog: "🌫️",
      light_rain: "🌦️",
      rain: "🌧️",
      heavy_rain: "⛈️",
      thunderstorm: "⚡",
      snow: "❄️",
      windy: "💨",
    };
    return map[code.toLowerCase()] || "⛅";
  }
}

export const weatherService = new WeatherService();
