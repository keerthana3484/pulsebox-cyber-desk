/**
 * =============================================================================
 * PulseBox Cyber Desk — ESP32 Native Voxel Interface (Full 320x240)
 * =============================================================================
 * 
 * Target Hardware:
 * - Microcontroller: ESP32 DevKit (30-pin, ESP32-D0WD-V3 @ 240MHz)
 * - Display: 2.8" SPI TFT (MSP2807 / ILI9341, 320x240 Landscape)
 * - Touch Controller: XPT2046 / HR2046 Resistive Touch
 * 
 * Voxel Architecture & Design Rules (docs/UI_RULES.md):
 * - Canvas: 320x240, 8px modular snap grid (40x30 blocks)
 * - 16-Color Indexed RGB565 Palette (tokens.h): Day & Night modes
 * - 3 Functional Horizontal Bands:
 *     Y:   0..15  (16px) -> Top Status Bar ([SIM] [WIFI] 12:00 [NIGHT] [PWR])
 *     Y:  16..207 (192px)-> Hero Stage / Detail View (1 Hero Element, <=12 words)
 *     Y: 208..239 (32px) -> Hotbar (8 slots x 40px = 320px)
 * - Anti-Flicker: Redraw only dirty regions (countdown, blinks, status clock)
 * - Power Management: Sleep Mode via Top-Right Power Icon & 450ms Double-Tap Wake
 * =============================================================================
 */

#include <Arduino.h>
#include <SPI.h>
#include <TFT_eSPI.h>
#include "tokens.h"
#include "icons.h"
#include "ca_cert.h"

// TFT_eSPI instance (SPI pins configured in platformio.ini build_flags)
TFT_eSPI tft = TFT_eSPI();

// =============================================================================
// Security Audit Logging (Device Actions)
// =============================================================================
void auditLog(const char* action, const char* result, const char* details = nullptr) {
  if (details) {
    Serial.printf("[AUDIT_LOG] %lu | ACTION: %s | RESULT: %s | DETAILS: %s\n", millis(), action, result, details);
  } else {
    Serial.printf("[AUDIT_LOG] %lu | ACTION: %s | RESULT: %s\n", millis(), action, result);
  }
}

// =============================================================================
// State Machine & Navigation
// =============================================================================
enum DeviceState {
  STATE_BOOTING,
  STATE_DASHBOARD,
  STATE_SLEEP,
  STATE_SHUTDOWN
};

enum DashboardScreen {
  SCREEN_HOME = 0,
  SCREEN_SERVERS = 1,
  SCREEN_INCIDENTS = 2,
  SCREEN_CLOUD = 3,
  SCREEN_DEPLOY = 4,
  SCREEN_WEATHER = 5,
  SCREEN_FOCUS = 6,
  SCREEN_SETTINGS = 7,
  SCREEN_COUNT = 8
};

enum MascotMood {
  MOOD_IDLE = 0,
  MOOD_HAPPY = 1,
  MOOD_WORRIED = 2,
  MOOD_CELEBRATING = 3
};

DeviceState deviceState = STATE_BOOTING;
DashboardScreen currentScreen = SCREEN_HOME;
bool showDetailView = false;
bool isNightMode = true; // Night Mode default (low glare, inverted display)

// Animation & Timer Timestamps
unsigned long stateTimer = 0;
int bootPhase = 0;
int shutdownPhase = 0;

unsigned long lastScreenCycle = 0;
bool autoCycleEnabled = false;
const unsigned long SCREEN_CYCLE_INTERVAL = 8000;

unsigned long lastBlinkTime = 0;
bool robotBlinkState = false;
unsigned long lastBeaconTime = 0;
bool beaconPulseState = false;

unsigned long lastHeartbeat = 0;
bool heartbeatToggle = false;

// Double-Tap to Wake State Engine
int wakeTapCount = 0;
unsigned long lastWakeTapTime = 0;
const unsigned long DOUBLE_TAP_MAX_GAP_MS = 450;
const unsigned long DOUBLE_TAP_MIN_GAP_MS = 50;

// Cluster & Telemetry Simulation State
int activeIncidentCount = 0; // 0 = Nominal, 1 = Outage
int failedServerCount = 0;
bool soundMuted = false;

// Focus Timer State (Pomodoro)
bool focusTimerRunning = true;
int focusRemainingSeconds = 25 * 60 - 42; // 24:18 default
unsigned long lastFocusTick = 0;
int focusSessionNumber = 1;
int focusCompletedSessions = 3;

// Forward declarations
void enterSleepMode();
void wakeFromSleepMode();
void renderDashboardScreen(DashboardScreen screen, bool isDetail = false);
void updateFocusTimerDisplay();
void updateStatusBarClockOnly();

// =============================================================================
// Calibrated Touchscreen Engine (320x240 Full Screen)
// =============================================================================
#define TOUCH_ENABLED true

const uint16_t CAL_RAW_X_MIN = 500;
const uint16_t CAL_RAW_X_MAX = 3520;
const uint16_t CAL_RAW_Y_MIN = 390;
const uint16_t CAL_RAW_Y_MAX = 3560;
const uint16_t TOUCH_PRESSURE_THRESHOLD = 300;

bool touchWasPressed = false;
unsigned long lastTouchTime = 0;
const unsigned long TOUCH_DEBOUNCE_MS = 250;

// =============================================================================
// Theme Color Accessors (RGB565)
// =============================================================================
uint16_t getThemeBg()             { return isNightMode ? COLOR_NIGHT_BG : COLOR_DAY_BEDROCK; }
uint16_t getThemePanel()          { return isNightMode ? COLOR_NIGHT_OBSIDIAN : COLOR_DAY_STONE_BASE; }
uint16_t getThemeCard()           { return isNightMode ? COLOR_NIGHT_BEDROCK : COLOR_DAY_DIRT_BASE; }
uint16_t getThemeBorder()         { return isNightMode ? COLOR_NIGHT_COBBLE : COLOR_DAY_STONE_SHADOW; }
uint16_t getThemeBevelShadow()    { return isNightMode ? COLOR_NIGHT_BEVEL : COLOR_DAY_DIRT_DARK; }
uint16_t getThemeBevelHighlight() { return isNightMode ? COLOR_NIGHT_IRON : COLOR_DAY_STONE_LIGHT; }
uint16_t getThemeTextPrimary()    { return isNightMode ? COLOR_NIGHT_WHITE : COLOR_DAY_CLOUD_WHITE; }
uint16_t getThemeTextMuted()      { return isNightMode ? COLOR_NIGHT_GRAY : COLOR_DAY_STONE_LIGHT; }
uint16_t getThemeNominal()        { return isNightMode ? COLOR_NIGHT_EMERALD : COLOR_DAY_GRASS_BASE; }
uint16_t getThemeNominalBright()  { return isNightMode ? COLOR_NIGHT_MINT : COLOR_DAY_GRASS_BRIGHT; }
uint16_t getThemeWarning()        { return isNightMode ? COLOR_NIGHT_AMBER : COLOR_DAY_SAND_GOLD; }
uint16_t getThemeAction()         { return isNightMode ? COLOR_NIGHT_ORANGE : COLOR_DAY_LAVA_ORANGE; }
uint16_t getThemeCritical()       { return isNightMode ? COLOR_NIGHT_CRIMSON : COLOR_DAY_REDSTONE; }
uint16_t getThemeCyan()           { return isNightMode ? COLOR_NIGHT_CYAN : COLOR_DAY_ORE_CYAN; }
uint16_t getThemeBlue()           { return isNightMode ? COLOR_NIGHT_AZURE : COLOR_DAY_SKY_BLUE; }
uint16_t getThemeViolet()         { return isNightMode ? COLOR_NIGHT_VIOLET : COLOR_DAY_WOOD_BARK; }

// =============================================================================
// Voxel UI Drawing Primitives (Strict 8px Grid & Beveled Blocks)
// =============================================================================

/**
 * Draws a beveled voxel block container with 2px highlight and shadow borders.
 */
void drawVoxelBlock(int x, int y, int w, int h, uint16_t fillCol, uint16_t highlightCol, uint16_t shadowCol, int bevel = 2) {
  // Main face fill
  tft.fillRect(x, y, w, h, fillCol);

  // Outer dark contour (1px)
  tft.drawRect(x, y, w, h, getThemeBevelShadow());

  // Top and Left highlight bevels
  tft.fillRect(x + 1, y + 1, w - 2, bevel, highlightCol);
  tft.fillRect(x + 1, y + 1, bevel, h - 2, highlightCol);

  // Bottom and Right shadow bevels
  tft.fillRect(x + 1, y + h - 1 - bevel, w - 2, bevel, shadowCol);
  tft.fillRect(x + w - 1 - bevel, y + 1, bevel, h - 2, shadowCol);
}

/**
 * Draws a beveled block button (Normal, Pressed, or Disabled).
 * Variants: 0=Secondary, 1=Primary/Cyan, 2=Danger/Crimson, 3=Caution/Amber
 */
void drawVoxelButton(int x, int y, int w, int h, const char* label, int variant = 0, bool isPressed = false) {
  uint16_t fillCol, hiCol, shCol, textCol;

  if (variant == 1) { // Primary Cyan
    fillCol = getThemeCyan();
    hiCol = COLOR_NIGHT_WHITE;
    shCol = getThemeBlue();
    textCol = COLOR_NIGHT_BG;
  } else if (variant == 2) { // Danger Red
    fillCol = getThemeCritical();
    hiCol = COLOR_DAY_REDSTONE;
    shCol = COLOR_NIGHT_BEVEL;
    textCol = COLOR_NIGHT_WHITE;
  } else if (variant == 3) { // Caution Amber
    fillCol = getThemeWarning();
    hiCol = COLOR_DAY_SAND_GOLD;
    shCol = COLOR_NIGHT_BEVEL;
    textCol = COLOR_NIGHT_BG;
  } else { // Secondary Cobble/Iron
    fillCol = getThemePanel();
    hiCol = getThemeBevelHighlight();
    shCol = getThemeBevelShadow();
    textCol = getThemeTextPrimary();
  }

  if (isPressed) {
    // Invert bevels on press
    drawVoxelBlock(x, y, w, h, fillCol, shCol, hiCol, 2);
  } else {
    drawVoxelBlock(x, y, w, h, fillCol, hiCol, shCol, 2);
  }

  tft.setTextFont(1);
  tft.setTextColor(textCol, fillCol);
  tft.drawCentreString(label, x + w / 2, y + (h - 8) / 2, 1);
}

