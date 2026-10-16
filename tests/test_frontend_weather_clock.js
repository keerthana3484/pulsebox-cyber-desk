/**
 * Automated test suite for WEATHER + CLOCK screen (Screen 6).
 * 
 * Verifies:
 * 1. Correct clock rendering and date formatting using local timezone
 * 2. Clock updates and timer cleanup on screen destruction
 * 3. Weather simulation data, DEMO LOCATION, and source labeling
 * 4. Missing or malformed weather data handling
 * 5. Backend offline behavior (never shows misleading 0°F / 0% values)
 * 6. Clock remains ticking even if weather backend is disconnected
 * 7. Repeated screen switching without duplicate timers
 */

import { getWeather } from "../frontend/src/api.js";
import { weatherService, SimulatedWeatherProvider } from "../frontend/src/weatherProvider.js";
import { renderCompanionScreen } from "../frontend/src/screens/companion.js";

// Minimal DOM Element emulation for Node.js test environment
class MockElement {
  constructor(tag = "div", attrs = {}) {
    this.tag = tag;
    this.attrs = attrs;
    this.dataset = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith("data-")) {
        this.dataset[k.slice(5)] = v;
      }
    }
    this.listeners = {};
    this.textContent = "";
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (this.classList._classes.has(c)) this.classList._classes.delete(c);
          else this.classList._classes.add(c);
        } else if (force) {
          this.classList._classes.add(c);
        } else {
          this.classList._classes.delete(c);
        }
      },
      contains: (c) => this.classList._classes.has(c),
    };
  }

  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  click() {
    if (this.listeners["click"]) {
      this.listeners["click"].forEach(fn => fn({ currentTarget: this, target: this }));
    }
  }
}

class MockContainer {
  constructor() {
    this._html = "";
    this._elements = new Map();
  }

  get innerHTML() {
    return this._html;
  }

  set innerHTML(val) {
    this._html = val;
  }

  querySelector(selector) {
    if (selector.startsWith("#")) {
      const id = selector.slice(1);
      if (this._html.includes(`id="${id}"`)) {
        if (!this._elements.has(id)) {
          const el = new MockElement("div", { id });
          // Extract initial text if present
          const regex = new RegExp(`id="${id}"[^>]*>([^<]*)<`, "i");
          const m = regex.exec(this._html);
          if (m) el.textContent = m[1].trim();
          this._elements.set(id, el);
        }
        return this._elements.get(id);
      }
    }
    return null;
  }

  querySelectorAll(selector) {
    return [];
  }
}

