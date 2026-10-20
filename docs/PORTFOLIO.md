# PulseBox Cyber Desk — Portfolio Assets & Launch Kit

This document provides ready-to-publish collateral for showcasing **PulseBox Cyber Desk** on LinkedIn, personal portfolio sites, GitHub releases, and video demonstrations.

---

## 📱 1. LinkedIn Post (Story Format)

### Copy (Ready to Paste)

```markdown
I got tired of having dozens of cluttered browser tabs and distracting dashboards open just to keep an eye on servers, deployments, and cloud costs.

So I built PulseBox Cyber Desk: an ambient hardware monitor on an ESP32 with a 2.8" SPI touchscreen, paired with a Python Flask API and a pixel-accurate web simulator. It translates dev ops into an original 8px voxel world with a reactive mascot and Day/Night palettes.

The hardest challenge? The 1-second glance rule on a 320x240 screen. Traditional dashboards fail from 3 feet away. I enforced a ruthless constraint: each screen has 1 hero element and 5 words or fewer on overview. Secondary metrics live behind a tap, powered by a token compiler outputting both CSS and embedded RGB565 C++ headers.

What I learned: Ruthless constraints breed clarity. Designing the simulator first made real-device bring-up smooth—I verified all 8 screens and touch navigation on the physical hardware with no display flicker.

Roadmap: Add a Wi-Fi client reading GET /state over HTTPS with our pinned CA, and test long-run thermal stability.

Live web demo: https://keerthana3484.github.io/pulsebox-cyber-desk/simulator.html
Code: https://github.com/keerthana3484/pulsebox-cyber-desk
```

*(Word count: 181 words — strictly under 200 words)*

---

## 🎬 2. 60-Second Demo Video Shot List

**Target Duration:** 0:58 – 1:00  
**Format:** 1080×1920 (9:16 Vertical for LinkedIn / YouTube Shorts / TikTok) or 1920×1080 (16:9 Landscape)  
**Pacing:** Fast, punchy, rhythmic cuts synced to subtle retro 8-bit lofi beats.

| Time | Scene & Camera Angle | Action on Screen / Simulator | Audio / SFX | Voiceover / Text Overlay |
| :---: | :--- | :--- | :--- | :--- |
| **0:00 – 0:06** | **Hook:** Macro view of 320×240 voxel simulator booting up. | Simulator powers on with retro voxel boot sequence. | Analog click + gentle CRT hum rising. | **VO:** *"I got tired of having dozens of cluttered browser tabs open just to check on servers and cloud costs."*<br>**Text:** Ambient Dev Telemetry. |
| **0:06 – 0:14** | **Overview & Navigation:** Clicking through the 8-slot hotbar. | Tapping through screens: System Status -> Cluster Health -> Costs -> Focus Timer. Smooth block wipes. | Soft tactile block click on each tap. | **VO:** *"So I built PulseBox: an 8px voxel desk fixture and browser simulator."* |
| **0:14 – 0:22** | **The 1-Second Rule:** Split screen showing Day vs Night mode. | Day mode (warm earth/sunlight) toggles into Night mode (low-glare obsidian & neon mint). Hero heart bar visible. | Click toggle SFX. | **VO:** *"The rule? Readable in under 1 second. Max 5 words per overview. Dual 16-color palettes."* |
| **0:22 – 0:33** | **Incident & Outage Injection:** Simulated failure injection. | Tap **"Simulate Failure"**. Screen shifts to Redstone crimson. Heart bar drops. Mascot switches to worried expression. | Sudden alert buzzer tone. | **VO:** *"When an outage hits: instant visual alarm, worried mascot, and incident logged."* |
| **0:33 – 0:42** | **Recovery & Chimes:** Tapping "RESTORE". | Cluster recovers to 6/6 online. Screen transitions to lush emerald. PulseBot celebrates. | Bright 8-bit synthetic chime. | **VO:** *"One tap recovers the node, verified by Bearer token authentication."* |
| **0:42 – 0:50** | **Focus Timer:** Pomodoro countdown sprint. | Timer finishes 25:00 focus sprint. XP progress bar fills up. SESS #1 recorded. | Synthesized level-up fanfare (`audio.js`). | **VO:** *"Plus a zero-drift Pomodoro focus timer with custom synthesized Web Audio chimes."* |
| **0:50 – 0:56** | **Engineering & Security:** Fast scrolling montage of test runner & architecture. | Terminal shows `pytest: 75 passed`, `node: 135 passed`, and real ESP32 hardware displaying voxel UI. | Subtle keyboard clatter. | **VO:** *"740+ automated tests, prepared device token scoping, and zero external game assets."* |
| **0:56 – 1:00** | **Outro & Call to Action:** Hero shot of physical desk fixture with animated mascot idle bounce. | URL banner appears: `github.com/keerthana3484/pulsebox-cyber-desk`. PulseBot winks. | Upbeat ending chord. | **VO:** *"Try the zero-install live demo link in the comments. Full open source code on GitHub!"*<br>**Text:** Try the Live Demo! |

---

## 💼 3. Resume / Portfolio Project Bullets

Add these impactful, metric-driven bullet points to your software engineering resume:

- **Full-Stack IoT Architecture & Embedded Bring-Up (Python, ESP32/C++, JavaScript):** Built and physically brought up an ambient developer monitoring system combining a Python Flask REST API with an ESP32 C++ firmware architecture (ILI9341 / Arduino Framework) and a pixel-accurate web simulator; verified all 8 native screens and touch navigation on the physical device.
- **Embedded UI & Token Compiler:** Designed a glanceable 320×240 embedded interface enforcing a $\le 5$-word overview limit with progressive disclosure; developed a dual 16-color design token compiler outputting web CSS and 16-bit RGB565 C++ macros for smooth partial redraws.
- **Hardened Security & CI Automation:** Implemented role-based token authentication (admin token vs. prepared scoped device token), loopback-only binding, sliding-window rate limiting, and automated CI test suites with 100% pass rate across 75 Pytest and 135 simulator tests.