/**
 * Draws an original 9x9 voxel heart (0=empty, 1=half, 2=full).
 */
void drawVoxelHeart(int x, int y, int type, int scale = 2) {
  #define H_PIX(px, py, pw, ph, col) tft.fillRect(x + (px)*scale, y + (py)*scale, (pw)*scale, (ph)*scale, col)

  uint16_t borderCol = getThemeBevelShadow();
  uint16_t fillCol = getThemeCritical();
  uint16_t darkFill = COLOR_DAY_REDSTONE;
  uint16_t shineCol = COLOR_NIGHT_WHITE;
  uint16_t bgCol = getThemeCard();

  // Outer border contour
  H_PIX(2, 1, 2, 1, borderCol);
  H_PIX(5, 1, 2, 1, borderCol);
  H_PIX(1, 2, 1, 3, borderCol);
  H_PIX(4, 2, 1, 2, borderCol);
  H_PIX(7, 2, 1, 3, borderCol);
  H_PIX(0, 3, 1, 2, borderCol);
  H_PIX(8, 3, 1, 2, borderCol);
  H_PIX(1, 5, 1, 1, borderCol);
  H_PIX(7, 5, 1, 1, borderCol);
  H_PIX(2, 6, 1, 1, borderCol);
  H_PIX(6, 6, 1, 1, borderCol);
  H_PIX(3, 7, 1, 1, borderCol);
  H_PIX(5, 7, 1, 1, borderCol);
  H_PIX(4, 8, 1, 1, borderCol);

  if (type == 2) { // Full
    H_PIX(2, 2, 2, 3, fillCol);
    H_PIX(5, 2, 2, 3, fillCol);
    H_PIX(1, 3, 7, 3, fillCol);
    H_PIX(2, 6, 5, 1, fillCol);
    H_PIX(3, 7, 3, 1, fillCol);
    H_PIX(4, 8, 1, 1, fillCol);

    // Shine & Shadow
    H_PIX(2, 2, 1, 2, shineCol);
    H_PIX(3, 2, 1, 1, shineCol);
    H_PIX(6, 4, 1, 2, darkFill);
    H_PIX(5, 6, 1, 1, darkFill);
  } else if (type == 1) { // Half
    H_PIX(5, 2, 2, 3, bgCol);
    H_PIX(5, 3, 3, 3, bgCol);
    H_PIX(4, 6, 3, 1, bgCol);
    H_PIX(4, 7, 2, 1, bgCol);

    H_PIX(2, 2, 2, 3, fillCol);
    H_PIX(1, 3, 4, 3, fillCol);
    H_PIX(2, 6, 2, 1, fillCol);
    H_PIX(3, 7, 1, 1, fillCol);
    H_PIX(4, 8, 1, 1, fillCol);

    H_PIX(2, 2, 1, 2, shineCol);
    H_PIX(3, 2, 1, 1, shineCol);
  } else { // Empty
    H_PIX(2, 2, 2, 3, bgCol);
    H_PIX(5, 2, 2, 3, bgCol);
    H_PIX(1, 3, 7, 3, bgCol);
    H_PIX(2, 6, 5, 1, bgCol);
    H_PIX(3, 7, 3, 1, bgCol);
    H_PIX(4, 8, 1, 1, bgCol);
  }

  #undef H_PIX
}

/**
 * Draws a 5-heart cluster bar representing 0 to 10 HP.
 */
void drawVoxelHeartBar(int startX, int startY, int currentHp, int maxHp = 10) {
  int totalHearts = maxHp / 2; // 5 hearts
  for (int i = 0; i < totalHearts; i++) {
    int heartVal = currentHp - (i * 2);
    int type = 0;
    if (heartVal >= 2) type = 2;
    else if (heartVal == 1) type = 1;
    else type = 0;

    drawVoxelHeart(startX + i * 22, startY, type, 2);
  }
}

/**
 * Draws a Voxel XP Progress Bar with Level Indicator.
 */
void drawVoxelXpBar(int x, int y, int w, int h, int current, int max, int level) {
  // Border container
  tft.fillRect(x, y, w, h, getThemeBevelShadow());
  tft.fillRect(x + 1, y + 1, w - 2, h - 2, getThemeCard());

  // Fill calculation
  int fillW = 0;
  if (max > 0) {
    fillW = (w - 4) * current / max;
    fillW = constrain(fillW, 0, w - 4);
  }

  if (fillW > 0) {
    tft.fillRect(x + 2, y + 2, fillW, h - 4, getThemeNominal());
    // 1px top highlight
    tft.fillRect(x + 2, y + 2, fillW, 1, getThemeNominalBright());
  }

  // Level number badge centered
  char lvlBuf[16];
  snprintf(lvlBuf, sizeof(lvlBuf), "%d", level);
  tft.setTextFont(1);
  tft.setTextColor(getThemeNominalBright(), getThemeCard());
  tft.drawCentreString(lvlBuf, x + w / 2, y + (h - 8) / 2, 1);
}

/**
 * Scaled 16x16 PROGMEM Bitmap renderer with transparent key.
 */
void drawIcon16(int x, int y, const uint16_t* icon, int scale = 1, uint16_t transparent = ICON_TRANSPARENT) {
  if (scale == 1) {
    tft.pushImage(x, y, 16, 16, icon, transparent);
  } else {
    for (int iy = 0; iy < 16; iy++) {
      for (int ix = 0; ix < 16; ix++) {
        uint16_t col = pgm_read_word(&icon[iy * 16 + ix]);
        if (col != transparent) {
          tft.fillRect(x + ix * scale, y + iy * scale, scale, scale, col);
        }
      }
    }
  }
}

// =============================================================================
// PulseBot Companion Mascot Engine (28x28 Original Voxel Matrix)
// =============================================================================
void drawPulseBotMascot(int startX, int startY, int scale, MascotMood mood, uint16_t beaconColor) {
  #define P_RECT(x, y, w, h, col) tft.fillRect(startX + (x)*scale, startY + (y)*scale, (w)*scale, (h)*scale, col)

  // 1. Ears
  if (mood == MOOD_WORRIED) {
    // Drooped ears
    P_RECT(4, 5, 2, 3, getThemeAction());
    P_RECT(22, 5, 2, 3, getThemeAction());
  } else {
    P_RECT(5, 3, 2, 2, getThemeAction());
    P_RECT(4, 5, 3, 2, COLOR_DAY_LAVA_ORANGE);
    P_RECT(21, 3, 2, 2, getThemeAction());
    P_RECT(21, 5, 3, 2, COLOR_DAY_LAVA_ORANGE);
  }

  // 2. Antenna Stalk & Beacon
  P_RECT(13, 1, 2, 3, COLOR_DAY_STONE_LIGHT);
  P_RECT(13, 0, 2, 1, beaconColor);

  // 3. Head Base
  P_RECT(5, 6, 18, 13, COLOR_NIGHT_OBSIDIAN);
  P_RECT(4, 8, 20, 9, COLOR_NIGHT_OBSIDIAN);
  P_RECT(6, 5, 16, 15, COLOR_NIGHT_OBSIDIAN);

  // 4. Cyber Face Plates
  P_RECT(6, 6, 16, 1, COLOR_NIGHT_COBBLE);
  P_RECT(4, 9, 1, 7, COLOR_NIGHT_COBBLE);
  P_RECT(23, 9, 1, 7, COLOR_NIGHT_COBBLE);

  // 5. Visor Recess Frame & Dark Screen
  P_RECT(6, 8, 16, 6, getThemeBevelShadow());
  P_RECT(5, 9, 18, 4, COLOR_NIGHT_BG);

  // 6. Eyes according to Mascot Mood
  if (mood == MOOD_HAPPY) {
    // Cheerful ^ ^ smile eyes
    P_RECT(8, 9, 3, 1, getThemeNominal());
    P_RECT(7, 10, 1, 2, getThemeNominal());
    P_RECT(11, 10, 1, 2, getThemeNominal());
    P_RECT(17, 9, 3, 1, getThemeNominal());
    P_RECT(16, 10, 1, 2, getThemeNominal());
    P_RECT(20, 10, 1, 2, getThemeNominal());
    // Mouth
    P_RECT(12, 14, 4, 1, getThemeWarning());
  } else if (mood == MOOD_WORRIED) {
    // Anxious slant eyes / \
    P_RECT(7, 11, 4, 1, getThemeWarning());
    P_RECT(10, 10, 1, 1, getThemeWarning());
    P_RECT(17, 11, 4, 1, getThemeWarning());
    P_RECT(17, 10, 1, 1, getThemeWarning());
    // Crimson pupils
    P_RECT(8, 11, 1, 1, getThemeCritical());
    P_RECT(19, 11, 1, 1, getThemeCritical());
    // Wavy mouth
    P_RECT(11, 15, 6, 1, COLOR_DAY_LAVA_ORANGE);
  } else if (mood == MOOD_CELEBRATING) {
    // Sparkling star eyes + +
    P_RECT(9, 8, 1, 5, COLOR_DAY_SAND_GOLD);
    P_RECT(7, 10, 5, 1, COLOR_DAY_SAND_GOLD);
    P_RECT(9, 10, 1, 1, COLOR_NIGHT_WHITE);
    P_RECT(18, 8, 1, 5, COLOR_DAY_SAND_GOLD);
    P_RECT(16, 10, 5, 1, COLOR_DAY_SAND_GOLD);
    P_RECT(18, 10, 1, 1, COLOR_NIGHT_WHITE);
    // Big open smile
    P_RECT(11, 14, 6, 2, getThemeNominal());
    P_RECT(12, 15, 4, 1, COLOR_NIGHT_WHITE);
    // Confetti / Party Hat
    P_RECT(13, 0, 2, 2, getThemeCritical());
    P_RECT(12, 2, 4, 2, getThemeWarning());
    P_RECT(11, 4, 6, 2, getThemeCyan());
  } else {
    // IDLE: Calm visor eyes
    P_RECT(7, 9, 4, 3, getThemeCyan());
    P_RECT(8, 9, 2, 2, COLOR_NIGHT_WHITE);
    P_RECT(17, 9, 4, 3, getThemeCyan());
    P_RECT(18, 9, 2, 2, COLOR_NIGHT_WHITE);
    // Snout
    P_RECT(13, 14, 2, 1, getThemeWarning());
  }

  // 7. Sensor Whiskers
  P_RECT(2, 12, 2, 1, getThemeAction());
  P_RECT(1, 14, 2, 1, getThemeWarning());
  P_RECT(24, 12, 2, 1, getThemeAction());
  P_RECT(25, 14, 2, 1, getThemeWarning());

  // 8. Neck Collar
  P_RECT(7, 19, 14, 2, COLOR_NIGHT_COBBLE);
  P_RECT(12, 19, 4, 2, getThemeAction());
  P_RECT(13, 20, 2, 2, getThemeWarning());

  #undef P_RECT
}

