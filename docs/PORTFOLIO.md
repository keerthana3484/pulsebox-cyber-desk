# PulseBox Cyber Desk — Portfolio Assets & Launch Kit

This document provides ready-to-publish collateral for showcasing **PulseBox Cyber Desk** on LinkedIn, personal portfolio sites, GitHub releases, and video demonstrations.

---

## 📱 1. LinkedIn Post (Story Format)

### Copy (Ready to Paste)

```markdown
I got tired of having 47 browser tabs open just to monitor my dev environment.

Cloud costs, cluster health, incident alerts, CI/CD deploys, Pomodoro focus timers… tab overload was quietly draining my focus every workday.

So I built a dedicated physical-digital ambient desk fixture: **PulseBox Cyber Desk** 🕹️⚡

Sitting on my desk is an ESP32 microcontroller with a 2.8" 320×240 touchscreen, paired with a hardened Python Flask backend and a pixel-accurate web simulator. 

Instead of noisy notification popups, it translates dev ops into an original retro-voxel world:
🌿 Healthy cluster = Lush green meadow, happy PulseBot mascot, full heart bar.
⚠️ Budget surge = Amber sun glow, draining XP bar, level indicators.
🚨 Production outage = Redstone crimson alarm, worried mascot, Telegram alert dispatched.

### 🛠️ What I Built:
• Full-stack hybrid: ESP32 C++ firmware (FreeRTOS) + Python Flask backend + Vite/Vanilla JS simulator.
• 8 native screens on an 8px modular snap grid (Cluster nodes, costs, incidents, focus timer, dynamic weather & clock, release pipeline).
• Dual 16-color indexed palettes (Day Sunlight vs. Night Low-Glare Midnight).
• 100% original IP: Procedural voxel sprites, custom Web Audio chimes, zero 3rd-party assets.
• Zero-backend autonomous Demo Mode compiled to GitHub Pages.

### 🧩 The Hardest Challenge: "The 1-Second Glance Rule"
On a 2.8" 320×240 resistive touchscreen sitting 3 feet away on a busy desk, traditional dashboards fail completely. Cramming Grafana tables or microscopic JSON graphs creates cognitive fatigue.

I set a ruthless design constraint: **One hero element per screen. Maximum 3 text elements and 12 words total. Readable in under 1 second.**

Every single screen had to convey critical state through shape, color, and mascot mood before a single word is read. For deep triage, I built a progressive disclosure architecture ("behind-the-tap") with touch targets ≥32×32px. 

Bridging this between browser canvas (Hex/CSS) and embedded microcontrollers (16-bit RGB565 binary) required writing a unified design-token compiler that generates both simultaneously.

### 💡 What I Learned:
1. **Constraints unlock aesthetic clarity:** Limiting the color palette to 16 indexed colors made the UI look remarkably cohesive, reduced memory usage to just 6.7% RAM on the ESP32, and eliminated display flicker via dirty-region partial redraws.
2. **Security is an architectural foundation, not an afterthought:** Implementing constant-time Bearer token checks, pinned root CA verification (ISRG Root X1), 120 req/min sliding-window rate limiting, and loopback defaults made this small desk gadget feel as robust as an enterprise microservice.
3. **Hardware-software co-design:** Building the web simulator first with 112 headless browser tests allowed me to iterate 10x faster before flashing a single byte of firmware.

720+ automated tests passing across pytest, Node.js, and PlatformIO.

👉 Try the live interactive web demo right in your browser (no install needed): [LINK IN COMMENTS]
⭐ Code & architecture on GitHub: [LINK IN COMMENTS]

What does your ideal physical developer desk setup look like? Would you want ambient hardware telemetry at your desk?

#SoftwareEngineering #EmbeddedSystems #IoT #ESP32 #Python #WebDev #GameDesign #CleanCode #FullStack #Hardware
```

---

## 🎬 2. 60-Second Demo Video Shot List

**Target Duration:** 0:58 – 1:00  
**Format:** 1080×1920 (9:16 Vertical for LinkedIn / YouTube Shorts / TikTok) or 1920×1080 (16:9 Landscape)  
**Pacing:** Fast, punchy, rhythmic cuts synced to subtle retro 8-bit lofi beats.

