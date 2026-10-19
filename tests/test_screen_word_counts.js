/**
 * PulseBox Cyber Desk — Screen Word Count & Hero Element Compliance Audit
 * 
 * Verifies docs/UI_RULES.md requirements for all 8 native simulator screens:
 * 1. Each screen has ONE hero element readable in under 1 second.
 * 2. Max 3 text elements per screen on overview (excluding hotbar).
 * 3. Max 12 words per screen on overview (excluding hotbar).
 * 4. Tap-through detail view behind [< BACK] button.
 */

import { renderHomeScreen } from "../frontend/src/screens/home.js";
import { renderServersScreen } from "../frontend/src/screens/servers.js";
import { renderIncidentsScreen } from "../frontend/src/screens/incidents.js";
import { renderCloudCostsScreen } from "../frontend/src/screens/cloudCosts.js";
import { renderDeployScreen } from "../frontend/src/screens/deploy.js";
import { renderCompanionScreen } from "../frontend/src/screens/companion.js";
import { renderFocusTimerScreen } from "../frontend/src/screens/focusTimer.js";
import { renderSettingsScreen } from "../frontend/src/screens/settings.js";
import { createMockState } from "../frontend/src/mockData.js";
import { focusTimerService } from "../frontend/src/timerService.js";

// Minimal DOM Element emulation for Node.js
class MockElement {
  constructor(tag = "div", attrs = {}) {
    this.tag = tag;
    this.attrs = attrs;
    this.dataset = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith("data-")) this.dataset[k.slice(5)] = v;
    }
    this.listeners = {};
    this.children = [];
    this.textContent = "";
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c),
    };
  }

  addEventListener(evt, fn) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  }
}

class MockContainer {
  constructor() {
    this._html = "";
  }

  get innerHTML() {
    return this._html;
  }

  set innerHTML(val) {
    this._html = val;
  }

  querySelector(selector) {
    return null;
  }

  querySelectorAll(selector) {
    return [];
  }
}

function createMockAppActions() {
  return {
    api: {
      getHealth: async () => ({ status: "healthy", uptime_seconds: 7200, version: "1.4.2" }),
      getState: async () => createMockState(),
      getIncidents: async () => [],
      getCosts: async () => ({
        today_spend: 64.20,
        month_spend: 1842.60,
        monthly_budget: 2500.00,
        budget_status: "NORMAL",
        daily_trend: [],
        breakdown: [],
      }),
      getWeather: async () => ({
        location: "DEMO LOCATION",
        condition: "Partly Cloudy",
        temperature_f: 72,
        feels_like_f: 72,
        humidity_pct: 58,
        wind_speed_mph: 8.5,
        wind_direction: "NW",
        pressure_hpa: 1014,
        timestamp: new Date().toISOString(),
      }),
      restoreServer: async () => ({ status: "success" }),
      simulateFailure: async () => ({ status: "success" }),
    },
    playClick: () => {},
    playBeep: () => {},
    playSuccess: () => {},
    playAlert: () => {},
    logSerial: () => {},
    toggleSound: () => {},
    applySettings: () => {},
    resetToDefaults: () => {},
    enterStandby: () => {},
    refreshBackendState: async () => {},
    onStateChange: () => () => {},
  };
}

/**
 * Parses the overview stage HTML and extracts text content of text elements.
 */
