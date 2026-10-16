// Full-Screen PULSE-BOT Pixel Face Animation Engine
// Used EXCLUSIVELY for Power-On, Power-Off, Wake-Up, and Standby states.
// (Not displayed on normal dashboard pages).

export class PulseBotAnimator {
  static getFaceSvg(eyeState = "normal", antennaColor = "#FFAB00") {
    let eyePixels = "";

    if (eyeState === "closed" || eyeState === "sleepy") {
      // Horizontal slit eyes
      eyePixels = `
        <rect x="7" y="11" width="5" height="1" fill="#FFB300" />
        <rect x="16" y="11" width="5" height="1" fill="#FFB300" />
      `;
    } else if (eyeState === "happy") {
      // Happy arches ^ ^
      eyePixels = `
        <rect x="8" y="9" width="3" height="1" fill="#00E676" />
        <rect x="7" y="10" width="1" height="2" fill="#00E676" />
        <rect x="11" y="10" width="1" height="2" fill="#00E676" />
        <rect x="17" y="9" width="3" height="1" fill="#00E676" />
        <rect x="16" y="10" width="1" height="2" fill="#00E676" />
        <rect x="20" y="10" width="1" height="2" fill="#00E676" />
      `;
    } else {
      // Normal amber visor eyes
      eyePixels = `
        <rect x="7" y="9" width="5" height="4" fill="#FFB300" />
        <rect x="8" y="10" width="2" height="2" fill="#FFE082" />
        <rect x="10" y="11" width="1" height="1" fill="#FF6D00" />
        <rect x="16" y="9" width="5" height="4" fill="#FFB300" />
        <rect x="17" y="10" width="2" height="2" fill="#FFE082" />
        <rect x="19" y="11" width="1" height="1" fill="#FF6D00" />
      `;
    }

    return `
      <svg viewBox="0 0 28 28" class="pulsebot-face-svg" shape-rendering="crispEdges">
        <!-- Ears -->
        <rect x="5" y="2" width="2" height="2" fill="#FF6D00" />
        <rect x="4" y="4" width="4" height="2" fill="#E65100" />
        <rect x="6" y="3" width="1" height="2" fill="#FFB300" />

        <rect x="21" y="2" width="2" height="2" fill="#FF6D00" />
        <rect x="20" y="4" width="4" height="2" fill="#E65100" />
        <rect x="21" y="3" width="1" height="2" fill="#FFB300" />

        <!-- Antenna Beacon -->
        <rect x="13" y="1" width="2" height="3" fill="#78909C" />
        <rect x="13" y="0" width="2" height="1" fill="${antennaColor}" class="pulse-beacon" />

        <!-- Head Base -->
        <rect x="5" y="6" width="18" height="13" fill="#181a20" />
        <rect x="4" y="8" width="20" height="9" fill="#181a20" />
        <rect x="6" y="5" width="16" height="15" fill="#181a20" />

        <!-- Cyber Face Plates -->
        <rect x="6" y="6" width="16" height="1" fill="#323846" />
        <rect x="4" y="9" width="1" height="7" fill="#323846" />
        <rect x="23" y="9" width="1" height="7" fill="#323846" />

        <!-- Visor Recess Frame -->
        <rect x="6" y="8" width="16" height="6" fill="#0d0f13" />
        <rect x="5" y="9" width="18" height="4" fill="#0a0c0e" />

        <!-- Eyes -->
        ${eyePixels}

        <!-- Sensor Whiskers -->
        <rect x="2" y="12" width="2" height="1" fill="#FF6D00" />
        <rect x="1" y="14" width="2" height="1" fill="#FFAB00" />
        <rect x="24" y="12" width="2" height="1" fill="#FF6D00" />
        <rect x="25" y="14" width="2" height="1" fill="#FFAB00" />

        <!-- Snout -->
        <rect x="13" y="14" width="2" height="1" fill="#FF8F00" />
        <rect x="12" y="15" width="4" height="1" fill="#2d3340" />

        <!-- Neck Collar -->
        <rect x="7" y="19" width="14" height="2" fill="#2d3340" />
        <rect x="12" y="19" width="4" height="2" fill="#FF6D00" />
        <rect x="13" y="20" width="2" height="2" fill="#FFD54F" />
      </svg>
    `;
  }

