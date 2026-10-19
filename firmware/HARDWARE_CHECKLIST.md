# Physical Hardware Identification Checklist

Before connecting any jumper wires or writing code, complete this beginner-friendly inspection. Different manufacturers produce visually similar modules with different pinouts, logic levels, or chips. Verifying these details prevents damaged hardware and hours of troubleshooting.

> [!NOTE]
> **Firmware Data & Network Status Today:**
> The current ESP32 firmware (`firmware/src/main.cpp`) operates entirely offline rendering local mock/demo data for verifying display rendering, dirty-region redraws, touch coordinates, and Day/Night palettes on real glass. It makes **zero network or HTTP requests**.
> Live Wi-Fi connectivity, HTTPS client requests (`GET /state`) with pinned Root CA (`ca_cert.h`), and backend synchronization are planned for future roadmap milestones. Any device token (`PULSEBOX_DEVICE_KEY`) is optional/future, only needed if the device ever posts telemetry data.

---

## 1. ESP32 Development Board Inspection

### A. Metal Can Markings
Inspect the silver rectangular RF shield on the top of the ESP32 board.
- [ ] What is the exact text engraved on the metal can?
  - Examples: `ESP-WROOM-32`, `ESP-WROOM-32D`, `ESP32-WROOM-32E`, `ESP32-S3-WROOM-1`, `ESP32-C3`
  - *Why this matters:* Classic `ESP-WROOM-32` has different hardware SPI pins and memory architectures than `ESP32-S3` or `ESP32-C3`.

### B. Pin Count
Count the total number of header pins on the board (both sides combined):
- [ ] Is your board **30-pin** (15 pins per side) or **38-pin** (19 pins per side)?
  - *Why this matters:* 30-pin and 38-pin boards map GPIO numbers to different physical positions on the edges.

### C. USB-to-UART Bridge Chip
Look at the small black chip located directly behind the micro-USB or USB-C connector:
- [ ] What chip is it?
  - **Square chip** with a silhouetted bird/dragon logo: **CP2102 / CP2104** (Silicon Labs)
  - **Rectangular chip** labeled `CH340G`, `CH340C`, or `CH9102`: WCH USB bridge
  - **No extra chip** (only buttons and dual USB-C ports): Native ESP32-S3 USB
  - *Why this matters:* Tells us which driver Windows needs to detect the board.

### D. Windows Cable & COM Port Verification
1. Connect the ESP32 board to your Windows laptop using your USB cable.
2. Open **Device Manager** in Windows (press `Win + X`, then choose *Device Manager*).
3. Expand the **Ports (COM & LPT)** section.
- [ ] Does a COM port appear when you plug the board in (e.g., `Silicon Labs CP210x USB to UART Bridge (COM3)` or `USB-SERIAL CH340 (COM4)`)?
  - **YES:** Note down the COM port number: `COM___`
  - **NO (Device not recognized / Yellow exclamation mark):** Driver needs to be installed (CP210x or CH34x driver).
  - **NO (Nothing appears at all):** Your USB cable may be a **charge-only cable** without data lines. Try a different USB cable that is confirmed to transfer data with a phone or storage device.

---

## 2. 2.8-inch TFT Display Module Inspection

### A. Module Physical Specifications
- [ ] Display diagonal size: Confirm it is approximately 2.8 inches across the glass active area.
- [ ] Landscape resolution target: 320 × 240 pixels (native portrait is 240 × 320, which is rotated 90° or 270° in firmware).

### B. Silkscreen Labels on the Back of the PCB
Turn the display over and inspect the text printed in white or gold directly on the red or blue PCB.
- [ ] What is the exact title / model printed on the back?
  - Common examples: `2.8" SPI 240x320`, `TJCTM24028-SPI`, `MSP2807`, `ILI9341V`
- [ ] Is there an onboard 3-pin voltage regulator chip (usually a tiny black component labeled `662K` or `AMS1117-3.3` or `U1`)?
  - *Why this matters:* If present, the `VCC` pin can accept either 3.3V or 5V from the ESP32. If absent, `VCC` must strictly be 3.3V.

### C. Exact Header Pin Markings (Read Left to Right)
Write down the exact label of every pin on the display header in order.
Common 14-pin or 18-pin breakouts look like this:

| Pin # | Common Label | Your Display's Actual Silkscreen Label | Function |
| :---: | :---: | :---: | :--- |
| 1 | `VCC` | | Power supply (3.3V or 5V) |
| 2 | `GND` | | Ground (0V) |
| 3 | `CS` | | Display Chip Select (active low) |
| 4 | `RESET` / `RST`| | Display Hardware Reset |
| 5 | `DC` / `RS` | | Data/Command selector |
| 6 | `SDI` / `MOSI`| | SPI Data In (from ESP32 to display) |
| 7 | `SCK` / `CLK` | | SPI Serial Clock |
| 8 | `LED` / `BLK` | | Backlight power control |
| 9 | `SDO` / `MISO`| | SPI Data Out (from display to ESP32) |

---

## 3. Touch Controller Inspection

Look at the back of the display PCB for a second integrated circuit chip:
- [ ] Is there a 16-pin small chip (approx. 4×5 mm) present on the back?
  - Common labels: `XPT2046`, `HR2046`, `TSC2046`, `ADS7843`
  - If yes, note down the chip label: `__________________`
- [ ] Are there touch-specific pins on the header?
  - Common labels: `T_CLK`, `T_CS`, `T_DIN` (MOSI), `T_DO` (MISO), `T_IRQ` (PENIRQ)
- [ ] Or is the footprint **unpopulated** (bare solder pads with no chip soldered on)?
  - *Why this matters:* Many budget 2.8" displays use the same PCB for touch and non-touch variants. If the chip is unpopulated, touch is not physically available and we should rely on the 3 physical push buttons for navigation.

---

## 4. Backlight Power Requirements

Look at the `LED` (or `BLK`) pin:
- [ ] Does the back silkscreen state:
  - `LED: 3.3V`
  - `LED: Connect to 3.3V through resistor`
  - `J1 / J2 solder jumper` for 3.3V/5V selection?
- *Rule of Thumb:* Connecting the backlight directly to 5V will burn out the LEDs. Always verify whether it expects 3.3V or needs a current-limiting resistor (e.g., 47Ω to 100Ω).

---

## 5. Push Buttons & Resistors Inspection

- [ ] Confirm you have **three panel-mount momentary push buttons**.
  - These will be mapped to the simulator's physical controls:
    - Button 1: **PREV** (Cycle backward through screens)
    - Button 2: **NEXT** (Cycle forward through screens)
    - Button 3: **ACTION** (Trigger primary action or wake from standby)
- [ ] Resistors:
  - Inspect the color bands or multimeter reading of your resistors (e.g., 10 kΩ, 1 kΩ, 220 Ω).
  - *Note:* The ESP32 features internal software pull-up resistors (`pinMode(pin, INPUT_PULLUP)`), which often allow wiring push buttons directly between a GPIO pin and GND without needing external resistors.

---

## 6. What to Share Once Inspected

Once you inspect your parts, share the following short summary:
1. ESP32 metal can text (e.g., `ESP-WROOM-32`) and header pin count (30 or 38).
2. Windows COM port detected in Device Manager (e.g., `COM3`).
3. Exact pin names printed on your 2.8" display header.
4. Whether the `XPT2046` touch chip is present or unpopulated.
5. Solder jumpers or voltage notes printed on the display back.