/**
 * Dirty region update: redrawing only visor eyes to blink without flicker.
 */
void updatePulseBotEyesOnly(int startX, int startY, int scale, MascotMood mood, bool isClosed) {
  #define P_RECT(x, y, w, h, col) tft.fillRect(startX + (x)*scale, startY + (y)*scale, (w)*scale, (h)*scale, col)

  // Clear visor interior (5..22 x 9..12)
  P_RECT(5, 9, 18, 4, COLOR_NIGHT_BG);

  if (isClosed) {
    P_RECT(7, 11, 4, 1, getThemeWarning());
    P_RECT(17, 11, 4, 1, getThemeWarning());
  } else {
    if (mood == MOOD_HAPPY) {
      P_RECT(8, 9, 3, 1, getThemeNominal());
      P_RECT(7, 10, 1, 2, getThemeNominal());
      P_RECT(11, 10, 1, 2, getThemeNominal());
      P_RECT(17, 9, 3, 1, getThemeNominal());
      P_RECT(16, 10, 1, 2, getThemeNominal());
      P_RECT(20, 10, 1, 2, getThemeNominal());
    } else if (mood == MOOD_WORRIED) {
      P_RECT(7, 11, 4, 1, getThemeWarning());
      P_RECT(10, 10, 1, 1, getThemeWarning());
      P_RECT(17, 11, 4, 1, getThemeWarning());
      P_RECT(17, 10, 1, 1, getThemeWarning());
      P_RECT(8, 11, 1, 1, getThemeCritical());
      P_RECT(19, 11, 1, 1, getThemeCritical());
    } else {
      P_RECT(7, 9, 4, 3, getThemeCyan());
      P_RECT(8, 9, 2, 2, COLOR_NIGHT_WHITE);
      P_RECT(17, 9, 4, 3, getThemeCyan());
      P_RECT(18, 9, 2, 2, COLOR_NIGHT_WHITE);
    }
  }

  #undef P_RECT
}

void updatePulseBotBeaconOnly(int startX, int startY, int scale, uint16_t beaconColor) {
  tft.fillRect(startX + 13 * scale, startY + 0 * scale, 2 * scale, 1 * scale, beaconColor);
}

// =============================================================================
// Top Status Bar (Y: 0..15, Height: 16px)
// =============================================================================
void drawStatusBar() {
  // Beveled status strip across full 320px
  tft.fillRect(0, 0, 320, 16, getThemePanel());
  tft.drawFastHLine(0, 15, 320, getThemeBevelShadow());

  tft.setTextFont(1);

  // 1. Mini SIM tag
  tft.fillRect(4, 2, 32, 11, getThemeCard());
  tft.drawRect(4, 2, 32, 11, getThemeBorder());
  tft.setTextColor(getThemeCyan(), getThemeCard());
  tft.drawString("[SIM]", 8, 4);

  // 2. WiFi RSSI Bars (3 stepped bars)
  int wifiX = 42;
  tft.fillRect(wifiX + 0, 10, 2, 3, getThemeNominal());
  tft.fillRect(wifiX + 3, 8, 2, 5, getThemeNominal());
  tft.fillRect(wifiX + 6, 6, 2, 7, getThemeNominal());

  // 3. Heartbeat Indicator Dot
  tft.fillCircle(58, 10, 2, heartbeatToggle ? getThemeCyan() : getThemeBevelShadow());

  // 4. Center Clock Digits
  updateStatusBarClockOnly();

  // 5. Day/Night indicator badge
  tft.fillRect(238, 2, 42, 11, getThemeCard());
  tft.drawRect(238, 2, 42, 11, getThemeBorder());
  tft.setTextColor(getThemeWarning(), getThemeCard());
  tft.drawString(isNightMode ? "NIGHT" : "DAY", 244, 4);

  // 6. Universal Top-Right Power Standby Icon (Touch Target: X=284..316, Y=0..15)
  int px = 286;
  int py = 2;
  tft.fillRect(px, py, 30, 12, getThemeCard());
  tft.drawRect(px, py, 30, 12, getThemeBorder());
  tft.drawCircle(px + 15, py + 6, 4, getThemeCyan());
  tft.drawCircle(px + 15, py + 6, 3, getThemeCyan());
  tft.fillRect(px + 13, py + 1, 5, 3, getThemeCard()); // notch
  tft.drawFastVLine(px + 15, py + 1, 5, getThemeCyan());
}

/**
 * Dirty region update: updates status bar clock without redrawing full bar.
 */
void updateStatusBarClockOnly() {
  if (deviceState != STATE_DASHBOARD) return;

  // Approximate time from millis or focus timer
  unsigned long totalSecs = (millis() / 1000) % 86400;
  int hh = (12 + (totalSecs / 3600)) % 24;
  int mm = (totalSecs % 3600) / 60;
  char timeBuf[10];
  snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d", hh, mm);

  tft.setTextFont(1);
  tft.setTextColor(getThemeTextPrimary(), getThemePanel());
  tft.drawCentreString(timeBuf, 160, 4, 1);
}

// =============================================================================
// Bottom Hotbar Navigation (Y: 208..239, 8 Slots x 40px = 320px)
// =============================================================================
const char* hotbarLabels[SCREEN_COUNT] = {
  "HOME", "SRV", "INC", "COST", "DEP", "WTHR", "TIME", "SET"
};

void drawVoxelHotbar(DashboardScreen activeScreen) {
  int slotW = 40;
  int slotH = 32;
  int startY = 208;

  for (int i = 0; i < SCREEN_COUNT; i++) {
    int x = i * slotW;
    bool isActive = (i == activeScreen);

    if (isActive) {
      // Raised active block: cyan/emerald border with bright inner bevel
      drawVoxelBlock(x, startY, slotW, slotH, getThemePanel(), getThemeCyan(), getThemeBevelShadow(), 2);
      tft.drawRect(x, startY, slotW, slotH, getThemeCyan());
      // Top active tab pip
      tft.fillRect(x + 12, startY + 2, slotW - 24, 2, getThemeCyan());
    } else {
      // Inactive dark inset slot
      drawVoxelBlock(x, startY, slotW, slotH, getThemeCard(), getThemeBevelHighlight(), getThemeBevelShadow(), 1);
    }

    // Number tag in top-left
    char numBuf[4];
    snprintf(numBuf, sizeof(numBuf), "%d", i + 1);
    tft.setTextFont(1);
    tft.setTextColor(isActive ? getThemeCyan() : getThemeTextMuted(), isActive ? getThemePanel() : getThemeCard());
    tft.drawString(numBuf, x + 3, startY + 4);

    // Label centered
    tft.setTextColor(isActive ? COLOR_NIGHT_WHITE : getThemeTextMuted(), isActive ? getThemePanel() : getThemeCard());
    tft.drawCentreString(hotbarLabels[i], x + slotW / 2, startY + 16, 1);
  }
}

// =============================================================================
// Detail View Navigation Header Helper ([◀ BACK] + Title + Badge)
// =============================================================================
void drawDetailHeader(const char* title, const char* badge) {
  // Clear viewport area
  tft.fillRect(0, 16, 320, 192, getThemeBg());

  // Back button (at least 32x32 touch target; visually 64x24)
  drawVoxelButton(6, 20, 64, 24, "◀ BACK", 0, false);

  // Title
  tft.setTextFont(2);
  tft.setTextColor(getThemeCyan(), getThemeBg());
  tft.drawString(title, 80, 24);

  // Badge
  if (badge && strlen(badge) > 0) {
    tft.setTextFont(1);
    tft.setTextColor(getThemeWarning(), getThemeBg());
    tft.drawRightString(badge, 314, 26, 1);
  }

  // Separator line
  tft.drawFastHLine(6, 48, 308, getThemeBorder());
}

// =============================================================================
// Screen Renderers (Strict 1-Second Hero, <= 12 Words, Tap-Through Detail)
// =============================================================================

/**
 * Screen 0: HOME — System Status & Telemetry
 */
