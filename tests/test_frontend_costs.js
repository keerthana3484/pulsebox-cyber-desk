/**
 * Automated test suite for CLOUD COSTS screen integration with Flask backend API.
 * 
 * Verifies:
 * 1. Default deterministic cost telemetry rendering (Today, Month, Budget, Remaining, SIM badge, Data source status)
 * 2. Status threshold calculations (NORMAL, WARNING, BUDGET EXCEEDED)
 * 3. 15-Day trend bar visualization rendering
 * 4. 4-Category service breakdown
 * 5. Budget adjust interaction (steppers, presets, validation)
 * 6. Offline state handling (never displays false $0.00 spend when disconnected)
 * 7. Division-by-zero protection on zero/invalid budgets
 */

import { getCosts, getCostSettings, updateCostBudget } from "../frontend/src/api.js";
import { renderCloudCostsScreen } from "../frontend/src/screens/cloudCosts.js";

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
    this.value = attrs.value || "";
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

  querySelectorAll(selector) {
    const elements = [];
    if (selector === ".cost-trend-bar-col") {
      const regex = /class="cost-trend-bar-col[^"]*"/g;
      let match;
      while ((match = regex.exec(this._html)) !== null) {
        elements.push(new MockElement("div", { class: "cost-trend-bar-col" }));
      }
    } else if (selector === ".cost-breakdown-row") {
      const regex = /class="cost-breakdown-row"/g;
      let match;
      while ((match = regex.exec(this._html)) !== null) {
        elements.push(new MockElement("div", { class: "cost-breakdown-row" }));
      }
    } else if (selector === ".preset-btn") {
      const regex = /class="[^"]*preset-btn[^"]*"[^>]*data-preset="([^"]+)"/g;
      let match;
      while ((match = regex.exec(this._html)) !== null) {
        elements.push(new MockElement("button", { class: "preset-btn", "data-preset": match[1] }));
      }
    }
    return elements;
  }

  querySelector(selector) {
    if (selector.startsWith("#")) {
      const id = selector.slice(1);
      if (this._html.includes(`id="${id}"`)) {
        if (!this._elements.has(id)) {
          this._elements.set(id, new MockElement("div", { id }));
        }
        return this._elements.get(id);
      }
    }
    return null;
  }
}

