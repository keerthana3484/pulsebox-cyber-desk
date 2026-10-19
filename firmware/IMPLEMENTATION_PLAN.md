# Firmware Implementation Plan

This roadmap outlines the progressive, step-by-step implementation for bringing up the physical **PulseBox Cyber Desk** hardware. Each phase builds on the previous one, ensuring that issues are caught early before combining display, network, and buttons together.

---

## Phase 1: USB Connection & Serial Bring-Up ("Hello PulseBox")

### Goal
Confirm that the ESP32 board powers on, connects to your Windows laptop, and can be flashed over USB without any errors.

### Steps
1. Plug the ESP32 board into the Windows laptop with a verified data cable.
2. Confirm the COM port in Windows Device Manager (from [`HARDWARE_CHECKLIST.md`](./HARDWARE_CHECKLIST.md)).
3. Flash a minimal 10-line test sketch (`setup()` and `loop()`) that outputs text to the Serial Monitor at 115200 baud:
   ```cpp
   void setup() {
     Serial.begin(115200);
     Serial.println("[PULSEBOX] ESP32 Core Online. Baud: 115200");
   }
   void loop() {
     Serial.println("[HEARTBEAT] System nominal...");
     delay(2000);
   }
   ```
4. Verify that the heartbeat message prints cleanly in the serial monitor.

---

## Phase 2: Information Needed Before Selecting SPI Pins

> [!CAUTION]
> **Do not connect display wires until this information is confirmed!**  
> Connecting outputs to strapping pins or SPI flash pins can prevent the ESP32 from booting or flashing.

Before assigning pins in code, we must account for the following ESP32 hardware rules:

1. **Avoid the Internal Flash Pins (GPIO 6 to 11)**:
   - On almost all ESP32-WROOM boards, GPIO 6, 7, 8, 9, 10, and 11 are connected directly to the internal SPI flash memory chip under the metal can. Using any of these pins will crash the board instantly.

2. **Respect Strapping Pins**:
   - **GPIO 0**: Boot mode select (must be HIGH to boot normally; LOW to enter flash mode).
   - **GPIO 2**: Must be LOW or floating during flashing on many boards; often connected to an onboard blue LED.
   - **GPIO 12**: Voltage selection pin (MTDI). If pulled HIGH during boot, it can set flash voltage incorrectly and cause boot loops.
   - **GPIO 15**: Outputs boot debug logs; must be handled carefully.

3. **Input-Only Pins (GPIO 34, 35, 36/VP, 39/VN)**:
   - These pins have no internal pull-up or pull-down resistors and **cannot output signals**. They cannot be used for display `CS`, `DC`, `MOSI`, `SCK`, or `RST`. They are only suitable for analog sensors or buttons with external pull-ups.

4. **Default Hardware SPI Bus (VSPI)**:
   - On standard ESP32-WROOM boards, the native hardware VSPI bus defaults to:
     - **SCK / Clock:** GPIO 18
     - **MOSI / Data In:** GPIO 23
     - **MISO / Data Out:** GPIO 19
   - Hardware SPI can clock up to 40 MHz for fluid 30+ FPS redraws, whereas arbitrary software-emulated GPIO pins are much slower.

---

## Phase 3: Display Bring-Up & "PULSEBOX ONLINE" Static Screen

### Goal
Wire the ILI9341 display to the verified SPI pins and render a static cyberpunk status screen.

### Steps
1. Wire power and ground:
   - `GND` -> ESP32 `GND`
   - `VCC` -> ESP32 `3.3V` (or `5V` if the display has an onboard 662K regulator)
   - `LED` / `BLK` -> 3.3V (with resistor if required by display silkscreen)
2. Wire SPI control lines:
   - `SCK` -> Hardware SPI Clock (e.g., GPIO 18)
   - `SDI/MOSI` -> Hardware SPI MOSI (e.g., GPIO 23)
   - `SDO/MISO` -> Hardware SPI MISO (e.g., GPIO 19)
   - `CS` -> Dedicated Chip Select (e.g., GPIO 5 or 15)
   - `DC` -> Data/Command (e.g., GPIO 2 or 4)
   - `RESET` -> Hardware Reset (e.g., GPIO 4 or ESP32 EN)
3. Initial Test Screen:
   - Set screen orientation to **Landscape (Rotation 1 or 3)**.
   - Fill background with dark matte-black (`#0B0D12`).
   - Draw an amber accent frame border (`#FFB300`).
   - Render large high-contrast text:
     ```text
     +----------------------------------------+
     | [SIM]  PULSEBOX CYBER DESK   12:00     |
     |----------------------------------------|
     |                                        |
     |           PULSEBOX ONLINE              |
     |       ILI9341 320x240 SPI TFT          |
     |         HARDWARE STAGE READY           |
     |                                        |
     |----------------------------------------|
     | [HOME] [SRV] [INC] [COST] [TIME] [SET] |
     +----------------------------------------+
     ```
4. Verify colors (amber and orange should render correctly; if red and blue are swapped, BGR vs RGB mode is toggled in driver settings).

---

## Phase 4: Push-Button Navigation Controls

### Goal
Wire the three panel-mount buttons and enable cyclic navigation between screens without needing touch input.

### Button Mapping
- **Button 1 (Left):** `PREV` (Move to previous screen)
- **Button 2 (Center):** `ACTION` (Trigger action or wake from standby)
- **Button 3 (Right):** `NEXT` (Move to next screen)

### Implementation
- Connect each button between a safe GPIO pin (e.g., GPIO 25, 26, 27) and `GND`.
- Enable internal pull-ups in software: `pinMode(BUTTON_PIN, INPUT_PULLUP)`.
- Use a 30ms software debounce algorithm to prevent multiple triggers from contact bounce.
- Confirm button presses print to Serial Monitor and change the active screen index (`0` to `7`).

---

## Phase 5: Wi-Fi & Flask Backend Integration

### Goal
Connect the ESP32 to your local Wi-Fi network and poll the existing Flask backend endpoints.

### Steps
1. Connect to local 2.4 GHz Wi-Fi using `WiFi.begin(ssid, password)`.
2. Find the laptop's private IPv4 address on the local network (e.g., `192.168.1.50`).
3. Query the Flask backend (running on laptop with `HOST=0.0.0.0`):
   - `GET http://192.168.1.50:5000/health`
   - `GET http://192.168.1.50:5000/state`
4. Parse the JSON response with `ArduinoJson`:
   - Extract `overall_health` (`NOMINAL`, `DEGRADED`, `CRITICAL`).
   - Extract failed server count and average latency.
5. Render live cluster metrics into the on-screen 2×2 telemetry grid.
6. Offline Handling:
   - If the HTTP request fails or times out (2.5s), display `OFFLINE` badge and maintain last known state without crashing.
   - Ensure local clock continues ticking uninterrupted.

---

## Phase 6: Multi-Screen UI & Feature Expansion

### Goal
Implement native drawing routines for the remaining screens established in the simulator:
- **Screen 1 (Home):** 2×2 cluster telemetry grid.
- **Screen 2 (Servers):** 6-node list with live status dots (`srv-api` to `srv-edge`).
- **Screen 3 (Incidents):** Outage incident log.
- **Screen 4 (Costs):** MTD spend, budget utilization bar, and threshold status.
- **Screen 5 (Weather + Clock):** Digital clock and demo weather.
- **Screen 6 (Focus Timer):** Standalone Pomodoro focus timer (100% offline).
- **Screen 7 (Settings):** Brightness and sleep mode.
- *(Optional)* **Touch Digitizer:** Calibrate XPT2046 touch controller if chip is present on the display module.
