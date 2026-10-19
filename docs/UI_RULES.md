# PulseBox Cyber Desk — UI Voxel Redesign Specification & Rules

This document establishes the mandatory design rules and technical constraints for the Voxel / Blocky UI redesign of the PulseBox Cyber Desk 320×240 embedded display and simulator.

Every future implementation step, component, screen, asset, and test modification must strictly comply with these rules.

---

## 1. Core Visual Style: Original Voxel / Blocky Sandbox

- **Originality & Clean IP:** All graphics, icons, sprites, fonts, and UI elements must be 100% original.
- **Strict Prohibition:** Absolutely NO Mojang or Minecraft assets, textures, sounds, logos, or typography may be used or referenced.
- **Naming Rule:** The term "Minecraft" must NEVER appear in UI text, code identifiers, comments, documentation, or filenames.
- **Aesthetic:** Clean, retro-voxel, chunk-based sandbox aesthetic with crisp hard pixel edges (`shape-rendering: crispEdges`), isometric or flat orthogonal block projections, chunky geometric frames, and zero smooth vector curves or anti-aliased blur.

---

## 2. Canvas, Grid & Color Palettes

### 2.1 Geometry & Grid
- **Native Resolution:** 320 × 240 pixels (Landscape ILI9341 display and hardware simulator).
- **Base Modular Grid:** Strict **8px snap grid** (40 horizontal blocks × 30 vertical blocks).
  - Primary UI blocks align to 8px, 16px, 24px, 32px, or 64px boundaries.
  - Borders use 1px, 2px, or 4px solid block-bevel edges.
- **Touch Target Rule:** Every interactive touchscreen target MUST be at least **32 × 32 pixels** (4 × 4 grid cells) to ensure reliable resistive digitizer finger actuation without misclicks.

### 2.2 Strict 16-Color Indexed Palettes
All screens, icons, sprites, and text must select from a unified maximum palette of **16 indexed colors**. Two synchronized lighting themes are defined:

#### A. Day Palette (Warm Sunlight & Earth Voxel)
1. `#1A1C23` — Bedrock Dark (Deep shadow/border)
2. `#2E3440` — Deep Slate (Dark block base)
3. `#4C566A` — Cobble Gray (Container fill)
4. `#D8DEE9` — Chalk White (Primary text & high contrast)
5. `#ECEFF4` — Pure Cloud (Active selection highlight)
6. `#4E9A06` — Lush Green (Healthy / Nominal state)
7. `#73D216` — Bright Meadow (Nominal accent)
8. `#C4A000` — Sun Amber (Warning / High utilization)
9. `#F57900` — Lava Orange (Alert / Degradation)
10. `#CC0000` — Redstone Red (Critical failure / Outage)
11. `#EF2929` — Bright Coral (Critical accent)
12. `#06989A` — Prism Cyan (Link / Clock / Pipeline)
13. `#3465A4` — Sky Blue (Weather / Data stream)
14. `#75507B` — Obsidian Purple (Settings / Mystery)
15. `#8F5902` — Oak Brown (Panel bevel shadow)
16. `#C17D11` — Plank Gold (Panel bevel highlight)

#### B. Night Palette (Deep Midnight & Fluorescent Neon Voxel)
1. `#05070D` — Midnight Void (Canvas background)
2. `#0B111E` — Dark Obsidian (Card & panel surface)
3. `#162035` — Deep Cobble (Panel border & inset)
4. `#E2E8F0` — Starlight White (Primary readable text)
5. `#94A3B8` — Mist Gray (Muted secondary text)
6. `#00E676` — Neon Emerald (Healthy / Nominal indicator)
7. `#69F0AE` — Bright Mint (Nominal highlight)
8. `#FFB300` — Glow Amber (Warning / Threshold reached)
9. `#FF6D00` — Plasma Orange (Action / Active timer)
10. `#FF1744` — Laser Crimson (Outage / Downed node)
11. `#FF5252` — Bright Ruby (Alert highlight)
12. `#00E5FF` — Neon Cyan (Clock / Telemetry highlight)
13. `#2979FF` — Electric Sapphire (Network / Ingress stream)
14. `#7C4DFF` — Phantom Violet (Config / Secondary category)
15. `#1F2937` — Basalt Bevel (Shadow bevel edge)
16. `#374151` — Iron Bevel (Highlight bevel edge)

---

## 3. Information Density & Screen Hierarchy

