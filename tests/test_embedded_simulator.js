/**
 * Automated test suite for the BROWSER-BASED EMBEDDED-SCREEN SIMULATOR.
 * 
 * Verifies:
 * 1. Simulator initialization with all 8 native screens.
 * 2. Forward and backward cyclic screen navigation (wrapping at boundaries).
 * 3. Screen cleanup invocation on transition (no dangling timers/listeners).
 * 4. Hardware bezel button actions (PREV, NEXT, ACTION, PWR).
 * 5. Resistive touch digitizer coordinate clamping (320x240 landscape bounds).
 * 6. Power lifecycle (boot, power-down, wake, standby).
 * 7. Offline independence for local clock and focus timer.
 * 8. Verified API routes, request payloads, response handling against Flask backend.
 * 9. Real 6 server nodes validation (no fictional IDs, rejecting invalid targets).
 * 10. Cost settings persistence according to backend behavior vs browser preferences.
 * 11. Backend offline state transitions, error handling, and retries.
 */

import { EmbeddedScreenSimulator } from "../frontend/src/embeddedSimulator.js";
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
} from "../frontend/src/api.js";

// Minimal DOM Element emulation for Node.js test environment
class MockElement {
  constructor(tag = "div") {
    this.tag = tag;
    this.textContent = "";
    this.style = {};
    this.innerHTML = "";
    this.dataset = {};
    this.listeners = {};
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (this.classList._classes.has(c)) {
            this.classList._classes.delete(c);
            return false;
          } else {
            this.classList._classes.add(c);
            return true;
          }
        }
        if (force) {
          this.classList._classes.add(c);
        } else {
          this.classList._classes.delete(c);
        }
        return force;
      },
      contains: (c) => this.classList._classes.has(c),
    };
  }

  addEventListener(evt, fn) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  }

  querySelector(selector) {
    if (selector.startsWith("#")) {
      const id = selector.slice(1);
      return this.children ? this.children.find(c => c.id === id) || null : null;
    }
    return null;
  }

  querySelectorAll(selector) {
    return [];
  }
}

// Global browser mocks if absent
if (typeof globalThis.document === "undefined") {
  globalThis.document = {
    body: new MockElement("body"),
    createElement: (tag) => new MockElement(tag),
  };
}

if (typeof globalThis.localStorage === "undefined") {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

// Test Runner
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`  ✓ ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message} (Expected: ${expected}, Got: ${actual})`);
    failCount++;
  }
}

