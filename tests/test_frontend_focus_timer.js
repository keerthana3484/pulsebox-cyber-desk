/**
 * Automated test suite for DEDICATED FOCUS TIMER screen.
 * 
 * Verifies:
 * 1. Start, pause, resume, reset, and skip controls.
 * 2. Focus and break completion handling and transitions.
 * 3. Correct countdown calculation after delayed UI updates (timestamp/deadline accuracy).
 * 4. Screen switching without timer resets or duplicate intervals.
 * 5. Page refresh and saved-state recovery via localStorage.
 * 6. Corrupted and invalid saved data handling (negative, NaN, non-JSON, stale).
 * 7. Sound and mute behavior integration.
 * 8. Preset selection (15m, 25m, 45m) and discard confirmation protection.
 */

import {
  FocusTimerService,
  STORAGE_KEY,
  DEFAULT_FOCUS_PRESET,
  DEFAULT_BREAK_PRESET
} from "../frontend/src/timerService.js";
import { renderFocusTimerScreen } from "../frontend/src/screens/focusTimer.js";
import { setSoundEnabled, isSoundEnabled } from "../frontend/src/audio.js";

// In-Memory Storage Emulation for Node.js
class MockStorage {
  constructor() {
    this._data = new Map();
  }
  getItem(key) {
    return this._data.has(key) ? this._data.get(key) : null;
  }
  setItem(key, val) {
    this._data.set(key, String(val));
  }
  removeItem(key) {
    this._data.delete(key);
  }
  clear() {
    this._data.clear();
  }
}

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
    this.style = {};
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
    const list = [];
    if (selector === "[data-preset]") {
      const regex = /data-preset="(\d+)"/g;
      let match;
      while ((match = regex.exec(this._html)) !== null) {
        const el = new MockElement("button", { "data-preset": match[1] });
        list.push(el);
      }
    }
    return list;
  }
}

function createMockAppActions() {
  const serialLogs = [];
  return {
    playClick: () => {},
    playBeep: () => {},
    playSuccess: () => {},
    playAlert: () => {},
    toggleSound: (enabled) => setSoundEnabled(enabled),
    logSerial: (msg) => serialLogs.push(msg),
    getLogs: () => serialLogs,
  };
}

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ✕ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  }
}