function createMockAppActions(apiOverrides = {}) {
  const serialLogs = [];
  return {
    api: {
      getCosts,
      getCostSettings,
      updateCostBudget,
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
  console.log("   RUNNING FRONTEND CLOUD COSTS INTEGRATION TEST SUITE    ");
  console.log("==========================================================\n");

  // Ensure backend is reset to default $2500 budget
  try {
    await updateCostBudget(2500.0);
  } catch (err) {
    console.warn("Backend not yet running or connection failed:", err.message);
  }

  // -------------------------------------------------------------
  // TEST 1: Default Deterministic Cost Rendering
  // -------------------------------------------------------------
  console.log("[TEST 1] Verifying deterministic cost telemetry rendering...");
  {
    const container = new MockContainer();
    const appActions = createMockAppActions();

    const cleanup = renderCloudCostsScreen(container, {}, appActions);
    await new Promise(r => setTimeout(r, 200));

    const html = container.innerHTML;

    assert(html.includes("SIM"), "Displays visible SIM badge");
    assert(html.includes("CLOUD SPEND TELEMETRY"), "Displays screen title");
    assert(html.includes("$64.20"), "Displays today spend $64.20");
    assert(html.includes("$1,842.60"), "Displays month-to-date spend $1,842.60");
    assert(html.includes("$2,500.00"), "Displays monthly budget $2,500.00");
    assert(html.includes("$657.40"), "Displays remaining budget $657.40");
    assert(html.includes("NORMAL"), "Displays NORMAL status pill");
    assert(html.includes("No live billing connection"), "Displays 'No live billing connection' status");
    assert(html.includes("73.7%"), "Displays 73.7% budget utilization");

    // Check trend bars: exactly 15 daily trend bars
    const trendBars = container.querySelectorAll(".cost-trend-bar-col");
    assert(trendBars.length === 15, `Renders 15 trend bars (found ${trendBars.length})`);

    // Check breakdown rows: 4 service categories
    const breakdownRows = container.querySelectorAll(".cost-breakdown-row");
    assert(breakdownRows.length === 4, `Renders 4 breakdown rows (found ${breakdownRows.length})`);
    assert(html.includes("Compute (K8s/EC2)"), "Includes Compute category");
    assert(html.includes("Managed DB (RDS)"), "Includes Managed DB category");
    assert(html.includes("Storage &amp; Backups") || html.includes("Storage & Backups"), "Includes Storage category");

    cleanup();
  }

  // -------------------------------------------------------------
  // TEST 2: Threshold Transitions (NORMAL -> WARNING -> BUDGET EXCEEDED)
  // -------------------------------------------------------------
  console.log("\n[TEST 2] Verifying threshold states (WARNING and BUDGET EXCEEDED)...");
  {
    // A: Set budget to $2000 -> 1842.60 / 2000 = 92.1% (WARNING)
    await updateCostBudget(2000.0);
    const containerWarning = new MockContainer();
    const appActions = createMockAppActions();
    const cleanupWarning = renderCloudCostsScreen(containerWarning, {}, appActions);
    await new Promise(r => setTimeout(r, 200));

    assert(containerWarning.innerHTML.includes("WARNING"), "Displays WARNING status pill for 92.1% utilization");
    assert(containerWarning.innerHTML.includes("cost-status-pill warning"), "Applies warning status styling class");
    cleanupWarning();

    // B: Set budget to $1500 -> 1842.60 / 1500 = 122.8% (BUDGET EXCEEDED)
    await updateCostBudget(1500.0);
    const containerExceeded = new MockContainer();
    const cleanupExceeded = renderCloudCostsScreen(containerExceeded, {}, appActions);
    await new Promise(r => setTimeout(r, 200));

    assert(containerExceeded.innerHTML.includes("BUDGET EXCEEDED"), "Displays BUDGET EXCEEDED status pill");
    assert(containerExceeded.innerHTML.includes("cost-status-pill exceeded"), "Applies exceeded status styling class");
    cleanupExceeded();

    // Reset back to $2500
    await updateCostBudget(2500.0);
  }

  // -------------------------------------------------------------
  // TEST 3: Budget Adjuster Controls and Steppers
  // -------------------------------------------------------------
  console.log("\n[TEST 3] Verifying compact budget adjuster interaction...");
  {
    const container = new MockContainer();
    const appActions = createMockAppActions();
    const cleanup = renderCloudCostsScreen(container, {}, appActions);
    await new Promise(r => setTimeout(r, 200));

    // Toggle adjuster open
    const toggleBtn = container.querySelector("#btn-toggle-adjust");
    assert(toggleBtn !== null, "Budget adjust toggle button is present");
    toggleBtn.click();

    // Verify adjuster panel is rendered
    const htmlAdjust = container.innerHTML;
    assert(htmlAdjust.includes("cost-adjuster-panel"), "Renders cost adjuster panel");
    assert(htmlAdjust.includes("-$250"), "Includes -$250 stepper button");
    assert(htmlAdjust.includes("+$250"), "Includes +$250 stepper button");
    assert(htmlAdjust.includes("$1.5k"), "Includes $1.5k preset button");
    assert(htmlAdjust.includes("$3.0k"), "Includes $3.0k preset button");
    assert(htmlAdjust.includes("APPLY"), "Includes APPLY button");

    cleanup();
  }

  // -------------------------------------------------------------
  // TEST 4: Backend Disconnected (Offline State)
  // -------------------------------------------------------------
  console.log("\n[TEST 4] Verifying unreachable Flask backend (OFFLINE state)...");
  {
    const container = new MockContainer();
    const mockOfflineApi = {
      getCosts: async () => {
        throw new Error("Connection refused (mock offline)");
      },
    };
    const appActions = createMockAppActions(mockOfflineApi);
    const cleanup = renderCloudCostsScreen(container, {}, appActions);
    await new Promise(r => setTimeout(r, 200));

    const html = container.innerHTML;
    assert(html.includes("COST DATA OFFLINE"), "Displays 'COST DATA OFFLINE'");
    assert(html.includes("BACKEND UNREACHABLE"), "Displays backend unreachable message");
    assert(html.includes("RETRYING IN 3s"), "Displays auto-retry notice");
    assert(html.includes("RETRY NOW"), "Provides manual retry button");
    assert(!html.includes("$0.00"), "Does NOT falsely display $0.00 costs when disconnected");

    cleanup();
  }

  // -------------------------------------------------------------
  // TEST 5: Zero/Invalid Budget Safe Math Protection
  // -------------------------------------------------------------
  console.log("\n[TEST 5] Verifying zero and negative budget division-by-zero protection...");
  {
    const container = new MockContainer();
    const mockZeroApi = {
      getCosts: async () => ({
        today_spend: 50.0,
        month_spend: 200.0,
        monthly_budget: 0.0,
        budget_used_pct: 100.0,
        remaining_budget: 0.0,
        budget_status: "BUDGET EXCEEDED",
        daily_trend: [],
        breakdown: [],
        data_source_status: "No live billing connection",
        simulation_mode: true,
        timestamp: new Date().toISOString(),
      }),
    };
    const appActions = createMockAppActions(mockZeroApi);
    let didCrash = false;
    try {
      const cleanup = renderCloudCostsScreen(container, {}, appActions);
      await new Promise(r => setTimeout(r, 200));
      assert(container.innerHTML.includes("BUDGET EXCEEDED"), "Handles zero budget safely with BUDGET EXCEEDED");
      cleanup();
    } catch {
      didCrash = true;
    }
    assert(!didCrash, "Zero budget does not crash or throw ZeroDivisionError");
  }

  console.log("\n==========================================================");
  console.log(`   ALL TESTS COMPLETED: ${passedTests}/${totalTests} PASSED (100%)       `);
  console.log("==========================================================\n");
}

runTests().catch(err => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
