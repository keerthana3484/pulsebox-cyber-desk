/**
 * main.js - Application bootstrap for the Workbench View (index.html).
 * Integrates the full-chassis tin-box workbench with the unified
 * 320x240 voxel EmbeddedScreenSimulator engine.
 */

import { EmbeddedScreenSimulator } from "./embeddedSimulator.js";
import { isSoundEnabled, setSoundEnabled, playClickSound } from "./audio.js";

document.addEventListener("DOMContentLoaded", () => {
  // 1. Gather LCD & Workbench DOM elements
  const viewport = document.getElementById("lcd-viewport");
  const screenTitle = document.getElementById("lcd-screen-title");
  const statusBarClock = document.getElementById("lcd-status-clock");
  const navContainer = document.getElementById("lcd-nav-bar");
  const lcdScreen = document.getElementById("lcd-screen");
  const simBadge = document.querySelector(".lcd-sim-badge");
  const ledRxTx = document.getElementById("led-rxtx");
  const ledStat = document.getElementById("led-stat");
  const ledPwr = document.getElementById("led-pwr");
  const serialStream = document.getElementById("serial-logs-stream");
  const tinBoxWrapper = document.getElementById("tin-box-wrapper");
  const crtScanlines = document.getElementById("crt-scanlines");

  // 2. Instantiate and initialize unified Voxel Simulator Engine
  const simulator = new EmbeddedScreenSimulator({
    viewport,
    screenTitle,
    statusBarClock,
    navContainer,
    lcdScreen,
    simBadge,
    ledRxTx,
    ledStat,
    ledPwr,
  });

  // Stream logs to Workbench Serial Monitor (UART0)
  simulator.onLog((msg) => {
    if (!serialStream) return;
    const line = document.createElement("div");
    line.className = "serial-line";
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0] + "." + String(now.getMilliseconds()).padStart(3, "0");
    line.innerHTML = `<span class="log-time">[${timeStr}]</span> <span class="log-text">${msg}</span>`;
    serialStream.appendChild(line);
    serialStream.scrollTop = serialStream.scrollHeight;
  });

  simulator.init();
  window.__PULSEBOX_SIMULATOR__ = simulator;

  // 3. Physical Chassis Tactile Buttons
  const btnPrev = document.getElementById("hw-btn-prev");
  const btnNext = document.getElementById("hw-btn-next");
  const btnAction = document.getElementById("hw-btn-action");
  const btnPower = document.getElementById("hw-toggle-power");

  if (btnPrev) {
    btnPrev.addEventListener("click", () => simulator.prevScreen());
  }
  if (btnNext) {
    btnNext.addEventListener("click", () => simulator.nextScreen());
  }
  if (btnAction) {
    btnAction.addEventListener("click", () => simulator.triggerAction());
  }
  if (btnPower) {
    btnPower.addEventListener("click", () => simulator.togglePower());
  }

  // 4. Workbench Zoom / Scale Controls
  document.querySelectorAll(".scale-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      playClickSound();
      document.querySelectorAll(".scale-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const scale = btn.dataset.scale;
      if (tinBoxWrapper) {
        tinBoxWrapper.className = `tin-box-wrapper scale-${scale}`;
      }
    });
  });

  // 5. Sound SFX Toggle
  const soundToggle = document.getElementById("wb-sound-toggle");
  if (soundToggle) {
    soundToggle.addEventListener("click", () => {
      const nextState = !isSoundEnabled();
      simulator.toggleSound(nextState);
      soundToggle.textContent = nextState ? "🔊 SFX ON" : "🔇 MUTED";
      soundToggle.classList.toggle("active", nextState);
      if (nextState) playClickSound();
    });
  }

  // 6. Direct Screen jump shortcuts in header (if present)
  document.querySelectorAll(".screen-jump-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetIdx = parseInt(btn.dataset.target, 10);
      simulator.switchScreen(targetIdx);
    });
  });

  // 7. CRT Scanline Toggle
  if (crtScanlines) {
    crtScanlines.addEventListener("dblclick", () => {
      crtScanlines.classList.toggle("disabled");
    });
  }
});