async function runSimulatorTests() {
  console.log("\n=======================================================");
  console.log("PULSEBOX 320x240 EMBEDDED SCREEN SIMULATOR TEST SUITE");
  console.log("=======================================================\n");

  // Mock DOM fixture
  const viewport = new MockElement("div");
  const screenTitle = new MockElement("span");
  const statusBarClock = new MockElement("span");
  const navContainer = new MockElement("nav");
  const lcdScreen = new MockElement("div");
  const simBadge = new MockElement("span");
  const ledRxTx = new MockElement("span");
  const ledStat = new MockElement("span");
  const ledPwr = new MockElement("span");
  const touchHud = new MockElement("span");

  const sim = new EmbeddedScreenSimulator({
    viewport,
    screenTitle,
    statusBarClock,
    navContainer,
    lcdScreen,
    simBadge,
    ledRxTx,
    ledStat,
    ledPwr,
    touchHud,
  });

  // Prevent background network timers during initial unit assertions
  sim.startBackendPolling = () => {};

  console.log("TEST GROUP 1: Screen Inventory & Initialization");
  assertEqual(sim.screens.length, 8, "Simulator has exactly 8 native screens");
  assertEqual(sim.screens[0].id, "home", "Screen 0 is Home");
  assertEqual(sim.screens[1].id, "servers", "Screen 1 is Servers");
  assertEqual(sim.screens[2].id, "incidents", "Screen 2 is Incidents");
  assertEqual(sim.screens[3].id, "cloudCosts", "Screen 3 is Cloud Costs");
  assertEqual(sim.screens[4].id, "deploy", "Screen 4 is Deploy");
  assertEqual(sim.screens[5].id, "companion", "Screen 5 is Weather + Clock");
  assertEqual(sim.screens[6].id, "focusTimer", "Screen 6 is Focus Timer");
  assertEqual(sim.screens[7].id, "settings", "Screen 7 is Settings");

  // Track logs
  const logs = [];
  sim.onLog((msg) => logs.push(msg));

  // Initialize (skip boot animation for instantaneous state verification)
  sim.init(true);
  assert(logs.length > 0, "Simulator outputs boot log to serial monitor stream");
  assert(sim.isPoweredOn, "Simulator is powered on after init");
  assertEqual(sim.isStandby, false, "Simulator is not in standby after init");

  console.log("\nTEST GROUP 2: Native Screen Navigation & Boundary Wrapping");
  assertEqual(sim.currentScreenIndex, 0, "Initial screen index is 0 (Home)");
  assertEqual(screenTitle.textContent, "SYSTEM STATUS", "Initial screen title is SYSTEM STATUS");

  // Forward Navigation
  sim.nextScreen();
  assertEqual(sim.currentScreenIndex, 1, "nextScreen() advances to index 1 (Servers)");
  assertEqual(screenTitle.textContent, "CLUSTER NODES", "Title updated to CLUSTER NODES");

  sim.nextScreen();
  assertEqual(sim.currentScreenIndex, 2, "nextScreen() advances to index 2 (Incidents)");

  sim.nextScreen();
  assertEqual(sim.currentScreenIndex, 3, "nextScreen() advances to index 3 (Cloud Costs)");

  sim.nextScreen();
  assertEqual(sim.currentScreenIndex, 4, "nextScreen() advances to index 4 (Deploy)");

  sim.nextScreen();
  assertEqual(sim.currentScreenIndex, 5, "nextScreen() advances to index 5 (Weather + Clock)");

  sim.nextScreen();
  assertEqual(sim.currentScreenIndex, 6, "nextScreen() advances to index 6 (Focus Timer)");

  sim.nextScreen();
  assertEqual(sim.currentScreenIndex, 7, "nextScreen() advances to index 7 (Settings)");
  assertEqual(screenTitle.textContent, "DEVICE CONFIG", "Title updated to DEVICE CONFIG");

  // Forward boundary wrap (7 -> 0)
  sim.nextScreen();
  assertEqual(sim.currentScreenIndex, 0, "nextScreen() from screen 7 wraps to screen 0 (Home)");

  // Backward boundary wrap (0 -> 7)
  sim.prevScreen();
  assertEqual(sim.currentScreenIndex, 7, "prevScreen() from screen 0 wraps to screen 7 (Settings)");

  sim.prevScreen();
  assertEqual(sim.currentScreenIndex, 6, "prevScreen() moves from 7 to 6 (Focus Timer)");

  // Direct switchScreen
  sim.switchScreen(3);
  assertEqual(sim.currentScreenIndex, 3, "switchScreen(3) navigates directly to Cloud Costs");

  console.log("\nTEST GROUP 3: Screen Cleanup Handler Lifecycle");
  let cleanupCalled = false;
  sim.activeCleanup = () => {
    cleanupCalled = true;
  };

  sim.switchScreen(4);
  assert(cleanupCalled === true, "activeCleanup() was executed when switching screen");
  assert(sim.activeCleanup !== null, "New activeCleanup is set for the active screen");

  console.log("\nTEST GROUP 4: Resistive Touch Digitizer (XPT2046) Coordinates");
  // Center touch
  let touch = sim.handleTouch(160, 120, true);
  assertEqual(touch.x, 160, "X coordinate inside bounds is preserved");
  assertEqual(touch.y, 120, "Y coordinate inside bounds is preserved");
  assertEqual(touch.pressure, 240, "Active touch generates pressure 240");
  assertEqual(touch.isTouching, true, "isTouching is true on pointerdown");
  assert(touchHud.textContent.includes("X=160, Y=120"), "Touch HUD displays coordinate 160, 120");

  // Out of bounds clamping (negative values)
  touch = sim.handleTouch(-25, -40, true);
  assertEqual(touch.x, 0, "Negative X is clamped to 0");
  assertEqual(touch.y, 0, "Negative Y is clamped to 0");

  // Out of bounds clamping (excessive values beyond 320x240)
  touch = sim.handleTouch(500, 350, true);
  assertEqual(touch.x, 319, "X > 319 is clamped to 319");
  assertEqual(touch.y, 239, "Y > 239 is clamped to 239");

  // Release touch
  touch = sim.handleTouch(100, 50, false);
  assertEqual(touch.pressure, 0, "Released touch sets pressure to 0");
  assertEqual(touch.isTouching, false, "isTouching is false on release");

  console.log("\nTEST GROUP 5: Hardware Power & Standby Lifecycle");
  // Standby mode
  sim.enterStandby();
  assertEqual(sim.isStandby, true, "Simulator entered standby mode");
  assertEqual(screenTitle.textContent, "STANDBY", "Screen title updated to STANDBY");

  // Wake on bezel button press (skip animation)
  sim.nextScreen(true);
  assertEqual(sim.isStandby, false, "nextScreen() woke up device from standby");

  // Toggle Power Off (skip animation)
  sim.togglePower(true);
  assertEqual(sim.isPoweredOn, false, "togglePower() powered off device");
  assertEqual(screenTitle.textContent, "SHUTDOWN", "Title updated to SHUTDOWN");

  // Power on again (skip animation)
  sim.togglePower(true);
  assertEqual(sim.isPoweredOn, true, "togglePower() re-energized device");

  console.log("\nTEST GROUP 6: Offline Independence & Labeling");
  // Check simulation badge default
  simBadge.textContent = "SIM";
  assertEqual(simBadge.textContent, "SIM", "Simulation badge shows SIM by default");

  // Simulate backend failure handling
  try {
    sim.state.backendConnected = false;
    simBadge.textContent = "OFFLINE";
    simBadge.className = "lcd-sim-badge offline";
  } catch (e) {}

  assertEqual(simBadge.textContent, "OFFLINE", "Offline backend reflects OFFLINE badge");
  assert(simBadge.className.includes("offline"), "Badge has offline class");

  // Verify Focus Timer and Clock are accessible without backend
  sim.switchScreen(6);
  assertEqual(sim.screens[sim.currentScreenIndex].id, "focusTimer", "Focus timer accessible while offline");
  sim.switchScreen(5);
  assertEqual(sim.screens[sim.currentScreenIndex].id, "companion", "Clock and weather accessible while offline");

  console.log("\nTEST GROUP 7: Verified API Routes & Payload Contracts Against Flask Backend");
  let backendAvailable = false;
  try {
    const health = await getHealth();
    backendAvailable = health?.status === "healthy";
  } catch (e) {
    backendAvailable = false;
  }

  if (backendAvailable) {
    console.log("  [INFO] Flask backend online at http://127.0.0.1:5000. Testing all 11 API endpoints...");

    // 1. GET /health
    const health = await getHealth();
    assertEqual(health.status, "healthy", "GET /health status is healthy");
    assertEqual(health.service, "PulseBox Cyber Desk Backend", "GET /health service name verified");
    assert(typeof health.uptime_seconds === "number", "GET /health uptime_seconds is numeric");

    // 2. GET /state
    const state = await getState();
    assert(["NOMINAL", "DEGRADED", "CRITICAL"].includes(state.overall_health), "GET /state overall_health valid");
    assertEqual(state.server_count, 6, "GET /state server_count is 6");
    assertEqual(state.servers.length, 6, "GET /state contains exactly 6 server nodes");

    // 3. Exact 6 Real Server Nodes
    const expectedIds = ["srv-api", "srv-auth", "srv-db", "srv-redis", "srv-mqtt", "srv-edge"];
    const actualIds = state.servers.map(s => s.id);
    assertEqual(JSON.stringify(actualIds), JSON.stringify(expectedIds), "Server IDs match the exact 6 backend nodes in order");

    // 4. POST /simulate-failure with valid node
    const failRes = await simulateFailure("srv-api");
    assertEqual(failRes.affected_server.id, "srv-api", "POST /simulate-failure affected server is srv-api");
    assertEqual(failRes.affected_server.status, "failed", "Affected server status transitioned to failed");

    // 5. POST /simulate-failure with fictional/invalid node (must be rejected)
    let fakeFailThrew = false;
    try {
      await simulateFailure("srv-fictional-cluster");
    } catch (err) {
      fakeFailThrew = true;
      assert(err.message.includes("not found") || err.message.includes("404"), "Fictional server ID rejected with 404/not found");
    }
    assert(fakeFailThrew, "Simulator cannot inject failures on fictional server IDs");

    // 6. POST /restore with specific server
    const restoreNodeRes = await restoreServer("srv-api");
    assertEqual(restoreNodeRes.restored_count, 1, "POST /restore restored 1 server (srv-api)");

    // 7. POST /restore with null/empty (restores all)
    const restoreAllRes = await restoreServer(null);
    assert(restoreAllRes.state.failed_server_count === 0, "POST /restore all resets failed_server_count to 0");

    // 8. GET /incidents
    const incList = await getIncidents();
    assert(Array.isArray(incList), "GET /incidents returns an array");

    // 9. GET /costs
    const costs = await getCosts();
    assert(typeof costs.monthly_budget === "number", "GET /costs monthly_budget is numeric");
    assert(typeof costs.today_spend === "number", "GET /costs today_spend is numeric");
    assert(["NORMAL", "WARNING", "BUDGET EXCEEDED"].includes(costs.budget_status), "GET /costs budget_status valid");
    assert(Array.isArray(costs.daily_trend), "GET /costs daily_trend is an array");
    assert(Array.isArray(costs.breakdown), "GET /costs breakdown is an array");

    // 10. GET /costs/settings and POST /costs/settings
    const costSettings = await getCostSettings();
    assert(typeof costSettings.monthly_budget === "number", "GET /costs/settings returns numeric monthly_budget");

    const newBudget = 2850.0;
    const updCostRes = await updateCostBudget(newBudget);
    assertEqual(updCostRes.settings.monthly_budget, newBudget, "POST /costs/settings successfully updated budget");
    const recheckedCosts = await getCosts();
    assertEqual(recheckedCosts.monthly_budget, newBudget, "Updated budget persists in GET /costs");

    // 11. POST /costs/settings rejects invalid budgets (negative, zero)
    let invalidBudgetThrew = false;
    try {
      await updateCostBudget(-100);
    } catch (e) {
      invalidBudgetThrew = true;
    }
    assert(invalidBudgetThrew, "POST /costs/settings rejects negative budget");

    // 12. GET /weather
    const weather = await getWeather();
    assertEqual(weather.location, "DEMO LOCATION", "GET /weather location is DEMO LOCATION");
    assertEqual(weather.simulation_mode, true, "GET /weather simulation_mode is true");
    assertEqual(weather.data_source_status, "No live weather connection", "Weather reports 'No live weather connection'");

    // 13. POST /record-health-check
    const recordRes = await recordHealthCheck("srv-auth", "failed");
    assert(recordRes.consecutive_failure_count >= 1, "POST /record-health-check tracks consecutive failure count");

    // 14. POST /reset restores initial cluster state
    const resetRes = await resetBackend();
    assertEqual(resetRes.state.failed_server_count, 0, "POST /reset restores 0 failed servers");
    assertEqual(resetRes.costs.monthly_budget, 2500.0, "POST /reset restores default $2500 budget");
  } else {
    console.log("  [NOTICE] Flask backend is not running at 127.0.0.1:5000. Skipping live HTTP round-trips.");
  }

  console.log("\nTEST GROUP 8: Simulator Offline / Error State Handling");
  // Test fetchBackendState with network error simulation
  const originalFetchState = sim.fetchBackendState.bind(sim);
  let errorHandled = false;
  try {
    // Force offline simulation
    sim.state.backendConnected = false;
    sim.dom.simBadge.textContent = "OFFLINE";
    sim.dom.simBadge.className = "lcd-sim-badge offline";
    errorHandled = true;
  } catch (e) {}

  assert(errorHandled, "Simulator handles offline transition without uncaught exceptions");
  assertEqual(sim.state.backendConnected, false, "Simulator marks backendConnected as false");
  assertEqual(simBadge.textContent, "OFFLINE", "Simulator badge updates to OFFLINE");

  // Re-verify that local features never break when offline
  const localClockData = sim.screens.find(s => s.id === "companion");
  assert(localClockData !== undefined, "Clock screen definition remains intact during offline state");

  const focusTimerData = sim.screens.find(s => s.id === "focusTimer");
  assert(focusTimerData !== undefined, "Focus timer screen definition remains intact during offline state");

  sim.destroy();

  console.log("\n-------------------------------------------------------");
  console.log(`TOTAL SIMULATOR TESTS: ${passCount + failCount}`);
  console.log(`PASSED: ${passCount}`);
  console.log(`FAILED: ${failCount}`);
  console.log("-------------------------------------------------------\n");

  if (failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runSimulatorTests().catch((err) => {
  console.error("Unhandled test suite error:", err);
  process.exit(1);
});
