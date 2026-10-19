/**
 * simulatorApp.js - Application bootstrap and event binding for the
 * dedicated 320x240 landscape embedded-screen simulator.
 */

import { EmbeddedScreenSimulator } from "./embeddedSimulator.js";
import { isSoundEnabled, setSoundEnabled, playClickSound } from "./audio.js";

document.addEventListener("DOMContentLoaded", () => {
  // 1. Gather DOM elements
  const viewport = document.getElementById("sim-viewport");
  const screenTitle = document.getElementById("sim-screen-title");
  const statusBarClock = document.getElementById("sim-clock");
  const navContainer = document.getElementById("sim-nav-bar");
  const lcdScreen = document.getElementById("sim-lcd-screen");
  const simBadge = document.getElementById("sim-badge");
  const ledRxTx = document.getElementById("sim-led-rxtx");
  const ledStat = document.getElementById("sim-led-stat");
  const ledPwr = document.getElementById("sim-led-pwr");
  const touchHud = document.getElementById("sim-touch-hud");
  const displayWrapper = document.getElementById("sim-display-wrapper");
  const crtScanlines = document.getElementById("sim-crt-scanlines");

  // 2. Instantiate and initialize Simulator Engine
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
    touchHud,
  });

  simulator.init();

  // Expose simulator globally for debugging and automated tests
  window.__PULSEBOX_EMBEDDED_SIMULATOR__ = simulator;

  // 3. Proportional Zoom Scale Selector
  const scaleBtns = document.querySelectorAll(".sim-toolbar-tools .scale-btn");
  const savedScale = localStorage.getItem("pulsebox_sim_scale") || "1-5x";

  function applyScale(scale) {
    if (!displayWrapper) return;
    displayWrapper.classList.remove("scale-1x", "scale-1-5x", "scale-2x", "scale-fit");
    displayWrapper.classList.add(`scale-${scale}`);
    scaleBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.scale === scale);
    });
    localStorage.setItem("pulsebox_sim_scale", scale);
  }

  applyScale(savedScale);

  scaleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      playClickSound();
      applyScale(btn.dataset.scale);
    });
  });

  // 3.5. Demo Mode Toggle
  const demoToggleBtn = document.getElementById("sim-demo-toggle");
  function updateDemoButtonUi() {
    if (!demoToggleBtn) return;
    const isDemo = simulator.isDemoMode;
    demoToggleBtn.classList.toggle("active", isDemo);
    demoToggleBtn.textContent = isDemo ? "🎮 DEMO: ON" : "🎮 DEMO: OFF";
  }

  if (demoToggleBtn) {
    updateDemoButtonUi();
    demoToggleBtn.addEventListener("click", () => {
      simulator.toggleDemoMode();
      updateDemoButtonUi();
    });
  }

  simulator.subscribeStateChange(() => {
    updateDemoButtonUi();
  });

  // 4. CRT Scanlines Overlay Toggle
  const crtToggleBtn = document.getElementById("sim-crt-toggle");
  if (crtToggleBtn && crtScanlines) {
    crtToggleBtn.addEventListener("click", () => {
      playClickSound();
      const isEnabled = !crtScanlines.classList.contains("disabled");
      if (isEnabled) {
        crtScanlines.classList.add("disabled");
        crtToggleBtn.classList.remove("active");
        crtToggleBtn.textContent = "CRT OFF";
      } else {
        crtScanlines.classList.remove("disabled");
        crtToggleBtn.classList.add("active");
        crtToggleBtn.textContent = "CRT ON";
      }
    });
  }

  // 5. Touch HUD Toggle
  const hudToggleBtn = document.getElementById("sim-hud-toggle");
  if (hudToggleBtn && touchHud) {
    hudToggleBtn.addEventListener("click", () => {
      playClickSound();
      const isHidden = touchHud.style.display === "none";
      if (isHidden) {
        touchHud.style.display = "";
        hudToggleBtn.classList.add("active");
        hudToggleBtn.textContent = "HUD ON";
      } else {
        touchHud.style.display = "none";
        hudToggleBtn.classList.remove("active");
        hudToggleBtn.textContent = "HUD OFF";
      }
    });
  }

  // 6. Sound SFX Toggle
  const soundToggleBtn = document.getElementById("sim-sound-toggle");
  if (soundToggleBtn) {
    soundToggleBtn.addEventListener("click", () => {
      const nextState = !isSoundEnabled();
      simulator.toggleSound(nextState);
      soundToggleBtn.classList.toggle("active", nextState);
      soundToggleBtn.textContent = nextState ? "🔊 SFX ON" : "🔇 SFX OFF";
      if (nextState) playClickSound();
    });
  }

  // 7. Hardware Bezel Tactile Buttons
  const btnPrev = document.getElementById("sim-hw-prev");
  const btnNext = document.getElementById("sim-hw-next");
  const btnAction = document.getElementById("sim-hw-action");
  const btnPwr = document.getElementById("sim-hw-pwr");

  if (btnPrev) {
    btnPrev.addEventListener("click", () => simulator.prevScreen());
  }
  if (btnNext) {
    btnNext.addEventListener("click", () => simulator.nextScreen());
  }
  if (btnAction) {
    btnAction.addEventListener("click", () => simulator.triggerAction());
  }
  if (btnPwr) {
    btnPwr.addEventListener("click", () => simulator.togglePower());
  }

  // 8. Keyboard Navigation
  window.addEventListener("keydown", (e) => {
    // Ignore keybindings if the user is typing inside an input/textarea
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT")) {
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      simulator.prevScreen();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      simulator.nextScreen();
    } else if (e.key === " " || e.key === "Enter") {
      if (activeEl && activeEl.classList.contains("cyber-btn")) return;
      e.preventDefault();
      simulator.triggerAction();
    } else if (e.key.toLowerCase() === "p") {
      e.preventDefault();
      simulator.togglePower();
    }
  });

  // 9. Simulated Resistive Touch Digitizer Tracking (XPT2046)
  if (lcdScreen) {
    let isPointerActive = false;

    function processTouchEvent(e, isDown) {
      const rect = lcdScreen.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const scaleX = 320 / rect.width;
      const scaleY = 240 / rect.height;

      const rawX = (e.clientX - rect.left) * scaleX;
      const rawY = (e.clientY - rect.top) * scaleY;

      simulator.handleTouch(rawX, rawY, isDown);

      if (isDown && e.type === "pointerdown") {
        createTouchRipple(rawX, rawY);
      }
    }

    function createTouchRipple(nativeX, nativeY) {
      const ripple = document.createElement("div");
      ripple.className = "sim-touch-ripple";
      ripple.style.left = `${nativeX}px`;
      ripple.style.top = `${nativeY}px`;
      lcdScreen.appendChild(ripple);

      setTimeout(() => {
        if (ripple.parentNode) {
          ripple.parentNode.removeChild(ripple);
        }
      }, 350);
    }

    lcdScreen.addEventListener("pointerdown", (e) => {
      isPointerActive = true;
      processTouchEvent(e, true);
    });

    lcdScreen.addEventListener("pointermove", (e) => {
      if (isPointerActive) {
        processTouchEvent(e, true);
      }
    });

    const handlePointerEnd = (e) => {
      if (isPointerActive) {
        isPointerActive = false;
        processTouchEvent(e, false);
      }
    };

    lcdScreen.addEventListener("pointerup", handlePointerEnd);
    lcdScreen.addEventListener("pointercancel", handlePointerEnd);
    lcdScreen.addEventListener("pointerleave", handlePointerEnd);
  }

  // 9. Direct URL Query Parameter Navigation (?screen=costs&view=detail or ?screen=2)
  const urlParams = new URLSearchParams(window.location.search);
  const screenParam = urlParams.get("screen");
  if (screenParam) {
    const screenMap = {
      home: 0,
      status: 0,
      servers: 1,
      cluster: 1,
      incidents: 2,
      costs: 3,
      cloudcosts: 3,
      cloud: 3,
      deploy: 4,
      pipeline: 4,
      companion: 5,
      weather: 5,
      clock: 5,
      focustimer: 6,
      timer: 6,
      focus: 6,
      settings: 7,
      config: 7,
    };
    const targetIdx = isNaN(parseInt(screenParam, 10))
      ? screenMap[screenParam.toLowerCase()] ?? 0
      : parseInt(screenParam, 10);
    simulator.switchScreen(targetIdx);

    const viewParam = urlParams.get("view");
    if (viewParam === "detail") {
      setTimeout(() => {
        const heroStage = document.getElementById("hero-overview-stage");
        const detailStage = document.getElementById("screen-detail-stage");
        if (heroStage && detailStage) {
          heroStage.classList.add("is-hidden");
          detailStage.classList.add("is-active");
        }
      }, 50);
    }
  }
});
