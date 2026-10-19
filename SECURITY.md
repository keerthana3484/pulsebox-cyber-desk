# PulseBox Cyber Desk — Security Policy & Threat Model

This document outlines the security architecture, threat model, defense-in-depth controls, and vulnerability reporting procedures for the PulseBox Cyber Desk project.

---

## 1. Reporting a Vulnerability

We take the security of PulseBox Cyber Desk seriously. If you discover a security vulnerability, please do NOT disclose it publicly via GitHub issues or discussions.

Instead, please send a responsible disclosure email to:
- **Security Contact:** `security@pulsebox.dev` (or open a confidential GitHub Security Advisory)
- **Required Details:**
  1. Description of the vulnerability and attack vector.
  2. Steps to reproduce or proof-of-concept payload.
  3. Affected component (Backend API, Embedded Simulator, ESP32 Firmware, CI/CD).
  4. Suggested remediation or patch (if available).
- **Response Timeline:** You will receive an initial response within 48 hours, followed by coordinated disclosure upon patch release.

---

## 2. Core Security Invariants

The project strictly adheres to nine core security invariants:

1. **Zero Secret Exposure in Frontend Code:**
   - The backend `PULSEBOX_API_KEY` is never accessible to browser JavaScript, never stored in `localStorage` or `sessionStorage`, and never injected into client-side environment variables bundled by Vite.
2. **State-Mutation Authentication:**
   - Every endpoint that alters system state (`/simulate-failure`, `/restore`, `/reset`, `/costs/settings`, `/record-health-check`) requires `Authorization: Bearer <PULSEBOX_API_KEY>`.
   - Token comparisons use constant-time verification (`secrets.compare_digest`) to prevent timing attacks.
3. **Loopback-Only by Default (Explicit LAN Opt-In):**
   - The Flask backend binds strictly to `127.0.0.1` (localhost).
   - Binding to `0.0.0.0` (all network interfaces) is rejected unless `PULSEBOX_ALLOW_LAN=true` is explicitly set in the server environment.
4. **CORS Lockdown:**
   - CORS is restricted to trusted origins (configured via `FRONTEND_ORIGIN`, defaulting to `http://localhost:5173` and `http://127.0.0.1:5173`). Wildcard origins (`*`) are disallowed.
5. **Rate Limiting:**
   - In-memory sliding-window rate limiting restricts client IPs to a maximum of 120 requests/minute for general endpoints and 30 requests/minute for state mutations, returning HTTP 429 when exceeded.
6. **Strict Input Validation & Payload Limits:**
   - Request bodies are capped at 16 KB (`MAX_CONTENT_LENGTH = 16 * 1024`).
   - String inputs (`server_id`) enforce regex `^[a-zA-Z0-9_\-]{1,64}$`.
   - Numeric inputs (`monthly_budget`) reject booleans, negative numbers, zero, `NaN`, `Infinity`, and numbers exceeding $1,000,000.00.
7. **Firmware TLS Integrity (No Insecure TLS):**
   - The ESP32 firmware strictly prohibits calling `WiFiClientSecure::setInsecure()`.
   - All HTTPS requests must validate against a pinned Root CA certificate (ISRG Root X1 in `ca_cert.h`).
8. **Hold-to-Confirm for Destructive Actions & Audit Logging:**
   - High-impact device actions (factory reset, power shutdown) require holding the button for at least 1.0 to 1.5 seconds.
   - All state mutations and administrative actions generate structured `[AUDIT_LOG]` entries.
9. **Automated Supply Chain & Secret Scanning:**
   - CI runs `gitleaks` on all commits and PRs.
   - Python dependencies are scanned with `pip-audit`.
   - Frontend dependencies are scanned with `npm audit`.
   - Automated dependency updates are managed via GitHub Dependabot.

---

## 3. Threat Model

### 3.1 System Decomposition & Trust Boundaries

```
+-------------------------------------------------------------------------+
| TRUST BOUNDARY 1: Local Workstation (Loopback)                         |
|                                                                         |
|  [Browser Dashboard / Simulator] <=== HTTP / CORS ===> [Flask Backend]  |
|         (Port 5173)                                      (Port 5000)    |
+-------------------------------------------------------------------------+
                                                               ^
                                                               | (Explicit LAN Opt-In Only)
+-------------------------------------------------------------|-----------+
| TRUST BOUNDARY 2: Local Wi-Fi / LAN                         |           |
|                                                             v           |
|  [Physical ESP32 Desk Display] <==== WPA2/WPA3 Wi-Fi =======+           |
|   - ILI9341 SPI Display              (Pinned Root CA TLS)               |
|   - XPT2046 Touchscreen                                                 |
+-------------------------------------------------------------------------+
                                                               |
+--------------------------------------------------------------v----------+
| TRUST BOUNDARY 3: External Internet & Cloud APIs                        |
|                                                                         |
|  [Telegram Bot API] <========== HTTPS (Encrypted)                       |
+-------------------------------------------------------------------------+
```

