# PulseBox Cyber Desk — ESP32 Firmware

This directory contains the proposed firmware architecture, hardware verification procedures, and implementation roadmap for running the **PulseBox Cyber Desk** native interface directly on an **ESP32 microcontroller** paired with a **2.8-inch ILI9341 SPI TFT display (320×240)**.

> [!IMPORTANT]
> **Status: Hardware Identification Phase (No Firmware Code Written Yet)**  
> Hardware pinouts, board models, voltage levels, and touch controllers vary between manufacturers. To avoid damaging the display or ESP32, **no GPIO wiring or board-specific code has been committed yet**. All wiring and driver code will be configured only after physical hardware details are confirmed using [`HARDWARE_CHECKLIST.md`](./HARDWARE_CHECKLIST.md).

---

## 🏗️ Intended Firmware Architecture

The physical desk gadget will run as a standalone embedded device that communicates with the existing Flask backend over Wi-Fi, while maintaining the same offline independence and visual design language established in the browser simulator.

```
+-------------------------------------------------------------------------+
|                      PULSEBOX FIRMWARE ARCHITECTURE                      |
+-------------------------------------------------------------------------+
|                                                                         |
|  [ LAYER 4: PRESENTATION & UI ENGINE ]                                  |
|  - 320x240 Landscape Frame / Screen State Machine                      |
|  - 8 Screen Views: Home, Servers, Incidents, Costs, Deploy,            |
|                   Weather+Clock, Focus Timer, Settings                  |
|  - Cyberpunk Aesthetics: Matte-black background, Amber/Orange accents   |
|  - Compact Typography: Header status bar (18px), Nav tabs (24px)        |
|                                                                         |
|  [ LAYER 3: STATE & LOCAL ENGINES ]                                     |
|  - System State Cache (Health, Servers, Latency, Incidents, Costs)      |
|  - Local High-Precision Clock (Internal RTC / SNTP sync)                |
|  - Standalone Focus Timer Engine (Pomodoro, 100% offline operable)      |
|  - Offline / Connection State Monitor (SIM / OFFLINE badges)            |
|                                                                         |
|  [ LAYER 2: COMMUNICATION & NETWORKING ]                                |
|  - Wi-Fi Station Manager (Auto-reconnect, Non-blocking)                 |
|  - HTTP REST Client (Consuming Flask backend API endpoints)             |
|    * GET /health, GET /state, POST /simulate-failure, POST /restore     |
|    * GET /incidents, GET /costs, GET /costs/settings, GET /weather      |
|  - ArduinoJson Deserializer (Lightweight memory-bounded JSON parsing)   |
|                                                                         |
|  [ LAYER 1: HARDWARE ABSTRACTION LAYER (HAL) ]                          |
|  - SPI Bus Driver (ILI9341 TFT Display, 40 MHz SPI bus)                |
|  - SPI Touch Controller Driver (XPT2046 Resistive, if present)          |
|  - GPIO Debounced Button Handlers (PREV, NEXT, ACTION push buttons)     |
|  - PWM Backlight Driver (Brightness level control)                      |
|  - UART Serial Monitor (115200 baud diagnostic stream)                  |
|                                                                         |
+-------------------------------------------------------------------------+
```

### Key Architectural Principles

1. **Parity with Browser Simulator**:
   - The on-screen layout matches the exact 320×240 landscape viewport proven in [`frontend/simulator.html`](file:///c:/Users/ASUS/OneDrive/Desktop/cyber%20desk/frontend/simulator.html).
   - The same amber (`#FFB300`), burnt-orange (`#FF5722`), and matte-black (`#0B0D12`) palette is used.

2. **100% Offline Independence for Local Widgets**:
   - The **Focus Timer** and **Local Clock** must continue functioning even when Wi-Fi is disconnected or the Flask backend is stopped.
   - When the backend is unreachable, the device displays `OFFLINE` indicators instead of showing misleading blank or zero values.

3. **Non-Blocking Core Loop**:
   - Display updates, HTTP polling (every 3–5 seconds), button reading, and clock ticking must never block each other.
   - FreeRTOS tasks or non-blocking `millis()` state machines will be used to keep button presses responsive.

4. **Strict Schema Adherence**:
   - The firmware consumes the existing Flask API schemas without requiring any modifications to [`backend/app.py`](file:///c:/Users/ASUS/OneDrive/Desktop/cyber%20desk/backend/app.py).

---

## 📁 Firmware Directory Structure

```text
firmware/
├── README.md                     # This file (Architecture overview)
├── HARDWARE_CHECKLIST.md         # Step-by-step physical inspection guide
├── platformio.ini                # Proposed draft PlatformIO configuration
├── IMPLEMENTATION_PLAN.md        # Phased roadmap from bring-up to backend sync
└── PIN_AND_DRIVER_REQUIREMENTS.md# Detailed requirements for pin mapping & libraries
```

---

## 🚀 Next Step

Read the beginner-friendly inspection guide in [`HARDWARE_CHECKLIST.md`](./HARDWARE_CHECKLIST.md) to inspect your physical components before connecting wires or writing code.
