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
2. **Role-Based Token Authentication (Admin vs Optional Scoped Device Token):**
   - Every endpoint that alters system state (`/simulate-failure`, `/restore`, `/reset`, `/costs/settings`) requires administrative credentials (`PULSEBOX_ADMIN_KEY` or `PULSEBOX_API_KEY`).
   - The backend architecture is prepared for a separate, strictly scoped **Device Token** (`PULSEBOX_DEVICE_KEY`, optional/future). When enabled, a device token is permitted ONLY to submit telemetry (`/record-health-check`); any attempt to trigger administrative state changes with the device token is rejected with HTTP 403 Forbidden. Read-only endpoints (`/state`) require no token. (Note: The current ESP32 firmware in `main.cpp` runs offline with local mock/demo data and makes no network requests).
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
7. **Firmware TLS Integrity Preparedness (No Insecure TLS):**
   - The ESP32 firmware repository includes a pinned Root CA certificate (ISRG Root X1 in `ca_cert.h`) prepared for planned Wi-Fi HTTPS client integration.
   - Calling `WiFiClientSecure::setInsecure()` is strictly forbidden in any future network implementations.
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
| TRUST BOUNDARY 2: Local Wi-Fi / LAN (Planned Future Sync)   |           |
|                                                             v           |
|  [Physical ESP32 Desk Display] <==== Prepared Wi-Fi HTTPS ==+           |
|   - ILI9341 SPI Display (Offline Mock Data Today)                       |
|   - Planned: HTTPS GET /state with Pinned Root CA                       |
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
   - *Mitigation:* CORS whitelist rejects unauthorized origins; state-changing endpoints require `PULSEBOX_ADMIN_KEY` in the `Authorization` header (which browsers cannot send cross-origin without preflight consent).
2. **Untrusted LAN Adjacent Device (Network Eavesdropper):**
   - *Vector:* Compromised IoT device or guest on the same Wi-Fi network.
   - *Goal:* Intercept tokens or spoof backend responses to alter data on the desk fixture.
   - *Mitigation:* Backend defaults to `127.0.0.1` (invisible to LAN); physical firmware operates offline today, and future Wi-Fi integration is prepared with an optional `PULSEBOX_DEVICE_KEY` that cannot alter state, plus a pinned Root CA header for TLS connections.
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
| **Spoofing** | Attacker impersonates authorized administrator | `require_api_key` with constant-time Bearer token comparison (`secrets.compare_digest`) | `test_backend.py::test_admin_token_allowed_*` |
| **Tampering** | Rogue device triggers fake outage or resets budget | Role-based token scoping: `PULSEBOX_DEVICE_KEY` restricted to telemetry, rejected with 403 on mutations | `test_backend.py::test_device_token_forbidden_*` |
| **Repudiation** | Denying who triggered a server failure or reset | Structured `[AUDIT_LOG]` records timestamp, caller IP, target, and outcome | Tested in `app.py::audit_log` |
| **Information Disclosure** | API keys leaked to browser or public repository | Token removed from browser storage; `.env` & `secrets.h` gitignored; Gitleaks CI | `test_frontend_*` & `test_design_tokens.js` |
| **Denial of Service** | Flooding backend with giant payloads or requests | 16 KB payload cap (`MAX_CONTENT_LENGTH`) + 120 req/min sliding-window rate limiting | `test_oversized_payload_returns_413` |
| **Elevation of Privilege** | Device token used for administrative state changes | Enforced role check (`role="admin"`) rejects non-admin tokens with 403 Forbidden | `test_backend.py::test_device_token_forbidden_*` |

---

## 5. Remaining Risks & Operational Guidance (Honest Disclosure)

While the project has been hardened, operators should be aware of the following residual risks:

1. **Plain HTTP LAN Token Exposure (CRITICAL RISK when LAN Mode is Active):**
   - **The Vulnerability:** If `PULSEBOX_ALLOW_LAN=true` is enabled to connect an external device over unencrypted HTTP (`http://<ip>:5000`), all HTTP headers—including `Authorization: Bearer <token>`—are transmitted in cleartext. Anyone with packet capture access on the local Wi-Fi / LAN (e.g. via Wireshark or ARP spoofing) can read the token.
   - **Implemented Mitigation (Device-Token Isolation & Future Scoping):** The backend is prepared with an optional scoped `PULSEBOX_DEVICE_KEY` rather than the `PULSEBOX_ADMIN_KEY`. Even if an attacker sniffs a future device token off the local Wi-Fi, they CANNOT trigger fake outages, restore nodes, wipe data, or alter budgets (mutations return 403 Forbidden). Note that read-only `GET /state` requires no token, and the current firmware operates offline with mock/demo data.
   - **Remaining Risk:** An attacker who intercepts the device token can forge health check telemetry (`/record-health-check`) to report false server states.
   - **Operational Recommendation:** Do NOT enable LAN mode on untrusted public/office Wi-Fi networks. If LAN access is required, put the Flask backend behind a reverse proxy (e.g., Caddy, Nginx) terminating local TLS/HTTPS, or isolate IoT desk devices on a dedicated VLAN.
2. **Physical Device Tampering (Flash Firmware Extraction):**
   - The ESP32 hardware currently operates with development eFuses. Flash Encryption and Secure Boot are not burned.
   - An attacker with physical access to the ESP32 and an external programmer could dump SPI flash memory and extract Wi-Fi credentials or the device token stored in firmware.
   - *Operational Recommendation:* For production deployments in shared spaces, enable ESP32 hardware Flash Encryption and NVS encryption before flashing.
3. **In-Memory Rate Limiting Across Restarts:**
   - The rate limiter uses local process memory and resets if the Flask process restarts.
   - *Operational Recommendation:* For multi-worker production deployments, back rate limiting with a shared Redis instance.
4. **Unauthenticated Read-Only Telemetry:**
   - All `GET` endpoints (`/health`, `/state`, `/incidents`, `/costs`, `/weather`) remain unauthenticated so lightweight dashboards and simulators can render without managing credentials. In LAN mode, any device on the network can view system status.
