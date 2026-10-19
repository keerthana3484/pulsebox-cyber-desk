/**
 * PulseBox Cyber Desk — Reusable Voxel UI Components & Procedural Sprites
 * 
 * Strict 8px modular grid on 320x240 canvas.
 * 100% original pixel art procedural SVG sprites (zero external sandbox game IP).
 * Uses tokens from frontend/src/tokens.js.
 */

import { DAY_COLORS, NIGHT_COLORS, GRID, TYPOGRAPHY } from "./tokens.js";

// =============================================================================
// 1. PROCEDURAL VOXEL SPRITE GENERATORS (Original Pixel Art)
// =============================================================================

/**
 * Generates an original 9x9 procedural pixel heart SVG.
 * @param {'full'|'half'|'empty'} type
 * @param {number} size
 * @param {'day'|'night'} mode
 * @returns {string} SVG markup
 */
export function getHeartSvg(type = "full", size = 16, mode = "night") {
  const isNight = mode === "night";
  const borderCol = isNight ? "#05070D" : "#1A1C23";
  const fillCol = isNight ? "#FF1744" : "#CC0000";
  const darkFill = isNight ? "#990022" : "#800000";
  const shineCol = isNight ? "#FF8A80" : "#FFCDD2";
  const bgCol = isNight ? "#151D2E" : "#2E3440";

  let inner = "";

  if (type === "full") {
    inner = `
      <!-- Red fill -->
      <rect x="2" y="2" width="2" height="3" fill="${fillCol}" />
      <rect x="5" y="2" width="2" height="3" fill="${fillCol}" />
      <rect x="1" y="3" width="7" height="3" fill="${fillCol}" />
      <rect x="2" y="6" width="5" height="1" fill="${fillCol}" />
      <rect x="3" y="7" width="3" height="1" fill="${fillCol}" />
      <rect x="4" y="8" width="1" height="1" fill="${fillCol}" />
      <!-- Shine highlight (top-left) -->
      <rect x="2" y="2" width="1" height="2" fill="${shineCol}" />
      <rect x="3" y="2" width="1" height="1" fill="${shineCol}" />
      <!-- Shadow depth -->
      <rect x="6" y="4" width="1" height="2" fill="${darkFill}" />
      <rect x="5" y="6" width="1" height="1" fill="${darkFill}" />
    `;
  } else if (type === "half") {
    inner = `
      <!-- Background right half -->
      <rect x="5" y="2" width="2" height="3" fill="${bgCol}" />
      <rect x="5" y="3" width="3" height="3" fill="${bgCol}" />
      <rect x="4" y="6" width="3" height="1" fill="${bgCol}" />
      <rect x="4" y="7" width="2" height="1" fill="${bgCol}" />
      <!-- Red fill left half -->
      <rect x="2" y="2" width="2" height="3" fill="${fillCol}" />
      <rect x="1" y="3" width="4" height="3" fill="${fillCol}" />
      <rect x="2" y="6" width="2" height="1" fill="${fillCol}" />
      <rect x="3" y="7" width="1" height="1" fill="${fillCol}" />
      <rect x="4" y="8" width="1" height="1" fill="${fillCol}" />
      <!-- Shine -->
      <rect x="2" y="2" width="1" height="2" fill="${shineCol}" />
      <rect x="3" y="2" width="1" height="1" fill="${shineCol}" />
    `;
  } else {
    // Empty heart container
    inner = `
      <rect x="2" y="2" width="2" height="3" fill="${bgCol}" />
      <rect x="5" y="2" width="2" height="3" fill="${bgCol}" />
      <rect x="1" y="3" width="7" height="3" fill="${bgCol}" />
      <rect x="2" y="6" width="5" height="1" fill="${bgCol}" />
      <rect x="3" y="7" width="3" height="1" fill="${bgCol}" />
      <rect x="4" y="8" width="1" height="1" fill="${bgCol}" />
    `;
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 9 9" shape-rendering="crispEdges" class="voxel-heart-svg heart-${type}" data-type="${type}">
      <!-- Outer Border -->
      <rect x="2" y="1" width="2" height="1" fill="${borderCol}" />
      <rect x="5" y="1" width="2" height="1" fill="${borderCol}" />
      <rect x="1" y="2" width="1" height="3" fill="${borderCol}" />
      <rect x="4" y="2" width="1" height="2" fill="${borderCol}" />
      <rect x="7" y="2" width="1" height="3" fill="${borderCol}" />
      <rect x="0" y="3" width="1" height="2" fill="${borderCol}" />
      <rect x="8" y="3" width="1" height="2" fill="${borderCol}" />
      <rect x="1" y="5" width="1" height="1" fill="${borderCol}" />
      <rect x="7" y="5" width="1" height="1" fill="${borderCol}" />
      <rect x="2" y="6" width="1" height="1" fill="${borderCol}" />
      <rect x="6" y="6" width="1" height="1" fill="${borderCol}" />
      <rect x="3" y="7" width="1" height="1" fill="${borderCol}" />
      <rect x="5" y="7" width="1" height="1" fill="${borderCol}" />
      <rect x="4" y="8" width="1" height="1" fill="${borderCol}" />
      ${inner}
    </svg>
  `;
}

/**
 * Generates an original 9x9 procedural pixel drumstick/hunger SVG.
 * @param {'full'|'half'|'empty'} type
 * @param {number} size
 * @param {'day'|'night'} mode
 * @returns {string} SVG markup
 */
export function getHungerSvg(type = "full", size = 16, mode = "night") {
  const isNight = mode === "night";
  const borderCol = isNight ? "#05070D" : "#1A1C23";
  const boneCol = "#D8DEE9";
  const meatCol = isNight ? "#FF6D00" : "#8B5A2B";
  const meatDark = isNight ? "#D84315" : "#5C3D24";
  const meatHigh = isNight ? "#FFB300" : "#C17D11";
  const bgCol = isNight ? "#151D2E" : "#2E3440";

  let inner = "";

  if (type === "full") {
    inner = `
      <!-- Roasted Meat Fill -->
      <rect x="3" y="1" width="4" height="2" fill="${meatHigh}" />
      <rect x="4" y="3" width="4" height="3" fill="${meatCol}" />
      <rect x="3" y="4" width="4" height="3" fill="${meatCol}" />
      <rect x="2" y="5" width="3" height="2" fill="${meatDark}" />
      <!-- Bone Handle (bottom-left) -->
      <rect x="0" y="7" width="2" height="2" fill="${boneCol}" />
      <rect x="1" y="6" width="2" height="1" fill="${boneCol}" />
    `;
  } else if (type === "half") {
    inner = `
      <!-- Half Meat Fill -->
      <rect x="3" y="1" width="2" height="2" fill="${meatHigh}" />
      <rect x="3" y="3" width="2" height="3" fill="${meatCol}" />
      <rect x="2" y="5" width="2" height="2" fill="${meatDark}" />
      <!-- Empty Right Half -->
      <rect x="5" y="1" width="2" height="2" fill="${bgCol}" />
      <rect x="5" y="3" width="3" height="3" fill="${bgCol}" />
      <!-- Bone Handle -->
      <rect x="0" y="7" width="2" height="2" fill="${boneCol}" />
      <rect x="1" y="6" width="2" height="1" fill="${boneCol}" />
    `;
  } else {
    // Empty drumstick outline
    inner = `
      <rect x="3" y="1" width="4" height="5" fill="${bgCol}" />
      <rect x="2" y="5" width="3" height="2" fill="${bgCol}" />
      <!-- Bone Handle Outline -->
      <rect x="0" y="7" width="2" height="2" fill="#4C566A" />
    `;
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 9 9" shape-rendering="crispEdges" class="voxel-hunger-svg hunger-${type}" data-type="${type}">
      <!-- Outline -->
      <rect x="3" y="0" width="4" height="1" fill="${borderCol}" />
      <rect x="2" y="1" width="1" height="4" fill="${borderCol}" />
      <rect x="7" y="1" width="1" height="4" fill="${borderCol}" />
      <rect x="1" y="5" width="1" height="2" fill="${borderCol}" />
      <rect x="6" y="5" width="1" height="2" fill="${borderCol}" />
      <rect x="0" y="6" width="1" height="3" fill="${borderCol}" />
      <rect x="2" y="7" width="1" height="2" fill="${borderCol}" />
      <rect x="1" y="8" width="2" height="1" fill="${borderCol}" />
      ${inner}
    </svg>
  `;
}

/**
 * Generates an original pixel item icon SVG for inventory slots.
 * @param {'wrench'|'battery'|'crystal'|'shield'|'compass'|'potion'|'server'|'heart'} itemId
 * @param {number} size
 * @returns {string} SVG markup
 */
export function getItemIconSvg(itemId = "wrench", size = 24) {
  let content = "";

  switch (itemId) {
    case "wrench":
      content = `
        <rect x="9" y="3" width="4" height="2" fill="#9AA5B4" />
        <rect x="8" y="5" width="2" height="2" fill="#9AA5B4" />
        <rect x="12" y="5" width="2" height="2" fill="#9AA5B4" />
        <rect x="7" y="7" width="2" height="2" fill="#5A6577" />
        <rect x="6" y="9" width="2" height="2" fill="#00E5FF" />
        <rect x="5" y="11" width="2" height="2" fill="#00E5FF" />
        <rect x="4" y="13" width="2" height="2" fill="#5A6577" />
      `;
      break;
    case "battery":
      content = `
        <rect x="7" y="3" width="2" height="1" fill="#9AA5B4" />
        <rect x="5" y="4" width="6" height="9" fill="#151D2E" />
        <rect x="6" y="5" width="4" height="2" fill="#00E676" />
        <rect x="6" y="8" width="4" height="2" fill="#00E676" />
        <rect x="6" y="11" width="4" height="1" fill="#69F0AE" />
      `;
      break;
    case "crystal":
      content = `
        <rect x="7" y="3" width="2" height="2" fill="#00E5FF" />
        <rect x="5" y="5" width="6" height="3" fill="#00BCD4" />
        <rect x="4" y="8" width="8" height="3" fill="#06989A" />
        <rect x="6" y="11" width="4" height="2" fill="#00BCD4" />
        <rect x="7" y="13" width="2" height="1" fill="#00E5FF" />
        <rect x="6" y="6" width="2" height="2" fill="#E2E8F0" />
      `;
      break;
    case "shield":
      content = `
        <rect x="4" y="4" width="8" height="2" fill="#8B5A2B" />
        <rect x="4" y="6" width="8" height="5" fill="#5A6577" />
        <rect x="5" y="11" width="6" height="2" fill="#5A6577" />
        <rect x="6" y="13" width="4" height="1" fill="#3B4252" />
        <rect x="7" y="6" width="2" height="4" fill="#00E676" />
      `;
      break;
    case "compass":
      content = `
        <rect x="5" y="3" width="6" height="1" fill="#E5B83B" />
        <rect x="4" y="4" width="8" height="8" fill="#151D2E" />
        <rect x="5" y="12" width="6" height="1" fill="#E5B83B" />
        <!-- Needle -->
        <rect x="7" y="5" width="2" height="3" fill="#FF1744" />
        <rect x="7" y="8" width="2" height="3" fill="#E2E8F0" />
      `;
      break;
    case "potion":
      content = `
        <rect x="7" y="3" width="2" height="2" fill="#8B5A2B" />
        <rect x="6" y="5" width="4" height="2" fill="#9AA5B4" />
        <rect x="4" y="7" width="8" height="6" fill="#0B111E" />
        <rect x="5" y="8" width="6" height="4" fill="#7C4DFF" />
        <rect x="6" y="9" width="2" height="1" fill="#E2E8F0" />
      `;
      break;
    case "rocket":
      content = `
        <rect x="7" y="1" width="2" height="2" fill="#FF1744" />
        <rect x="6" y="3" width="4" height="2" fill="#FF1744" />
        <rect x="6" y="5" width="4" height="6" fill="#E2E8F0" />
        <rect x="7" y="6" width="2" height="2" fill="#00E5FF" />
        <rect x="4" y="9" width="2" height="4" fill="#FF1744" />
        <rect x="10" y="9" width="2" height="4" fill="#FF1744" />
        <rect x="6" y="11" width="4" height="1" fill="#374761" />
        <rect x="7" y="12" width="2" height="2" fill="#FFB300" />
        <rect x="7" y="14" width="2" height="2" fill="#FF6D00" />
      `;
      break;
    case "server":
    default:
      content = `
        <rect x="4" y="4" width="8" height="8" fill="#243048" />
        <rect x="5" y="5" width="6" height="1" fill="#00E5FF" />
        <rect x="5" y="7" width="6" height="1" fill="#374761" />
        <rect x="5" y="9" width="2" height="1" fill="#00E676" />
        <rect x="8" y="9" width="3" height="1" fill="#FFB300" />
      `;
      break;
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 16 16" shape-rendering="crispEdges" class="voxel-item-icon">
      ${content}
    </svg>
  `;
}

/**
 * Generates procedural voxel Sun SVG.
 * @param {number} size
 * @returns {string} SVG markup
 */
export function getVoxelSunSvg(size = 36) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 16 16" shape-rendering="crispEdges" class="voxel-sun-svg">
      <rect x="7" y="0" width="2" height="2" fill="#E5B83B" />
      <rect x="7" y="14" width="2" height="2" fill="#E5B83B" />
      <rect x="0" y="7" width="2" height="2" fill="#E5B83B" />
      <rect x="14" y="7" width="2" height="2" fill="#E5B83B" />
      <rect x="2" y="2" width="2" height="2" fill="#F57900" />
      <rect x="12" y="2" width="2" height="2" fill="#F57900" />
      <rect x="2" y="12" width="2" height="2" fill="#F57900" />
      <rect x="12" y="12" width="2" height="2" fill="#F57900" />
      <rect x="4" y="3" width="8" height="10" fill="#E5B83B" />
      <rect x="3" y="4" width="10" height="8" fill="#E5B83B" />
      <rect x="5" y="4" width="6" height="8" fill="#FFF275" />
      <rect x="6" y="5" width="4" height="6" fill="#FFFFFF" />
    </svg>
  `;
}

/**
 * Generates procedural voxel Moon SVG.
 * @param {number} size
 * @returns {string} SVG markup
 */
export function getVoxelMoonSvg(size = 36) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 16 16" shape-rendering="crispEdges" class="voxel-moon-svg">
      <rect x="6" y="1" width="6" height="1" fill="#00E5FF" />
      <rect x="4" y="2" width="3" height="1" fill="#00E5FF" />
      <rect x="3" y="3" width="2" height="2" fill="#00E5FF" />
      <rect x="2" y="5" width="2" height="6" fill="#00E5FF" />
      <rect x="3" y="11" width="2" height="2" fill="#00E5FF" />
      <rect x="4" y="13" width="3" height="1" fill="#00E5FF" />
      <rect x="6" y="14" width="6" height="1" fill="#00E5FF" />
      <rect x="6" y="2" width="5" height="12" fill="#E2E8F0" />
      <rect x="4" y="3" width="3" height="10" fill="#E2E8F0" />
      <rect x="3" y="5" width="2" height="6" fill="#E2E8F0" />
      <rect x="8" y="4" width="4" height="8" fill="#0B111E" />
      <rect x="7" y="5" width="4" height="6" fill="#0B111E" />
      <rect x="6" y="6" width="3" height="4" fill="#0B111E" />
      <rect x="4" y="6" width="1" height="1" fill="#94A3B8" />
      <rect x="5" y="9" width="1" height="2" fill="#94A3B8" />
    </svg>
  `;
}

/**
 * Generates procedural voxel Cloud SVG.
 * @param {number} width
 * @param {number} height
 * @returns {string} SVG markup
 */
export function getVoxelCloudSvg(width = 48, height = 20) {
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 24 10" shape-rendering="crispEdges" class="voxel-cloud-svg">
      <rect x="6" y="1" width="8" height="2" fill="#F0F4F8" />
      <rect x="4" y="3" width="14" height="3" fill="#F0F4F8" />
      <rect x="1" y="5" width="20" height="3" fill="#F0F4F8" />
      <rect x="3" y="8" width="18" height="2" fill="#9AA5B4" />
    </svg>
  `;
}

// =============================================================================
// 2. RESTYLED PULSEBOT MASCOT (4 Original Procedural Expressions)
// =============================================================================

/**
 * Generates procedural pixel-art SVG for the PulseBot companion mascot.
 * @param {'happy'|'idle'|'worried'|'celebrating'} expression
 * @param {number} size
 * @param {string|null} antennaColor
 * @returns {string} SVG markup
 */
export function getPulseBotMascotSvg(expression = "idle", size = 56, antennaColor = null) {
  let beaconColor = antennaColor || "#00E5FF";
  let eyes = "";
  let mouth = "";
  let partyHat = "";
  let ears = `
    <rect x="5" y="3" width="2" height="2" fill="#FF6D00" />
    <rect x="4" y="5" width="3" height="2" fill="#E65100" />
    <rect x="21" y="3" width="2" height="2" fill="#FF6D00" />
    <rect x="21" y="5" width="3" height="2" fill="#E65100" />
  `;

  if (expression === "happy") {
    beaconColor = antennaColor || "#00E676";
    // Cheerful ^ ^ smile eyes
    eyes = `
      <rect x="8" y="9" width="3" height="1" fill="#00E676" />
      <rect x="7" y="10" width="1" height="2" fill="#00E676" />
      <rect x="11" y="10" width="1" height="2" fill="#00E676" />
      <rect x="17" y="9" width="3" height="1" fill="#00E676" />
      <rect x="16" y="10" width="1" height="2" fill="#00E676" />
      <rect x="20" y="10" width="1" height="2" fill="#00E676" />
    `;
    mouth = `<rect x="12" y="14" width="4" height="1" fill="#FFB300" />`;
  } else if (expression === "worried") {
    beaconColor = antennaColor || "#FFB300";
    // Anxious asymmetrical slant eyes / \
    eyes = `
      <rect x="7" y="11" width="4" height="1" fill="#FFB300" />
      <rect x="10" y="10" width="1" height="1" fill="#FFB300" />
      <rect x="17" y="11" width="4" height="1" fill="#FFB300" />
      <rect x="17" y="10" width="1" height="1" fill="#FFB300" />
      <!-- Pupil dots -->
      <rect x="8" y="11" width="1" height="1" fill="#FF1744" />
      <rect x="19" y="11" width="1" height="1" fill="#FF1744" />
    `;
    mouth = `<rect x="11" y="15" width="6" height="1" fill="#E65100" />`;
    // Drooped ears
    ears = `
      <rect x="4" y="5" width="2" height="3" fill="#D84315" />
      <rect x="22" y="5" width="2" height="3" fill="#D84315" />
    `;
  } else if (expression === "celebrating") {
    beaconColor = antennaColor || "#FFEB3B";
    // Sparkling star/plus eyes + +
    eyes = `
      <rect x="9" y="8" width="1" height="5" fill="#FFD54F" />
      <rect x="7" y="10" width="5" height="1" fill="#FFD54F" />
      <rect x="9" y="10" width="1" height="1" fill="#FFFFFF" />

      <rect x="18" y="8" width="1" height="5" fill="#FFD54F" />
      <rect x="16" y="10" width="5" height="1" fill="#FFD54F" />
      <rect x="18" y="10" width="1" height="1" fill="#FFFFFF" />
    `;
    mouth = `
      <rect x="11" y="14" width="6" height="2" fill="#00E676" />
      <rect x="12" y="15" width="4" height="1" fill="#FFFFFF" />
    `;
    // Party hat blocks on head!
    partyHat = `
      <rect x="13" y="0" width="2" height="2" fill="#FF1744" />
      <rect x="12" y="2" width="4" height="2" fill="#FFB300" />
      <rect x="11" y="4" width="6" height="2" fill="#00E5FF" />
      <!-- Confetti specks -->
      <rect x="2" y="1" width="2" height="2" fill="#00E676" />
      <rect x="24" y="2" width="2" height="2" fill="#FF6D00" />
      <rect x="1" y="10" width="2" height="2" fill="#7C4DFF" />
      <rect x="25" y="11" width="2" height="2" fill="#00E5FF" />
    `;
  } else {
    // IDLE: Steady calm visor eyes ■ ■
    beaconColor = antennaColor || "#00E5FF";
    eyes = `
      <rect x="7" y="9" width="4" height="3" fill="#00E5FF" />
      <rect x="8" y="9" width="2" height="2" fill="#E2E8F0" />
      <rect x="17" y="9" width="4" height="3" fill="#00E5FF" />
      <rect x="18" y="9" width="2" height="2" fill="#E2E8F0" />
    `;
    mouth = `<rect x="13" y="14" width="2" height="1" fill="#2979FF" />`;
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 28 28" shape-rendering="crispEdges" class="pulsebot-mascot-svg expression-${expression}">
      ${partyHat}
      ${ears}

      <!-- Antenna Stalk & Glowing Beacon -->
      <rect x="13" y="2" width="2" height="4" fill="#5A6577" />
      <rect x="12" y="1" width="4" height="2" fill="${beaconColor}" class="pulse-beacon" />

      <!-- Head Base Box -->
      <rect x="5" y="6" width="18" height="12" fill="#151D2E" />
      <rect x="4" y="8" width="20" height="8" fill="#151D2E" />

      <!-- Outer Face Bevel -->
      <rect x="6" y="6" width="16" height="1" fill="#374761" />
      <rect x="4" y="8" width="1" height="8" fill="#374761" />
      <rect x="23" y="8" width="1" height="8" fill="#0B111E" />

      <!-- Visor Recess -->
      <rect x="6" y="8" width="16" height="5" fill="#05070D" />
      <rect x="5" y="9" width="18" height="3" fill="#05070D" />

      <!-- Eyes & Face Features -->
      <g class="mascot-eyes">${eyes}</g>
      ${mouth}

      <!-- Cheeks / Sensors -->
      <rect x="2" y="11" width="2" height="1" fill="#FF6D00" />
      <rect x="24" y="11" width="2" height="1" fill="#FF6D00" />

      <!-- Chassis Neck & Collar -->
      <rect x="8" y="18" width="12" height="2" fill="#243048" />
      <rect x="11" y="18" width="6" height="2" fill="#00E5FF" />
    </svg>
  `;
}

// =============================================================================
// 3. REUSABLE COMPONENT HTML BUILDERS
// =============================================================================

/**
 * Builds HTML for a Voxel Beveled Block Button.
 * @param {object} props
 * @param {string} props.text - 1-3 words
 * @param {'primary'|'secondary'|'danger'|'caution'} [props.variant='primary']
 * @param {'normal'|'pressed'|'disabled'} [props.state='normal']
 * @param {string} [props.icon='']
 * @param {string} [props.id='']
 * @param {string} [props.extraClass='']
 * @returns {string} HTML string
 */
export function buildVoxelButton({
  text = "ACTION",
  variant = "primary",
  state = "normal",
  icon = "",
  id = "",
  extraClass = "",
} = {}) {
  const isDisabled = state === "disabled";
  const isPressed = state === "pressed";
  const idAttr = id ? `id="${id}"` : "";
  const disabledAttr = isDisabled ? "disabled" : "";

  return `
    <button class="voxel-btn variant-${variant} state-${state} ${isPressed ? 'is-pressed' : ''} ${extraClass}" ${idAttr} ${disabledAttr}>
      ${icon ? `<span class="voxel-btn-icon">${icon}</span>` : ""}
      <span class="voxel-btn-text">${text}</span>
    </button>
  `;
}

/**
 * Builds HTML for the Heart Bar (Health/Node Vitality).
 * @param {object} props
 * @param {number} props.current - 0..max
 * @param {number} props.max - default 10
 * @param {'day'|'night'} [props.mode='night']
 * @returns {string} HTML string
 */
export function buildHeartBar({ current = 10, max = 10, mode = "night" } = {}) {
  const hearts = [];
  const totalSlots = Math.ceil(max / 2);

  for (let i = 0; i < totalSlots; i++) {
    const heartValue = (i + 1) * 2;
    if (current >= heartValue) {
      hearts.push(getHeartSvg("full", 16, mode));
    } else if (current >= heartValue - 1) {
      hearts.push(getHeartSvg("half", 16, mode));
    } else {
      hearts.push(getHeartSvg("empty", 16, mode));
    }
  }

  return `
    <div class="voxel-heart-bar" title="Health: ${current}/${max}">
      ${hearts.join("")}
    </div>
  `;
}

/**
 * Builds HTML for the Hunger Bar (Resource / Heap / Memory Level).
 * @param {object} props
 * @param {number} props.current - 0..max
 * @param {number} props.max - default 10
 * @param {'day'|'night'} [props.mode='night']
 * @returns {string} HTML string
 */
export function buildHungerBar({ current = 10, max = 10, mode = "night" } = {}) {
  const icons = [];
  const totalSlots = Math.ceil(max / 2);

  for (let i = 0; i < totalSlots; i++) {
    const value = (i + 1) * 2;
    if (current >= value) {
      icons.push(getHungerSvg("full", 16, mode));
    } else if (current >= value - 1) {
      icons.push(getHungerSvg("half", 16, mode));
    } else {
      icons.push(getHungerSvg("empty", 16, mode));
    }
  }

  return `
    <div class="voxel-hunger-bar" title="Resources: ${current}/${max}">
      ${icons.join("")}
    </div>
  `;
}

/**
 * Builds HTML for the XP / Progress Level Bar.
 * @param {object} props
 * @param {number} props.current - e.g. 74
 * @param {number} props.max - e.g. 100
 * @param {number|string} props.level - Level number displayed in center badge (e.g. 42)
 * @returns {string} HTML string
 */
export function buildXpBar({ current = 75, max = 100, level = 42 } = {}) {
  const pct = Math.max(0, Math.min(100, Math.round((current / max) * 100)));

  return `
    <div class="voxel-xp-container">
      <div class="voxel-xp-track">
        <div class="voxel-xp-fill" style="width: ${pct}%;"></div>
      </div>
      <div class="voxel-xp-badge">${level}</div>
    </div>
  `;
}

/**
 * Builds HTML for a Voxel Inventory Slot.
 * @param {object} props
 * @param {string|null} props.item - item icon identifier (e.g. 'wrench', 'battery')
 * @param {number} props.count - count badge (e.g. 64)
 * @param {boolean} props.isSelected - active selection frame
 * @param {boolean} props.isDisabled - empty/disabled slot
 * @param {number} props.size - 32 or 40px
 * @param {string} [props.id='']
 * @returns {string} HTML string
 */
export function buildInventorySlot({
  item = null,
  count = 1,
  isSelected = false,
  isDisabled = false,
  size = 40,
  id = "",
} = {}) {
  const idAttr = id ? `id="${id}"` : "";
  const selectClass = isSelected ? "is-selected" : "";
  const disabledClass = isDisabled ? "is-disabled" : "";

  return `
    <div class="voxel-slot ${selectClass} ${disabledClass}" style="width: ${size}px; height: ${size}px;" ${idAttr}>
      ${item ? getItemIconSvg(item, Math.round(size * 0.6)) : ""}
      ${item && count > 1 ? `<span class="voxel-slot-count">${count}</span>` : ""}
    </div>
  `;
}

/**
 * Builds HTML for the Bottom Hotbar Navigation Bar.
 * 8 slots, each 40x32px, perfectly filling the 320px width.
 * @param {object} props
 * @param {number} props.activeIndex - 0..7
 * @param {Array<{label: string, icon?: string}>} [props.items]
 * @returns {string} HTML string
 */
export function buildHotbarNavigation({
  activeIndex = 0,
  items = [
    { label: "HOME", icon: "⌂" },
    { label: "SRV", icon: "≡" },
    { label: "INC", icon: "!" },
    { label: "COST", icon: "$" },
    { label: "DEP", icon: "▲" },
    { label: "WTHR", icon: "⛅" },
    { label: "TIME", icon: "⏱" },
    { label: "SET", icon: "⚙" },
  ],
} = {}) {
  const slots = items.map((item, idx) => {
    const isActive = idx === activeIndex;
    return `
      <div class="voxel-hotbar-slot ${isActive ? 'is-active' : ''}" data-index="${idx}" title="${item.label}">
        <span class="slot-idx-tag">${idx + 1}</span>
        <span class="slot-label">${item.label}</span>
      </div>
    `;
  });

  return `
    <nav class="voxel-hotbar" id="voxel-hotbar-nav">
      ${slots.join("")}
    </nav>
  `;
}

/**
 * Builds HTML for an Alert Banner.
 * @param {object} props
 * @param {'nominal'|'warning'|'critical'} props.type
 * @param {string} props.title - 1-3 words
 * @param {string} props.message - brief notice
 * @param {boolean} [props.dismissible=true]
 * @returns {string} HTML string
 */
export function buildAlertBanner({
  type = "nominal",
  title = "SYSTEM NOMINAL",
  message = "All subsystems operational",
  dismissible = true,
} = {}) {
  const icon = type === "nominal" ? "✓" : type === "warning" ? "!" : "⚡";

  return `
    <div class="voxel-alert-banner alert-${type}">
      <span class="alert-icon-box">${icon}</span>
      <div class="alert-text-group">
        <span class="alert-title">${title}</span>
        <span class="alert-msg">${message}</span>
      </div>
      ${dismissible ? `<button class="alert-dismiss-btn" title="Dismiss">X</button>` : ""}
    </div>
  `;
}