void renderHomeScreen(bool isDetail) {
  if (isDetail) {
    drawDetailHeader("SYSTEM TELEMETRY", "[LIVE]");

    // 2x2 Telemetry Grid
    int gw = 148;
    int gh = 64;

    // Tile 1: Services
    drawVoxelBlock(8, 56, gw, gh, getThemeCard(), getThemeBevelHighlight(), getThemeBevelShadow(), 2);
    tft.setTextFont(1);
    tft.setTextColor(getThemeTextMuted(), getThemeCard());
    tft.drawString("SERVICES", 16, 62);
    tft.setTextFont(2);
    tft.setTextColor(failedServerCount == 0 ? getThemeNominal() : getThemeCritical(), getThemeCard());
    tft.drawString(failedServerCount == 0 ? "6/6 ONLINE" : "5/6 DEGRADED", 16, 76);
    tft.setTextFont(1);
    tft.setTextColor(getThemeTextMuted(), getThemeCard());
    tft.drawString("CLUSTER SYNCED", 16, 98);

    // Tile 2: Latency
    drawVoxelBlock(164, 56, gw, gh, getThemeCard(), getThemeBevelHighlight(), getThemeBevelShadow(), 2);
    tft.setTextFont(1);
    tft.setTextColor(getThemeTextMuted(), getThemeCard());
    tft.drawString("AVG LATENCY", 172, 62);
    tft.setTextFont(2);
    tft.setTextColor(getThemeCyan(), getThemeCard());
    tft.drawString("24 ms", 172, 76);
    tft.setTextFont(1);
    tft.setTextColor(getThemeNominal(), getThemeCard());
    tft.drawString("PING NORMAL", 172, 98);

    // Tile 3: Heap
    drawVoxelBlock(8, 126, gw, gh, getThemeCard(), getThemeBevelHighlight(), getThemeBevelShadow(), 2);
    tft.setTextFont(1);
    tft.setTextColor(getThemeTextMuted(), getThemeCard());
    tft.drawString("FREE HEAP", 16, 132);
    tft.setTextFont(2);
    tft.setTextColor(getThemeCyan(), getThemeCard());
    tft.drawString("218 KB", 16, 146);
    tft.setTextFont(1);
    tft.setTextColor(getThemeTextMuted(), getThemeCard());
    tft.drawString("66% FREE", 16, 168);

    // Tile 4: Hardware
    drawVoxelBlock(164, 126, gw, gh, getThemeCard(), getThemeBevelHighlight(), getThemeBevelShadow(), 2);
    tft.setTextFont(1);
    tft.setTextColor(getThemeTextMuted(), getThemeCard());
    tft.drawString("CPU FREQ", 172, 132);
    tft.setTextFont(2);
    tft.setTextColor(getThemeTextPrimary(), getThemeCard());
    tft.drawString("240 MHz", 172, 146);
    tft.setTextFont(1);
    tft.setTextColor(getThemeCyan(), getThemeCard());
    tft.drawString("ESP32-D0WD-V3", 172, 168);

  } else {
    // Clear viewport area
    tft.fillRect(0, 16, 320, 192, getThemeBg());

    // Hero Visual: PulseBot Mascot (Expression: HAPPY / WORRIED) + Shield Icon
    MascotMood mood = (failedServerCount == 0 && activeIncidentCount == 0) ? MOOD_HAPPY : MOOD_WORRIED;
    drawPulseBotMascot(96, 26, 2, mood, mood == MOOD_HAPPY ? getThemeNominal() : getThemeWarning());
    drawIcon16(168, 38, icon_shield_16x16, 2, ICON_TRANSPARENT);

    // Hero Metric: Max 1 text element, 2 words
    tft.setTextFont(4);
    tft.setTextColor(failedServerCount == 0 ? getThemeNominal() : getThemeCritical(), getThemeBg());
    tft.drawCentreString(failedServerCount == 0 ? "SYS NOMINAL" : "SYS DEGRADED", 160, 96, 4);

    // Hero Status: Max 1 text element, 2 words
    tft.setTextFont(2);
    tft.setTextColor(getThemeTextMuted(), getThemeBg());
    tft.drawCentreString("UPTIME 4H 12M", 160, 132, 2);

    // Hero Action Button: 1 word
    drawVoxelButton(90, 164, 140, 30, "TELEMETRY ▶", 0, false);
  }
}

/**
 * Screen 1: SERVERS — Cluster Health & Voxel Heart Bar
 */
void renderServersScreen(bool isDetail) {
  if (isDetail) {
    drawDetailHeader("CLUSTER NODES", "[LIVE]");

    // 3 Server Rows (Strictly <= 3 items per UI_RULES.md)
    const char* srvNames[3] = {"API GATEWAY", "AUTH SERVICE", "DATABASE"};
    const char* srvLat[3] = {"24ms", "18ms", "12ms"};

    for (int i = 0; i < 3; i++) {
      int y = 56 + i * 40;
      drawVoxelBlock(10, y, 300, 34, getThemeCard(), getThemeBevelHighlight(), getThemeBevelShadow(), 1);

      // Status dot
      tft.fillCircle(24, y + 17, 4, getThemeNominal());

      tft.setTextFont(2);
      tft.setTextColor(COLOR_NIGHT_WHITE, getThemeCard());
      tft.drawString(srvNames[i], 38, y + 8);

      tft.setTextFont(1);
      tft.setTextColor(getThemeCyan(), getThemeCard());
      tft.drawRightString(srvLat[i], 230, y + 12, 1);

      tft.setTextColor(getThemeNominal(), getThemeCard());
      tft.drawString("[ONLINE]", 244, y + 12);
    }

    drawVoxelButton(80, 178, 160, 22, "RETEST NODES ▶", 0, false);

  } else {
    tft.fillRect(0, 16, 320, 192, getThemeBg());

    // Hero Visual: PulseBot + Heart Bar (10 HP = 5 Hearts)
    MascotMood mood = (failedServerCount == 0) ? MOOD_HAPPY : MOOD_WORRIED;
    drawPulseBotMascot(60, 28, 2, mood, getThemeNominal());

    int hp = (failedServerCount == 0) ? 10 : 8;
    drawVoxelHeartBar(130, 48, hp, 10);

    // Hero Metric: 2 words
    tft.setTextFont(4);
    tft.setTextColor(failedServerCount == 0 ? getThemeNominal() : getThemeCritical(), getThemeBg());
    tft.drawCentreString(failedServerCount == 0 ? "6/6 ONLINE" : "5/6 ONLINE", 160, 96, 4);

    // Hero Status: 2 words
    tft.setTextFont(2);
    tft.setTextColor(getThemeTextMuted(), getThemeBg());
    tft.drawCentreString(failedServerCount == 0 ? "ALL NOMINAL" : "1 NODE DOWN", 160, 132, 2);

    // Hero Action Button
    drawVoxelButton(90, 164, 140, 30, "DETAILS ▶", 0, false);
  }
}

/**
 * Screen 2: INCIDENTS — Incident Log & Alert Triage
 */
void renderIncidentsScreen(bool isDetail) {
  if (isDetail) {
    drawDetailHeader("INCIDENT LOG", "[SIM]");

    if (activeIncidentCount == 0) {
      // Empty Incident State
      tft.fillCircle(160, 84, 16, getThemeNominal());
      tft.setTextFont(4);
      tft.setTextColor(COLOR_NIGHT_BG, getThemeNominal());
      tft.drawCentreString("OK", 160, 72, 4);

      tft.setTextFont(2);
      tft.setTextColor(getThemeNominal(), getThemeBg());
      tft.drawCentreString("EMPTY INCIDENT LOG", 160, 114, 2);

      tft.setTextFont(1);
      tft.setTextColor(getThemeTextMuted(), getThemeBg());
      tft.drawCentreString("ALL 6 CLUSTER NODES NOMINAL", 160, 136, 1);
      tft.drawCentreString("0 ACTIVE OUTAGES DETECTED", 160, 150, 1);
    } else {
      // Active Outage Card
      drawVoxelBlock(10, 56, 300, 68, getThemeCard(), getThemeCritical(), getThemeBevelShadow(), 2);
      tft.setTextFont(1);
      tft.setTextColor(getThemeCritical(), getThemeCard());
      tft.drawString("[P2 - WARNING]  INC-402", 20, 64);
      tft.setTextFont(2);
      tft.setTextColor(COLOR_NIGHT_WHITE, getThemeCard());
      tft.drawString("Edge Fleet Latency Spike", 20, 80);
      tft.setTextFont(1);
      tft.setTextColor(getThemeTextMuted(), getThemeCard());
      tft.drawString("Traffic rerouted to fallback nodes.", 20, 102);

      // Resolved Card
      drawVoxelBlock(10, 130, 300, 42, getThemePanel(), getThemeBorder(), getThemeBevelShadow(), 1);
      tft.setTextFont(1);
      tft.setTextColor(getThemeNominal(), getThemePanel());
      tft.drawString("[RESOLVED]  INC-391 (4h ago)", 20, 138);
      tft.setTextColor(getThemeTextMuted(), getThemePanel());
      tft.drawString("TLS Certificate Renewal Verified OK", 20, 154);
    }

  } else {
    tft.fillRect(0, 16, 320, 192, getThemeBg());

    // Hero Visual: Mascot + Shield or Alert Potion
    MascotMood mood = (activeIncidentCount == 0) ? MOOD_HAPPY : MOOD_WORRIED;
    drawPulseBotMascot(96, 26, 2, mood, mood == MOOD_HAPPY ? getThemeNominal() : getThemeCritical());
    drawIcon16(168, 38, icon_shield_16x16, 2, ICON_TRANSPARENT);

    // Hero Metric
    tft.setTextFont(4);
    tft.setTextColor(activeIncidentCount == 0 ? getThemeNominal() : getThemeCritical(), getThemeBg());
    tft.drawCentreString(activeIncidentCount == 0 ? "ALL NOMINAL" : "1 ACTIVE OUTAGE", 160, 96, 4);

    // Hero Status
    tft.setTextFont(2);
    tft.setTextColor(activeIncidentCount == 0 ? getThemeTextMuted() : getThemeCritical(), getThemeBg());
    tft.drawCentreString(activeIncidentCount == 0 ? "0 ALERTS" : "CRITICAL ALERT", 160, 132, 2);

    // Hero Action Button
    drawVoxelButton(90, 164, 140, 30, activeIncidentCount == 0 ? "HISTORY ▶" : "TRIAGE ▶", activeIncidentCount == 0 ? 0 : 2, false);
  }
}

