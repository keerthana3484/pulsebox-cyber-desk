# PulseBox Cyber Desk — Flask Backend API (v1.0)

A lightweight Python Flask REST API providing simulated cluster telemetry, health monitoring, and fault injection for the PulseBox Cyber Desk.

---

## 🚀 Setup & Installation

### 1. Prerequisites
- Python 3.9+ (tested on Python 3.13)
- `pip` package manager

### 2. Install Dependencies
From the repository root or inside `backend/`:

```powershell
cd backend
pip install -r requirements.txt
```

### 3. Start the Backend Server

The backend supports two startup modes:

#### Mode A: Localhost Only Access (Default — Recommended for Laptop Simulator)
By default, the server binds strictly to the loopback interface (`127.0.0.1`):

```powershell
# PowerShell (Windows)
python app.py
```
*(On Linux/macOS: `python app.py`)*

The server listens securely at **`http://127.0.0.1:5000`** and is accessible only from the local machine.

#### Mode B: Optional LAN Access (For ESP32 on Trusted Local Wi-Fi)
To allow an ESP32 microcontroller on the same trusted local network (LAN) to access the backend API, explicitly set `HOST=0.0.0.0`:

```powershell
# PowerShell (Windows)
$env:HOST="0.0.0.0"; python app.py
```
```bash
# Bash (Linux/macOS)
HOST=0.0.0.0 python app.py
```

*(To specify a custom port in either mode: `$env:PORT=5001; python app.py`)*

#### Finding Your Laptop's Private IPv4 Address for ESP32 Firmware
When running in LAN Mode (`HOST=0.0.0.0`), the ESP32 must connect using your laptop's **private IPv4 address** on your local network (e.g. `http://192.168.1.150:5000`):

1. **Find your IP address:**
   - **Windows:** Open PowerShell and run `ipconfig`. Look for the **IPv4 Address** under your active Wi-Fi or Ethernet adapter (e.g. `192.168.1.150` or `10.0.0.42`).
   - **Linux:** Run `ip -4 addr show` or `hostname -I`.
   - **macOS:** Run `ipconfig getifaddr en0` (or `en1`).
2. **Configure future ESP32 firmware:**
   - Set the backend base URL in firmware to: `http://<YOUR_LAPTOP_IP>:5000` (e.g. `http://192.168.1.150:5000/state`).
   - ⚠️ **Important:** Never use `http://127.0.0.1:5000` or `http://localhost:5000` on the ESP32; on a microcontroller, `127.0.0.1` refers to the ESP32 itself, not your laptop!

#### ⚠️ Network Security Warning
- **LAN Exposure Only:** Binding to `0.0.0.0` exposes the Flask development server to any device on the same local network subnet.
- **Trusted Networks Only:** Use LAN mode only on trusted private networks (such as your home or lab Wi-Fi). Do not bind to `0.0.0.0` on untrusted or public networks (such as public Wi-Fi).
- **No Port Forwarding:** Never configure router port forwarding (NAT WAN forwarding) or expose port 5000 to the public internet.
- **No Hardcoded Credentials:** Never hardcode credentials, Wi-Fi passwords, or bot tokens in source code or Git commits.


---

## 🔐 API Authentication & Resource Limits

To protect simulated state and avoid unauthorized alert triggers, all state-mutating `POST` endpoints enforce **Bearer Token Authentication** using the `PULSEBOX_API_KEY` environment variable.

### 1. Configure the API Key
Set `PULSEBOX_API_KEY` in `backend/.env` (or in your shell session):

```env
PULSEBOX_API_KEY=your_secret_api_key_here
```
```powershell
$env:PULSEBOX_API_KEY="your_secret_api_key_here"
```

### 2. Protected Endpoints
The following endpoints require `Authorization: Bearer <PULSEBOX_API_KEY>`:
- `POST /simulate-failure`
- `POST /restore`
- `POST /reset`
- `POST /record-health-check` (alias: `POST /simulate-health-check`)
- `POST /costs/settings`

Public endpoints (`GET /health`, `GET /state`, `GET /incidents`, `GET /costs`, `GET /costs/settings`, `GET /weather`) remain unauthenticated for seamless dashboard telemetry reading.

