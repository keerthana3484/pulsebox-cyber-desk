/**
 * Automated test suite for PulseBox Cyber Desk Design Tokens & Palette Generation.
 * 
 * Verifies:
 * 1. Palette constraints (max 16 colors for Day and Night palettes).
 * 2. Hex format validity (#RRGGBB).
 * 3. Exact 16-bit RGB565 integer boundaries (0 <= val <= 0xFFFF).
 * 4. Hex string formatting ("0xXXXX").
 * 5. Primary color reference conversions (Black, White, Red, Green, Blue).
 * 6. Quantization fidelity (5-6-5 channel limits).
 * 7. 8px grid alignment (320x240, 32x32px touch target minimum).
 * 8. Horizontal screen zone layout math (16 + 192 + 32 = 240px).
 * 9. Typography limits (max 3 text elements, max 12 words per screen).
 * 10. Open-license font attribution.
 * 11. C++ header and CSS variable generators.
 */

import {
  DAY_PALETTE,
  NIGHT_PALETTE,
  GRID,
  TYPOGRAPHY,
  hexToRgb,
  hexToRgb565,
  hexToRgb565Hex,
  rgb565ToRgb,
  generateCppHeader,
  generateCssVariables,
} from "../frontend/src/tokens.js";

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
console.log("   RUNNING DESIGN TOKENS & RGB565 VERIFICATION SUITE      ");
console.log("==========================================================\n");

// -------------------------------------------------------------
// TEST 1: Palette Size and Constraints (Max 16 Colors)
// -------------------------------------------------------------
console.log("[TEST 1] Verifying palette size constraints...");
assert(DAY_PALETTE.length <= 16, `Day palette has <= 16 colors (count: ${DAY_PALETTE.length})`);
assertEqual(DAY_PALETTE.length, 16, "Day palette has exactly 16 indexed colors");

assert(NIGHT_PALETTE.length <= 16, `Night palette has <= 16 colors (count: ${NIGHT_PALETTE.length})`);
assertEqual(NIGHT_PALETTE.length, 16, "Night palette has exactly 16 indexed colors");

// -------------------------------------------------------------
// TEST 2: RGB565 Boundary and Format Verification for Every Color
// -------------------------------------------------------------
console.log("\n[TEST 2] Verifying every color in Day and Night palettes...");
const hexPattern = /^#[0-9A-Fa-f]{6}$/;
const rgb565HexPattern = /^0x[0-9A-F]{4}$/;

for (const color of DAY_PALETTE) {
  assert(hexPattern.test(color.hex), `Day color '${color.name}' (${color.id}) has valid hex: ${color.hex}`);
  assert(Number.isInteger(color.rgb565), `Day color '${color.name}' rgb565 is integer: ${color.rgb565}`);
  assert(color.rgb565 >= 0 && color.rgb565 <= 0xffff, `Day color '${color.name}' rgb565 inside [0x0000, 0xFFFF]`);
  assert(rgb565HexPattern.test(color.rgb565Hex), `Day color '${color.name}' formatted as 0xXXXX: ${color.rgb565Hex}`);
  assert(color.role.length > 0, `Day color '${color.name}' has defined role`);
}

for (const color of NIGHT_PALETTE) {
  assert(hexPattern.test(color.hex), `Night color '${color.name}' (${color.id}) has valid hex: ${color.hex}`);
  assert(Number.isInteger(color.rgb565), `Night color '${color.name}' rgb565 is integer: ${color.rgb565}`);
  assert(color.rgb565 >= 0 && color.rgb565 <= 0xffff, `Night color '${color.name}' rgb565 inside [0x0000, 0xFFFF]`);
  assert(rgb565HexPattern.test(color.rgb565Hex), `Night color '${color.name}' formatted as 0xXXXX: ${color.rgb565Hex}`);
  assert(color.role.length > 0, `Night color '${color.name}' has defined role`);
}

// -------------------------------------------------------------
// TEST 3: Ground Truth Canonical Color Conversions
// -------------------------------------------------------------
console.log("\n[TEST 3] Verifying canonical RGB565 math...");
assertEqual(hexToRgb565("#000000"), 0x0000, "Black (#000000) converts to 0x0000");
assertEqual(hexToRgb565Hex("#000000"), "0x0000", "Black formatted as 0x0000");

assertEqual(hexToRgb565("#FFFFFF"), 0xffff, "White (#FFFFFF) converts to 0xFFFF");
assertEqual(hexToRgb565Hex("#FFFFFF"), "0xFFFF", "White formatted as 0xFFFF");

assertEqual(hexToRgb565("#FF0000"), 0xf800, "Pure Red (#FF0000) converts to 0xF800");
assertEqual(hexToRgb565Hex("#FF0000"), "0xF800", "Pure Red formatted as 0xF800");

assertEqual(hexToRgb565("#00FF00"), 0x07e0, "Pure Green (#00FF00) converts to 0x07E0");
assertEqual(hexToRgb565Hex("#00FF00"), "0x07E0", "Pure Green formatted as 0x07E0");

assertEqual(hexToRgb565("#0000FF"), 0x001f, "Pure Blue (#0000FF) converts to 0x001F");
assertEqual(hexToRgb565Hex("#0000FF"), "0x001F", "Pure Blue formatted as 0x001F");