/**
 * Screen 3: CLOUD — Cloud Costs & Budget XP Bar
 */
void renderCloudCostsScreen(bool isDetail) {
  if (isDetail) {
    drawDetailHeader("CLOUD COSTS", "[SIM]");

    // Monthly Spend Tile
    drawVoxelBlock(10, 56, 300, 60, getThemeCard(), getThemeBevelHighlight(), getThemeBevelShadow(), 2);
    tft.setTextFont(1);
    tft.setTextColor(getThemeTextMuted(), getThemeCard());
    tft.drawString("MONTHLY BUDGET SPEND", 20, 64);
    tft.setTextFont(4);
    tft.setTextColor(getThemeCyan(), getThemeCard());
    tft.drawString("$1,842", 20, 78);
    tft.setTextFont(2);
    tft.setTextColor(getThemeTextMuted(), getThemeCard());
    tft.drawString("/ $2,500 BUDGET", 124, 84);

    // Progress
    tft.drawRect(20, 104, 280, 6, getThemeBorder());
    tft.fillRect(21, 105, 206, 4, getThemeCyan());

    // Daily Burn Tile
    drawVoxelBlock(10, 122, 145, 52, getThemePanel(), getThemeBorder(), getThemeBevelShadow(), 1);
    tft.setTextFont(1);
    tft.setTextColor(getThemeTextMuted(), getThemePanel());
    tft.drawString("EST. DAILY BURN", 18, 128);
    tft.setTextFont(2);
    tft.setTextColor(COLOR_NIGHT_WHITE, getThemePanel());
    tft.drawString("$58.40/day", 18, 144);

    // Regions Tile
    drawVoxelBlock(165, 122, 145, 52, getThemePanel(), getThemeBorder(), getThemeBevelShadow(), 1);
    tft.setTextFont(1);
    tft.setTextColor(getThemeTextMuted(), getThemePanel());
    tft.drawString("INFRASTRUCTURE", 173, 128);
    tft.setTextFont(2);
    tft.setTextColor(getThemeNominal(), getThemePanel());
    tft.drawString("ALL REGIONS OK", 173, 144);

  } else {
    tft.fillRect(0, 16, 320, 192, getThemeBg());

    // Hero Visual: Crystal Icon + XP Progress Bar ($1,842 / $2,500 = 74%)
    drawIcon16(144, 26, icon_crystal_16x16, 2, ICON_TRANSPARENT);
    drawVoxelXpBar(40, 66, 240, 12, 74, 100, 74);

    // Hero Metric
    tft.setTextFont(4);
    tft.setTextColor(getThemeCyan(), getThemeBg());
    tft.drawCentreString("$64.20 TODAY", 160, 96, 4);

    // Hero Status
    tft.setTextFont(2);
    tft.setTextColor(getThemeNominal(), getThemeBg());
    tft.drawCentreString("BUDGET NORMAL", 160, 132, 2);

    // Hero Action Button
    drawVoxelButton(90, 164, 140, 30, "DETAILS ▶", 0, false);
  }
}

/**
 * Screen 4: DEPLOY — Release Pipeline & Rollout
 */
void renderDeployScreen(bool isDetail) {
  if (isDetail) {
    drawDetailHeader("RELEASE PIPELINE", "[SIM]");

    // Production release block
    drawVoxelBlock(10, 56, 300, 56, getThemeCard(), getThemeNominal(), getThemeBevelShadow(), 2);
    tft.setTextFont(1);
    tft.setTextColor(getThemeTextMuted(), getThemeCard());
    tft.drawString("PRODUCTION RELEASE", 20, 64);
    tft.setTextFont(4);
    tft.setTextColor(getThemeCyan(), getThemeCard());
    tft.drawString("v2.4.1", 20, 78);
    tft.setTextFont(2);
    tft.setTextColor(getThemeNominal(), getThemeCard());
    tft.drawRightString("[100% CANARY]", 300, 84, 2);

    // Staging target block
    drawVoxelBlock(10, 120, 300, 56, getThemePanel(), getThemeBorder(), getThemeBevelShadow(), 1);
    tft.setTextFont(1);
    tft.setTextColor(getThemeCyan(), getThemePanel());
    tft.drawString("STAGING TARGET: v2.4.2-rc1", 20, 128);
    tft.setTextColor(getThemeTextMuted(), getThemePanel());
    tft.drawString("CI/CD AUTOMATION: 4/4 CHECKS PASSED", 20, 144);
    tft.setTextColor(getThemeNominal(), getThemePanel());
    tft.drawString("STATUS: READY TO SHIP", 20, 158);

  } else {
    tft.fillRect(0, 16, 320, 192, getThemeBg());

    // Hero Visual: Rocket + Compass Icons
    drawIcon16(120, 26, icon_rocket_16x16, 2, ICON_TRANSPARENT);
    drawIcon16(168, 38, icon_compass_16x16, 2, ICON_TRANSPARENT);

    // Hero Metric
    tft.setTextFont(4);
    tft.setTextColor(getThemeCyan(), getThemeBg());
    tft.drawCentreString("v2.4.1 PROD", 160, 96, 4);

    // Hero Status
    tft.setTextFont(2);
    tft.setTextColor(getThemeNominal(), getThemeBg());
    tft.drawCentreString("READY TO SHIP", 160, 132, 2);

    // Hero Action Button
    drawVoxelButton(90, 164, 140, 30, "PIPELINE ▶", 0, false);
  }
}

/**
 * Screen 5: WEATHER — Dynamic Sky, Clock & Atmospheric Telemetry
 */
void renderWeatherScreen(bool isDetail) {
  if (isDetail) {
    drawDetailHeader("WEATHER + CLOCK", "[SIM]");

    // Atmospheric Telemetry 2x2 Grid
    int gw = 148;
    int gh = 56;

    // Tile 1: Humidity
    drawVoxelBlock(8, 56, gw, gh, getThemeCard(), getThemeBevelHighlight(), getThemeBevelShadow(), 1);
    tft.setTextFont(1);
    tft.setTextColor(getThemeTextMuted(), getThemeCard());
    tft.drawString("HUMIDITY", 16, 64);
    tft.setTextFont(2);
    tft.setTextColor(getThemeCyan(), getThemeCard());
    tft.drawString("58%", 16, 80);

    // Tile 2: Wind
    drawVoxelBlock(164, 56, gw, gh, getThemeCard(), getThemeBevelHighlight(), getThemeBevelShadow(), 1);
    tft.setTextFont(1);
    tft.setTextColor(getThemeTextMuted(), getThemeCard());
    tft.drawString("WIND SPEED", 172, 64);
    tft.setTextFont(2);
    tft.setTextColor(getThemeTextPrimary(), getThemeCard());
    tft.drawString("8.5 MPH NW", 172, 80);

    // Tile 3: Barometer
    drawVoxelBlock(8, 120, gw, gh, getThemeCard(), getThemeBevelHighlight(), getThemeBevelShadow(), 1);
    tft.setTextFont(1);
    tft.setTextColor(getThemeTextMuted(), getThemeCard());
    tft.drawString("PRESSURE", 16, 128);
    tft.setTextFont(2);
    tft.setTextColor(getThemeTextPrimary(), getThemeCard());
    tft.drawString("1014 hPa", 16, 144);

    // Tile 4: UV Index
    drawVoxelBlock(164, 120, gw, gh, getThemeCard(), getThemeBevelHighlight(), getThemeBevelShadow(), 1);
    tft.setTextFont(1);
    tft.setTextColor(getThemeTextMuted(), getThemeCard());
    tft.drawString("UV INDEX", 172, 128);
    tft.setTextFont(2);
    tft.setTextColor(getThemeWarning(), getThemeCard());
    tft.drawString("3 (MODERATE)", 172, 144);

  } else {
    tft.fillRect(0, 16, 320, 192, getThemeBg());

    // Hero Visual: Dynamic Voxel Sky Icon (Sun if Day, Moon if Night) + Giant Clock Digits
    if (isNightMode) {
      drawIcon16(80, 30, icon_moon_16x16, 2, ICON_TRANSPARENT);
    } else {
      drawIcon16(80, 30, icon_sun_16x16, 2, ICON_TRANSPARENT);
    }

    // Live clock digits
    unsigned long totalSecs = (millis() / 1000) % 86400;
    int hh = (12 + (totalSecs / 3600)) % 24;
    int mm = (totalSecs % 3600) / 60;
    int ss = totalSecs % 60;
    char timeStr[12];
    snprintf(timeStr, sizeof(timeStr), "%02d:%02d:%02d", hh, mm, ss);

    tft.setTextFont(4);
    tft.setTextColor(getThemeCyan(), getThemeBg());
    tft.drawString(timeStr, 130, 34, 4);

    // Hero Metric
    tft.setTextFont(4);
    tft.setTextColor(getThemeNominal(), getThemeBg());
    tft.drawCentreString(isNightMode ? "68°F CLEAR" : "72°F SUNNY", 160, 96, 4);

    // Hero Status
    tft.setTextFont(2);
    tft.setTextColor(getThemeTextMuted(), getThemeBg());
    tft.drawCentreString("AUSTIN TX", 160, 132, 2);

    // Hero Action Button
    drawVoxelButton(90, 164, 140, 30, "DETAILS ▶", 0, false);
  }
}