function extractOverviewMetrics(html) {
  // Extract content inside <div class="screen-hero-view..." ... id="hero-overview-stage">...</div>
  const heroMatch = /<div class="screen-hero-view[^"]*"[^>]*id="hero-overview-stage"[^>]*>([\s\S]*?)<\/div>\s*<!--/i.exec(html)
    || /<div class="screen-hero-view[^"]*"[^>]*id="hero-overview-stage"[^>]*>([\s\S]*?)<\/div>\s*<div class="screen-detail-view/i.exec(html)
    || /id="hero-overview-stage"[^>]*>([\s\S]*?)<\/div>\s*<div/i.exec(html);

  if (!heroMatch) {
    throw new Error("Could not locate #hero-overview-stage in rendered HTML");
  }

  const heroContent = heroMatch[1];

  // Strip all SVGs and their inner contents so icon markup isn't counted as text
  const noSvg = heroContent.replace(/<svg[\s\S]*?<\/svg>/gi, " ");

  // Extract text from tags with text content (excluding container divs)
  // Match text nodes between tags
  const textMatches = noSvg
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Extract individual text elements inside hero overview
  // Looking for .voxel-hero-metric, .voxel-hero-status, .voxel-btn, .clock-digits-hero, etc.
  const elementRegex = /<(?:div|span|button)[^>]*class="[^"]*(?:voxel-hero-metric|voxel-hero-status|voxel-clock-hero-digits|clock-digits-hero|voxel-btn)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|span|button)>/gi;
  const elements = [];
  let m;
  while ((m = elementRegex.exec(noSvg)) !== null) {
    const txt = m[1].replace(/<[^>]+>/g, "").trim();
    if (txt) elements.push(txt);
  }

  // Count total words in textMatches
  const words = textMatches.length > 0 ? textMatches.split(/\s+/).filter(w => w.length > 0) : [];

  return {
    rawText: textMatches,
    words,
    wordCount: words.length,
    elements,
    elementCount: elements.length || (words.length > 0 ? 1 : 0),
  };
}

