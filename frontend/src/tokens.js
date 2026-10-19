/**
 * PulseBox Cyber Desk — Unified Design Tokens (Source of Truth)
 * 
 * Strict 8px modular grid on 320x240 canvas.
 * Max 16 indexed colors per palette: Day (Earth/Sandbox) and Night (Low-Glare Midnight).
 * Provides bi-directional RGB565 generation for ILI9341 / ESP32 TFT_eSPI firmware.
 * 
 * Font License Note:
 * Primary Font: Silkscreen (SIL Open Font License, Version 1.1)
 * Secondary Font: Press Start 2P (SIL Open Font License, Version 1.1)
 */

/**
 * Converts a 6-digit hex color string (e.g. "#4E9A06") to an RGB object.
 * @param {string} hex
 * @returns {{r: number, g: number, b: number}}
 */
export function hexToRgb(hex) {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) {
    throw new Error(`Invalid hex color string: "${hex}". Expected 6 hexadecimal characters.`);
  }
  const intVal = parseInt(clean, 16);
  if (isNaN(intVal)) {
    throw new Error(`Non-hexadecimal character in color string: "${hex}"`);
  }
  return {
    r: (intVal >> 16) & 0xff,
    g: (intVal >> 8) & 0xff,
    b: intVal & 0xff,
  };
}

/**
 * Converts a 24-bit RGB or hex color to 16-bit RGB565 integer (0x0000 - 0xFFFF).
 * Formula: ((R & 0xF8) << 8) | ((G & 0xFC) << 3) | (B >> 3)
 * @param {string} hex
 * @returns {number} 16-bit integer
 */
export function hexToRgb565(hex) {
  const { r, g, b } = hexToRgb(hex);
  const r5 = (r >> 3) & 0x1f;
  const g6 = (g >> 2) & 0x3f;
  const b5 = (b >> 3) & 0x1f;
  return (r5 << 11) | (g6 << 5) | b5;
}

/**
 * Formats RGB565 integer as 4-digit hexadecimal string for C/C++ headers (e.g. "0x072E").
 * @param {string} hex
 * @returns {string}
 */