/**
 * Screen 6: FOCUS — Pomodoro Focus Timer & XP Progress Bar
 */
void renderFocusScreen(bool isDetail) {
  if (isDetail) {
    drawDetailHeader("TIMER CONTROLS", "[POMODORO]");

    // Preset Options
    tft.setTextFont(1);
    tft.setTextColor(getThemeTextMuted(), getThemeBg());
    tft.drawString("PRESETS:", 16, 62);

    drawVoxelButton(16, 76, 88, 30, "25m FOCUS", 1, false);
    drawVoxelButton(114, 76, 88, 30, "5m BREAK", 0, false);
    drawVoxelButton(212, 76, 88, 30, "RESET", 2, false);

    // Session Statistics
    drawVoxelBlock(16, 120, 288, 56, getThemeCard(), getThemeBevelHighlight(), getThemeBevelShadow(), 1);
    tft.setTextFont(1);
    tft.setTextColor(getThemeCyan(), getThemeCard());
    tft.drawString("POMODORO SESSION STATS", 26, 128);
    tft.setTextColor(COLOR_NIGHT_WHITE, getThemeCard());
    tft.drawString("Completed Today: 3 Sessions (75 min total)", 26, 144);
    tft.setTextColor(getThemeNominal(), getThemeCard());
    tft.drawString("Daily Streak Active  //  Goal: 4 Sessions", 26, 158);

  } else {
    tft.fillRect(0, 16, 320, 192, getThemeBg());

    // Large Digital Countdown (Font 6 or Font 4)
    int mins = focusRemainingSeconds / 60;
    int secs = focusRemainingSeconds % 60;
    char timeBuf[16];
    snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d", mins, secs);

    tft.setTextColor(getThemeCyan(), getThemeBg());
    tft.drawCentreString(timeBuf, 160, 26, 6);

    // XP Progress Bar (elapsed time)
    int totalSecs = 25 * 60;
    int elapsed = totalSecs - focusRemainingSeconds;
    drawVoxelXpBar(40, 88, 240, 12, elapsed, totalSecs, focusSessionNumber);

    // Hero Metric: 2 words
    tft.setTextFont(2);
    tft.setTextColor(focusTimerRunning ? getThemeNominal() : getThemeWarning(), getThemeBg());
    tft.drawCentreString(focusTimerRunning ? "FOCUS ACTIVE" : "FOCUS PAUSED", 160, 110, 2);

    // Hero Status: 2 words
    tft.setTextFont(1);
    tft.setTextColor(getThemeTextMuted(), getThemeBg());
    tft.drawCentreString("SESSION #1", 160, 134, 1);

    // Action Buttons: PAUSE/START + DETAILS
    drawVoxelButton(40, 160, 110, 32, focusTimerRunning ? "PAUSE" : "RESUME", focusTimerRunning ? 3 : 1, false);
    drawVoxelButton(170, 160, 110, 32, "DETAILS ▶", 0, false);
  }
}

/**
 * Dirty region update: updates countdown digits & XP fill without full screen refresh.
 */
void updateFocusTimerDisplay() {
  if (deviceState != STATE_DASHBOARD || currentScreen != SCREEN_FOCUS || showDetailView) return;

  int mins = focusRemainingSeconds / 60;
  int secs = focusRemainingSeconds % 60;
  char timeBuf[16];
  snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d", mins, secs);

  // Digits bounding rect: localized redraw
  tft.fillRect(60, 26, 200, 52, getThemeBg());
  tft.setTextColor(getThemeCyan(), getThemeBg());
  tft.drawCentreString(timeBuf, 160, 26, 6);

  // Progress Bar localized fill
  int totalSecs = 25 * 60;
  int elapsed = totalSecs - focusRemainingSeconds;
  drawVoxelXpBar(40, 88, 240, 12, elapsed, totalSecs, focusSessionNumber);
}

/**
 * Screen 7: SETTINGS — Device Configuration & System Parameters
 */
void renderSettingsScreen(bool isDetail) {
  if (isDetail) {
    drawDetailHeader("DEVICE CONFIG", "[ESP32]");

    // Setting 1: Audio SFX
    drawVoxelBlock(16, 56, 288, 34, getThemeCard(), getThemeBevelHighlight(), getThemeBevelShadow(), 1);
    tft.setTextFont(1);
    tft.setTextColor(COLOR_NIGHT_WHITE, getThemeCard());
    tft.drawString("AUDIO SFX BUZZER", 26, 68);
    drawVoxelButton(220, 61, 74, 24, soundMuted ? "MUTED" : "ENABLED", soundMuted ? 0 : 1, false);

    // Setting 2: Auto-Cycle
    drawVoxelBlock(16, 96, 288, 34, getThemeCard(), getThemeBevelHighlight(), getThemeBevelShadow(), 1);
    tft.setTextFont(1);
    tft.setTextColor(COLOR_NIGHT_WHITE, getThemeCard());
    tft.drawString("AUTO-CYCLE SCREENS", 26, 108);
    drawVoxelButton(220, 101, 74, 24, autoCycleEnabled ? "ENABLED" : "OFF", autoCycleEnabled ? 1 : 0, false);

    // Setting 3: Night / Day Palette
    drawVoxelBlock(16, 134, 288, 30, getThemeCard(), getThemeBevelHighlight(), getThemeBevelShadow(), 1);
    tft.setTextFont(1);
    tft.setTextColor(COLOR_NIGHT_WHITE, getThemeCard());
    tft.drawString("COLOR PALETTE", 26, 144);
    drawVoxelButton(220, 138, 74, 22, isNightMode ? "NIGHT" : "DAY", isNightMode ? 0 : 3, false);

    // Setting 4: Factory Reset (Destructive Action: Enforces Hold-to-Confirm >= 1.5s)
    drawVoxelBlock(16, 168, 288, 28, getThemeCard(), getThemeCritical(), getThemeBevelShadow(), 1);
    tft.setTextFont(1);
    tft.setTextColor(getThemeCritical(), getThemeCard());
    tft.drawString("FACTORY RESET", 26, 176);
    drawVoxelButton(200, 171, 94, 22, "HOLD 1.5s", 2, false);

  } else {
    tft.fillRect(0, 16, 320, 192, getThemeBg());

    // Hero Visual: Wrench + Battery Icons
    drawIcon16(120, 26, icon_wrench_16x16, 2, ICON_TRANSPARENT);
    drawIcon16(168, 38, icon_battery_16x16, 2, ICON_TRANSPARENT);

    // Hero Metric
    tft.setTextFont(4);
    tft.setTextColor(getThemeCyan(), getThemeBg());
    tft.drawCentreString("DEVICE CONFIG", 160, 96, 4);

    // Hero Status
    tft.setTextFont(2);
    tft.setTextColor(getThemeNominal(), getThemeBg());
    tft.drawCentreString("SYSTEM READY", 160, 132, 2);

    // Hero Action Button
    drawVoxelButton(90, 164, 140, 30, "SETTINGS ▶", 0, false);
  }
}

/**
 * Universal Dashboard Screen Dispatcher.
 */
void renderDashboardScreen(DashboardScreen screen, bool isDetail) {
  currentScreen = screen;
  showDetailView = isDetail;

  drawStatusBar();
  drawVoxelHotbar(currentScreen);

  switch (screen) {
    case SCREEN_HOME:      renderHomeScreen(showDetailView); break;
    case SCREEN_SERVERS:   renderServersScreen(showDetailView); break;
    case SCREEN_INCIDENTS: renderIncidentsScreen(showDetailView); break;
    case SCREEN_CLOUD:     renderCloudCostsScreen(showDetailView); break;
    case SCREEN_DEPLOY:    renderDeployScreen(showDetailView); break;
    case SCREEN_WEATHER:   renderWeatherScreen(showDetailView); break;
    case SCREEN_FOCUS:     renderFocusScreen(showDetailView); break;
    case SCREEN_SETTINGS:  renderSettingsScreen(showDetailView); break;
    default:               renderHomeScreen(showDetailView); break;
  }

  Serial.printf("[NAV] Switched to Screen %d: %s [%s]\n", 
                currentScreen + 1, hotbarLabels[currentScreen], showDetailView ? "DETAIL" : "OVERVIEW");
}

// =============================================================================
// Startup & Shutdown Animation Routines
// =============================================================================
void startBootAnimation() {
  deviceState = STATE_BOOTING;
  bootPhase = 0;
  stateTimer = millis();
  tft.fillScreen(COLOR_NIGHT_BG);
  Serial.println("[BOOT] PULSEBOX VOXEL INTERFACE INITIALIZING...");
}