### 3. Error Responses
- **Missing or Invalid Key:** Returns `401 Unauthorized`:
  ```json
  {
    "error": "Unauthorized",
    "message": "Missing Authorization header. Expected 'Authorization: Bearer <key>'.",
    "timestamp": "2026-10-18T10:00:00.000000Z"
  }
  ```
- **Unconfigured Server Key:** If `PULSEBOX_API_KEY` is not set on the server, protected operations fail safely with `401 Unauthorized` without modifying state.

### 4. Resource & Value Limits
- **Maximum Request Size (`MAX_CONTENT_LENGTH`):** 16 KB. Requests exceeding this return `413 Payload Too Large`.
- **Incident Storage Cap:** In-memory incident history is strictly capped at **100 entries**. When the 101st incident is recorded, the oldest entry is discarded.
- **Monthly Budget Validation:** Values in `POST /costs/settings` must be finite numbers between `$0.01` and `$1,000,000.00`. Values exceeding `$1,000,000.00`, non-numeric strings, booleans, `NaN`, and `Infinity` are rejected with `400 Bad Request`.


---

## 📡 API Endpoints

### 1. `GET /health`
Confirms the backend service is running, returning current uptime and timestamp.

**Example Request:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/health" -Method Get
```

**Example Response (200 OK):**
```json
{
  "service": "PulseBox Cyber Desk Backend",
  "status": "healthy",
  "timestamp": "2026-10-16T08:30:10.123456Z",
  "uptime_seconds": 14.2,
  "version": "1.0.0"
}
```

---

### 2. `GET /state`
Returns the current simulated system status as JSON, including overall health, server count, failed server count, and average latency.

**Example Request:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/state" -Method Get
```

**Example Response (200 OK):**
```json
{
  "average_latency_ms": 22.0,
  "failed_server_count": 0,
  "last_event": "System initialized in healthy state",
  "online_server_count": 6,
  "overall_health": "NOMINAL",
  "server_count": 6,
  "servers": [
    {
      "id": "srv-api",
      "latency_ms": 24,
      "name": "API Gateway",
      "role": "Public Ingress / Envoy",
      "status": "online"
    },
    {
      "id": "srv-auth",
      "latency_ms": 18,
      "name": "Auth Cluster",
      "role": "JWT / OAuth2 / Vault",
      "status": "online"
    },
    {
      "id": "srv-db",
      "latency_ms": 12,
      "name": "PostgreSQL Primary",
      "role": "Transactional Store",
      "status": "online"
    },
    {
      "id": "srv-redis",
      "latency_ms": 2,
      "name": "Redis Cache Cluster",
      "role": "In-Memory Session Store",
      "status": "online"
    },
    {
      "id": "srv-mqtt",
      "latency_ms": 31,
      "name": "MQTT Broker",
      "role": "IoT Telemetry Pipeline",
      "status": "online"
    },
    {
      "id": "srv-edge",
      "latency_ms": 45,
      "name": "Edge Worker Fleet",
      "role": "Global CDN / SSR",
      "status": "online"
    }
  ],
  "simulation_mode": true,
  "timestamp": "2026-10-16T08:30:15.654321Z"
}
```

---

### 3. `POST /simulate-failure`
Simulates a server failure for testing.
- If called with an empty body (`{}`), it automatically selects and fails the first available online server.
- You can optionally target a specific server by passing `{ "server_id": "srv-api" }`.

