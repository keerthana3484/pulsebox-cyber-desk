# PulseBox Cyber Desk — Design System Specification

## 1. Overview & Aesthetic Philosophy

The **PulseBox Cyber Desk** user interface is engineered for a 2.8" SPI TFT LCD (ILI9341 controller, 320×240 pixels) powered by an ESP32 microcontroller, accompanied by a pixel-accurate browser-based embedded simulator.

The visual direction follows an **original retro-voxel / blocky sandbox-game style**:
- **Original & Clean IP:** 100% original pixel art, voxel icons, and block geometry. Absolutely zero Mojang/Minecraft textures, logos, sound effects, fonts, or assets. The word "Minecraft" is never used in code, filenames, or UI text.
- **Strict 8px Grid:** Every UI card, bezel, button, slot, and icon is anchored to a hard 8px modular chunk grid. Zero smooth vector curves; all edges render with crisp square pixels (`shape-rendering: crispEdges`).
- **One Hero Element per Screen:** The user must grasp the essential state of the device in **under 1 second** from 3 feet away on a desk.
- **Radical Brevity:** Maximum 3 text elements and maximum 12 words per screen (excluding the persistent bottom hotbar).
- **Dual Indexed Palettes:** Strict maximum of 16 indexed colors for Day (Earth/Sunlight) and 16 indexed colors for Night (Low-Glare Midnight).

---

## 2. Color Palettes (Max 16 Colors Each)

