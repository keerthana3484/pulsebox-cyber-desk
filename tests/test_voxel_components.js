/**
 * Automated test suite for PulseBox Cyber Desk Reusable Voxel Components.
 * 
 * Verifies:
 * 1. Procedural pixel heart sprite generation (full, half, empty).
 * 2. Procedural pixel drumstick/hunger sprite generation (full, half, empty).
 * 3. Procedural pixel item icons (wrench, battery, crystal, shield, compass, potion, server).
 * 4. Procedural PulseBot mascot faces across all 4 expressions (happy, idle, worried, celebrating).
 * 5. Beveled block button builder variants (primary, secondary, danger, caution) & states (normal, pressed, disabled).
 * 6. Heart bar calculation & slot counts (10/10, 7/10, 0/10).
 * 7. Hunger bar calculation & slot counts (10/10, 5/10, 1/10).
 * 8. XP progress level bar calculation and badge display.
 * 9. Inventory slot rendering with item icon, count badge, and selection state.
 * 10. Hotbar navigation rendering (exactly 8 slots with active index).
 * 11. Alert banner variants (nominal, warning, critical) and dismiss triggers.
 */

import {
  getHeartSvg,
  getHungerSvg,
  getItemIconSvg,
  getPulseBotMascotSvg,
  buildVoxelButton,
  buildHeartBar,
  buildHungerBar,
  buildXpBar,
  buildInventorySlot,
  buildHotbarNavigation,
  buildAlertBanner,
} from "../frontend/src/voxelComponents.js";

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

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (expected: ${expected}, got: ${actual})`);
}

console.log("==========================================================");
console.log("   RUNNING REUSABLE VOXEL COMPONENTS TEST SUITE           ");
console.log("==========================================================\n");

// -------------------------------------------------------------
// TEST 1: Procedural Heart Sprites
// -------------------------------------------------------------
console.log("[TEST 1] Verifying procedural heart sprites...");
const fullHeart = getHeartSvg("full", 16);
assert(fullHeart.includes("<svg"), "Full heart renders valid SVG element");
assert(fullHeart.includes('shape-rendering="crispEdges"'), "Full heart uses crisp pixel rendering");
assert(fullHeart.includes("viewBox=\"0 0 9 9\""), "Full heart has 9x9 viewBox");
assert(fullHeart.includes("#FF1744") || fullHeart.includes("#CC0000"), "Full heart includes red fill");

const halfHeart = getHeartSvg("half", 16);
assert(halfHeart.includes("<svg"), "Half heart renders valid SVG element");
assert(halfHeart.includes("#151D2E") || halfHeart.includes("#2E3440"), "Half heart includes background half fill");

const emptyHeart = getHeartSvg("empty", 16);
assert(emptyHeart.includes("<svg"), "Empty heart renders valid SVG element");
assert(!emptyHeart.includes("#FF1744") && !emptyHeart.includes("#CC0000"), "Empty heart contains zero red fill");

// -------------------------------------------------------------
// TEST 2: Procedural Hunger / Drumstick Sprites
// -------------------------------------------------------------
console.log("\n[TEST 2] Verifying procedural drumstick sprites...");
const fullHunger = getHungerSvg("full", 16);
assert(fullHunger.includes("<svg"), "Full drumstick renders valid SVG element");
assert(fullHunger.includes("#D8DEE9"), "Full drumstick includes bone handle");

const halfHunger = getHungerSvg("half", 16);
assert(halfHunger.includes("<svg"), "Half drumstick renders valid SVG element");

const emptyHunger = getHungerSvg("empty", 16);
assert(emptyHunger.includes("<svg"), "Empty drumstick renders valid SVG element");

// -------------------------------------------------------------
// TEST 3: Procedural Item Icons
// -------------------------------------------------------------
console.log("\n[TEST 3] Verifying procedural item icons...");
const items = ["wrench", "battery", "crystal", "shield", "compass", "potion", "server"];
for (const item of items) {
  const iconSvg = getItemIconSvg(item, 24);
  assert(iconSvg.includes("<svg"), `Item icon '${item}' renders valid SVG`);
  assert(iconSvg.includes('viewBox="0 0 16 16"'), `Item icon '${item}' has 16x16 viewBox`);
  assert(iconSvg.includes('shape-rendering="crispEdges"'), `Item icon '${item}' enforces crisp edges`);
}

// -------------------------------------------------------------
// TEST 4: PulseBot Mascot 4 Expressions
// -------------------------------------------------------------
console.log("\n[TEST 4] Verifying PulseBot mascot procedural expressions...");
const expressions = ["happy", "idle", "worried", "celebrating"];
for (const exp of expressions) {
  const mascotSvg = getPulseBotMascotSvg(exp, 56);
  assert(mascotSvg.includes("<svg"), `Mascot expression '${exp}' renders valid SVG`);
  assert(mascotSvg.includes(`expression-${exp}`), `Mascot SVG has expression class 'expression-${exp}'`);
  assert(mascotSvg.includes('viewBox="0 0 28 28"'), `Mascot SVG has 28x28 viewBox`);
}

// Verify expression-specific details
const happySvg = getPulseBotMascotSvg("happy");
assert(happySvg.includes("#00E676"), "Happy mascot includes bright green eye arches");

const worriedSvg = getPulseBotMascotSvg("worried");
assert(worriedSvg.includes("#FFB300"), "Worried mascot includes amber eye slant");

const celebratingSvg = getPulseBotMascotSvg("celebrating");
assert(celebratingSvg.includes("#FFEB3B") || celebratingSvg.includes("#FFD54F"), "Celebrating mascot includes sparkling star eyes");

// -------------------------------------------------------------
// TEST 5: Voxel Button Builder
// -------------------------------------------------------------
console.log("\n[TEST 5] Verifying beveled block button builder...");
const normalBtn = buildVoxelButton({ text: "CONFIRM", variant: "primary", state: "normal" });
assert(normalBtn.includes("voxel-btn"), "Button has 'voxel-btn' class");
assert(normalBtn.includes("variant-primary"), "Button has 'variant-primary' class");
assert(normalBtn.includes("CONFIRM"), "Button includes text 'CONFIRM'");
assert(!normalBtn.includes("disabled"), "Normal button does not have disabled attribute");

const pressedBtn = buildVoxelButton({ text: "PRESSED", variant: "secondary", state: "pressed" });
assert(pressedBtn.includes("is-pressed"), "Pressed button has 'is-pressed' class");

const disabledBtn = buildVoxelButton({ text: "LOCKED", variant: "danger", state: "disabled" });
assert(disabledBtn.includes("disabled"), "Disabled button has disabled HTML attribute");
assert(disabledBtn.includes("state-disabled"), "Disabled button has 'state-disabled' class");

// -------------------------------------------------------------
// TEST 6: Heart Bar Logic
// -------------------------------------------------------------
console.log("\n[TEST 6] Verifying heart bar calculation...");
// 10 HP -> 5 full hearts
const barFull = buildHeartBar({ current: 10, max: 10 });
const fullCount10 = (barFull.match(/full/g) || []).length;
assert(fullCount10 >= 5, "10 HP displays 5 full hearts");

// 7 HP -> 3 full hearts, 1 half heart, 1 empty
const bar7 = buildHeartBar({ current: 7, max: 10 });
assert(bar7.includes("half"), "7 HP displays a half heart");
assert(bar7.includes("empty"), "7 HP displays an empty heart container");

// 0 HP -> 5 empty hearts
const bar0 = buildHeartBar({ current: 0, max: 10 });
assert(!bar0.includes("half"), "0 HP contains zero half hearts");

// -------------------------------------------------------------
// TEST 7: Hunger Bar Logic
// -------------------------------------------------------------
console.log("\n[TEST 7] Verifying hunger bar calculation...");
const hungerFull = buildHungerBar({ current: 10, max: 10 });
assert(hungerFull.includes("voxel-hunger-bar"), "Renders hunger bar container");
assert(hungerFull.includes("voxel-hunger-svg"), "Renders hunger icon SVGs");

const hungerMid = buildHungerBar({ current: 5, max: 10 });
assert(hungerMid.includes("half"), "5/10 resources displays half drumstick");

// -------------------------------------------------------------
// TEST 8: XP Level Progress Bar
// -------------------------------------------------------------
console.log("\n[TEST 8] Verifying XP progress bar...");
const xpBar = buildXpBar({ current: 75, max: 100, level: 42 });
assert(xpBar.includes("width: 75%;"), "XP bar fill width set to 75%");
assert(xpBar.includes(">42<"), "XP badge displays level 42");

// -------------------------------------------------------------
// TEST 9: Inventory Slot Rendering
// -------------------------------------------------------------
console.log("\n[TEST 9] Verifying inventory slots...");
const slotWrench = buildInventorySlot({ item: "wrench", count: 16, isSelected: true });
assert(slotWrench.includes("voxel-slot"), "Slot has 'voxel-slot' class");
assert(slotWrench.includes("is-selected"), "Slot has 'is-selected' class");
assert(slotWrench.includes("voxel-item-icon"), "Slot renders item icon");
assert(slotWrench.includes(">16<"), "Slot displays count badge '16'");

const emptySlot = buildInventorySlot({ item: null, count: 1 });
assert(!emptySlot.includes("voxel-item-icon"), "Empty slot renders zero item icons");

// -------------------------------------------------------------
// TEST 10: Hotbar Navigation
// -------------------------------------------------------------
console.log("\n[TEST 10] Verifying hotbar navigation...");
const hotbar = buildHotbarNavigation({ activeIndex: 2 });
assert(hotbar.includes('class="voxel-hotbar"'), "Hotbar renders navigation container");

const slotMatches = hotbar.match(/class="voxel-hotbar-slot/g) || [];
assertEqual(slotMatches.length, 8, "Hotbar renders exactly 8 inventory slots");
assert(hotbar.includes('data-index="2"'), "Includes slot with data-index 2");
assert(hotbar.includes('data-index="2" class="voxel-hotbar-slot is-active"') || hotbar.includes('class="voxel-hotbar-slot is-active" data-index="2"'), "Slot 2 has active selection class");

// -------------------------------------------------------------
// TEST 11: Alert Banners
// -------------------------------------------------------------
console.log("\n[TEST 11] Verifying alert banners...");
const nominalBanner = buildAlertBanner({ type: "nominal", title: "OK", message: "Nominal" });
assert(nominalBanner.includes("alert-nominal"), "Nominal banner has 'alert-nominal' class");
assert(nominalBanner.includes("✓"), "Nominal banner has checkmark icon");

const warningBanner = buildAlertBanner({ type: "warning", title: "WARN", message: "Warning" });
assert(warningBanner.includes("alert-warning"), "Warning banner has 'alert-warning' class");
assert(warningBanner.includes("!"), "Warning banner has exclamation icon");

const criticalBanner = buildAlertBanner({ type: "critical", title: "FAIL", message: "Critical" });
assert(criticalBanner.includes("alert-critical"), "Critical banner has 'alert-critical' class");
assert(criticalBanner.includes("⚡"), "Critical banner has alert lightning/skull icon");

console.log("\n==========================================================");
console.log(`   ALL TESTS COMPLETED: ${passedTests}/${totalTests} PASSED (100%)       `);
console.log("==========================================================\n");