void updateBootSequence(unsigned long now) {
  unsigned long elapsed = now - stateTimer;

  if (bootPhase == 0) {
    tft.fillScreen(COLOR_NIGHT_BG);
    tft.setTextFont(2);
    tft.setTextColor(COLOR_NIGHT_CYAN, COLOR_NIGHT_BG);
    tft.drawString("PULSEBOX VOXEL INITIALIZING...", 36, 40);

    tft.setTextFont(1);
    tft.setTextColor(COLOR_NIGHT_VIOLET, COLOR_NIGHT_BG);
    tft.drawString("ESP32-D0WD-V3 @ 240MHz  |  ILI9341 SPI 320x240", 28, 75);
    tft.drawString("LOADING 16-COLOR RGB565 VOXEL DESIGN ENGINE...", 26, 94);

    drawVoxelBlock(40, 130, 240, 10, COLOR_NIGHT_BEDROCK, COLOR_NIGHT_IRON, COLOR_NIGHT_BEVEL, 1);
    tft.fillRect(42, 132, 90, 6, COLOR_NIGHT_CYAN);

    bootPhase = 1;
    stateTimer = now;
  } else if (bootPhase == 1 && elapsed > 600) {
    tft.fillScreen(COLOR_NIGHT_BG);
    drawPulseBotMascot(132, 40, 2, MOOD_IDLE, COLOR_NIGHT_CYAN);

    tft.setTextFont(2);
    tft.setTextColor(COLOR_NIGHT_CYAN, COLOR_NIGHT_BG);
    tft.drawCentreString("PULSE-BOT v2.0", 160, 116, 2);

    tft.setTextFont(1);
    tft.setTextColor(COLOR_NIGHT_GRAY, COLOR_NIGHT_BG);
    tft.drawCentreString("MOUNTING VOXEL DASHBOARD...", 160, 140, 1);

    bootPhase = 2;
    stateTimer = now;
  } else if (bootPhase == 2 && elapsed > 700) {
    drawPulseBotMascot(132, 40, 2, MOOD_HAPPY, COLOR_NIGHT_EMERALD);

    tft.fillRect(60, 138, 200, 20, COLOR_NIGHT_BG);
    tft.setTextFont(2);
    tft.setTextColor(COLOR_NIGHT_EMERALD, COLOR_NIGHT_BG);
    tft.drawCentreString("SYSTEM READY", 160, 140, 2);

    bootPhase = 3;
    stateTimer = now;
  } else if (bootPhase == 3 && elapsed > 800) {
    deviceState = STATE_DASHBOARD;
    currentScreen = SCREEN_HOME;
    showDetailView = false;
    renderDashboardScreen(currentScreen, false);
    lastScreenCycle = now;
    Serial.println("[BOOT] Voxel UI mounted successfully.");
  }
}

void startShutdownAnimation() {
  deviceState = STATE_SHUTDOWN;
  shutdownPhase = 0;
  stateTimer = millis();
  Serial.println("[POWER] SHUTTING DOWN VOXEL DISPLAY...");
}

void updateShutdownSequence(unsigned long now) {
  unsigned long elapsed = now - stateTimer;

  if (shutdownPhase == 0) {
    tft.fillScreen(COLOR_NIGHT_BG);
    drawPulseBotMascot(132, 40, 2, MOOD_HAPPY, COLOR_NIGHT_EMERALD);

    tft.setTextFont(2);
    tft.setTextColor(COLOR_NIGHT_CYAN, COLOR_NIGHT_BG);
    tft.drawCentreString("SHUTTING DOWN...", 160, 116, 2);
    tft.drawCentreString("SEE YOU SOON!", 160, 140, 2);

    shutdownPhase = 1;
    stateTimer = now;
  } else if (shutdownPhase == 1 && elapsed > 1000) {
    tft.fillScreen(0x0000);
    Serial.println("[POWER] Screen offline. Send 'boot' to restart.");
    shutdownPhase = 2;
  }
}

// =============================================================================
// Power Sleep & Double-Tap Wake Engine
// =============================================================================
void enterSleepMode() {
  if (deviceState == STATE_SLEEP) return;
  Serial.println("[POWER] Tapped Power Icon -> Entering Display Sleep Mode...");
  deviceState = STATE_SLEEP;

  // Clear display buffer to black
  tft.fillScreen(0x0000);

  // Command ILI9341 controller to sleep
  tft.writecommand(0x28); // DISPOFF
  delay(10);
  tft.writecommand(0x10); // SLPIN
  delay(120);

  wakeTapCount = 0;
  lastWakeTapTime = 0;
  touchWasPressed = false;
  Serial.println("[POWER] Display asleep. Double-tap screen within 450ms to wake.");
}

void wakeFromSleepMode() {
  Serial.println("[POWER] Double-tap confirmed! Waking display controller...");
  deviceState = STATE_DASHBOARD;

  tft.writecommand(0x11); // SLPOUT
  delay(120);
  tft.writecommand(0x29); // DISPON
  tft.invertDisplay(isNightMode);

  touchWasPressed = true;
  lastTouchTime = millis() + 350;

  renderDashboardScreen(currentScreen, showDetailView);
  Serial.printf("[POWER] Restored Screen %d. Awake.\n", currentScreen + 1);
}

// =============================================================================
// Process Touch Input (Navigation & Double-Tap Wake)
// =============================================================================
void processTouchInput() {
#if TOUCH_ENABLED && defined(TOUCH_CS)
  unsigned long now = millis();
  uint16_t rawZ = tft.getTouchRawZ();

  // 1. SLEEP MODE: Double-Tap to Wake
  if (deviceState == STATE_SLEEP) {
    if (rawZ > TOUCH_PRESSURE_THRESHOLD) {
      if (!touchWasPressed && (now - lastTouchTime > TOUCH_DEBOUNCE_MS)) {
        touchWasPressed = true;
        lastTouchTime = now;

        if (wakeTapCount == 1 && (now - lastWakeTapTime <= DOUBLE_TAP_MAX_GAP_MS) && (now - lastWakeTapTime >= DOUBLE_TAP_MIN_GAP_MS)) {
          Serial.printf("[POWER] Double-tap detected (%lu ms gap). WAKING DISPLAY!\n", now - lastWakeTapTime);
          wakeTapCount = 0;
          wakeFromSleepMode();
          return;
        } else {
          wakeTapCount = 1;
          lastWakeTapTime = now;
          Serial.println("[POWER] Wake Tap 1 detected. Waiting for Tap 2 within 450ms...");
        }
      }
    } else if (touchWasPressed && rawZ < (TOUCH_PRESSURE_THRESHOLD / 2)) {
      touchWasPressed = false;
    }

    if (wakeTapCount == 1 && (now - lastWakeTapTime > DOUBLE_TAP_MAX_GAP_MS)) {
      wakeTapCount = 0;
      Serial.println("[POWER] Double-tap expired. Staying asleep.");
    }
    return;
  }

  // 2. DASHBOARD MODE: Touch Navigation with Hold-to-Confirm for Destructive Actions
  static unsigned long powerHoldStart = 0;
  static unsigned long resetHoldStart = 0;

  if (rawZ > TOUCH_PRESSURE_THRESHOLD) {
    uint16_t rawX = 0, rawY = 0;
    tft.getTouchRaw(&rawX, &rawY);

    if (rawX > 0 && rawY > 0) {
      int screenX = map(rawY, CAL_RAW_Y_MIN, CAL_RAW_Y_MAX, 0, 319);
      int screenY = map(rawX, CAL_RAW_X_MIN, CAL_RAW_X_MAX, 0, 239);
      screenX = constrain(screenX, 0, 319);
      screenY = constrain(screenY, 0, 239);

      // Check ongoing hold actions
      if (powerHoldStart > 0 && (now - powerHoldStart >= 1000)) {
        auditLog("POWER_SLEEP", "CONFIRMED", "Hold-to-confirm 1000ms satisfied");
        powerHoldStart = 0;
        enterSleepMode();
        return;
      }

      if (resetHoldStart > 0 && (now - resetHoldStart >= 1500)) {
        auditLog("FACTORY_RESET", "CONFIRMED", "Hold-to-confirm 1500ms satisfied");
        resetHoldStart = 0;
        activeIncidentCount = 0;
        failedServerCount = 0;
        soundMuted = false;
        autoCycleEnabled = false;
        isNightMode = true;
        focusRemainingSeconds = 25 * 60;
        focusTimerRunning = false;
        tft.invertDisplay(true);
        renderDashboardScreen(SCREEN_SETTINGS, true);
        return;
      }

      if (!touchWasPressed && (now - lastTouchTime > TOUCH_DEBOUNCE_MS)) {
        touchWasPressed = true;
        lastTouchTime = now;
        autoCycleEnabled = false; // touch interaction pauses auto-cycle

        Serial.printf("[TOUCH] Screen (%d, %d) Z=%u\n", screenX, screenY, rawZ);

        // A. TOP STATUS BAR: Power Standby Icon (X >= 280, Y <= 18)
        // Destructive / Power-down Action: Enforces Hold-to-Confirm >= 1000ms
        if (screenY <= 18 && screenX >= 280) {
          powerHoldStart = now;
          Serial.println("[TOUCH] Power standby touched. Hold continuously for 1.0s to enter sleep...");
          return;
        }

        // B. BOTTOM HOTBAR: 8 Slots (Y >= 208)
        if (screenY >= 208) {
          int slot = screenX / 40;
          slot = constrain(slot, 0, SCREEN_COUNT - 1);
          auditLog("NAV_HOTBAR", hotbarLabels[slot]);
          renderDashboardScreen((DashboardScreen)slot, false);
          return;
        }

        // C. VIEWPORT AREA (Y: 16..207)
        if (showDetailView) {
          // In Detail View: Back button (X: 6..70, Y: 20..46)
          if (screenX <= 75 && screenY <= 48) {
            auditLog("NAV_BACK", hotbarLabels[currentScreen]);
            renderDashboardScreen(currentScreen, false);
            return;
          }

          // Screen-specific detail controls
          if (currentScreen == SCREEN_FOCUS) {
            // Preset buttons: 25m (16..104), 5m (114..202), Reset (212..300) at Y: 76..106
            if (screenY >= 76 && screenY <= 106) {
              if (screenX <= 105) {
                focusRemainingSeconds = 25 * 60;
                focusTimerRunning = true;
                auditLog("TIMER_PRESET", "25m");
              } else if (screenX <= 205) {
                focusRemainingSeconds = 5 * 60;
                focusTimerRunning = true;
                auditLog("TIMER_PRESET", "5m");
              } else {
                focusRemainingSeconds = 25 * 60;
                focusTimerRunning = false;
                auditLog("TIMER_RESET", "CONFIRMED");
              }
              renderDashboardScreen(SCREEN_FOCUS, true);
            }
          } else if (currentScreen == SCREEN_SETTINGS) {
            // Toggles at Y: 60..85, 100..125, 134..160
            if (screenY >= 60 && screenY <= 85) {
              soundMuted = !soundMuted;
              auditLog("SETTING_AUDIO", soundMuted ? "MUTED" : "ENABLED");
              renderDashboardScreen(SCREEN_SETTINGS, true);
            } else if (screenY >= 100 && screenY <= 125) {
              autoCycleEnabled = !autoCycleEnabled;
              auditLog("SETTING_AUTOCYCLE", autoCycleEnabled ? "ENABLED" : "OFF");
              renderDashboardScreen(SCREEN_SETTINGS, true);
            } else if (screenY >= 134 && screenY <= 160) {
              isNightMode = !isNightMode;
              tft.invertDisplay(isNightMode);
              auditLog("SETTING_THEME", isNightMode ? "NIGHT" : "DAY");
              renderDashboardScreen(SCREEN_SETTINGS, true);
            } else if (screenY >= 168 && screenY <= 196 && screenX >= 200) {
              // Destructive Action: Factory Reset (Enforce Hold-to-Confirm >= 1.5s)
              resetHoldStart = now;
              Serial.println("[TOUCH] Factory reset touched. Hold continuously for 1.5s to confirm...");
            }
          }
        } else {
          // In Overview View:
          // Focus Screen Start/Pause toggle button (X: 40..150, Y: 160..192)
          if (currentScreen == SCREEN_FOCUS && screenX >= 40 && screenX <= 150 && screenY >= 160) {
            focusTimerRunning = !focusTimerRunning;
            auditLog("FOCUS_TOGGLE", focusTimerRunning ? "RESUMED" : "PAUSED");
            renderDashboardScreen(SCREEN_FOCUS, false);
            return;
          }

          // Tapping Detail Button or Hero switches to Detail View!
          auditLog("NAV_DETAIL", hotbarLabels[currentScreen]);
          renderDashboardScreen(currentScreen, true);
        }
      }
    }
  } else if (touchWasPressed && rawZ < (TOUCH_PRESSURE_THRESHOLD / 2)) {
    touchWasPressed = false;
    powerHoldStart = 0;
    resetHoldStart = 0;
  }
#endif
}