function createMockAppActions(apiOverrides = {}) {
  const serialLogs = [];
  return {
    api: {
      getWeather,
      ...apiOverrides,
    },
    playClick: () => {},
    playBeep: () => {},
    playSuccess: () => {},
    playAlert: () => {},
    logSerial: (msg) => serialLogs.push(msg),
    onStateChange: (fn) => () => {},
    getLogs: () => serialLogs,
  };
}

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✓ PASS: ${message}`);
}

async function runTests() {
  console.log("==========================================================");
  console.log("   RUNNING FRONTEND WEATHER + CLOCK INTEGRATION SUITE     ");
  console.log("==========================================================\n");

  // -------------------------------------------------------------
  // TEST 1: Clock Rendering and Date Formatting
  // -------------------------------------------------------------
  console.log("[TEST 1] Verifying clock rendering and date formatting...");
  {
    const container = new MockContainer();
    const appActions = createMockAppActions();
    const cleanup = renderCompanionScreen(container, {}, appActions);
    await new Promise(r => setTimeout(r, 200));

    const html = container.innerHTML;
    assert(html.includes("clock-digits-hero"), "Renders clock digits element");
    assert(html.includes("clock-date-hero"), "Renders clock date element");

    // Verify digital time format matches HH:MM:SS
    const clockEl = container.querySelector("#clock-digits-live");
    assert(clockEl !== null, "Clock digits element found by ID");
    const timeMatch = /^\d{2}:\d{2}:\d{2}$/.test(clockEl.textContent);
    assert(timeMatch, `Clock digits '${clockEl.textContent}' match format HH:MM:SS`);

    // Verify day and date
    const dateEl = container.querySelector("#clock-date-live");
    assert(dateEl !== null, "Date element found by ID");
    const now = new Date();
    const expectedDay = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
    assert(dateEl.textContent.includes(expectedDay), `Date text includes current weekday '${expectedDay}'`);

    cleanup();
  }

  // -------------------------------------------------------------
  // TEST 2: Clock Updates and Timer Cleanup
  // -------------------------------------------------------------
  console.log("\n[TEST 2] Verifying clock updates and timer cleanup...");
  {
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;

    const activeTimers = new Set();
    global.setInterval = (fn, ms) => {
      const id = originalSetInterval(fn, ms);
      activeTimers.add(id);
      return id;
    };
    global.clearInterval = (id) => {
      activeTimers.delete(id);
      return originalClearInterval(id);
    };

    const container = new MockContainer();
    const appActions = createMockAppActions();
    const cleanup = renderCompanionScreen(container, {}, appActions);
    await new Promise(r => setTimeout(r, 200));

    // Verify timers were registered (clock ticker + weather poll)
    assert(activeTimers.size >= 2, `Active timers registered for clock and polling (count: ${activeTimers.size})`);

    // Cleanup screen
    cleanup();

    // Verify cleanup cleared timers
    assert(activeTimers.size === 0, `All timers successfully cleared on unmount (remaining: ${activeTimers.size})`);

    // Restore globals
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  }

  // -------------------------------------------------------------
  // TEST 3: Weather Simulation Data, DEMO LOCATION & Source Labeling
  // -------------------------------------------------------------
  console.log("\n[TEST 3] Verifying weather simulation data and source labeling...");
  {
    const container = new MockContainer();
    const appActions = createMockAppActions();
    const cleanup = renderCompanionScreen(container, {}, appActions);
    await new Promise(r => setTimeout(r, 200));

    const html = container.innerHTML;

    assert(html.includes("SIM"), "Displays visible SIM badge");
    assert(html.includes("DEMO LOCATION"), "Displays simulated location 'DEMO LOCATION'");
    assert(!html.includes("California") && !html.includes("London"), "Does not assume or hardcode user actual location");
    assert(html.includes("72°F") || html.includes("71.6°F"), "Displays simulated temperature");
    assert(html.includes("Partly Cloudy"), "Displays simulated condition 'Partly Cloudy'");
    assert(html.includes("Feels 72°F") || html.includes("Feels 73°F"), "Displays feels-like temperature");
    assert(html.includes("58%"), "Displays humidity percentage (58%)");
    assert(html.includes("8.5 mph"), "Displays wind speed (8.5 mph)");
    assert(html.includes("NW"), "Displays wind direction (NW)");
    assert(html.includes("No live weather connection"), "Displays 'No live weather connection' status");
    assert(html.includes("1014 hPa"), "Displays barometric pressure (1014 hPa)");

    cleanup();
  }

  // -------------------------------------------------------------
  // TEST 4: Temperature Unit Toggle (°F to °C)
  // -------------------------------------------------------------
  console.log("\n[TEST 4] Verifying temperature unit toggle (°F / °C)...");
  {
    const container = new MockContainer();
    const appActions = createMockAppActions();
    const cleanup = renderCompanionScreen(container, {}, appActions);
    await new Promise(r => setTimeout(r, 200));

    assert(container.innerHTML.includes("°F"), "Initially displays °F temperature unit");

    // Click unit toggle button
    const toggleBtn = container.querySelector("#btn-toggle-unit");
    assert(toggleBtn !== null, "Unit toggle button found");
    toggleBtn.click();

    // Verify °C is rendered
    assert(container.innerHTML.includes("22°C"), "Toggles to Celsius (22°C)");
    assert(container.innerHTML.includes("Feels 23°C") || container.innerHTML.includes("Feels 22°C"), "Toggles feels-like to Celsius");

    cleanup();
  }

  // -------------------------------------------------------------
  // TEST 5: Backend Offline Handling (No False Zero Values)
  // -------------------------------------------------------------
  console.log("\n[TEST 5] Verifying backend offline handling without misleading zero values...");
  {
    const container = new MockContainer();
    const mockOfflineApi = {
      getWeather: async () => {
        throw new Error("Connection refused (mock offline)");
      },
    };
    const appActions = createMockAppActions(mockOfflineApi);
    const cleanup = renderCompanionScreen(container, {}, appActions);
    await new Promise(r => setTimeout(r, 200));

    const html = container.innerHTML;

    assert(html.includes("WEATHER OFFLINE"), "Displays 'WEATHER OFFLINE'");
    assert(html.includes("BACKEND UNREACHABLE"), "Displays 'BACKEND UNREACHABLE' notice");
    assert(html.includes("RETRY"), "Provides RETRY button");

    // Clock MUST continue ticking while offline!
    const clockEl = container.querySelector("#clock-digits-live");
    assert(clockEl !== null, "Digital clock continues to render even when weather backend is offline");
    assert(/^\d{2}:\d{2}:\d{2}$/.test(clockEl.textContent), "Clock digits remain valid during backend outage");

    // Must NOT display misleading zeros
    assert(!html.includes("0°F"), "Does NOT falsely display '0°F' temperature when offline");
    assert(!html.includes("0%"), "Does NOT falsely display '0%' humidity when offline");

    cleanup();
  }

  // -------------------------------------------------------------
  // TEST 6: Missing or Malformed Weather Data Fallbacks
  // -------------------------------------------------------------
  console.log("\n[TEST 6] Verifying missing or malformed weather data safety...");
  {
    const container = new MockContainer();
    const mockMalformedApi = {
      getWeather: async () => ({
        location: null,
        temperature_f: "not_a_number",
        condition: null,
        humidity_pct: null,
      }),
    };
    const appActions = createMockAppActions(mockMalformedApi);
    let didCrash = false;
    try {
      const cleanup = renderCompanionScreen(container, {}, appActions);
      await new Promise(r => setTimeout(r, 200));
      assert(container.innerHTML.includes("DEMO LOCATION"), "Falls back to DEMO LOCATION safely");
      cleanup();
    } catch {
      didCrash = true;
    }
    assert(!didCrash, "Malformed weather data does not crash or throw unhandled errors");
  }

  // -------------------------------------------------------------
  // TEST 7: Screen Navigation & Rapid Switching Without Timer Leaks
  // -------------------------------------------------------------
  console.log("\n[TEST 7] Verifying screen switching without accumulating duplicate timers...");
  {
    let activeIntervalCount = 0;
    const origSet = global.setInterval;
    const origClr = global.clearInterval;
    global.setInterval = (fn, ms) => {
      activeIntervalCount++;
      return origSet(fn, ms);
    };
    global.clearInterval = (id) => {
      activeIntervalCount--;
      return origClr(id);
    };

    const container = new MockContainer();
    const appActions = createMockAppActions();

    // Mount and unmount 5 times in rapid succession
    for (let i = 0; i < 5; i++) {
      const cleanup = renderCompanionScreen(container, {}, appActions);
      cleanup();
    }

    assert(activeIntervalCount === 0, `No dangling timers after 5 screen transitions (active: ${activeIntervalCount})`);

    global.setInterval = origSet;
    global.clearInterval = origClr;
  }

  console.log("\n==========================================================");
  console.log(`   ALL TESTS COMPLETED: ${passedTests}/${totalTests} PASSED (100%)       `);
  console.log("==========================================================\n");
}

runTests().catch(err => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