### 3.2 Threat Actors & Motivations

1. **Malicious Web Script (Cross-Origin Attacker):**
   - *Vector:* User visits an untrusted website while running the PulseBox backend locally.
   - *Goal:* Issue cross-origin requests to `http://localhost:5000` to trigger fake outages or alter cloud budgets.
   - *Mitigation:* CORS whitelist rejects unauthorized origins; state-changing endpoints require `PULSEBOX_API_KEY` in the `Authorization` header (which browsers cannot send cross-origin without preflight consent).
2. **Untrusted LAN Adjacent Device (Network Eavesdropper):**
   - *Vector:* Compromised IoT device or guest on the same Wi-Fi network.
   - *Goal:* Intercept telemetry or spoof backend responses to display false data on the physical desk fixture.
   - *Mitigation:* Backend defaults to `127.0.0.1` (invisible to LAN); firmware uses pinned Root CA verification for TLS connections, preventing ARP spoofing / MITM proxies.
3. **Desk Passerby / Accidental Physical Touch:**
   - *Vector:* Inadvertent touch or curious coworker tapping the physical desk display.
   - *Goal:* Accidental power-off, focus timer cancellation, or settings wipe.
   - *Mitigation:* Destructive actions (factory reset, power standby) enforce a 1.0s to 1.5s continuous hold-to-confirm gesture with audit logging.
4. **Supply Chain / Dependency Vulnerabilities:**
   - *Vector:* Outdated or compromised third-party package in `backend/requirements.txt` or `frontend/package.json`.
   - *Goal:* Remote code execution or data exfiltration.
   - *Mitigation:* CI runs `pip-audit`, `npm audit`, and Dependabot weekly security updates.
5. **Credential Leakage in Source Control:**
   - *Vector:* Accidental commit of `.env` or `secrets.h`.
   - *Goal:* Expose API tokens or Wi-Fi passwords in Git history.
   - *Mitigation:* Explicit `.gitignore` entries for `.env`, `*.env`, `secrets.h`, and `*/secrets.h`; sanitized `.env.example` and `secrets.h.example` templates; pre-commit and CI `gitleaks` scanning.

---

## 4. STRIDE Threat Analysis Matrix

| Threat Category | Specific Threat | Implemented Mitigation | Verification |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker impersonates authorized administrator | `require_api_key` with constant-time Bearer token comparison (`secrets.compare_digest`) | `test_backend.py::test_require_api_key_*` |
| **Tampering** | Man-in-the-Middle modifies firmware telemetry | Firmware enforces pinned Root CA (`ca_cert.h`); `setInsecure()` is strictly forbidden | Verified in `firmware/src/ca_cert.h` |
| **Repudiation** | Denying who triggered a server failure or reset | Structured `[AUDIT_LOG]` records timestamp, caller IP, target, and outcome | Tested in `app.py::audit_log` |
| **Information Disclosure** | API keys leaked to browser or public repository | Token removed from browser storage; `.env` & `secrets.h` gitignored; Gitleaks CI | `test_frontend_*` & `test_design_tokens.js` |
| **Denial of Service** | Flooding backend with giant payloads or requests | 16 KB payload cap (`MAX_CONTENT_LENGTH`) + 120 req/min sliding-window rate limiting | `test_oversized_payload_returns_413` |
| **Elevation of Privilege** | Unauthenticated caller alters cloud budget | POST `/costs/settings` requires valid API key and enforces bounds ($1.00 to $1,000,000.00) | `test_post_cost_settings_*` |

---

## 5. Remaining Risks & Operational Guidance

While the project has been hardened, operators should be aware of the following residual risks:

1. **Unencrypted HTTP over Local LAN (if LAN Mode enabled):**
   - If `PULSEBOX_ALLOW_LAN=true` is enabled to connect an ESP32 over plain HTTP (`http://<laptop-ip>:5000`), local network traffic (including the `PULSEBOX_API_KEY` if mutation calls are sent) is unencrypted on the local Wi-Fi segment.
   - *Recommendation:* Place the backend behind a reverse proxy (e.g. Caddy or Nginx) with a local TLS certificate if deploying in untrusted office Wi-Fi environments.
2. **Physical Device Tampering:**
   - The ESP32 does not currently enable Flash Encryption or Secure Boot. An attacker with physical access and an external programmer could dump the flash firmware.
   - *Recommendation:* For high-security environments, enable ESP32 hardware Flash Encryption and NVS encryption.
3. **In-Memory Rate Limiting Across Restarts:**
   - The rate limiter uses process memory and resets if the Flask backend process restarts.
   - *Recommendation:* For production multi-worker deployments, back rate limiting with a shared Redis instance.