**Example Request (Auto-fail first online server):**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/simulate-failure" -Method Post -ContentType "application/json"
```

**Example Request (Targeting specific server):**
```powershell
$body = @{ server_id = "srv-edge" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:5000/simulate-failure" -Method Post -ContentType "application/json" -Body $body
```

**Example Response (200 OK):**
```json
{
  "affected_server": {
    "id": "srv-edge",
    "latency_ms": 999,
    "name": "Edge Worker Fleet",
    "status": "failed"
  },
  "message": "Simulated failure applied to 'Edge Worker Fleet' (srv-edge)",
  "state": {
    "average_latency_ms": 181.0,
    "failed_server_count": 1,
    "online_server_count": 5,
    "overall_health": "DEGRADED",
    "server_count": 6
  }
}
```

**Error Handling:**
- Invalid server ID returns `404 Not Found` with a list of valid server IDs.
- Malformed payload or already-failed server returns `400 Bad Request`.

---

### 4. `POST /restore`
Restores simulated servers to healthy online status, resets nominal latencies, resets consecutive failure streaks to zero, records recovery timestamps, and automatically resolves any OPEN incidents for restored servers.
- If called with no body or `{}`: restores **all** 6 servers and resolves all open incidents.
- You can optionally pass `{ "server_id": "srv-edge" }` to restore an individual server.

**Example Request (Restore all servers):**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/restore" -Method Post -ContentType "application/json"
```

**Example Response (200 OK):**
```json
{
  "message": "All 6 simulated servers restored to healthy status",
  "recovered_count": 1,
  "restored_count": 6,
  "state": {
    "average_latency_ms": 22.0,
    "failed_server_count": 0,
    "online_server_count": 6,
    "overall_health": "NOMINAL",
    "server_count": 6
  }
}
```

---

### 5. `POST /record-health-check` (Alias: `POST /simulate-health-check`)
Records an individual health-check result for a simulated server. Used to test consecutive-failure thresholds and automated alert generation without waiting for real infrastructure.

**Alert Rule:**
- When a server reaches **3 consecutive failed health-check results**, an automatic **CRITICAL** incident is generated.
- The alert triggers **only once per failure streak**.
- Additional failed health-checks during the same streak increment the streak count without generating duplicate incidents.
- Restoring the server resets the failure streak and restores alert eligibility for future streaks.

**Required Payload:**
- `server_id`: (string) ID of the server to record health check for (e.g., `"srv-api"`).
- `status`: (string, optional) `"failed"` (default) or `"online"`.

**Example Request (Record 1 failed health check):**
```powershell
$body = @{ server_id = "srv-api"; status = "failed" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:5000/record-health-check" -Method Post -ContentType "application/json" -Body $body
```

**Example Response (3rd consecutive failure triggering CRITICAL incident):**
```json
{
  "consecutive_failure_count": 3,
  "incident_created": true,
  "incident": {
    "consecutive_failure_count": 3,
    "created_at": "2026-10-16T09:35:12.345678Z",
    "id": "INC-001",
    "message": "Server 'API Gateway' (srv-api) reached 3 consecutive failed health checks",
    "resolved_at": null,
    "server_id": "srv-api",
    "server_name": "API Gateway",
    "severity": "CRITICAL",
    "status": "OPEN"
  },
  "message": "Health check failed on 'API Gateway' (streak: 3). Incident INC-001 created.",
  "server_id": "srv-api",
  "status": "failed"
}
```

---

### 6. `GET /incidents`
Returns the in-memory incident history, sorted newest first. Open incidents are marked `OPEN` and transition to `RESOLVED` with a `resolved_at` timestamp when their corresponding server is restored. Historical incidents are never deleted.

**Optional Query Parameters:**
- `?envelope=true`: Wraps the list in an object `{ total_incidents: N, open_incidents_count: N, incidents: [...] }`.
- `?status=OPEN`: Filters by status (`OPEN` or `RESOLVED`).
- `?server_id=srv-api`: Filters by specific server ID.

**Example Request:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/incidents" -Method Get
```

**Example Response (200 OK):**
```json
[
  {
    "consecutive_failure_count": 3,
    "created_at": "2026-10-16T09:35:12.345678Z",
    "id": "INC-001",
    "message": "Server 'API Gateway' (srv-api) reached 3 consecutive failed health checks",
    "resolved_at": null,
    "server_id": "srv-api",
    "server_name": "API Gateway",
    "severity": "CRITICAL",
    "status": "OPEN"
  }
]
```

---

### 7. `GET /costs`
Returns cloud spend summary, 15-day daily trend, service breakdown, budget status, simulation flag, and provider connection status.

> **Honest Simulation Notice:** All cost metrics are deterministic simulated values. Live AWS/Azure billing connections are **not** connected and no real cloud credentials are required.

**Example Request:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/costs" -Method Get
```

**Example Response (200 OK):**
```json
{
  "breakdown": [
    { "amount": 980.4, "color": "#FF5722", "name": "Compute (K8s/EC2)", "percentage": 53.2 },
    { "amount": 462.1, "color": "#FFB300", "name": "Managed DB (RDS)", "percentage": 25.1 },
    { "amount": 218.3, "color": "#FF8A65", "name": "Storage & Backups", "percentage": 11.8 },
    { "amount": 181.8, "color": "#FFE082", "name": "Network & CDN Egress", "percentage": 9.9 }
  ],
  "budget_status": "NORMAL",
  "budget_used_pct": 73.7,
  "currency": "USD",
  "daily_trend": [
    { "amount": 118.0, "day": 1 },
    { "amount": 122.5, "day": 2 },
    { "amount": 64.2, "day": 15 }
  ],
  "data_source_status": "No live billing connection",
  "days_remaining": 15,
  "month_spend": 1842.6,
  "monthly_budget": 2500.0,
  "remaining_budget": 657.4,
  "simulation_mode": true,
  "source": "simulated",
  "timestamp": "2026-10-16T10:00:00.000000Z",
  "today_spend": 64.2
}
```

**Status Thresholds:**
- `NORMAL`: Spend is strictly below 75% of monthly budget.
- `WARNING`: Spend is 75% to 99.99% of monthly budget.
- `BUDGET EXCEEDED`: Spend is 100% or more of monthly budget. Zero or invalid budget handling safely defaults to `BUDGET EXCEEDED` without division by zero.

---

### 8. `GET /costs/settings`
Returns current cloud budget settings, currency, and provider source information.

**Example Request:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/costs/settings" -Method Get
```

**Example Response (200 OK):**
```json
{
  "currency": "USD",
  "monthly_budget": 2500.0,
  "simulation_mode": true,
  "source": "simulated",
  "timestamp": "2026-10-16T10:00:00.000000Z"
}
```

---

### 9. `POST /costs/settings`
Validates and updates the monthly budget.
> **Note on Persistence:** Budget settings are maintained in memory for lightweight execution and reset to the default `$2,500.00` when the Flask backend restarts.

**Validation Rules:**
- Must be a positive numeric amount greater than zero (`> 0`).
- Rejects non-numeric strings, negative numbers, zero, booleans (`true`/`false`), `NaN`, and `Infinity`.

**Example Request:**
```powershell
$body = @{ monthly_budget = 3000.0 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:5000/costs/settings" -Method Post -ContentType "application/json" -Body $body
```

**Example Response (200 OK):**
```json
{
  "costs": { ... },
  "message": "Monthly budget updated to $3000.00",
  "settings": {
    "currency": "USD",
    "monthly_budget": 3000.0,
    "simulation_mode": true,
    "source": "simulated",
    "timestamp": "2026-10-16T10:00:00.000000Z"
  }
}
```

---

### 10. `GET /weather`
Returns current weather telemetry, condition, humidity, wind speed, simulation flag, and data source status.

> **Honest Simulation Notice:** Weather metrics are deterministic simulated values labeled with `DEMO LOCATION`. No live external weather service is connected and no API keys are required.

**Example Request:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/weather" -Method Get
```

**Example Response (200 OK):**
```json
{
  "air_quality": "24 AQI (Good)",
  "condition": "Partly Cloudy",
  "condition_code": "partly_cloudy",
  "condition_symbol": "⛅",
  "data_source_status": "No live weather connection",
  "feels_like_c": 22.5,
  "feels_like_f": 72.5,
  "humidity_pct": 58,
  "location": "DEMO LOCATION",
  "pressure_hpa": 1014,
  "simulation_mode": true,
  "source": "simulated",
  "temperature_c": 22.0,
  "temperature_f": 71.6,
  "timestamp": "2026-10-16T10:40:00.000000Z",
  "uv_index": 3,
  "wind_direction": "NW",
  "wind_speed_kmh": 13.7,
  "wind_speed_mph": 8.5
}
```

---

### 11. `POST /reset`
Resets the simulated cluster nodes, clears incident logs, restores default cost budget ($2,500.00), and resets weather telemetry to default simulation values (used for test isolation).

**Example Request:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/reset" -Method Post
```

---

## 🔒 CORS Configuration

CORS (Cross-Origin Resource Sharing) is explicitly enabled and restricted to trusted local browser simulator origins:
- `http://localhost:5173` (Vite simulator)
- `http://127.0.0.1:5173`
- `http://localhost:3000`
- `http://127.0.0.1:3000`

### 💡 Why CORS is NOT Weakened for ESP32 Integration
- **Browser-Only Enforcement:** CORS is a security mechanism enforced exclusively by web browsers when web pages make cross-origin JavaScript requests (`fetch`, `XMLHttpRequest`).
- **Native Microcontrollers are Unaffected:** Native ESP32 HTTP clients (such as Arduino `HTTPClient` or ESP-IDF `esp_http_client`) communicate directly over TCP/IP sockets. They do not execute inside a web browser, do not send `Origin` headers, and are not subject to CORS restrictions.
- **Strict Security:** Wildcard CORS (`*`) is deliberately avoided to protect the local development server from unauthorized cross-site browser requests.


---

## 🤖 Telegram Notifications Setup

PulseBox Cyber Desk dispatches automated real-time incident and recovery notifications to your Telegram channel or direct chat via Telegram's Bot API over HTTPS.

### 1. Notification Triggers
- **Incident Alert:** Dispatched when a simulated node suffers **3 consecutive failed health checks**, creating a `CRITICAL` incident.
- **Incident Recovery:** Dispatched when an `OPEN` incident transitions to `RESOLVED` upon server restoration.
- **Deduplication:** Extra failure checks within the same streak never duplicate incident alerts. Recovery notifications are only dispatched when an incident actually transitions from `OPEN` to `RESOLVED`.
- **Fault-Tolerant:** Telegram network or API delivery failures are logged safely and will **never** interrupt cluster state operations or roll back incidents.

### 2. How to Create a Telegram Bot
1. Open Telegram and search for [`@BotFather`](https://t.me/BotFather) (the official Telegram bot manager).
2. Send the message `/newbot`.
3. Choose a display name for your bot (e.g. `PulseBox Monitor`).
4. Choose a unique username ending in `bot` (e.g. `pulsebox_cyberdesk_bot`).
5. BotFather will provide an **HTTP API Token** formatted like `123456789:ABCdefGHIjklMNOpqrSTUvwxYZ`.
6. ⚠️ **Security Warning:** Never paste your bot token into public chats, repository issues, or Git commits!

### 3. How to Obtain Your Chat ID
1. Search for your new bot in Telegram and click **Start** (or send `/start`).
2. To find your unique chat ID:
   - **Method A (Quick):** Search for [`@userinfobot`](https://t.me/userinfobot) on Telegram and send `/start`. It will reply with your numeric `Id` (e.g. `987654321`).
   - **Method B (Official API):** Open `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` in your browser and locate `"chat":{"id":987654321}` in the returned JSON.

### 4. Configure Local Environment Variables
Create your local `.env` file from the provided template:
```powershell
cp backend/.env.example backend/.env
```
Edit `backend/.env` (which is excluded from Git via `.gitignore`):
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```
Alternatively, set them in your current terminal session:
```powershell
$env:TELEGRAM_BOT_TOKEN="your_bot_token_here"
$env:TELEGRAM_CHAT_ID="your_chat_id_here"
```
*(If credentials are not configured, the backend continues running normally and marks `notifications_configured: false`.)*

### 5. Safe Testing

#### A. Automated Mocked Tests (Never touches live Telegram servers)
Run the automated backend test suite. All Telegram requests are mocked with in-memory assertions:
```powershell
python -m pytest -v tests/test_backend.py
```

#### B. Optional Live Delivery Test (Local Verification)
To verify real-world message delivery to your Telegram app:
1. Ensure `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set in `backend/.env`.
2. Start the backend: `python app.py`.
3. Verify connectivity via `GET /health` (`"notifications_configured": true`).
4. Trigger 3 consecutive failed health checks on a node:
   ```powershell
   1..3 | ForEach-Object {
       Invoke-RestMethod -Uri "http://127.0.0.1:5000/record-health-check" -Method Post -ContentType "application/json" -Body '{"server_id": "srv-api", "status": "failed"}'
   }
   ```
5. Check your Telegram chat to view the incoming **CRITICAL INCIDENT** alert!
6. Restore the node:
   ```powershell
   Invoke-RestMethod -Uri "http://127.0.0.1:5000/restore" -Method Post -ContentType "application/json" -Body '{"server_id": "srv-api"}'
   ```
7. Check your Telegram chat to view the incoming **INCIDENT RESOLVED** recovery notification!