### 3.1 The 1-Second Rule (One Hero Element)
- Each screen must feature **EXACTLY ONE primary hero element** that communicates the essential state instantly in under 1 second.
- Examples of hero elements: A giant voxel heart cluster, a single 3-digit latency block, a blocky outage banner, a chunky coin bank, a giant digital clock stone, or a countdown hourglass.

### 3.2 Strict Text & Word Limits
- **Maximum 3 text elements** per screen (excluding the hotbar).
- **Maximum 12 words total** on the entire display per screen (excluding the hotbar).
- Labels must be concise: **1 to 3 words maximum** (e.g., `ALL NOMINAL`, `API DOWN`, `$64 TODAY`).
- Visuals First: Icons, voxel blocks, color transitions, and mascot facial expressions must convey meaning before reading any text.

### 3.3 Zero Clutter on the Device
- **NO tables.**
- **NO lists exceeding 3 items.**
- **NO paragraphs, descriptions, or serialized log streams** on the 320×240 embedded display.
- Every screen is glanceable, clear, and readable from 3 feet away on a desk.

### 3.4 Progressive Disclosure: "Behind-the-Tap"
- The primary screen displays only the hero state and immediate status.
- Complex information, server breakdowns, historical logs, or adjustments live **behind a tap**.
- Tapping the hero element or a dedicated chunky `[INFO]` / `[MORE]` block opens a simple **Detail View**.
- Every detail view must include a prominent, top-left **`[< BACK]`** button (at least 32×32px) returning directly to the overview.

---

## 4. Emotional Feedback & State Signaling

- **Nominal / Healthy = Calm:**
  - Soothing colors (Neon Emerald / Lush Green, Deep Obsidian / Midnight Void).
  - Steady or gentle breathing animations (no flashing).
  - Mascot face: Happy smile (`^ ^`) or steady relaxed visor.
- **Problem / Degraded = Obvious Alert:**
  - High-contrast color shift (Laser Crimson, Lava Orange, Glow Amber).
  - Clear icon metamorphosis (Checkmark -> Warning triangle -> Crushed block).
  - Mascot face: Shocked wide eyes, sleepy outage slits, or alert beacon pulse.
  - Audio: Distinct alert chime; UI changes state without ambiguity.

---

## 5. Screen Layout & Hotbar Structure

The 320×240 display is partitioned into three functional horizontal zones aligned to the 8px grid:

```
+--------------------------------------------------------------+ [Y: 0]
| STATUS BAR: [SIM] [WIFI] [PWR]                 12:00 [NIGHT] | (16px)
+--------------------------------------------------------------+ [Y: 16]
|                                                              |
|                     HERO DISPLAY ZONE                        |
|                                                              | (192px)
|              (One prominent voxel visual,                    |
|               Max 3 text elements, <= 12 words)              |
|                                                              |
+--------------------------------------------------------------+ [Y: 208]
| HOTBAR: [HOME] [SRV] [INC] [COST] [DEP] [WTHR] [TIME] [SET]  | (32px)
+--------------------------------------------------------------+ [Y: 240]
```

- **Top Status Bar (16px / 2 rows):** Voxel battery icon, WiFi RSSI bars, SIM badge, mini clock, Day/Night toggle indicator.
- **Center Hero Stage (192px / 24 rows):** The single hero visual and glanceable status. Tap anywhere to enter Detail View.
- **Bottom Hotbar (32px / 4 rows):** 8 chunky item-slot buttons (each 40×32px, perfectly filling 320px). Tapping switches screens with instant click feedback.

---

## 6. Engineering & Compatibility Invariants

1. **Backend Endpoints Unchanged:** Do not modify any Flask backend route paths (`/health`, `/state`, `/simulate-failure`, `/restore`, `/incidents`, `/costs`, `/costs/settings`, `/weather`, `/reset`, `/record-health-check`).
2. **Response Shapes Unchanged:** Do not change any JSON request or response schemas.
3. **No Secret Leaks:** Never reintroduce API keys to browser storage or frontend bundles. Direct browser mutations remain gracefully gated behind authorization notices.
4. **Preserve Existing Tests:** All 65 backend tests, 85 embedded simulator tests, and frontend test suites must continue to pass 100% without breakage.
5. **Hardware Preservation:** Do not edit ESP32 firmware wiring, display SPI pins, touchscreen calibration, or PlatformIO configs.