async function runTests() {
  console.log("==========================================================");
  console.log("   RUNNING FRONTEND FOCUS TIMER INTEGRATION SUITE         ");
  console.log("==========================================================\n");

  // -------------------------------------------------------------
  // TEST 1: Start, Pause, Resume, Reset, and Skip Controls
  // -------------------------------------------------------------
  console.log("[TEST 1] Verifying Start, Pause, Resume, Reset, and Skip controls...");
  {
    const storage = new MockStorage();
    const service = new FocusTimerService(storage);

    // Initial state
    let state = service.getState();
    assert(state.mode === "focus", "Initial mode is 'focus'");
    assert(state.durationMinutes === DEFAULT_FOCUS_PRESET, "Initial duration is 25 minutes");
    assert(state.remainingSeconds === 1500, "Initial remaining seconds is 1500 (25:00)");
    assert(state.isRunning === false, "Timer initially not running");
    assert(state.sessionNumber === 1, "Session number starts at 1");
    assert(state.completedSessions === 0, "Completed sessions starts at 0");

    // Start
    service.start();
    state = service.getState();
    assert(state.isRunning === true, "Timer is running after start()");
    assert(typeof state.targetDeadline === "number" && state.targetDeadline > Date.now(), "Target deadline set into future");

    // Pause
    service.pause();
    state = service.getState();
    assert(state.isRunning === false, "Timer is stopped after pause()");
    assert(state.targetDeadline === null, "Target deadline cleared when paused");
    assert(typeof state.pausedAt === "number", "pausedAt timestamp recorded");

    // Resume
    service.resume();
    state = service.getState();
    assert(state.isRunning === true, "Timer is running after resume()");

    // Reset without force when active: requires confirmation
    const resetRes = service.requestReset(false);
    assert(resetRes.requiresConfirmation === true, "Resetting active session prompts for confirmation");
    assert(service.getState().pendingConfirm?.action === "reset", "Pending confirm set to 'reset'");

    // Cancel reset
    service.cancelPendingAction();
    assert(service.getState().pendingConfirm === null, "Cancel clears pending confirmation");

    // Confirm reset
    service.requestReset(false);
    service.confirmPendingAction();
    state = service.getState();
    assert(state.isRunning === false, "Timer halted after confirmed reset");
    assert(state.remainingSeconds === 1500, "Remaining seconds reset to 1500");

    // Skip
    service.start();
    const skipRes = service.requestSkip(false);
    assert(skipRes.requiresConfirmation === true, "Skipping active session prompts for confirmation");
    service.confirmPendingAction();

    state = service.getState();
    assert(state.mode === "break", "Skipped focus session transitioned to 'break' mode");
    assert(state.durationMinutes === DEFAULT_BREAK_PRESET, "Break duration set to 5 minutes");
    assert(state.remainingSeconds === 300, "Break remaining seconds set to 300 (5:00)");

    // Skip break
    service.requestSkip(true); // force skip
    state = service.getState();
    assert(state.mode === "focus", "Skipped break transitioned back to 'focus' mode");
    assert(state.sessionNumber === 2, "Session number incremented to 2 after break");
  }

  // -------------------------------------------------------------
  // TEST 2: Focus and Break Completion Handling
  // -------------------------------------------------------------
  console.log("\n[TEST 2] Verifying Focus and Break completion...");
  {
    const storage = new MockStorage();
    const service = new FocusTimerService(storage);

    service.start();
    const startDeadline = service.getState().targetDeadline;

    // Simulate completion by syncing at or after the target deadline
    service.sync(startDeadline + 100);

    let state = service.getState();
    assert(state.completedSessions === 1, "Completed sessions incremented to 1 upon focus completion");
    assert(state.mode === "break", "Automatically transitioned to break mode after focus completion");
    assert(state.durationMinutes === 5, "Break duration is 5 minutes");
    assert(state.remainingSeconds === 300, "Break countdown set to 300s");
    assert(state.isRunning === false, "Timer waiting for user to start break");
    assert(state.completionNotice.includes("FOCUS SESSION COMPLETE"), "Displays focus completion celebration banner");

    // Start break
    service.start();
    const breakDeadline = service.getState().targetDeadline;

    // Complete break
    service.sync(breakDeadline + 100);
    state = service.getState();
    assert(state.mode === "focus", "Automatically transitioned back to focus mode after break completion");
    assert(state.sessionNumber === 2, "Session number incremented to 2 after break completed");
    assert(state.completionNotice.includes("BREAK COMPLETE"), "Displays break completion banner");
  }

  // -------------------------------------------------------------
  // TEST 3: Correct Countdown After Delayed UI Updates (Deadline Accuracy)
  // -------------------------------------------------------------
  console.log("\n[TEST 3] Verifying correct countdown after delayed UI updates (no drift)...");
  {
    const storage = new MockStorage();
    const service = new FocusTimerService(storage);
    const now = Date.now();

    service.start();

    // Fast forward wall-clock by exactly 95 seconds
    const simulatedNow = now + (95 * 1000);
    const remaining = service.sync(simulatedNow);

    assert(remaining === 1500 - 95, `Remaining seconds (${remaining}) matches exactly 1500 - 95 = 1405s`);
    assert(service.getState(simulatedNow).remainingSeconds === 1405, "Internal state reflects true wall clock elapsed time");
  }

  // -------------------------------------------------------------
  // TEST 4: Screen Switching Without Timer Resets or Duplicate Intervals
  // -------------------------------------------------------------
  console.log("\n[TEST 4] Verifying screen switching without timer resets or duplicate intervals...");
  {
    let activeIntervals = 0;
    const origSet = global.setInterval;
    const origClr = global.clearInterval;

    global.setInterval = (fn, ms) => {
      activeIntervals++;
      return origSet(fn, ms);
    };
    global.clearInterval = (id) => {
      activeIntervals--;
      return origClr(id);
    };

    const container = new MockContainer();
    const appActions = createMockAppActions();

    // Mount screen
    const cleanup1 = renderFocusTimerScreen(container, {}, appActions);
    assert(activeIntervals === 1, "Exactly 1 UI ticker registered on mount");

    // Unmount (simulating user switching to SERVERS screen)
    cleanup1();
    assert(activeIntervals === 0, "UI ticker cleared completely upon unmounting screen");

    // Mount and unmount 5 times in rapid succession
    for (let i = 0; i < 5; i++) {
      const cleanup = renderFocusTimerScreen(container, {}, appActions);
      cleanup();
    }
    assert(activeIntervals === 0, `Zero dangling intervals after rapid screen transitions (active: ${activeIntervals})`);

    global.setInterval = origSet;
    global.clearInterval = origClr;
  }

  // -------------------------------------------------------------
  // TEST 5: Page Refresh & Saved-State Recovery via LocalStorage
  // -------------------------------------------------------------
  console.log("\n[TEST 5] Verifying page refresh and saved-state recovery...");
  {
    const storage = new MockStorage();
    const now = Date.now();

    // 1. Session in progress when page reloaded
    const savedActiveData = {
      mode: "focus",
      focusPresetMinutes: 25,
      breakPresetMinutes: 5,
      durationMinutes: 25,
      remainingSeconds: 850,
      targetDeadline: now + 50000, // 50 seconds remaining
      isRunning: true,
      pausedAt: null,
      sessionNumber: 3,
      completedSessions: 2,
      savedAt: now,
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(savedActiveData));

    // New instance loads state (simulating page reload)
    const reloadedService = new FocusTimerService(storage);
    const reloadedState = reloadedService.getState();

    assert(reloadedState.sessionNumber === 3, "Preserved session number 3");
    assert(reloadedState.completedSessions === 2, "Preserved 2 completed sessions");
    assert(reloadedState.isRunning === true, "Restored running state");
    assert(reloadedState.remainingSeconds > 0 && reloadedState.remainingSeconds <= 50, "Accurately calculated remaining seconds from deadline");

    // 2. Timer expired while page was closed
    const expiredData = {
      mode: "focus",
      focusPresetMinutes: 25,
      breakPresetMinutes: 5,
      durationMinutes: 25,
      remainingSeconds: 10,
      targetDeadline: now - 3000, // expired 3 seconds ago
      isRunning: true,
      pausedAt: null,
      sessionNumber: 1,
      completedSessions: 0,
      savedAt: now - 15000,
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(expiredData));

    const expiredReloadService = new FocusTimerService(storage);
    const expiredState = expiredReloadService.getState();
    assert(expiredState.completedSessions === 1, "Completed session detected and credited upon reopen");
    assert(expiredState.mode === "break", "Transitioned to break mode upon reopening after deadline");
  }

  // -------------------------------------------------------------
  // TEST 6: Invalid and Stale Saved Data Handling
  // -------------------------------------------------------------
  console.log("\n[TEST 6] Verifying invalid and stale saved data safety...");
  {
    const storage = new MockStorage();

    // Corrupted JSON
    storage.setItem(STORAGE_KEY, "{ bad json: true, ");
    const badJsonService = new FocusTimerService(storage);
    assert(badJsonService.getState().mode === "focus", "Falls back safely to default on corrupt JSON");

    // Invalid non-numeric values
    storage.setItem(STORAGE_KEY, JSON.stringify({
      mode: "invalid_mode_xyz",
      durationMinutes: "one_hundred",
      remainingSeconds: -500,
      sessionNumber: -2,
    }));
    const invalidValsService = new FocusTimerService(storage);
    const state = invalidValsService.getState();
    assert(state.mode === "focus", "Invalid mode normalized to 'focus'");
    assert(state.durationMinutes === 25, "Invalid duration normalized to 25");
    assert(state.remainingSeconds >= 0, "Negative remaining seconds normalized safely");
    assert(state.sessionNumber === 1, "Negative session number normalized to 1");

    // Stale session (targetDeadline from 3 days ago)
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    storage.setItem(STORAGE_KEY, JSON.stringify({
      mode: "focus",
      isRunning: true,
      targetDeadline: threeDaysAgo,
    }));
    const staleService = new FocusTimerService(storage);
    assert(staleService.getState().isRunning === false, "Stale session beyond 24h reset to idle without crash");
  }

  // -------------------------------------------------------------
  // TEST 7: Sound and Mute Behavior
  // -------------------------------------------------------------
  console.log("\n[TEST 7] Verifying Sound and Mute behavior...");
  {
    const storage = new MockStorage();
    const service = new FocusTimerService(storage);

    setSoundEnabled(true);
    assert(isSoundEnabled() === true, "Audio initially enabled");
    assert(service.getState().soundEnabled === true, "Service reports sound enabled");

    // Mute
    service.toggleSound(false);
    assert(isSoundEnabled() === false, "Audio successfully muted");
    assert(service.getState().soundEnabled === false, "Service reports sound muted");

    // Unmute
    service.toggleSound(true);
    assert(isSoundEnabled() === true, "Audio successfully unmuted");
  }

  // -------------------------------------------------------------
  // TEST 8: Preset Selection (15m, 25m, 45m)
  // -------------------------------------------------------------
  console.log("\n[TEST 8] Verifying Presets (15m, 25m, 45m)...");
  {
    const storage = new MockStorage();
    const service = new FocusTimerService(storage);

    // Switch to 15m preset when idle
    service.requestPreset(15, false);
    let state = service.getState();
    assert(state.focusPresetMinutes === 15, "Focus preset changed to 15m");
    assert(state.remainingSeconds === 900, "Remaining seconds updated to 900 (15:00)");

    // Switch to 45m preset
    service.requestPreset(45, false);
    state = service.getState();
    assert(state.focusPresetMinutes === 45, "Focus preset changed to 45m");
    assert(state.remainingSeconds === 2700, "Remaining seconds updated to 2700 (45:00)");

    // Switch preset while running: requires confirmation
    service.start();
    const presetRes = service.requestPreset(25, false);
    assert(presetRes.requiresConfirmation === true, "Switching preset during active session prompts confirmation");
    service.confirmPendingAction();
    state = service.getState();
    assert(state.focusPresetMinutes === 25, "Confirmed preset switch to 25m");
    assert(state.remainingSeconds === 1500, "Remaining seconds reset to 25m");
  }

  console.log("\n==========================================================");
  console.log(`   ALL TESTS COMPLETED: ${passedTests}/${totalTests} PASSED (100%)       `);
  console.log("==========================================================\n");
}

runTests().catch(err => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