| Time | Scene & Camera Angle | Action on Screen / Hardware | Audio / SFX | Voiceover / Text Overlay |
| :---: | :--- | :--- | :--- | :--- |
| **0:00 – 0:06** | **Hook:** Tight macro shot of physical desk fixture powering on. | ESP32 display boots with retro voxel boot sequence; camera pulls back to reveal compact desk gadget next to a mechanical keyboard. | Analog click + gentle CRT hum rising. | **VO:** *"I got tired of 50 browser tabs just to know if my servers were running."*<br>**Text:** Ambient Dev Telemetry on your desk. |
| **0:06 – 0:14** | **Overview & Navigation:** Top-down finger tapping the hotbar. | User finger taps through screens: System Status -> Cluster Health -> Costs -> Focus Timer. Smooth block wipe transitions. | Soft tactile block click on each tap. | **VO:** *"So I built PulseBox: an ESP32 desk gadget and pixel-accurate web simulator with an 8px voxel aesthetic."* |
| **0:14 – 0:22** | **The 1-Second Rule:** Split screen showing Day vs Night mode. | Day mode (warm earth/sunlight) toggles into Night mode (low-glare obsidian & neon mint). Hero heart bar visible. | Click toggle SFX. | **VO:** *"The rule? Readable in under 1 second from 3 feet away. Max 12 words per screen. Dual 16-color palettes."* |
| **0:22 – 0:33** | **Incident & Outage Injection:** Split screen (Web simulator + Telegram phone notification). | Tap **"Simulate Failure"** button. The screen shifts to Redstone crimson. Heart bar drops. Mascot switches to worried expression. Phone buzzes with Telegram alert! | Sudden alert buzzer tone + phone vibration. | **VO:** *"When an outage hits: instant visual alarm, worried mascot, and automated Telegram alert dispatched."* |
| **0:33 – 0:42** | **Recovery & Chimes:** Finger taps "RESTORE". | Cluster recovers to 6/6 online. Screen transitions to lush emerald. PulseBot celebrates. | Bright 8-bit synthetic chime. | **VO:** *"One tap recovers the node, verified by constant-time Bearer token authentication."* |
| **0:42 – 0:50** | **Focus Timer Level-Up:** Focus Timer screen ticking down. | Timer finishes 25:00 focus sprint. XP progress bar fills up. SESS #1 recorded. | Synthesized level-up fanfare (`audio.js`). | **VO:** *"Plus a zero-drift Pomodoro focus timer with zero cloud dependencies and custom synthesized Web Audio SFX."* |
| **0:50 – 0:56** | **Engineering & Security:** Fast scrolling montage of test runner & architecture. | Terminal shows `pytest: 72 passed`, `node: 112 passed`, PlatformIO RAM 6.7%, and Gitleaks green checkmark. | Subtle keyboard clatter. | **VO:** *"Over 720 automated tests, pinned root CA encryption, and hardened loopback security."* |
| **0:56 – 1:00** | **Outro & Call to Action:** Hero shot of device with animated mascot idle bounce. | URL banner appears: `github.com/your-username/pulsebox-cyber-desk`. PulseBot winks. | Upbeat ending chord. | **VO:** *"Try the zero-install live demo link in the comments. Full open source code on GitHub!"*<br>**Text:** Try the Live Demo! |

---

## 💼 3. Resume / Portfolio Project Bullets

Add these impactful, metric-driven bullet points to your software engineering resume:

- **PulseBox Cyber Desk — Full-Stack IoT & Ambient Developer Dashboard (Python, ESP32/C++, JavaScript)**
  - Engineered an ambient desk telemetry device and web simulator utilizing an ESP32 microcontroller, 2.8" SPI TFT LCD, and Python Flask REST API to monitor cluster health, cloud costs, and CI/CD pipelines.
  - Implemented an original retro-voxel design system with dual 16-color indexed palettes, an 8px modular snap grid, and a single-source token generator compiling to both web CSS and 16-bit RGB565 C++ macros.
  - Designed an embedded UI architecture enforcing the "1-Second Glance Rule" (max 3 text elements and $\le 12$ words per screen) with progressive disclosure detail views and $\ge 32\text{px}$ touch targets.
  - Hardened backend security with constant-time Bearer token validation (`secrets.compare_digest`), loopback-only binding, sliding-window rate limiting, pinned root CA TLS (ISRG Root X1), and structured audit logging.
  - Built comprehensive CI/CD test automation comprising **720+ automated assertions** across Pytest, headless browser simulator tests, Gitleaks secret detection, and automated GitHub Pages demo deployment.
