# PulseBox Cyber Desk — Physical Hardware Wiring & Testing Guide

This unified guide combines physical component inspection, hardware wiring, PlatformIO flashing instructions, and real-device verification checklists for the physical ESP32 + 2.8" ILI9341 touch desk fixture.

---

## 1. Verified Hardware Bill of Materials (BOM)

The project has been physically assembled and verified on bench hardware with the following components:

| Component | Part / Model | Role / Specifications | Verification Status |
|:---|:---|:---|:---:|
| **Microcontroller** | ESP32-WROOM-32 DevKit (30-pin, ESP32-D0WD-V3) | 240 MHz dual-core Xtensa, 320 KB SRAM, 4 MB Flash | **VERIFIED ON HARDWARE** |
| **Display Panel** | 2.8" SPI TFT LCD (MSP2807 / ILI9341) | 320 × 240 pixels (landscape), 16-bit RGB565 color | **VERIFIED ON HARDWARE** |
| **Digitizer** | XPT2046 / HR2046 Resistive Touch Controller | SPI touch interface, dedicated chip select | **VERIFIED ON HARDWARE** |
| **Interconnect** | Breadboard & jumper wires / SPI bus | VSPI hardware bus + shared touch lines | **VERIFIED ON HARDWARE** |
| **USB Interface** | Silicon Labs CP2102 USB-to-UART Bridge | 115200 baud serial monitor & flashing | **VERIFIED ON HARDWARE** |

> [!IMPORTANT]
> **Current Real Hardware Operational Status:**
> - **Display & Touch:** All 8 screens display correctly on real glass. The XPT2046 resistive touchscreen is functional; taps accurately actuate the 8-slot hotbar and open behind-the-tap detail views.
> - **Rendering & Palettes:** 16-color Day and Night palettes render cleanly without color inversion (`TFT_RGB_ORDER=1`). Dirty-region redraws avoid screen-wide flicker.
> - **Current Telemetry:** The firmware (`firmware/src/main.cpp`) operates entirely offline with zero network requests, rendering local mock/demo data for UI validation.
> - **NOT Tested on Hardware:** Wi-Fi connection, live HTTPS synchronization with the Flask backend, and long-run 24h+ thermal/power stability remain untested on physical hardware (marked as planned in the roadmap).

---

## 2. Complete Hardware Wiring Table

Connect the 2.8" ILI9341 TFT display module to the 30-pin ESP32 DevKit according to this pinout:

| Header Pin # | Display Silkscreen Label | ESP32 GPIO Pin | Function / Description |
|:---:|:---|:---|:---|
| **1** | `VCC` | `5V` (or `VIN`) | Power supply (display onboard 3.3V LDO regulator active) |
| **2** | `GND` | `GND` | Common ground reference (0V) |
| **3** | `CS` | `GPIO 5` | Hardware VSPI Display Chip Select (active low) |
| **4** | `RESET` / `RST` | `GPIO 4` | Hardware display reset line |
| **5** | `DC` / `RS` | `GPIO 27` | Data / Command selector (safe GPIO, avoids GPIO 2 strapping) |
| **6** | `SDI` / `MOSI` | `GPIO 23` | Hardware VSPI Master Out Slave In |
| **7** | `SCK` / `CLK` | `GPIO 18` | Hardware VSPI Serial Clock |
| **8** | `LED` / `BLK` | `3.3V` | Backlight power rail |
| **9** | `SDO` / `MISO` | `GPIO 19` | Hardware VSPI Master In Slave Out |
| **10** | `T_CLK` | `GPIO 18` | Touch Serial Clock (shared with VSPI SCK) |
| **11** | `T_CS` | `GPIO 21` | Dedicated Touch Chip Select (active low) |
| **12** | `T_DIN` | `GPIO 23` | Touch MOSI (shared with VSPI MOSI) |
| **13** | `T_DO` | `GPIO 19` | Touch MISO (shared with VSPI MISO) |
| **14** | `T_IRQ` | `NC` | Touch interrupt (software polling used in firmware) |

### Power & Jumper Configuration Notes
- **Jumper J1:** If powering `VCC` from the ESP32's `5V`/`VIN` pin, leave solder jumper J1 on the display back OPEN. If powering strictly from `3.3V`, bridge solder jumper J1 to bypass the onboard regulator.
- **Backlight (`LED`):** Connect to the ESP32 `3.3V` rail. Do NOT connect directly to `5V` without a current-limiting resistor to avoid damaging the LED string.

---

## 3. PlatformIO Build & Upload Instructions

The firmware is configured in `firmware/platformio.ini` using the `esp32_draft` environment:

### Compile Firmware
```bash
cd firmware
pio run -e esp32_draft
```
*(Build footprint: ~22 KB RAM / 6.7%, ~344 KB Flash / 26.2%, zero compiler warnings)*

### Flash to Physical Device
Connect the ESP32 to your workstation via USB cable (confirm COM port in Windows Device Manager):
```bash
cd firmware
pio run -e esp32_draft -t upload
```

### Open Serial Diagnostics Monitor
```bash
pio device monitor -b 115200
```

---

## 4. Hardware Verification Checklist

Use this checklist to confirm proper physical behavior on the assembled device:

### Bench Setup & Power-Up
- [x] **Wiring Inspection:** Verify SPI pins (MOSI: 23, SCK: 18, MISO: 19, CS: 5, DC: 27, RST: 4, T_CS: 21).
- [x] **Power Rail:** Display powers up with white backlight on 3.3V; ESP32 powers via USB.
- [x] **Serial Heartbeat:** Serial console at 115200 baud outputs boot sequence logs.