// =============================================================================
// Serial Commands Handler
// =============================================================================
void handleSerialCommands() {
  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  cmd.toLowerCase();
  if (cmd.length() == 0) return;

  Serial.printf("[CMD] '%s'\n", cmd.c_str());

  if (cmd == "boot" || cmd == "b") {
    startBootAnimation();
  } else if (cmd == "shutdown" || cmd == "s") {
    startShutdownAnimation();
  } else if (cmd == "sleep" || cmd == "slp") {
    enterSleepMode();
  } else if (cmd == "wake" || cmd == "w") {
    wakeFromSleepMode();
  } else if (cmd == "detail" || cmd == "d") {
    renderDashboardScreen(currentScreen, true);
  } else if (cmd == "back") {
    renderDashboardScreen(currentScreen, false);
  } else if (cmd == "alert") {
    activeIncidentCount = (activeIncidentCount == 0) ? 1 : 0;
    failedServerCount = (activeIncidentCount == 1) ? 1 : 0;
    renderDashboardScreen(currentScreen, showDetailView);
    Serial.printf("[STATE] Active Incidents: %d\n", activeIncidentCount);
  } else if (cmd == "night") {
    isNightMode = true;
    tft.invertDisplay(true);
    renderDashboardScreen(currentScreen, showDetailView);
  } else if (cmd == "day") {
    isNightMode = false;
    tft.invertDisplay(false);
    renderDashboardScreen(currentScreen, showDetailView);
  } else if (cmd == "inv" || cmd == "i") {
    isNightMode = !isNightMode;
    tft.invertDisplay(isNightMode);
    renderDashboardScreen(currentScreen, showDetailView);
  } else if (cmd == "next" || cmd == "n") {
    int nextIdx = (currentScreen + 1) % SCREEN_COUNT;
    renderDashboardScreen((DashboardScreen)nextIdx, false);
  } else if (cmd == "prev" || cmd == "p") {
    int prevIdx = (currentScreen - 1 + SCREEN_COUNT) % SCREEN_COUNT;
    renderDashboardScreen((DashboardScreen)prevIdx, false);
  } else if (cmd == "home" || cmd == "0") {
    renderDashboardScreen(SCREEN_HOME, false);
  } else if (cmd == "srv" || cmd == "1") {
    renderDashboardScreen(SCREEN_SERVERS, false);
  } else if (cmd == "inc" || cmd == "2") {
    renderDashboardScreen(SCREEN_INCIDENTS, false);
  } else if (cmd == "cost" || cmd == "3") {
    renderDashboardScreen(SCREEN_CLOUD, false);
  } else if (cmd == "dep" || cmd == "4") {
    renderDashboardScreen(SCREEN_DEPLOY, false);
  } else if (cmd == "wthr" || cmd == "5") {
    renderDashboardScreen(SCREEN_WEATHER, false);
  } else if (cmd == "focus" || cmd == "time" || cmd == "6") {
    renderDashboardScreen(SCREEN_FOCUS, false);
  } else if (cmd == "set" || cmd == "7") {
    renderDashboardScreen(SCREEN_SETTINGS, false);
  } else if (cmd == "auto") {
    autoCycleEnabled = !autoCycleEnabled;
    Serial.printf("[AUTO] Auto-cycle: %s\n", autoCycleEnabled ? "ON" : "OFF");
  } else if (cmd == "help" || cmd == "?") {
    Serial.println("=== PulseBox Voxel Commands ===");
    Serial.println("  0..7        : Select screen (Home, Srv, Inc, Cost, Dep, Wthr, Time, Set)");
    Serial.println("  detail / d  : Open Detail View");
    Serial.println("  back        : Return to Hero Overview");
    Serial.println("  alert       : Toggle simulated cluster incident");
    Serial.println("  sleep / wake: Control display power state");
    Serial.println("  night / day : Switch color theme");
    Serial.println("  auto        : Toggle automatic screen cycling");
    Serial.println("===============================");
  }
}

// =============================================================================
// Arduino Setup & Loop
// =============================================================================
void setup() {
  Serial.begin(115200);
  delay(400);

  Serial.println("PULSEBOX HARDWARE FOUND");
  Serial.println("[BOOT] ESP32-D0WD-V3 Core Online @ 240MHz");
  Serial.println("[BOOT] Initializing ILI9341 SPI Display (320x240 Voxel Engine)...");

  tft.init();
  tft.setRotation(1); // Landscape 320x240

  // Apply Night Mode display inversion for true pitch-black background:
  tft.invertDisplay(isNightMode);

  Serial.println("[DISPLAY] Display initialized in Voxel Night Mode.");
  startBootAnimation();
}

void loop() {
  unsigned long now = millis();

  // 1. Process Inputs
  handleSerialCommands();
  processTouchInput();

  // 2. Hardware Heartbeat (maintains Phase 1 verification string)
  if (now - lastHeartbeat >= 2000) {
    lastHeartbeat = now;
    heartbeatToggle = !heartbeatToggle;
    Serial.println("PULSEBOX HARDWARE FOUND");

    // Pulsing activity dot in status bar (localized dirty update)
    if (deviceState == STATE_DASHBOARD) {
      tft.fillCircle(58, 10, 2, heartbeatToggle ? getThemeCyan() : getThemeBevelShadow());
      updateStatusBarClockOnly();
    }
  }

  // 3. Focus Timer Countdown (accrues accurately in background without resetting)
  if (now - lastFocusTick >= 1000) {
    lastFocusTick = now;
    if (focusTimerRunning && focusRemainingSeconds > 0) {
      focusRemainingSeconds--;
      if (deviceState == STATE_DASHBOARD && currentScreen == SCREEN_FOCUS && !showDetailView) {
        updateFocusTimerDisplay();
      }
    }
  }

  // 4. State Machine Updates
  if (deviceState == STATE_BOOTING) {
    updateBootSequence(now);
  } else if (deviceState == STATE_SHUTDOWN) {
    updateShutdownSequence(now);
  } else if (deviceState == STATE_SLEEP) {
    // Controller in sleep mode; double-tap wake monitored in processTouchInput()
  } else if (deviceState == STATE_DASHBOARD) {
    // Idle Mascot Blink & Beacon Animation (Redraws only dirty regions)
    if (!showDetailView && (currentScreen == SCREEN_HOME || currentScreen == SCREEN_SERVERS || currentScreen == SCREEN_INCIDENTS)) {
      int rx = (currentScreen == SCREEN_SERVERS) ? 60 : 96;
      int ry = (currentScreen == SCREEN_SERVERS) ? 28 : 26;
      MascotMood mood = (failedServerCount == 0 && activeIncidentCount == 0) ? MOOD_HAPPY : MOOD_WORRIED;

      if (now - lastBlinkTime >= (robotBlinkState ? 200 : 3800)) {
        lastBlinkTime = now;
        robotBlinkState = !robotBlinkState;
        updatePulseBotEyesOnly(rx, ry, 2, mood, robotBlinkState);
      }

      if (now - lastBeaconTime >= 500) {
        lastBeaconTime = now;
        beaconPulseState = !beaconPulseState;
        uint16_t bCol = beaconPulseState ? getThemeNominal() : getThemeCyan();
        if (mood == MOOD_WORRIED) bCol = beaconPulseState ? getThemeCritical() : getThemeWarning();
        updatePulseBotBeaconOnly(rx, ry, 2, bCol);
      }
    }

    // Auto screen cycling (if enabled via serial 'auto')
    if (autoCycleEnabled && (now - lastScreenCycle >= SCREEN_CYCLE_INTERVAL)) {
      lastScreenCycle = now;
      int nextIdx = (currentScreen + 1) % SCREEN_COUNT;
      renderDashboardScreen((DashboardScreen)nextIdx, false);
    }
  }
}