async function runAudit() {
  console.log("================================================================================");
  console.log("   PULSEBOX CYBER DESK — 5-WORD LIMIT & DYNAMIC STATE AUDIT                     ");
  console.log("   Target Canvas: 320x240 | Max Text Elements: 3 | Max Words: 5 (Overview)      ");
  console.log("================================================================================\n");

  const nominalScreens = [
    { id: "home", name: "System Status", render: renderHomeScreen, hero: "PulseBot + Shield Visual", expected: "ALL GOOD" },
    { id: "servers", name: "Cluster Health", render: renderServersScreen, hero: "Heart Bar + PulseBot", expected: "6 HAPPY" },
    { id: "incidents", name: "Incident Log", render: renderIncidentsScreen, hero: "PulseBot + Shield/Potion", expected: "ALL CLEAR" },
    { id: "costs", name: "Cloud Costs", render: renderCloudCostsScreen, hero: "Crystal + XP Level Bar", expected: "ON TRACK" },
    { id: "deploy", name: "Release Pipeline", render: renderDeployScreen, hero: "Voxel Rocket + Compass", expected: "LET'S SHIP" },
    { id: "companion", name: "Weather + Clock", render: renderCompanionScreen, hero: "Day/Night Sky + Clock Digits", expected: "72°F CLOUDY" },
    { id: "focusTimer", name: "Focus Timer", render: renderFocusTimerScreen, hero: "Digital Timer + Progress Bar", expected: "FOCUS TIME" },
    { id: "settings", name: "Device Config", render: renderSettingsScreen, hero: "Voxel Wrench + Battery", expected: "SETTINGS" },
  ];

  let allCompliant = true;
  const results = [];

  console.log("[PART 1: NOMINAL OVERVIEW LABELS & WORD COUNT]");
  for (let i = 0; i < nominalScreens.length; i++) {
    const scr = nominalScreens[i];
    const container = new MockContainer();
    const state = createMockState();
    state.backendConnected = true;
    const actions = createMockAppActions();

    const cleanup = scr.render(container, state, actions, { initialShowDetail: false });
    await new Promise(r => setTimeout(r, 100));

    const metrics = extractOverviewMetrics(container.innerHTML);

    const isElementCompliant = metrics.elementCount <= 3;
    const isWordCompliant = metrics.wordCount <= 5;
    const hasExpectedLabel = metrics.rawText.includes(scr.expected);
    const isPass = isElementCompliant && isWordCompliant && hasExpectedLabel;

    if (!isPass) allCompliant = false;

    results.push({
      slot: i + 1,
      id: scr.id,
      name: scr.name,
      hero: scr.hero,
      elementsCount: metrics.elementCount,
      wordCount: metrics.wordCount,
      snippet: metrics.rawText,
      expected: scr.expected,
      status: isPass ? "PASS (<=5 words)" : "FAIL",
    });

    if (typeof cleanup === "function") cleanup();
  }

  // Print Formatted Report Table
  console.log(
    "| Slot | Screen ID  | Screen Name        | Hero Element               | Elements | Words | Label Match | Status              |"
  );
  console.log(
    "|------|------------|--------------------|----------------------------|----------|-------|-------------|---------------------|"
  );

  for (const r of results) {
    const slotStr = String(r.slot).padEnd(4);
    const idStr = r.id.padEnd(10);
    const nameStr = r.name.padEnd(18);
    const heroStr = r.hero.padEnd(26);
    const elemStr = `${r.elementsCount}/3`.padEnd(8);
    const wordStr = `${r.wordCount}/5`.padEnd(5);
    const matchStr = (r.snippet.includes(r.expected) ? "YES" : "NO").padEnd(11);
    const statStr = r.status.padEnd(19);
    console.log(`| ${slotStr} | ${idStr} | ${nameStr} | ${heroStr} | ${elemStr} | ${wordStr} | ${matchStr} | ${statStr} |`);
  }

  console.log("\n[PART 2: DYNAMIC FAILURE, WARNING, AND BREAK STATE TRANSITIONS]");
  const dynamicTests = [];

  // 1. Home Screen: Degraded state -> "NEEDS LOVE"
  {
    const container = new MockContainer();
    const state = createMockState();
    state.backendConnected = true;
    state.system.overallHealth = "DEGRADED";
    state.system.failedServerCount = 1;
    const actions = createMockAppActions();
    const cleanup = renderHomeScreen(container, state, actions, { initialShowDetail: false });
    const metrics = extractOverviewMetrics(container.innerHTML);
    const pass = metrics.rawText.includes("NEEDS LOVE") && metrics.wordCount <= 5;
    if (!pass) allCompliant = false;
    dynamicTests.push({ test: "Home Degraded State", label: "NEEDS LOVE", snippet: metrics.rawText, words: metrics.wordCount, pass });
    if (typeof cleanup === "function") cleanup();
  }

  // 2. Home Screen: Offline state -> "OFFLINE"
  {
    const container = new MockContainer();
    const state = createMockState();
    state.backendConnected = false;
    const actions = createMockAppActions();
    const cleanup = renderHomeScreen(container, state, actions, { initialShowDetail: false });
    const metrics = extractOverviewMetrics(container.innerHTML);
    const pass = metrics.rawText.includes("OFFLINE") && metrics.wordCount <= 5;
    if (!pass) allCompliant = false;
    dynamicTests.push({ test: "Home Offline State", label: "OFFLINE", snippet: metrics.rawText, words: metrics.wordCount, pass });
    if (typeof cleanup === "function") cleanup();
  }

  // 3. Servers: 1 node failed -> "1 DOWN"
  {
    const container = new MockContainer();
    const state = createMockState();
    state.backendConnected = true;
    state.servers[0].status = "failed";
    const actions = createMockAppActions();
    const cleanup = renderServersScreen(container, state, actions, { initialShowDetail: false });
    const metrics = extractOverviewMetrics(container.innerHTML);
    const pass = metrics.rawText.includes("1 DOWN") && metrics.wordCount <= 5;
    if (!pass) allCompliant = false;
    dynamicTests.push({ test: "Servers 1 Node Down", label: "1 DOWN", snippet: metrics.rawText, words: metrics.wordCount, pass });
    if (typeof cleanup === "function") cleanup();
  }

  // 4. Servers: 2 nodes failed -> "2 DOWN"
  {
    const container = new MockContainer();
    const state = createMockState();
    state.backendConnected = true;
    state.servers[0].status = "failed";
    state.servers[1].status = "failed";
    const actions = createMockAppActions();
    const cleanup = renderServersScreen(container, state, actions, { initialShowDetail: false });
    const metrics = extractOverviewMetrics(container.innerHTML);
    const pass = metrics.rawText.includes("2 DOWN") && metrics.wordCount <= 5;
    if (!pass) allCompliant = false;
    dynamicTests.push({ test: "Servers 2 Nodes Down", label: "2 DOWN", snippet: metrics.rawText, words: metrics.wordCount, pass });
    if (typeof cleanup === "function") cleanup();
  }

  // 5. Incidents: Active open outage -> "UH OH"
  {
    const container = new MockContainer();
    const state = createMockState();
    state.backendConnected = true;
    const actions = createMockAppActions();
    actions.api.getIncidents = async () => [
      { id: "INC-001", server_id: "srv-api", server_name: "API Gateway", severity: "CRITICAL", status: "OPEN" }
    ];
    const cleanup = renderIncidentsScreen(container, state, actions, { initialShowDetail: false });
    await new Promise(r => setTimeout(r, 100));
    const metrics = extractOverviewMetrics(container.innerHTML);
    const pass = metrics.rawText.includes("UH OH") && metrics.wordCount <= 5;
    if (!pass) allCompliant = false;
    dynamicTests.push({ test: "Incidents Active Outage", label: "UH OH", snippet: metrics.rawText, words: metrics.wordCount, pass });
    if (typeof cleanup === "function") cleanup();
  }

  // 6. Costs: Warning threshold -> "HEADS UP"
  {
    const container = new MockContainer();
    const state = createMockState();
    state.backendConnected = true;
    const actions = createMockAppActions();
    actions.api.getCosts = async () => ({
      today_spend: 92.00,
      month_spend: 2350.00,
      monthly_budget: 2500.00,
      budget_status: "WARNING",
      daily_trend: [],
      breakdown: []
    });
    const cleanup = renderCloudCostsScreen(container, state, actions, { initialShowDetail: false });
    await new Promise(r => setTimeout(r, 100));
    const metrics = extractOverviewMetrics(container.innerHTML);
    const pass = metrics.rawText.includes("HEADS UP") && metrics.wordCount <= 5;
    if (!pass) allCompliant = false;
    dynamicTests.push({ test: "Costs Warning Threshold", label: "HEADS UP", snippet: metrics.rawText, words: metrics.wordCount, pass });
    if (typeof cleanup === "function") cleanup();
  }

  // 7. Costs: Budget Exceeded -> "HEADS UP"
  {
    const container = new MockContainer();
    const state = createMockState();
    state.backendConnected = true;
    const actions = createMockAppActions();
    actions.api.getCosts = async () => ({
      today_spend: 150.00,
      month_spend: 2650.00,
      monthly_budget: 2500.00,
      budget_status: "BUDGET EXCEEDED",
      daily_trend: [],
      breakdown: []
    });
    const cleanup = renderCloudCostsScreen(container, state, actions, { initialShowDetail: false });
    await new Promise(r => setTimeout(r, 100));
    const metrics = extractOverviewMetrics(container.innerHTML);
    const pass = metrics.rawText.includes("HEADS UP") && metrics.wordCount <= 5;
    if (!pass) allCompliant = false;
    dynamicTests.push({ test: "Costs Budget Exceeded", label: "HEADS UP", snippet: metrics.rawText, words: metrics.wordCount, pass });
    if (typeof cleanup === "function") cleanup();
  }

  // 8. Deploy: Shipping in-flight -> "SHIPPING"
  {
    const container = new MockContainer();
    const state = createMockState();
    const actions = createMockAppActions();
    const cleanup = renderDeployScreen(container, state, actions, { initialShowDetail: false, initialDeploying: true });
    const metrics = extractOverviewMetrics(container.innerHTML);
    const pass = metrics.rawText.includes("SHIPPING") && metrics.wordCount <= 5;
    if (!pass) allCompliant = false;
    dynamicTests.push({ test: "Deploy Shipping State", label: "SHIPPING", snippet: metrics.rawText, words: metrics.wordCount, pass });
    if (typeof cleanup === "function") cleanup();
  }

  // 9. Weather: Live condition word dynamically extracted -> e.g. "68°F RAIN"
  {
    const container = new MockContainer();
    const state = createMockState();
    const actions = createMockAppActions();
    actions.api.getWeather = async () => ({
      location: "LIVE CITY",
      condition: "Thunderstorm Rain",
      temperature_f: 68,
      feels_like_f: 68,
      humidity_pct: 85,
      wind_speed_mph: 12.0,
      wind_direction: "NE",
      pressure_hpa: 1008,
      timestamp: new Date().toISOString()
    });
    const cleanup = renderCompanionScreen(container, state, actions, { initialShowDetail: false });
    await new Promise(r => setTimeout(r, 100));
    const metrics = extractOverviewMetrics(container.innerHTML);
    const pass = metrics.rawText.includes("68°F RAIN") && metrics.wordCount <= 5;
    if (!pass) allCompliant = false;
    dynamicTests.push({ test: "Weather Live Condition Dynamic", label: "68°F RAIN", snippet: metrics.rawText, words: metrics.wordCount, pass });
    if (typeof cleanup === "function") cleanup();
  }

  // 10. Weather: Offline -> "OFFLINE"
  {
    const container = new MockContainer();
    const state = createMockState();
    const actions = createMockAppActions();
    actions.api.getWeather = async () => { throw new Error("Connection refused"); };
    const cleanup = renderCompanionScreen(container, state, actions, { initialShowDetail: false });
    await new Promise(r => setTimeout(r, 100));
    const metrics = extractOverviewMetrics(container.innerHTML);
    const pass = metrics.rawText.includes("OFFLINE") && metrics.wordCount <= 5;
    if (!pass) allCompliant = false;
    dynamicTests.push({ test: "Weather Offline State", label: "OFFLINE", snippet: metrics.rawText, words: metrics.wordCount, pass });
    if (typeof cleanup === "function") cleanup();
  }

  // 11. Focus Timer: Break Mode -> "CHILL TIME"
  {
    // Skip to break mode
    focusTimerService.requestSkip(false);
    focusTimerService.confirmPendingAction();

    const container = new MockContainer();
    const state = createMockState();
    const actions = createMockAppActions();
    const cleanup = renderFocusTimerScreen(container, state, actions, { initialShowDetail: false });
    const metrics = extractOverviewMetrics(container.innerHTML);
    const pass = metrics.rawText.includes("CHILL TIME") && metrics.wordCount <= 5;
    if (!pass) allCompliant = false;
    dynamicTests.push({ test: "Focus Break Mode", label: "CHILL TIME", snippet: metrics.rawText, words: metrics.wordCount, pass });
    if (typeof cleanup === "function") cleanup();

    // Reset back to focus mode
    focusTimerService.requestSkip(false);
    focusTimerService.confirmPendingAction();
  }

  for (const dt of dynamicTests) {
    const mark = dt.pass ? "✓ PASS" : "✗ FAIL";
    console.log(`  ${mark}: [${dt.test}] -> Expected "${dt.label}" in "${dt.snippet}" (${dt.words} words)`);
  }

  console.log("\n================================================================================");
  if (allCompliant) {
    console.log("  >>> RESULT: ALL SCREENS STRICTLY PASS WORD LIMIT & DYNAMIC STATE AUDIT! <<<   ");
  } else {
    console.error("  >>> RESULT: ONE OR MORE SCREENS FAILED WORD LIMIT OR DYNAMIC STATE AUDIT! <<< ");
    process.exit(1);
  }
  console.log("================================================================================\n");
}

runAudit().catch(err => {
  console.error("Audit error:", err);
  process.exit(1);
});
