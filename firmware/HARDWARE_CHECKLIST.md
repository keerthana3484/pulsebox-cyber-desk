# PulseBox Cyber Desk — Physical Hardware Wiring & Testing Guide

This unified guide combines physical component inspection, hardware wiring, PlatformIO flashing instructions, and real-device verification checklists for the physical ESP32 + 2.8" ILI9341 touch desk fixture.

---

## 1. Verified Hardware Bill of Materials (BOM)

The project has been physically assembled and verified on bench hardware with the following components:

| Component | Part / Model | Role / Specifications | Verification Status |
|:---|:---|:---|:---:|
| **Microcontroller** | ESP32 DevKit (30-pin, ESP32-WROOM-32) | 240 MHz dual-core Xtensa, 320 KB SRAM, 4 MB Flash | **VERIFIED ON HARDWARE** |
| **Display Panel** | 2.8" SPI TFT LCD (ILI9341 / 320×240) | 320 × 240 pixels (landscape), 16-bit RGB565 color | **VERIFIED ON HARDWARE** |
| **Digitizer** | XPT2046 Resistive Touch Controller | SPI touch interface, dedicated chip select | **VERIFIED ON HARDWARE** |
| **Interconnect** | Breadboard & jumper wires / SPI bus | VSPI hardware bus + shared touch lines | **VERIFIED ON HARDWARE** |
| **Power Setup** | Standard USB cable to ESP32 DevKit only | Powers both ESP32 and display module | **VERIFIED ON HARDWARE** |

> [!IMPORTANT]
> **Current Real Hardware Operational Status:**
> - **Display & Touch:** All 8 screens display correctly on the physical 320×240 LCD. Touchscreen navigation works across all 8 hotbar slots and behind-the-tap detail views toggle cleanly.
> - **Display Quality:** No display flicker was observed; dirty-region partial redraws render smoothly.
> - **Current Telemetry:** The firmware (`firmware/src/main.cpp`) is configured to run offline with zero network requests, rendering local mock/demo data for UI validation.
> - **Problems Hit:** None reported during bench bring-up.
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

### Power Setup
The physical device is powered via a standard USB cable connected to the ESP32 DevKit only, which provides power to both the microcontroller and the display module.

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

Use this checklist to track physical behavior on the assembled device:

### Bench Setup & Power-Up
- [x] **Wiring Inspection:** SPI pins (MOSI: 23, SCK: 18, MISO: 19, CS: 5, DC: 27, RST: 4, T_CS: 21) verified matching the wiring table.
- [x] **Power Rail:** Verified powering via standard USB cable to ESP32 DevKit only.
- [ ] **Serial Console Logs:** Serial console at 115200 baud outputs boot sequence logs (configured in firmware).

### Boot Sequence (Configured in `main.cpp`)
- [ ] **Stage 1 (T=0ms):** Initialization canvas appears with 16-color progress bar.
- [ ] **Stage 2 (T=600ms):** PulseBot mascot appears in IDLE state.
- [ ] **Stage 3 (T=1300ms):** Mascot shifts to HAPPY expression.
- [ ] **Stage 4 (T=2100ms):** Automatically mounts Dashboard Screen 1 (HOME).

### Global Navigation & Touchscreen
- [x] **Top Status Bar (16px):** Shows mini `[SIM]` tag, WiFi RSSI icon, pulsing heartbeat dot, clock `HH:MM`, theme badge (`NIGHT`/`DAY`).
- [x] **Bottom Hotbar (32px):** 8 inventory slots fill 320px evenly (40px each): `[1 HOME]`, `[2 SRV]`, `[3 INC]`, `[4 COST]`, `[5 DEP]`, `[6 WTHR]`, `[7 TIME]`, `[8 SET]`.
- [x] **Touchscreen Actuation:** Verified: touchscreen works across all 8 hotbar slots.
- [x] **Behind-The-Tap Detail View:** Verified: tapping hero or action button toggles detail view cleanly; `[◀ BACK]` returns to overview.

### Screen-by-Screen Display Verification (All 8 Screens Verified on Glass)
- [x] **Screen 1: HOME** — Displays correctly (PulseBot mascot + shield icon, `ALL GOOD` status badge, telemetry detail grid).
- [x] **Screen 2: SERVERS** — Displays correctly (5-heart voxel bar, `6 HAPPY` metric, node latency breakdown in detail view).
- [x] **Screen 3: INCIDENTS** — Displays correctly (shield/potion visual, `ALL CLEAR` nominal badge, outage triage detail view).
- [x] **Screen 4: CLOUD COSTS** — Displays correctly (crystal + XP level bar, `ON TRACK` metric, 15-day spend trend in detail view).
- [x] **Screen 5: DEPLOY** — Displays correctly (voxel rocket + compass, `LET'S SHIP` metric, staging/production version cards).
- [x] **Screen 6: WEATHER+CLOCK** — Displays correctly (dynamic sky, live clock digits, temperature + live condition word).
- [x] **Screen 7: FOCUS TIMER** — Displays correctly (countdown digits, XP progress bar, `FOCUS TIME` / `CHILL TIME` toggle, preset buttons in detail view).
- [x] **Screen 8: SETTINGS** — Displays correctly (wrench + battery icons, `SETTINGS` metric, CRT scanline and Day/Night palette toggles in detail view).

### Display Quality & Redraws
- [x] **Display Quality & Flicker:** Verified: no display flicker observed; dirty-region partial redraws render smoothly.
- [ ] **Color Order Configuration:** Configured as `-D TFT_RGB_ORDER=1` in `platformio.ini`.

---

## 5. Problems Hit & Fixes

- **Problems hit during bench bring-up:** None. The firmware compiled, uploaded via PlatformIO, and ran on the physical fixture without hardware issues.

---

## 6. Items Planned for Future Milestones (Not Tested on Hardware)

The following capabilities are marked as planned and have NOT yet been executed on physical hardware:
- [ ] **Wi-Fi Client HTTPS Sync:** Connecting to local WPA2/WPA3 access point and fetching `GET /state` from the Flask backend using the pinned ISRG Root X1 certificate in `ca_cert.h`.
- [ ] **Device Telemetry Posting:** Authenticating with an optional scoped device token (`PULSEBOX_DEVICE_KEY`) to submit health telemetry via `POST /record-health-check`.
- [ ] **Long-Run Thermal & Power Stability:** Benchmarking heat dissipation and power consumption across continuous 24-hour operation.

---

## 7. Serial UART Diagnostics & Debug Commands

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