export function hexToRgb565Hex(hex) {
  const val = hexToRgb565(hex);
  return "0x" + val.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Reconstructs 24-bit RGB values from a 16-bit RGB565 integer for testing & fidelity checks.
 * @param {number} rgb565
 * @returns {{r: number, g: number, b: number}}
 */
export function rgb565ToRgb(rgb565) {
  const r5 = (rgb565 >> 11) & 0x1f;
  const g6 = (rgb565 >> 5) & 0x3f;
  const b5 = rgb565 & 0x1f;
  return {
    r: Math.round((r5 * 255) / 31),
    g: Math.round((g6 * 255) / 63),
    b: Math.round((b5 * 255) / 31),
  };
}

// =============================================================================
// 1. DAY PALETTE (16 Indexed Colors — Warm Sunlight, Grass, Dirt, Stone, Sky)
// =============================================================================
export const DAY_PALETTE = [
  { id: "day_dirt_dark", name: "Soil Shadow", hex: "#2E1F14", role: "Deep inset border & soil shadow" },
  { id: "day_dirt_base", name: "Loam Dirt", hex: "#5C3D24", role: "Dirt block base & dark wood" },
  { id: "day_wood_bark", name: "Oak Bark", hex: "#8B5A2B", role: "Wood trunk & warm button bevel" },
  { id: "day_stone_shadow", name: "Deep Slate", hex: "#3B4252", role: "Stone shadow & card header" },
  { id: "day_stone_base", name: "Cobble Gray", hex: "#5A6577", role: "Stone block surface & card fill" },
  { id: "day_stone_light", name: "Flint Stone", hex: "#9AA5B4", role: "Stone highlight & secondary bevel" },
  { id: "day_sky_blue", name: "Sky Blue", hex: "#4A90E2", role: "Day atmosphere & telemetry line" },
  { id: "day_water_deep", name: "Ocean Deep", hex: "#245C9E", role: "Water stream & network ingress" },
  { id: "day_grass_base", name: "Lush Meadow", hex: "#4E9A06", role: "Healthy status & nominal indicator" },
  { id: "day_grass_bright", name: "Foliage Green", hex: "#73D216", role: "Grass top & healthy highlight" },
  { id: "day_sand_gold", name: "Sun Amber", hex: "#E5B83B", role: "Sunlight & utilization warning" },
  { id: "day_lava_orange", name: "Lava Orange", hex: "#F57900", role: "Alert highlight & active timer" },
  { id: "day_redstone", name: "Redstone Red", hex: "#CC0000", role: "Outage critical & failed node" },
  { id: "day_cloud_white", name: "Cloud White", hex: "#F0F4F8", role: "Primary readable text & active tab" },
  { id: "day_bedrock", name: "Bedrock Dark", hex: "#1A1C23", role: "Canvas background & drop shadow" },
  { id: "day_ore_cyan", name: "Diamond Ore", hex: "#00BCD4", role: "Clock stone & key milestone" },
].map(item => ({
  ...item,
  rgb565: hexToRgb565(item.hex),
  rgb565Hex: hexToRgb565Hex(item.hex),
}));

// =============================================================================
// 2. NIGHT PALETTE (16 Indexed Colors — Low-Glare Midnight, Obsidian, Neon Glow)
// =============================================================================
export const NIGHT_PALETTE = [
  { id: "night_bg", name: "Midnight Void", hex: "#05070D", role: "Primary canvas background" },
  { id: "night_obsidian", name: "Dark Obsidian", hex: "#0B111E", role: "Card surface & panel background" },
  { id: "night_bedrock", name: "Shadow Slate", hex: "#151D2E", role: "Panel border & card inset" },
  { id: "night_cobble", name: "Night Cobble", hex: "#243048", role: "Low-glare container & bevel shadow" },
  { id: "night_iron", name: "Muted Iron", hex: "#374761", role: "Button outline & tab separator" },
  { id: "night_emerald", name: "Neon Emerald", hex: "#00E676", role: "Nominal status & happy mascot" },
  { id: "night_mint", name: "Bright Mint", hex: "#69F0AE", role: "Healthy accent & active selection" },
  { id: "night_amber", name: "Glow Amber", hex: "#FFB300", role: "Warning & threshold caution" },
  { id: "night_orange", name: "Plasma Orange", hex: "#FF6D00", role: "Active countdown & beacon pulse" },
  { id: "night_crimson", name: "Laser Crimson", hex: "#FF1744", role: "Outage alarm & failed service" },
  { id: "night_cyan", name: "Neon Cyan", hex: "#00E5FF", role: "Digital clock & telemetry highlight" },
  { id: "night_azure", name: "Electric Sapphire", hex: "#2979FF", role: "Network stream & active ingress" },
  { id: "night_violet", name: "Phantom Violet", hex: "#7C4DFF", role: "Config category & secondary pill" },
  { id: "night_gray", name: "Mist Gray", hex: "#8899AC", role: "Low-glare secondary label text" },
  { id: "night_white", name: "Starlight White", hex: "#E2E8F0", role: "Primary low-glare readable text" },
  { id: "night_bevel", name: "Basalt Bevel", hex: "#101623", role: "Subtle 1px block shadow bevel" },
].map(item => ({
  ...item,
  rgb565: hexToRgb565(item.hex),
  rgb565Hex: hexToRgb565Hex(item.hex),
}));

// Quick dictionary lookups
export const DAY_COLORS = Object.fromEntries(DAY_PALETTE.map(c => [c.id, c]));
export const NIGHT_COLORS = Object.fromEntries(NIGHT_PALETTE.map(c => [c.id, c]));

// =============================================================================
// 3. GRID & SPACING TOKENS (Strict 8px Snap Grid)
// =============================================================================
export const GRID = {
  canvasWidth: 320,
  canvasHeight: 240,
  baseUnit: 8,            // 1 modular grid cell = 8px
  columns: 40,            // 320 / 8 = 40 cells
  rows: 30,               // 240 / 8 = 30 cells
  minTouchTarget: 32,     // 4x4 cells = 32x32px minimum touch target
  borderThin: 1,          // 1px inner hairline
  borderBlock: 2,         // 2px solid voxel border
  borderThick: 4,         // 4px heavy hero border
  statusBarHeight: 16,    // 2 grid cells (Y: 0 to 16)
  heroZoneHeight: 192,    // 24 grid cells (Y: 16 to 208)
  hotbarHeight: 32,       // 4 grid cells (Y: 208 to 240)
  hotbarItemWidth: 40,    // 320 / 8 hotbar items = 40px each (5 cells wide)
  spacing: {
    xs: 4,                // Half-cell
    sm: 8,                // 1 cell
    md: 16,               // 2 cells
    lg: 24,               // 3 cells
    xl: 32,               // 4 cells
    xxl: 64,              // 8 cells
  },
};

// =============================================================================
// 4. TYPOGRAPHY & TYPE SCALE TOKENS
// =============================================================================
export const TYPOGRAPHY = {
  fontFamily: "'Silkscreen', 'Press Start 2P', monospace",
  fontLicense: "SIL Open Font License, Version 1.1 (OFL-1.1)",
  googleFontsUrl: "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Silkscreen:wght@400;700&display=swap",
  scale: {
    micro: { size: 8, lineHeight: 10, tracking: 0, description: "Status tags & hotbar badges" },
    small: { size: 10, lineHeight: 12, tracking: 0, description: "Secondary metrics & detail labels" },
    body: { size: 12, lineHeight: 16, tracking: 0, description: "Primary labels (1-3 words)" },
    title: { size: 16, lineHeight: 20, tracking: 1, description: "Screen headers & card titles" },
    hero: { size: 24, lineHeight: 28, tracking: 1, description: "Hero numbers & prominent states" },
    clock: { size: 36, lineHeight: 40, tracking: 2, description: "Massive digital clock digits" },
  },
  rules: {
    maxTextElementsPerScreen: 3,
    maxWordsPerScreen: 12,
    maxWordsPerLabel: 3,
  },
};

// =============================================================================
// 5. C/C++ FIRMWARE HEADER GENERATOR
// =============================================================================
export function generateCppHeader() {
  const lines = [
    "// =============================================================================",
    "// PulseBox Cyber Desk — Generated RGB565 Voxel Palette Tokens",
    "// Auto-generated from frontend/src/tokens.js (Source of Truth)",
    "// =============================================================================",
    "#ifndef PULSEBOX_TOKENS_H",
    "#define PULSEBOX_TOKENS_H",
    "",
    "// Screen Dimensions",
    `#define SCREEN_WIDTH         ${GRID.canvasWidth}`,
    `#define SCREEN_HEIGHT        ${GRID.canvasHeight}`,
    `#define GRID_UNIT            ${GRID.baseUnit}`,
    `#define MIN_TOUCH_TARGET     ${GRID.minTouchTarget}`,
    "",
    "// --- DAY PALETTE (RGB565) ---",
  ];

  for (const c of DAY_PALETTE) {
    const macroName = "COLOR_DAY_" + c.id.replace("day_", "").toUpperCase();
    lines.push(`#define ${macroName.padEnd(24, " ")} ${c.rgb565Hex}  // ${c.name} (${c.hex}) - ${c.role}`);
  }

  lines.push("", "// --- NIGHT PALETTE (RGB565) ---");
  for (const c of NIGHT_PALETTE) {
    const macroName = "COLOR_NIGHT_" + c.id.replace("night_", "").toUpperCase();
    lines.push(`#define ${macroName.padEnd(24, " ")} ${c.rgb565Hex}  // ${c.name} (${c.hex}) - ${c.role}`);
  }

  lines.push("", "#endif // PULSEBOX_TOKENS_H", "");
  return lines.join("\n");
}

// =============================================================================
// 6. CSS CUSTOM PROPERTIES GENERATOR
// =============================================================================
export function generateCssVariables() {
  const lines = [
    ":root {",
    "  /* Grid & Dimensions */",
    `  --canvas-width: ${GRID.canvasWidth}px;`,
    `  --canvas-height: ${GRID.canvasHeight}px;`,
    `  --grid-unit: ${GRID.baseUnit}px;`,
    `  --min-touch-target: ${GRID.minTouchTarget}px;`,
    `  --font-pixel: ${TYPOGRAPHY.fontFamily};`,
    "",
    "  /* Day Palette */",
  ];

  for (const c of DAY_PALETTE) {
    lines.push(`  --${c.id.replace(/_/g, "-")}: ${c.hex};`);
  }

  lines.push("", "  /* Night Palette */");
  for (const c of NIGHT_PALETTE) {
    lines.push(`  --${c.id.replace(/_/g, "-")}: ${c.hex};`);
  }

  lines.push("}\n");
  return lines.join("\n");
}