Every color is defined in the single source-of-truth token file [`frontend/src/tokens.js`](file:///c:/Users/ASUS/OneDrive/Desktop/cyber%20desk/frontend/src/tokens.js) and maps bi-directionally between 24-bit Hex (for the CSS/Canvas simulator) and 16-bit RGB565 (for the ESP32 TFT_eSPI hardware driver).

### 2.1 Day Palette (Earth & Sunlight Sandbox)

| Index | Identifier | Name | Hex | RGB565 (Hex) | RGB565 (Dec) | Semantic Role |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| **0** | `day_dirt_dark` | Soil Shadow | `#2E1F14` | `0x2902` | `10498` | Deep inset border & soil shadow |
| **1** | `day_dirt_base` | Loam Dirt | `#5C3D24` | `0x59E4` | `23012` | Dirt block base & dark wood fill |
| **2** | `day_wood_bark` | Oak Bark | `#8B5A2B` | `0x8AC5` | `35525` | Wood trunk & warm button bevel |
| **3** | `day_stone_shadow`| Deep Slate | `#3B4252` | `0x3A0A` | `14858` | Stone shadow & card header |
| **4** | `day_stone_base` | Cobble Gray | `#5A6577` | `0x5B2E` | `23342` | Stone block surface & card fill |
| **5** | `day_stone_light`| Flint Stone | `#9AA5B4` | `0x9D36` | `40246` | Stone highlight & secondary bevel |
| **6** | `day_sky_blue` | Sky Blue | `#4A90E2` | `0x4C9C` | `19612` | Day atmosphere & telemetry line |
| **7** | `day_water_deep` | Ocean Deep | `#245C9E` | `0x22F3` | `8947` | Water stream & network ingress |
| **8** | `day_grass_base` | Lush Meadow | `#4E9A06` | `0x4CC0` | `19648` | Healthy status & nominal indicator |
| **9** | `day_grass_bright`| Foliage Green | `#73D216` | `0x7682` | `30338` | Grass top & healthy highlight |
| **10**| `day_sand_gold` | Sun Amber | `#E5B83B` | `0xE5C7` | `58823` | Sunlight & utilization warning |
| **11**| `day_lava_orange`| Lava Orange | `#F57900` | `0xF3C0` | `62400` | Alert highlight & active timer |
| **12**| `day_redstone` | Redstone Red | `#CC0000` | `0xC800` | `51200` | Outage critical & failed node |
| **13**| `day_cloud_white`| Cloud White | `#F0F4F8` | `0xF7BF` | `63423` | Primary readable text & active tab |
| **14**| `day_bedrock` | Bedrock Dark | `#1A1C23` | `0x18E4` | `6372` | Canvas background & drop shadow |
| **15**| `day_ore_cyan` | Diamond Ore | `#00BCD4` | `0x05FA` | `1530` | Clock stone & key milestone |

### 2.2 Night Palette (Low-Glare Midnight & Fluorescent Neon)

| Index | Identifier | Name | Hex | RGB565 (Hex) | RGB565 (Dec) | Semantic Role |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| **0** | `night_bg` | Midnight Void | `#05070D` | `0x0041` | `65` | Primary canvas background (low glare) |
| **1** | `night_obsidian` | Dark Obsidian | `#0B111E` | `0x0883` | `2179` | Card surface & panel background |
| **2** | `night_bedrock` | Shadow Slate | `#151D2E` | `0x10E5` | `4325` | Panel border & card inset |
| **3** | `night_cobble` | Night Cobble | `#243048` | `0x2189` | `8585` | Low-glare container & bevel shadow |
| **4** | `night_iron` | Muted Iron | `#374761` | `0x324C` | `12876` | Button outline & tab separator |
| **5** | `night_emerald` | Neon Emerald | `#00E676` | `0x072E` | `1838` | Nominal status & happy mascot face |
| **6** | `night_mint` | Bright Mint | `#69F0AE` | `0x6F95` | `28565` | Healthy accent & active selection |
| **7** | `night_amber` | Glow Amber | `#FFB300` | `0xFD60` | `64864` | Warning & threshold caution |
| **8** | `night_orange` | Plasma Orange | `#FF6D00` | `0xFB60` | `64352` | Active countdown & beacon pulse |
| **9** | `night_crimson` | Laser Crimson | `#FF1744` | `0xF8A8` | `63656` | Outage alarm & failed service |
| **10**| `night_cyan` | Neon Cyan | `#00E5FF` | `0x073F` | `1855` | Digital clock & telemetry highlight |
| **11**| `night_azure` | Electric Sapphire | `#2979FF` | `0x2BCF` | `11215` | Network stream & active ingress |
| **12**| `night_violet` | Phantom Violet | `#7C4DFF` | `0x7A7F` | `31359` | Config category & secondary pill |
| **13**| `night_gray` | Mist Gray | `#8899AC` | `0x8CD5` | `36053` | Low-glare secondary label text |
| **14**| `night_white` | Starlight White | `#E2E8F0` | `0xE75E` | `59230` | Primary low-glare readable text |
| **15**| `night_bevel` | Basalt Bevel | `#101623` | `0x10A4` | `4260` | Subtle 1px block shadow bevel |

---

## 3. Grid & Geometry Architecture

### 3.1 8px Modular Snap Grid
The display resolution is exactly **320 × 240 pixels**:
- **Columns:** 40 grid units (320 px / 8 px)
- **Rows:** 30 grid units (240 px / 8 px)
- **Base Grid Unit:** 8 × 8 pixels

All components, margins, paddings, and card boundaries must be multiples of 8px (8px, 16px, 24px, 32px, 40px, 48px, 64px).

### 3.2 Vertical Screen Partitioning
```
+--------------------------------------------------------------+ [Y: 0]
| STATUS BAR: [SIM] [WIFI]                    19:42 [BAT:85%]  | (16px / 2 Grid Units)
+--------------------------------------------------------------+ [Y: 16]
|                                                              |
|                     HERO DISPLAY ZONE                        |
|                                                              | (192px / 24 Grid Units)
|              One prominent voxel visual                      |
|              Max 3 text elements, <= 12 words                |
|                                                              |
+--------------------------------------------------------------+ [Y: 208]
| HOTBAR: [HOME] [SRV] [INC] [COST] [DEP] [WTHR] [TIME] [SET]  | (32px / 4 Grid Units)
+--------------------------------------------------------------+ [Y: 240]
```
- **Top Status Bar (16px):** 2 grid rows. Displays hardware status, connectivity, mini clock, and day/night mode.
- **Hero Display Stage (192px):** 24 grid rows. Dedicated to the single primary hero visualization.
- **Bottom Hotbar (32px):** 4 grid rows. Houses 8 chunky item-slot buttons. Each slot is exactly **40 × 32 pixels** (5 × 4 grid units), spanning the full 320px width without seams or gaps.

### 3.3 Touch Targets
- To ensure reliable actuation on resistive touch digitizers (XPT2046) using fingers, **every interactive touch target must be at least 32 × 32 pixels** (4 × 4 grid units).
- Hotbar buttons exceed this requirement at **40 × 32 pixels**.

---

## 4. Typography & Type Scale

### 4.1 Font Selection & Open License Attribution
- **Primary Typeface:** **`Silkscreen`** (Normal & Bold).
- **Secondary Fallback:** **`Press Start 2P`**.
- **License:** Both fonts are released under the **SIL Open Font License, Version 1.1 (OFL-1.1)**:
  > *Copyright (c) Jason Kottke, Christian Robertson, CodeMan38.*  
  > *Permission is hereby granted, free of charge, to any person obtaining a copy of the Font Software, to use, study, copy, merge, embed, modify, redistribute, and sell modified and unmodified copies of the Font Software.*

### 4.2 Type Scale
| Level | Font Size | Line Height | Usage |
| :--- | :---: | :---: | :--- |
| **Micro** | 8 px | 10 px | Status bar tags, hotbar slot labels, minute indicators |
| **Small** | 10 px | 12 px | Secondary metrics, detail card keys, timestamps |
| **Body** | 12 px | 16 px | Primary labels (1–3 words), button text |
| **Title** | 16 px | 20 px | Screen headers, card hero titles |
| **Hero** | 24 px | 28 px | Hero values, big single-metric readouts |
| **Clock** | 36 px | 40 px | Massive digital clock numbers |

### 4.3 Content Density Constraints
1. **Max 3 Text Elements:** Only 3 distinct text nodes per screen (excluding the hotbar).
2. **Max 12 Words:** Entire screen text sum must not exceed 12 words.
3. **Short Labels:** Every label must be 1 to 3 words maximum.
4. **No Paragraphs / Tables:** Tables, extensive lists (> 3 items), and multi-sentence descriptions are banned from the embedded screen.

---

## 5. RGB565 Hardware Conversion & Firmware Bridge

The ILI9341 display uses a 16-bit RGB565 color representation:
- **Red:** 5 bits (0–31) -> Bits 15..11
- **Green:** 6 bits (0–63) -> Bits 10..5
- **Blue:** 5 bits (0–31) -> Bits 4..0

### Formula
```text
RGB565 = (((R & 0xF8) << 8) | ((G & 0xFC) << 3) | (B >> 3))
```

The source file [`frontend/src/tokens.js`](file:///c:/Users/ASUS/OneDrive/Desktop/cyber%20desk/frontend/src/tokens.js) includes automated generation functions:
- `generateCppHeader()`: Generates `firmware/include/pulsebox_tokens.h` containing `#define` macros for all 32 palette colors.
- `generateCssVariables()`: Generates `:root` CSS custom properties matching the design tokens.

---

## 6. Progressive Disclosure: Behind-the-Tap

1. **Glance First:** The default screen presents only the single hero visual and glanceable status.
2. **Tap for Detail:** Tapping anywhere on the hero stage or tapping a dedicated `[MORE]` block opens a lightweight **Detail View**.
3. **Escape Route:** Every detail view features a prominent **`[< BACK]`** button (at least 32×32px) in the top-left corner.
4. **Safety Gating:** Mutation controls in the browser simulator gracefully display `[AUTH REQUIRED]` notices while leaving read-only telemetry intact.
