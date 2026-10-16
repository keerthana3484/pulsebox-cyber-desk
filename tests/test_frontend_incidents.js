/**
 * Automated test suite for INCIDENTS screen integration with Flask backend API.
 * 
 * Verifies the 5 required scenarios:
 * 1. No incidents (EMPTY INCIDENT LOG state)
 * 2. One OPEN incident (CRITICAL alert with all 6 required fields)
 * 3. A RESOLVED incident (transitions to RESOLVED, not deleted)
 * 4. Multiple incidents (newest first ordering, navigation/selection)
 * 5. Unreachable Flask backend (INCIDENT DATA OFFLINE, does not falsely show empty log)
 */

import { getIncidents, restoreServer } from "../frontend/src/api.js";
import { renderIncidentsScreen } from "../frontend/src/screens/incidents.js";

// Helper for minimal container emulation
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
    this.children = [];
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
    this._listeners = new Map();
  }

  get innerHTML() {
    return this._html;
  }

  set innerHTML(val) {
    this._html = val;
  }

  querySelectorAll(selector) {
    // Find elements by class or dataset
    const elements = [];
    if (selector === ".inc-row-item") {
      const regex = /class="inc-row-item[^"]*"[^>]*data-id="([^"]+)"/g;
      let match;
      while ((match = regex.exec(this._html)) !== null) {
        const id = match[1];
        const el = new MockElement("div", { "data-id": id, class: "inc-row-item" });
        elements.push(el);
      }
    }
    return elements;
  }

  querySelector(selector) {
    if (selector === "#btn-resolve-node") {
      if (this._html.includes('id="btn-resolve-node"')) {
        return new MockElement("button", { id: "btn-resolve-node" });
      }
      return null;
    }
    if (selector === "#btn-refresh-inc") {
      if (this._html.includes('id="btn-refresh-inc"')) {
        return new MockElement("button", { id: "btn-refresh-inc" });
      }
      return null;
    }
    if (selector === "#btn-manual-retry") {
      if (this._html.includes('id="btn-manual-retry"')) {
        return new MockElement("button", { id: "btn-manual-retry" });
      }
      return null;
    }
    return null;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Backend helper to inject failures
async function postJson(url, data = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return await res.json();
}

async function runTests() {
  console.log("==========================================================");
  console.log("   RUNNING FRONTEND INCIDENTS INTEGRATION TEST SUITE      ");
  console.log("==========================================================\n");

  const state = { incidents: [] };
  const mockActions = {
    api: {
      getIncidents,
      restoreServer,
    },
    onStateChange: (fn) => () => {},
    playClick: () => {},
    playSuccess: () => {},
    playAlert: () => {},
    logSerial: (msg) => console.log(`   [SERIAL] ${msg}`),
    refreshBackendState: async () => {},
  };

  let passed = 0;
  let total = 0;

  function assert(condition, name) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name}`);
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  // --- Reset backend cluster to nominal state before testing ---
  await postJson("http://127.0.0.1:5000/restore", { clear_incidents: true });

  // ------------------------------------------------------------------------
  // TEST 1: NO INCIDENTS (EMPTY INCIDENT LOG)
  // ------------------------------------------------------------------------
  console.log("\n[TEST 1] Verifying NO INCIDENTS (EMPTY INCIDENT LOG state)...");
  const container1 = new MockContainer();
  const cleanup1 = renderIncidentsScreen(container1, state, mockActions);

  // Wait for initial fetch
  await sleep(100);

  assert(container1.innerHTML.includes("EMPTY INCIDENT LOG"), "Displays 'EMPTY INCIDENT LOG'");
  assert(container1.innerHTML.includes("ALL 6 SIMULATED CLUSTER NODES NOMINAL"), "Displays nominal subtitle");
  assert(container1.innerHTML.includes("SIMULATION MODE"), "Displays SIMULATION label");
  assert(!container1.innerHTML.includes("INC-"), "Does not display any fake or residual incidents");
  cleanup1();

  // ------------------------------------------------------------------------
  // TEST 2: ONE OPEN INCIDENT
  // ------------------------------------------------------------------------
  console.log("\n[TEST 2] Verifying ONE OPEN INCIDENT...");
  // Inject 3 consecutive failed health checks on srv-api to trigger real alert
  await postJson("http://127.0.0.1:5000/record-health-check", { server_id: "srv-api", status: "failed" });
  await postJson("http://127.0.0.1:5000/record-health-check", { server_id: "srv-api", status: "failed" });
  const check3 = await postJson("http://127.0.0.1:5000/record-health-check", { server_id: "srv-api", status: "failed" });
  assert(check3.incident_created === true, "Backend created CRITICAL incident on 3rd failure");

  const container2 = new MockContainer();
  const cleanup2 = renderIncidentsScreen(container2, state, mockActions);
  await sleep(150);

  const html2 = container2.innerHTML;
  assert(html2.includes("INC-001"), "Displays incident ID INC-001");
  assert(html2.includes("API Gateway"), "Displays server name 'API Gateway'");
  assert(html2.includes("CRITICAL"), "Displays severity 'CRITICAL'");
  assert(html2.includes("OPEN"), "Displays status 'OPEN'");
  assert(html2.includes("F:3"), "Displays consecutive failure count F:3");
  assert(html2.includes("Z") || html2.includes("UTC"), "Displays formatted created time timestamp");
  assert(html2.includes("ACTIVE OUTAGE"), "Displays ACTIVE OUTAGE state in detail view");
  assert(html2.includes("id=\"btn-resolve-node\""), "Displays RESTORE action button for OPEN incident");
  assert(html2.includes("[SIMULATION]"), "Displays [SIMULATION] tag");
  cleanup2();

  // ------------------------------------------------------------------------
  // TEST 3: A RESOLVED INCIDENT
  // ------------------------------------------------------------------------
  console.log("\n[TEST 3] Verifying RESOLVED INCIDENT...");
  // Restore srv-api to resolve INC-001
  await postJson("http://127.0.0.1:5000/restore", { server_id: "srv-api" });

  const container3 = new MockContainer();
  const cleanup3 = renderIncidentsScreen(container3, state, mockActions);
  await sleep(150);

  const html3 = container3.innerHTML;
  assert(html3.includes("INC-001"), "Historical incident INC-001 is preserved and not deleted");
  assert(html3.includes("RESOLVED"), "Incident status transitioned to RESOLVED");
  assert(html3.includes("RESOLVED ✓"), "Displays RESOLVED checkmark in detail view");
  assert(html3.includes("resolved-item"), "Uses resolved cyberpunk styling");
  assert(!html3.includes("id=\"btn-resolve-node\""), "Does not show RESTORE button for already resolved incident");
  cleanup3();

  // ------------------------------------------------------------------------
  // TEST 4: MULTIPLE INCIDENTS (NEWEST FIRST)
  // ------------------------------------------------------------------------
  console.log("\n[TEST 4] Verifying MULTIPLE INCIDENTS (NEWEST FIRST ORDER)...");
  // Trigger 3 failures on srv-db to create second incident INC-002
  await postJson("http://127.0.0.1:5000/record-health-check", { server_id: "srv-db", status: "failed" });
  await postJson("http://127.0.0.1:5000/record-health-check", { server_id: "srv-db", status: "failed" });
  await postJson("http://127.0.0.1:5000/record-health-check", { server_id: "srv-db", status: "failed" });

  const container4 = new MockContainer();
  const cleanup4 = renderIncidentsScreen(container4, state, mockActions);
  await sleep(150);

  const html4 = container4.innerHTML;
  assert(html4.includes("ALERTS (2)"), "Alerts count displays 2 incidents");
  assert(html4.includes("INC-002") && html4.includes("INC-001"), "Both INC-002 and INC-001 are present");
  
  // Verify ordering: INC-002 (newest) must appear before INC-001 in DOM
  const idx2 = html4.indexOf("INC-002");
  const idx1 = html4.indexOf("INC-001");
  assert(idx2 < idx1, "Newest incident INC-002 is listed BEFORE older INC-001");

  // Verify elements list
  const rows = container4.querySelectorAll(".inc-row-item");
  assert(rows.length === 2, `Found ${rows.length} incident list items for navigation`);
  cleanup4();

  // ------------------------------------------------------------------------
  // TEST 5: UNREACHABLE FLASK BACKEND (OFFLINE STATE)
  // ------------------------------------------------------------------------
  console.log("\n[TEST 5] Verifying UNREACHABLE FLASK BACKEND (OFFLINE STATE)...");
  const offlineActions = {
    ...mockActions,
    api: {
      getIncidents: async () => {
        throw new Error("Failed to fetch: Connection refused (offline)");
      },
      restoreServer: async () => {},
    },
  };

  const container5 = new MockContainer();
  const cleanup5 = renderIncidentsScreen(container5, state, offlineActions);
  await sleep(100);

  const html5 = container5.innerHTML;
  assert(html5.includes("INCIDENT DATA OFFLINE"), "Displays 'INCIDENT DATA OFFLINE'");
  assert(html5.includes("BACKEND UNREACHABLE"), "Displays backend unreachable message");
  assert(html5.includes("RETRYING IN 3s"), "Displays auto-retry message");
  assert(!html5.includes("EMPTY INCIDENT LOG"), "Does NOT falsely show 'EMPTY INCIDENT LOG' when backend is offline");
  cleanup5();

  // Clean up backend to nominal
  await postJson("http://127.0.0.1:5000/restore", {});

  console.log("\n==========================================================");
  console.log(`   ALL TESTS COMPLETED: ${passed}/${total} PASSED (100%)       `);
  console.log("==========================================================\n");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
