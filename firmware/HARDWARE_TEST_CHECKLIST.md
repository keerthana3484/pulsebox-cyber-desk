# PulseBox Cyber Desk — Real Hardware Testing Checklist

This checklist provides a systematic step-by-step procedure for verifying each screen, touch target, animation, power management state, and serial command on the physical ESP32 + 2.8" ILI9341 TFT display hardware.

---

## 1. Bench Setup & Hardware Prerequisite Verification

- [ ] **Wiring Inspection:**
  - Microcontroller: ESP32 DevKit (30-pin, ESP32-D0WD-V3)
  - Display: 2.8" SPI TFT (MSP2807 / ILI9341, 320×240)
  - SPI Bus Pins:
    - CS: `GPIO 5`
    - DC: `GPIO 27`
    - RST: `GPIO 4`
    - MOSI: `GPIO 23`
    - SCK: `GPIO 18`
    - MISO: `GPIO 19`
    - TOUCH_CS: `GPIO 21`
  - Power: Jumper J1 OPEN (powered from 5V/VIN), LED backlight on 3.3V rail.
- [ ] **Serial Console Connection:**
  - Baud rate: `115200 8-N-1`
  - Verify boot heartbeat message appears every 2 seconds: `PULSEBOX HARDWARE FOUND`

---

## 2. Boot & Startup Sequence Verification

