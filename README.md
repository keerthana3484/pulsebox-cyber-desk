# PulseBox Cyber Desk

**PulseBox** is a mini cyber desk gadget and desktop dashboard built using **Flask**, an **ESP32** microcontroller, and a **2.8-inch touchscreen** display.

---

## 🌟 Overview

PulseBox bridges physical desk hardware with backend services to provide real-time metrics, notifications, and desktop controls in an ultra-compact cyber desk form factor.

- **Backend:** Flask (Python) REST API & service orchestration
- **Firmware:** ESP32 embedded code powering hardware peripherals and screen rendering
- **Display:** 2.8-inch touchscreen for interactive controls and widget feeds
- **Frontend:** Web interface / UI assets for device configuration and dashboard viewing

---

## 📁 Project Structure

```text
cyber desk/
├── backend/       # Flask application, API routes, and backend logic
├── docs/          # Documentation, schematics, and design notes
├── firmware/      # ESP32 source code, libraries, and board definitions
├── frontend/      # Web UI, dashboard, and styling assets
├── tests/         # Unit and integration test suites
├── .gitignore     # Git ignore rules for Python, environments, and secrets
└── README.md      # Project overview and documentation
```

---

## 🚀 Features

- **Simulated Cluster Telemetry:** 6 microservice nodes with latency history, failure injection, and automated recovery.
- **Incident Detection & Alerts:** Consecutive failure tracking (threshold: 3 failures) with automated incident generation and HTTPS Telegram notifications.
- **Cloud Cost Monitoring:**
  - Real-time spend metrics (Today's spend, Month MTD, Remaining budget, % utilized).
  - 15-day deterministic daily spending trend bar visualization.
  - 4-category service breakdown (Compute, DB, Storage, CDN).
  - Status thresholds: `NORMAL` (<75%), `WARNING` (75%–99.99%), `BUDGET EXCEEDED` (≥100%).
  - In-memory budget settings with quick touchscreen steppers and presets.
  - Decoupled billing provider architecture (`SimulatedBillingProvider`, and stubs for future `AWSBillingProvider` and `AzureBillingProvider`).
  - Clear **SIMULATION MODE** labeling and `"No live billing connection"` status indicator.
- **Weather & Clock Screen:**
  - Large digital clock with live seconds, day of week, and full date using the device/browser's local timezone.
  - Safe interval ticker that cleans up on screen change without duplicate timers.
  - Deterministic simulated weather telemetry with clearly labeled `"DEMO LOCATION"`.
  - Condition symbols, temperature with live °F / °C toggle, feels-like temperature, humidity %, wind speed & direction, and barometric pressure.
  - Visible `[SIM]` badge and `"No live weather connection"` indicator.
  - Decoupled weather provider module (`weatherProvider.js` / `backend/weather.py`) ready for future live adapters (e.g. OpenWeatherMap).
  - Backend disconnection handling with retry state that keeps the clock ticking without showing misleading zero values.
  - Optional quick access to companion focus timer.
- **Dedicated Focus Timer Screen:**
  - High-precision timestamp/deadline-based Pomodoro focus timer with zero clock drift.
  - Pomodoro defaults: 25 minutes of Focus and 5 minutes of Break.
  - Compact preset duration selector: 15m (Quick Sprint), 25m (Standard Pomodoro), and 45m (Deep Focus).
  - Complete control suite: `START`, `PAUSE`, `RESUME`, `RESET`, and `SKIP`.
  - Discard protection: prompts for confirmation before resetting, skipping, or switching presets if an active session is in progress.
  - Large readable digital digits (`MM:SS`) with live gradient progress bar.
  - Distinct session number (`SESS #1`) and completed focus counter (`⚡ N DONE`).
  - Clear visual and audio completion feedback for both Focus and Break completion using synthetic Web Audio SFX (respecting audio mute).
  - 100% offline local engine: zero Flask backend calls or cloud dependencies required.
  - `localStorage` persistence (`pulsebox_focus_timer_v1`) that restores elapsed time across page refreshes.
  - Resilient error handling for corrupt, negative, or stale saved data.
  - *Browser lifecycle note:* The timer uses deadline timestamps and automatically calculates elapsed wall-clock time upon page reopening. While the browser process or machine is shut down, local alarms cannot fire; upon reopening, expired sessions are detected and credited automatically.
- **Minimal 320×240 Touchscreen Simulator:**
  - Cyberpunk matte black & burnt-orange/amber aesthetic.
  - High-density minimal layout optimized for 2.8" landscape display.
  - Hardware buttons emulation, CRT scanline toggle, and serial log output.

---

## 🛠️ Getting Started

### 1. Run the Flask Backend
```powershell
cd backend
python app.py
```
*(Default: `http://127.0.0.1:5000` localhost only. For optional local-network access when testing with an ESP32 on the same trusted Wi-Fi, run `$env:HOST="0.0.0.0"; python app.py`)*


### 2. Run the Frontend Simulator
```powershell
cd frontend
npm run dev
```
*(Simulator runs on `http://localhost:5173`)*

### 3. Run Automated Tests
```powershell
# Backend pytest suite (48 tests)
python -m pytest -v tests/test_backend.py

# Frontend integration tests (153 assertions across 4 suites)
node tests/test_frontend_incidents.js
node tests/test_frontend_costs.js
node tests/test_frontend_weather_clock.js
node tests/test_frontend_focus_timer.js

# Frontend production build
npm run build --prefix frontend
```

---

## 🔄 Continuous Integration (GitHub Actions)

The repository includes an automated GitHub Actions CI workflow configured in [`.github/workflows/ci.yml`](file:///.github/workflows/ci.yml).

### 1. What GitHub Actions Checks
On every push, pull request targeting `main`, or manual trigger (`workflow_dispatch`), GitHub Actions runs on `ubuntu-latest` and verifies:
- **Backend Test Suite:** Executes `python -m pytest -v tests/test_backend.py` covering all 48 tests (endpoints, health thresholds, failure streaks, restore validation, Telegram mock notifications, cost tracking, weather telemetry, reset isolation).
- **Frontend Incidents Suite:** Executes `node tests/test_frontend_incidents.js` (27 assertions verifying nominal, outage, resolved, ordering, and offline states).
- **Frontend Cloud Costs Suite:** Executes `node tests/test_frontend_costs.js` (32 assertions verifying spend cards, utilization thresholds, steppers/presets, zero-budget safety, and backend disconnects).
- **Frontend Weather & Clock Suite:** Executes `node tests/test_frontend_weather_clock.js` (33 assertions verifying digital clock formatting, timer cleanup, SIM labels, unit toggle, and offline fallback).
- **Frontend Focus Timer Suite:** Executes `node tests/test_frontend_focus_timer.js` (61 assertions verifying deadline precision, start/pause/resume/reset/skip, discard confirmation modal, session transitions, audio mute, and localStorage recovery).
- **Production Bundle Build:** Executes `npm run build --prefix frontend` (Vite) ensuring 100% of modules transform and build with zero syntax errors or broken imports.

### 2. How to Push to GitHub & Trigger the Workflow
If your local directory is not yet connected to a remote GitHub repository, initialize and push with:

```powershell
# 1. Initialize git repository (if not already done)
git init

# 2. Add files (respects .gitignore: excludes node_modules, dist, .env, and caches)
git add .

# 3. Commit changes
git commit -m "feat: implement PulseBox Cyber Desk with CI workflow"

# 4. Set default branch to main
git branch -M main

# 5. Link to your remote GitHub repository
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY>.git

# 6. Push to main branch (automatically triggers CI)
git push -u origin main
```

### 3. Where to View Workflow Results
1. Open your repository on GitHub (`https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY>`).
2. Click the **Actions** tab in the top navigation bar.
3. Select the latest workflow run under **CI**.
4. You will see real-time execution logs for each step:
   - 🟢 **Green checkmark:** All tests and the production build succeeded.
   - 🔴 **Red cross:** A step failed and requires attention.

### 4. How to Diagnose a Failed Test or Build
1. In the **Actions** tab, click on the failed workflow run, then click on the **Run Test Suites & Production Build** job.
2. Expand the specific step displaying the red ❌ icon (e.g., `Run backend pytest suite` or `Run frontend focus timer test suite`).
3. Review the terminal output and error message.
4. Reproduce and fix the issue locally using the exact command:
   ```powershell
   # If backend failed:
   python -m pytest -v tests/test_backend.py -k <test_name>

   # If a frontend suite failed:
   node tests/<failed_suite>.js

   # If build failed:
   npm run build --prefix frontend
   ```
5. Commit and push the fix to `main` to trigger a fresh CI verification run.

### 5. Important: CI Verification vs. Production Deployment
- **CI is strictly verification:** The workflow only validates code correctness, runs test assertions, and compiles the production assets inside a clean, temporary Ubuntu container.
- **No live deployment occurs:** The workflow does **NOT** deploy code to live cloud infrastructure, publish web hosts, or flash physical ESP32 microcontrollers.
- **No secrets required:** CI relies entirely on simulated endpoints and mocked external notifications, requiring no real Telegram tokens or external API keys. Production deployment will be configured separately in future steps.


