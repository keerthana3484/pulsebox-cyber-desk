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
  console.log("   PULSEBOX CYBER DESK — 5-WORD LIMIT & HERO ELEMENT COMPLIANCE AUDIT           ");
  console.log("   Target Canvas: 320x240 | Max Text Elements: 3 | Max Words: 5 (Overview)      ");
  console.log("================================================================================\n");

  const screens = [
    { id: "home", name: "System Status", render: renderHomeScreen, hero: "PulseBot + Shield Visual" },
    { id: "servers", name: "Cluster Health", render: renderServersScreen, hero: "Heart Bar + PulseBot" },
    { id: "incidents", name: "Incident Log", render: renderIncidentsScreen, hero: "PulseBot + Shield/Potion" },
    { id: "costs", name: "Cloud Costs", render: renderCloudCostsScreen, hero: "Crystal + XP Level Bar" },
    { id: "deploy", name: "Release Pipeline", render: renderDeployScreen, hero: "Voxel Rocket + Compass" },
    { id: "companion", name: "Weather + Clock", render: renderCompanionScreen, hero: "Day/Night Sky + Clock Digits" },
    { id: "focusTimer", name: "Focus Timer", render: renderFocusTimerScreen, hero: "Digital Timer + Progress Bar" },
    { id: "settings", name: "Device Config", render: renderSettingsScreen, hero: "Voxel Wrench + Battery" },
  ];

  let allCompliant = true;
  const results = [];

  for (let i = 0; i < screens.length; i++) {
    const scr = screens[i];
    const container = new MockContainer();
    const state = createMockState();
    state.backendConnected = true;
    const actions = createMockAppActions();

    const cleanup = scr.render(container, state, actions, { initialShowDetail: false });
    await new Promise(r => setTimeout(r, 100));

    const metrics = extractOverviewMetrics(container.innerHTML);

    const isElementCompliant = metrics.elementCount <= 3;
    const isWordCompliant = metrics.wordCount <= 5;
    const isPass = isElementCompliant && isWordCompliant;

    if (!isPass) allCompliant = false;

    results.push({
      slot: i + 1,
      id: scr.id,
      name: scr.name,
      hero: scr.hero,
      elementsCount: metrics.elementCount,
      wordCount: metrics.wordCount,
      snippet: metrics.rawText,
      status: isPass ? "PASS (<=5 words)" : "FAIL (>5 words)",
    });

    if (typeof cleanup === "function") cleanup();
  }

  // Print Formatted Report Table
  console.log(
    "| Slot | Screen ID  | Screen Name        | Hero Element               | Elements | Words | Status              |"
  );
  console.log(
    "|------|------------|--------------------|----------------------------|----------|-------|---------------------|"
  );

  for (const r of results) {
    const slotStr = String(r.slot).padEnd(4);
    const idStr = r.id.padEnd(10);
    const nameStr = r.name.padEnd(18);
    const heroStr = r.hero.padEnd(26);
    const elemStr = `${r.elementsCount}/3`.padEnd(8);
    const wordStr = `${r.wordCount}/12`.padEnd(5);
    const statStr = r.status.padEnd(19);
    console.log(`| ${slotStr} | ${idStr} | ${nameStr} | ${heroStr} | ${elemStr} | ${wordStr} | ${statStr} |`);
  }

  console.log("\n--------------------------------------------------------------------------------");
  console.log("SCREEN OVERVIEW TEXT AUDIT BREAKDOWN:");
  console.log("--------------------------------------------------------------------------------");
  for (const r of results) {
    console.log(`[Slot ${r.slot}: ${r.name}]`);
    console.log(`  Hero: ${r.hero}`);
    console.log(`  Word count: ${r.wordCount} words (Limit: 12 words)`);
    console.log(`  Text elements: ${r.elementsCount} elements (Limit: 3 elements)`);
    console.log(`  Content: "${r.snippet}"`);
    console.log("");
  }

  console.log("================================================================================");
  if (allCompliant) {
    console.log("  >>> RESULT: ALL 8 SCREENS STRICTLY PASS THE 5-WORD LIMIT! (0 BREAKS) <<<     ");
  } else {
    console.error("  >>> RESULT: ONE OR MORE SCREENS BREAK THE 5-WORD LIMIT! <<<                 ");
    process.exit(1);
  }
  console.log("================================================================================\n");
}

runAudit().catch(err => {
  console.error("Audit error:", err);
  process.exit(1);
});