- [ ] **Boot Animation Stages:**
  - Send serial command: `boot` (or cycle power)
  - **Stage 1 (T=0ms):** Midnight canvas (#05070D) appears. Cyan text `"PULSEBOX VOXEL INITIALIZING..."` with 16-color progress bar.
  - **Stage 2 (T=600ms):** PulseBot mascot appears in IDLE state (steady visor eyes, cyan beacon). Subtitle: `"PULSE-BOT v2.0"`.
  - **Stage 3 (T=1300ms):** Mascot shifts to HAPPY expression (`^ ^` green eyes, emerald beacon). Subtitle: `"SYSTEM READY"`.
  - **Stage 4 (T=2100ms):** Automatically mounts Dashboard Screen 1 (HOME) with Status Bar and 8-slot Hotbar.

---

## 3. Global Chrome & Navigation Verification

- [ ] **Top Status Bar (Y: 0..15, 16px):**
  - Verify mini `[SIM]` cyan tag is positioned at (X: 4..36).
  - Verify WiFi 3-bar stepped RSSI icon is rendered in emerald at (X: 42..50).
  - Verify pulsing cyan heartbeat dot toggles every 2 seconds at (X: 58).
  - Verify clock `HH:MM` updates in center without full-screen flicker.
  - Verify theme badge reads `NIGHT` in amber.
  - Verify power standby icon (ring with vertical notch) is visible at top-right (X: 286..316).
- [ ] **Bottom Hotbar (Y: 208..239, 32px):**
  - Verify 8 slots evenly fill 320px (each slot is exactly 40px wide):
    - Slot 1 (X: 0..39): `[1 HOME]`
    - Slot 2 (X: 40..79): `[2 SRV]`
    - Slot 3 (X: 80..119): `[3 INC]`
    - Slot 4 (X: 120..159): `[4 COST]`
    - Slot 5 (X: 160..199): `[5 DEP]`
    - Slot 6 (X: 200..239): `[6 WTHR]`
    - Slot 7 (X: 240..279): `[7 TIME]`
    - Slot 8 (X: 280..319): `[8 SET]`
  - Verify active slot has raised cyan border and top pip.
  - Verify inactive slots have beveled cobble/iron finish.
  - Verify tapping any slot switches to that screen with instant touch response.

---

## 4. Screen-by-Screen Verification Checklist

### Screen 1: HOME (System Status & Telemetry)
- [ ] **Overview Screen:**
  - Verify Hero Visual: PulseBot mascot (Happy expression) + Shield icon (16x16 scaled 2x).
  - Verify Hero Metric: `"SYS NOMINAL"` in large Font 4 emerald text.
  - Verify Hero Status: `"UPTIME 4H 12M"` in Font 2 muted text.
  - Verify Action Button: Beveled block `"TELEMETRY ▶"`.
  - Verify total word count: 5 words (Strictly $\le 12$ words).
  - Verify idle animation: Mascot blinks eyes every ~4 seconds without display flicker.
- [ ] **Detail View:**
  - Tap `"TELEMETRY ▶"` (or send serial `detail`).
  - Verify `[◀ BACK]` button at top-left.
  - Verify 2x2 Telemetry Grid:
    - Block 1: `SERVICES: 6/6 ONLINE` (Green)
    - Block 2: `AVG LATENCY: 24 ms` (Cyan)
    - Block 3: `FREE HEAP: 218 KB` (Muted)
    - Block 4: `CPU FREQ: 240 MHz` (White)
  - Tap `[◀ BACK]` to return to Overview.

### Screen 2: SERVERS (Cluster Health)
- [ ] **Overview Screen:**
  - Navigate to Slot 2 (tap `[2 SRV]` or send `srv`).
  - Verify Hero Visual: PulseBot + 5-Heart Voxel Bar (10 HP, full hearts).
  - Verify Hero Metric: `"6/6 ONLINE"` in Font 4 emerald.
  - Verify Hero Status: `"ALL NOMINAL"` in Font 2 muted.
  - Verify Action Button: `"DETAILS ▶"`.
  - Verify word count: 5 words.
- [ ] **Detail View:**
  - Tap `"DETAILS ▶"`.
  - Verify 3 service rows (strictly $\le 3$ items):
    - `API GATEWAY` [24ms] [ONLINE]
    - `AUTH SERVICE` [18ms] [ONLINE]
    - `DATABASE` [12ms] [ONLINE]
  - Tap `[◀ BACK]` to return.

### Screen 3: INCIDENTS (Incident Log)
- [ ] **Overview Screen (Nominal State):**
  - Navigate to Slot 3 (tap `[3 INC]` or send `inc`).
  - Verify Hero Visual: PulseBot + Shield icon.
  - Verify Hero Metric: `"ALL NOMINAL"` in emerald.
  - Verify Hero Status: `"0 ALERTS"` in muted text.
  - Verify Action Button: `"HISTORY ▶"`.
- [ ] **Detail View (Nominal State):**
  - Tap `"HISTORY ▶"`.
  - Verify green circular badge with `"OK"`, `"EMPTY INCIDENT LOG"`.
  - Tap `[◀ BACK]` to return.
- [ ] **Alert / Outage Simulation:**
  - Send serial command: `alert`.
  - Verify Hero Metric immediately updates to `"1 ACTIVE OUTAGE"` in crimson.
  - Verify Hero Status updates to `"CRITICAL ALERT"`.
  - Verify Mascot shifts to WORRIED mood (drooped ears, amber/crimson eyes, pulsing alarm beacon).
  - Verify Action Button changes to `"TRIAGE ▶"` in danger variant.
  - Tap `"TRIAGE ▶"`.
  - Verify active outage card: `[P2 - WARNING] INC-402`, `"Edge Fleet Latency Spike"`.
  - Send serial command: `alert` again to restore nominal state.

### Screen 4: CLOUD COSTS (Cloud Spend & Budget)
- [ ] **Overview Screen:**
  - Navigate to Slot 4 (tap `[4 COST]` or send `cost`).
  - Verify Hero Visual: Vault Crystal icon + XP Level Bar ($1,842 / $2,500 = 74%).
  - Verify Hero Metric: `"$64.20 TODAY"` in cyan.
  - Verify Hero Status: `"BUDGET NORMAL"` in emerald.
  - Verify Action Button: `"DETAILS ▶"`.
  - Verify word count: 5 words.
- [ ] **Detail View:**
  - Tap `"DETAILS ▶"`.
  - Verify Monthly Budget Spend card: `"$1,842 / $2,500 BUDGET"`.
  - Verify Daily Burn tile: `"$58.40/day"`.
  - Verify Infrastructure tile: `"ALL REGIONS OK"`.
  - Tap `[◀ BACK]` to return.

### Screen 5: DEPLOY (Release Pipeline)
- [ ] **Overview Screen:**
  - Navigate to Slot 5 (tap `[5 DEP]` or send `dep`).
  - Verify Hero Visual: Voxel Rocket + Compass icons.
  - Verify Hero Metric: `"v2.4.1 PROD"` in cyan.
  - Verify Hero Status: `"READY TO SHIP"` in emerald.
  - Verify Action Button: `"PIPELINE ▶"`.
  - Verify word count: 6 words.
- [ ] **Detail View:**
  - Tap `"PIPELINE ▶"`.
  - Verify Production Release: `"v2.4.1 [100% CANARY]"`.
  - Verify Staging Target: `"v2.4.2-rc1"` (4/4 CI checks passed).
  - Tap `[◀ BACK]` to return.

### Screen 6: WEATHER (Weather & Clock)
- [ ] **Overview Screen:**
  - Navigate to Slot 6 (tap `[6 WTHR]` or send `wthr`).
  - Verify Hero Visual: Voxel Moon icon (or Sun if Day mode) + Live running clock `HH:MM:SS`.
  - Verify Hero Metric: `"68°F CLEAR"` (Night) or `"72°F SUNNY"` (Day).
  - Verify Hero Status: `"AUSTIN TX"`.
  - Verify Action Button: `"DETAILS ▶"`.
  - Verify word count: 5 words.
- [ ] **Detail View:**
  - Tap `"DETAILS ▶"`.
  - Verify 2x2 Atmospheric Grid:
    - Tile 1: `HUMIDITY: 58%`
    - Tile 2: `WIND SPEED: 8.5 MPH NW`
    - Tile 3: `PRESSURE: 1014 hPa`
    - Tile 4: `UV INDEX: 3 (MODERATE)`
  - Tap `[◀ BACK]` to return.

### Screen 7: FOCUS TIMER (Pomodoro Countdown)
- [ ] **Overview Screen & Countdown:**
  - Navigate to Slot 7 (tap `[7 TIME]` or send `focus`).
  - Verify giant countdown digits (e.g., `24:18`).
  - Verify countdown decrements every second in-place.
  - Verify XP progress bar fills proportionally to elapsed time.
  - Verify Hero Metric: `"FOCUS ACTIVE"` in emerald (or `"FOCUS PAUSED"` in amber).
  - Verify Action Buttons: `"PAUSE"` / `"RESUME"` and `"DETAILS ▶"`.
  - Tap `"PAUSE"`: verify digits freeze, metric changes to `"FOCUS PAUSED"`, button changes to `"RESUME"`.
  - Tap `"RESUME"`: verify countdown resumes without skipping seconds.
- [ ] **Detail View:**
  - Tap `"DETAILS ▶"`.
  - Verify Pomodoro preset buttons: `[25m FOCUS]`, `[5m BREAK]`, `[RESET]`.
  - Tap `[5m BREAK]`: verify timer resets to `05:00`.
  - Tap `[◀ BACK]` to return to overview.

### Screen 8: SETTINGS (Device Configuration)
- [ ] **Overview Screen:**
  - Navigate to Slot 8 (tap `[8 SET]` or send `set`).
  - Verify Hero Visual: Wrench + Battery voxel icons.
  - Verify Hero Metric: `"DEVICE CONFIG"` in cyan.
  - Verify Hero Status: `"SYSTEM READY"` in emerald.
  - Verify Action Button: `"SETTINGS ▶"`.
- [ ] **Detail View & Interactive Toggles:**
  - Tap `"SETTINGS ▶"`.
  - **Audio SFX Toggle:** Tap toggle; verify state switches between `"ENABLED"` and `"MUTED"`.
  - **Auto-Cycle Toggle:** Tap toggle; verify state switches between `"OFF"` and `"ENABLED"`.
  - **Color Palette Toggle:** Tap toggle; verify palette toggles between `"NIGHT"` and `"DAY"`.
  - Verify display inversion adapts immediately without rebooting.
  - Tap `[◀ BACK]` to return.

---

## 5. Power Standby & Double-Tap Wake Verification

- [ ] **Entering Display Sleep:**
  - Tap the top-right power standby icon (X: 286..316, Y: 0..15).
  - Or send serial command: `sleep`
  - Verify display controller goes black (`0x0000`).
  - Verify serial log outputs:
    `[POWER] Tapped Power Icon -> Entering Display Sleep Mode...`
    `[POWER] Display asleep. Double-tap screen within 450ms to wake.`
- [ ] **Single Tap Immunity:**
  - Tap the screen once with a finger or stylus.
  - Verify screen remains completely asleep (single taps ignored).
  - Verify serial log outputs:
    `[POWER] Wake Tap 1 detected. Waiting for Tap 2 within 450ms...`
    `[POWER] Double-tap expired. Staying asleep.`
- [ ] **Valid Double-Tap Wake:**
  - Double-tap screen with two consecutive taps between 50ms and 450ms apart.
  - Verify display controller immediately re-energizes (`SLPOUT`, `DISPON`).
  - Verify active dashboard screen is completely restored without artifacting.
  - Verify serial log outputs:
    `[POWER] Double-tap detected (... ms gap). WAKING DISPLAY!`
    `[POWER] Restored Screen ... Awake.`

---

## 6. Serial UART Diagnostics & Command Verification

Open serial terminal at 115200 baud and send each command to confirm response:
- [ ] `0` or `home` -> Switched to Screen 1: HOME
- [ ] `1` or `srv` -> Switched to Screen 2: SERVERS
- [ ] `2` or `inc` -> Switched to Screen 3: INCIDENTS
- [ ] `3` or `cost` -> Switched to Screen 4: CLOUD
- [ ] `4` or `dep` -> Switched to Screen 5: DEPLOY
- [ ] `5` or `wthr` -> Switched to Screen 6: WEATHER
- [ ] `6` or `time` -> Switched to Screen 7: FOCUS
- [ ] `7` or `set` -> Switched to Screen 8: SETTINGS
- [ ] `detail` or `d` -> Opens Detail View of current screen
- [ ] `back` -> Returns to Hero Overview
- [ ] `alert` -> Toggles incident count (0 <-> 1)
- [ ] `night` -> Re-asserts Night Mode with inverted display
- [ ] `day` -> Switches to warm earth Day Mode
- [ ] `auto` -> Toggles 8-second auto-cycling across all 8 screens
- [ ] `help` -> Displays serial help summary