  // Full-Screen Power-On / Boot Animation
  static playBootAnimation(container, onComplete) {
    container.innerHTML = `
      <div class="fullscreen-anim-screen boot-anim">
        <div class="anim-face-box">
          <div id="anim-face-slot">${PulseBotAnimator.getFaceSvg("closed", "#FF6D00")}</div>
        </div>
        <div class="anim-text-box">
          <div class="anim-primary-text" id="boot-text-main">PULSE-BOT v1.2</div>
          <div class="anim-sub-text" id="boot-text-sub">INITIALIZING ESP32-S3 CORE...</div>
        </div>
      </div>
    `;

    const slot = container.querySelector("#anim-face-slot");
    const sub = container.querySelector("#boot-text-sub");

    // Phase 1: Open eyes (300ms)
    setTimeout(() => {
      if (slot) slot.innerHTML = PulseBotAnimator.getFaceSvg("normal", "#FFAB00");
      if (sub) sub.textContent = "CALIBRATING ILI9341 320x240 SPI TFT...";
    }, 400);

    // Phase 2: Happy ready face (900ms)
    setTimeout(() => {
      if (slot) slot.innerHTML = PulseBotAnimator.getFaceSvg("happy", "#00E676");
      if (sub) sub.textContent = "SYSTEM NOMINAL. MOUNTING DASHBOARD...";
    }, 1000);

    // Phase 3: Transition to dashboard
    setTimeout(() => {
      if (typeof onComplete === "function") onComplete();
    }, 1500);
  }

  // Full-Screen Power-Off / Shutdown Animation
  static playShutdownAnimation(container, onComplete) {
    container.innerHTML = `
      <div class="fullscreen-anim-screen shutdown-anim">
        <div class="anim-face-box">
          <div id="anim-face-slot">${PulseBotAnimator.getFaceSvg("normal", "#FFAB00")}</div>
        </div>
        <div class="anim-text-box">
          <div class="anim-primary-text">PULSE-BOT</div>
          <div class="anim-sub-text" id="shutdown-text-sub">SHUTTING DOWN SUBSYSTEMS...</div>
        </div>
      </div>
    `;

    const slot = container.querySelector("#anim-face-slot");
    const sub = container.querySelector("#shutdown-text-sub");

    // Phase 1: Blink to sleep
    setTimeout(() => {
      if (slot) slot.innerHTML = PulseBotAnimator.getFaceSvg("closed", "#FF6D00");
      if (sub) sub.textContent = "ENTERING POWER-SAVE SLEEP...";
    }, 400);

    // Phase 2: Fade out
    setTimeout(() => {
      container.innerHTML = `
        <div class="fullscreen-anim-screen powered-off-black"></div>
      `;
      if (typeof onComplete === "function") onComplete();
    }, 900);
  }

  // Full-Screen Standby Mode (Sleeping PulseBot face)
  static renderStandbyScreen(container, onWake) {
    container.innerHTML = `
      <div class="fullscreen-anim-screen standby-anim" title="Click anywhere to wake up">
        <div class="anim-face-box standby-pulse">
          ${PulseBotAnimator.getFaceSvg("sleepy", "#FF6D00")}
        </div>
        <div class="standby-z-particles">z  Z  Z</div>
        <div class="anim-text-box">
          <div class="anim-primary-text standby-label">PULSE-BOT STANDBY</div>
          <div class="anim-hint-text">TAP SCREEN OR POWER TO WAKE</div>
        </div>
      </div>
    `;

    container.querySelector(".standby-anim")?.addEventListener("click", () => {
      if (typeof onWake === "function") onWake();
    });
  }

  // Full-Screen Wake-Up Animation
  static playWakeAnimation(container, onComplete) {
    container.innerHTML = `
      <div class="fullscreen-anim-screen wake-anim">
        <div class="anim-face-box">
          <div id="anim-face-slot">${PulseBotAnimator.getFaceSvg("closed", "#FF6D00")}</div>
        </div>
        <div class="anim-text-box">
          <div class="anim-primary-text">PULSE-BOT</div>
          <div class="anim-sub-text">WAKING CORE...</div>
        </div>
      </div>
    `;

    const slot = container.querySelector("#anim-face-slot");

    setTimeout(() => {
      if (slot) slot.innerHTML = PulseBotAnimator.getFaceSvg("happy", "#00E676");
    }, 300);

    setTimeout(() => {
      if (typeof onComplete === "function") onComplete();
    }, 700);
  }
}