// -------------------------------------------------------------
// TEST 4: Color Reconstruction Fidelity Check
// -------------------------------------------------------------
console.log("\n[TEST 4] Verifying color reconstruction fidelity...");
for (const color of [...DAY_PALETTE, ...NIGHT_PALETTE]) {
  const originalRgb = hexToRgb(color.hex);
  const reconstructed = rgb565ToRgb(color.rgb565);

  // 5-bit channel max error: ~8, 6-bit channel max error: ~4
  const deltaR = Math.abs(originalRgb.r - reconstructed.r);
  const deltaG = Math.abs(originalRgb.g - reconstructed.g);
  const deltaB = Math.abs(originalRgb.b - reconstructed.b);

  assert(deltaR <= 8, `Color ${color.name} red delta <= 8 (delta: ${deltaR})`);
  assert(deltaG <= 5, `Color ${color.name} green delta <= 5 (delta: ${deltaG})`);
  assert(deltaB <= 8, `Color ${color.name} blue delta <= 8 (delta: ${deltaB})`);
}

// -------------------------------------------------------------
// TEST 5: Grid & Dimension Constraints
// -------------------------------------------------------------
console.log("\n[TEST 5] Verifying 8px grid and canvas geometry...");
assertEqual(GRID.canvasWidth, 320, "Canvas width is 320px");
assertEqual(GRID.canvasHeight, 240, "Canvas height is 240px");
assertEqual(GRID.baseUnit, 8, "Base modular grid unit is 8px");
assertEqual(GRID.columns, 40, "Canvas has 40 grid columns (320 / 8)");
assertEqual(GRID.rows, 30, "Canvas has 30 grid rows (240 / 8)");
assert(GRID.minTouchTarget >= 32, `Minimum touch target is >= 32px (got ${GRID.minTouchTarget}px)`);

// Check zone partition math
const totalHeight = GRID.statusBarHeight + GRID.heroZoneHeight + GRID.hotbarHeight;
assertEqual(totalHeight, 240, "Status bar (16) + Hero zone (192) + Hotbar (32) === 240px exactly");

// Check hotbar slot width
const totalHotbarWidth = GRID.hotbarItemWidth * 8;
assertEqual(totalHotbarWidth, 320, "8 hotbar slots * 40px === 320px exactly");

// -------------------------------------------------------------
// TEST 6: Typography Rules and Open Font License Attribution
// -------------------------------------------------------------
console.log("\n[TEST 6] Verifying typography rules and licensing...");
assert(TYPOGRAPHY.fontLicense.includes("SIL Open Font License"), "Font license explicitly notes SIL Open Font License");
assert(TYPOGRAPHY.fontFamily.includes("Silkscreen"), "Primary font family specifies Silkscreen");
assert(TYPOGRAPHY.fontFamily.includes("Press Start 2P"), "Secondary font fallback specifies Press Start 2P");

assertEqual(TYPOGRAPHY.rules.maxTextElementsPerScreen, 3, "Max 3 text elements per screen rule enforced");
assertEqual(TYPOGRAPHY.rules.maxWordsPerScreen, 12, "Max 12 words per screen rule enforced");
assertEqual(TYPOGRAPHY.rules.maxWordsPerLabel, 3, "Max 3 words per label rule enforced");

// Scale steps
assert(TYPOGRAPHY.scale.micro.size === 8, "Micro type size is 8px");
assert(TYPOGRAPHY.scale.body.size === 12, "Body type size is 12px");
assert(TYPOGRAPHY.scale.title.size === 16, "Title type size is 16px");
assert(TYPOGRAPHY.scale.hero.size === 24, "Hero type size is 24px");
assert(TYPOGRAPHY.scale.clock.size === 36, "Clock type size is 36px");

// -------------------------------------------------------------
// TEST 7: C++ Firmware Header and CSS Variable Generation
// -------------------------------------------------------------
console.log("\n[TEST 7] Verifying firmware C++ header and CSS variable generators...");
const cppHeader = generateCppHeader();
assert(cppHeader.includes("#ifndef PULSEBOX_TOKENS_H"), "Generated C++ header includes include guard");
assert(cppHeader.includes("COLOR_DAY_GRASS_BASE"), "Header includes Day palette color macro");
assert(cppHeader.includes("COLOR_NIGHT_EMERALD"), "Header includes Night palette color macro");
assert(cppHeader.includes("SCREEN_WIDTH         320"), "Header includes SCREEN_WIDTH 320");
assert(cppHeader.includes("MIN_TOUCH_TARGET     32"), "Header includes MIN_TOUCH_TARGET 32");

const cssVars = generateCssVariables();
assert(cssVars.includes("--day-grass-base: #4E9A06;"), "CSS variables include Day palette tokens");
assert(cssVars.includes("--night-emerald: #00E676;"), "CSS variables include Night palette tokens");
assert(cssVars.includes("--canvas-width: 320px;"), "CSS variables include canvas width");
assert(cssVars.includes("--min-touch-target: 32px;"), "CSS variables include min touch target");

console.log("\n==========================================================");
console.log(`   ALL TESTS COMPLETED: ${passedTests}/${totalTests} PASSED (100%)       `);
console.log("==========================================================\n");