### Boot Sequence
- [x] **Stage 1 (T=0ms):** Midnight canvas (#05070D) appears with cyan text `"PULSEBOX VOXEL INITIALIZING..."` and 16-color progress bar.
- [x] **Stage 2 (T=600ms):** PulseBot mascot appears in IDLE state with steady visor eyes.
- [x] **Stage 3 (T=1300ms):** Mascot shifts to HAPPY expression with emerald beacon.
- [x] **Stage 4 (T=2100ms):** Automatically mounts Dashboard Screen 1 (HOME) with Status Bar and 8-slot Hotbar.

### Global Navigation & Touchscreen
- [x] **Top Status Bar (16px):** Mini `[SIM]` tag, WiFi RSSI icon, pulsing heartbeat dot, clock `HH:MM`, theme badge (`NIGHT`/`DAY`), power icon.
- [x] **Bottom Hotbar (32px):** 8 inventory slots fill 320px evenly (40px each): `[1 HOME]`, `[2 SRV]`, `[3 INC]`, `[4 COST]`, `[5 DEP]`, `[6 WTHR]`, `[7 TIME]`, `[8 SET]`.
- [x] **Touchscreen Actuation:** Tapping any hotbar slot with finger or stylus switches to that screen.
- [x] **Behind-The-Tap Detail View:** Tapping the hero element or action button opens the detail view; tapping `[◀ BACK]` returns to the overview.

### Screen-by-Screen Display Verification (All 8 Screens Verified)
- [x] **Screen 1: HOME** — Shows PulseBot mascot + shield icon, `ALL GOOD` status badge, telemetry detail grid.
- [x] **Screen 2: SERVERS** — Shows 5-heart voxel bar (10 HP), `6 HAPPY` metric, node latency breakdown in detail view.
- [x] **Screen 3: INCIDENTS** — Shows shield/potion visual, `ALL CLEAR` nominal badge, outage triage detail view.
- [x] **Screen 4: CLOUD COSTS** — Shows vault crystal + XP level bar, `ON TRACK` metric, 15-day spend trend in detail view.
- [x] **Screen 5: DEPLOY** — Shows voxel rocket + compass, `LET'S SHIP` metric, staging/production version cards.
- [x] **Screen 6: WEATHER+CLOCK** — Shows dynamic sky (Sun/Moon), live clock digits, temperature + live condition word.
- [x] **Screen 7: FOCUS TIMER** — Shows large countdown digits, XP progress bar, `FOCUS TIME` / `CHILL TIME` toggle, preset buttons in detail view.
- [x] **Screen 8: SETTINGS** — Shows wrench + battery icons, `SETTINGS` metric, CRT scanline and Day/Night palette toggles in detail view.

### Display Quality & Redraws
- [x] **Palette Fidelity:** Verified 16-color Day and Night palettes match design tokens without color banding.
- [x] **Dirty-Region Redraws:** Mascot eye blinks, status bar clock updates, and focus timer countdown redraw only dirty pixel bounding boxes without flickering the rest of the display.

---

## 5. Items Planned for Future Milestones (Not Tested on Hardware)

The following capabilities are marked as planned and have NOT yet been executed on physical hardware:
- [ ] **Wi-Fi Client HTTPS Sync:** Connecting to local WPA2/WPA3 access point and fetching `GET /state` from the Flask backend using the pinned ISRG Root X1 certificate in `ca_cert.h`.
- [ ] **Device Telemetry Posting:** Authenticating with an optional scoped device token (`PULSEBOX_DEVICE_KEY`) to submit health telemetry via `POST /record-health-check`.
- [ ] **Long-Run Thermal & Power Stability:** Benchmarking heat dissipation and power consumption across continuous 24-hour operation.

---

## 6. Serial UART Diagnostics & Debug Commands

You can interact with the physical device over the USB serial terminal at 115200 baud using these commands:

| Command | Action | Expected Output |
|:---|:---|:---|
| `0` or `home` | Switch to Screen 1 | `[NAV] Switched to Screen 0: HOME` |
| `1` or `srv` | Switch to Screen 2 | `[NAV] Switched to Screen 1: SERVERS` |
| `2` or `inc` | Switch to Screen 3 | `[NAV] Switched to Screen 2: INCIDENTS` |
| `3` or `cost` | Switch to Screen 4 | `[NAV] Switched to Screen 3: CLOUD` |
| `4` or `dep` | Switch to Screen 5 | `[NAV] Switched to Screen 4: DEPLOY` |
| `5` or `wthr` | Switch to Screen 6 | `[NAV] Switched to Screen 5: WEATHER` |
| `6` or `time` | Switch to Screen 7 | `[NAV] Switched to Screen 6: FOCUS` |
| `7` or `set` | Switch to Screen 8 | `[NAV] Switched to Screen 7: SETTINGS` |
| `detail` or `d`| Toggle Detail View | Opens / closes behind-the-tap telemetry grid |
| `alert` | Simulate Outage | Toggles between nominal `ALL CLEAR` and alert `UH OH` |
| `day` | Switch to Day Palette | Renders warm earth / loam / sun palette |
| `night` | Switch to Night Palette | Renders low-glare obsidian / neon mint palette |
| `sleep` | Enter Standby | Display powers down; wakes via 450ms double-tap |
| `help` | Show Commands | Prints full diagnostic help menu |
