"""
PulseBox Cyber Desk - Flask API Backend (v1.0 - Hardened)
Provides REST endpoints for simulated system state, failure injection, and health checks.

Security Invariants:
- All state-mutating POST endpoints enforce Bearer Token auth (PULSEBOX_API_KEY).
- Server binds to 127.0.0.1 by default; 0.0.0.0 requires explicit PULSEBOX_ALLOW_LAN=true opt-in.
- CORS restricted to configured frontend origins (wildcards disallowed).
- In-memory sliding-window rate limiting per remote IP.
- Strict input validation (length, regex, and type guards) on all routes.
- Structured audit logging for state-mutating actions.
"""

from collections import defaultdict, deque
from datetime import datetime, timezone
from functools import wraps
import os
import re
import secrets
import time
from typing import Any, Dict, List, Optional, Tuple
from flask import Flask, jsonify, request, Response
from flask_cors import CORS

try:
    from dotenv import load_dotenv
    dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path)
    else:
        load_dotenv()
except ImportError:
    pass

from notifier import notifier
from state import state_manager
from costs import cost_manager
from weather import weather_manager

app = Flask(__name__)

# Enforce maximum request payload size of 16 KB
MAX_CONTENT_LENGTH = 16 * 1024
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

# -----------------------------------------------------------------------------
# CORS Configuration (Restricted to Configured Frontend Origins)
# -----------------------------------------------------------------------------
raw_origins = os.environ.get("FRONTEND_ORIGIN", "").strip()
if raw_origins:
    ALLOWED_ORIGINS: List[str] = [
        o.strip() for o in raw_origins.split(",") if o.strip() and o.strip() != "*"
    ]
else:
    ALLOWED_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

CORS(
    app,
    resources={r"/*": {"origins": ALLOWED_ORIGINS}},
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# -----------------------------------------------------------------------------
# Input Validation Patterns
# -----------------------------------------------------------------------------
SERVER_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]{1,64}$")
STATUS_PARAM_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]{1,32}$")

# -----------------------------------------------------------------------------
# In-Memory Sliding-Window Rate Limiter
# -----------------------------------------------------------------------------
_request_log: Dict[str, deque] = defaultdict(deque)
_state_change_log: Dict[str, deque] = defaultdict(deque)


def get_client_ip() -> str:
    """Safely extracts client IP address."""
    return request.remote_addr or "127.0.0.1"


def is_rate_limited(ip: str, is_state_change: bool = False) -> bool:
    """
    Sliding-window rate limiter per client IP.
    Bypassed during automated unit tests unless PULSEBOX_TEST_RATE_LIMIT=1 is set.
    """
    if app.config.get("TESTING") and not os.environ.get("PULSEBOX_TEST_RATE_LIMIT"):
        return False

    now = time.time()
    window = 60.0  # 60 seconds

    # General rate limit (default 120 req/min)
    try:
        rate_limit = int(os.environ.get("RATE_LIMIT_PER_MINUTE", "120"))
    except ValueError:
        rate_limit = 120

    dq = _request_log[ip]
    while dq and dq[0] <= now - window:
        dq.popleft()
    if len(dq) >= rate_limit:
        return True
    dq.append(now)

    # State-changing rate limit (default 30 req/min)
    if is_state_change:
        try:
            state_limit = int(os.environ.get("STATE_CHANGE_RATE_LIMIT", "30"))
        except ValueError:
            state_limit = 30

        sdq = _state_change_log[ip]
        while sdq and sdq[0] <= now - window:
            sdq.popleft()
        if len(sdq) >= state_limit:
            return True
        sdq.append(now)

    return False


@app.before_request
def check_rate_limit() -> Optional[Tuple[Response, int]]:
    """Enforces rate limiting before handling request."""
    if request.method == "OPTIONS":
        return None
    ip = get_client_ip()
    is_state_change = request.method in ("POST", "PUT", "DELETE", "PATCH")
    if is_rate_limited(ip, is_state_change=is_state_change):
        return jsonify({
            "error": "Too Many Requests",
            "message": "Rate limit exceeded. Please wait before retrying.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }), 429
    return None


# -----------------------------------------------------------------------------
# Structured Security & Audit Logging
# -----------------------------------------------------------------------------
def audit_log(action: str, target: Optional[str] = None, status: str = "SUCCESS", details: Optional[str] = None):
    """Logs state-changing administrative and simulation actions for auditing."""
    caller_ip = get_client_ip()
    ts = datetime.now(timezone.utc).isoformat()
    detail_str = f" | DETAILS: {details}" if details else ""
    target_str = f" | TARGET: {target}" if target else ""
    print(f"[AUDIT_LOG] {ts} | ACTION: {action} | CALLER_IP: {caller_ip}{target_str} | STATUS: {status}{detail_str}")


# -----------------------------------------------------------------------------
# Authentication Decorator
# -----------------------------------------------------------------------------
def get_api_key() -> Optional[str]:
    """Retrieves PULSEBOX_API_KEY from environment."""
    key = os.environ.get("PULSEBOX_API_KEY", "").strip()
    return key if key else None


def require_api_key(f):
    """
    Decorator requiring Authorization: Bearer <PULSEBOX_API_KEY> on protected endpoints.
    Fails safely if key is not configured or if credentials are missing/invalid.
    Uses timing-attack-safe secrets.compare_digest.
    Never logs or reveals expected or provided credentials.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        expected_key = get_api_key()
        if not expected_key:
            return jsonify({
                "error": "Unauthorized",
                "message": "API key authentication required. Server API key is not configured.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }), 401

        auth_header = request.headers.get("Authorization", "").strip()
        if not auth_header:
            return jsonify({
                "error": "Unauthorized",
                "message": "Missing Authorization header. Expected 'Authorization: Bearer <key>'.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }), 401

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({
                "error": "Unauthorized",
                "message": "Invalid Authorization header format. Expected 'Authorization: Bearer <key>'.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }), 401

        provided_key = parts[1].strip()
        if not secrets.compare_digest(provided_key, expected_key):
            audit_log("AUTH_FAILURE", status="REJECTED", details="Invalid Bearer key attempt")
            return jsonify({
                "error": "Unauthorized",
                "message": "Invalid API key.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }), 401

        return f(*args, **kwargs)

    return decorated


# -----------------------------------------------------------------------------
# Global Error Handlers
# -----------------------------------------------------------------------------
@app.errorhandler(400)
def handle_bad_request(e: Any) -> Tuple[Response, int]:
    return jsonify({
        "error": "Bad Request",
        "message": getattr(e, "description", "Malformed request or invalid payload"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), 400


@app.errorhandler(404)
def handle_not_found(e: Any) -> Tuple[Response, int]:
    return jsonify({
        "error": "Not Found",
        "message": getattr(e, "description", "The requested resource was not found"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), 404


@app.errorhandler(405)
def handle_method_not_allowed(e: Any) -> Tuple[Response, int]:
    return jsonify({
        "error": "Method Not Allowed",
        "message": getattr(e, "description", "The HTTP method is not allowed for this endpoint"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), 405


@app.errorhandler(413)
def handle_payload_too_large(e: Any) -> Tuple[Response, int]:
    return jsonify({
        "error": "Payload Too Large",
        "message": "Request payload exceeds maximum allowed size (16 KB)",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), 413


@app.errorhandler(429)
def handle_too_many_requests(e: Any) -> Tuple[Response, int]:
    return jsonify({
        "error": "Too Many Requests",
        "message": "Rate limit exceeded. Please wait before retrying.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), 429


@app.errorhandler(500)
def handle_server_error(e: Any) -> Tuple[Response, int]:
    return jsonify({
        "error": "Internal Server Error",
        "message": "An unexpected server error occurred",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), 500


# -----------------------------------------------------------------------------
# REST Endpoints
# -----------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def get_health() -> Tuple[Response, int]:
    """
    GET /health
    Confirms that the Cyber Desk backend is running.
    """
    return jsonify({
        "status": "healthy",
        "service": "PulseBox Cyber Desk Backend",
        "version": "1.0.0",
        "uptime_seconds": state_manager.get_uptime_seconds(),
        "notifications_configured": notifier.is_configured(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), 200


@app.route("/state", methods=["GET"])
def get_state() -> Tuple[Response, int]:
    """
    GET /state
    Returns the current simulated system status as JSON,
    including overall health, server count, failed server count, and latency.
    """
    current_state = state_manager.get_state()
    return jsonify(current_state), 200


@app.route("/simulate-failure", methods=["POST"])
@require_api_key
def post_simulate_failure() -> Tuple[Response, int]:
    """
    POST /simulate-failure
    Simulates one server failure for testing.
    Optional JSON payload: { "server_id": "srv-api" }
    If no server_id is specified, the first online server is selected.
    """
    target_id = None

    if request.is_json and request.data:
        try:
            body: Dict[str, Any] = request.get_json(silent=True) or {}
        except Exception:
            return jsonify({
                "error": "Bad Request",
                "message": "Malformed JSON payload in request body",
            }), 400

        if "server_id" in body:
            raw_id = body["server_id"]
            if not isinstance(raw_id, str) or not raw_id.strip():
                return jsonify({
                    "error": "Bad Request",
                    "message": "Field 'server_id' must be a non-empty string",
                }), 400
            clean_id = raw_id.strip()
            if not SERVER_ID_PATTERN.match(clean_id):
                return jsonify({
                    "error": "Bad Request",
                    "message": "Field 'server_id' contains invalid characters or exceeds 64 characters",
                }), 400
            target_id = clean_id

    success, message, affected = state_manager.simulate_failure(server_id=target_id)

    if not success:
        valid_ids = [s["id"] for s in state_manager.servers]
        if target_id and target_id not in valid_ids:
            audit_log("SIMULATE_FAILURE", target=target_id, status="NOT_FOUND", details=message)
            return jsonify({
                "error": "Not Found",
                "message": message,
                "valid_server_ids": valid_ids,
            }), 404
        else:
            audit_log("SIMULATE_FAILURE", target=target_id, status="BAD_REQUEST", details=message)
            return jsonify({
                "error": "Bad Request",
                "message": message,
                "current_state": state_manager.get_state(),
            }), 400

    audit_log("SIMULATE_FAILURE", target=affected["id"] if affected else target_id, status="SUCCESS")
    return jsonify({
        "message": message,
        "affected_server": affected,
        "state": state_manager.get_state(),
    }), 200


@app.route("/restore", methods=["POST"])
@require_api_key
def post_restore() -> Tuple[Response, int]:
    """
    POST /restore
    Restores simulated servers to healthy online status.
    Optional JSON payload: { "server_id": "srv-api" }
    If no server_id is provided, all servers are restored.
    """
    target_id = None

    if request.is_json and request.data:
        try:
            body: Dict[str, Any] = request.get_json(silent=True) or {}
        except Exception:
            return jsonify({
                "error": "Bad Request",
                "message": "Malformed JSON payload in request body",
            }), 400

        if "server_id" in body:
            raw_id = body["server_id"]
            if not isinstance(raw_id, str) or not raw_id.strip():
                return jsonify({
                    "error": "Bad Request",
                    "message": "Field 'server_id' must be a non-empty string",
                }), 400
            clean_id = raw_id.strip()
            if not SERVER_ID_PATTERN.match(clean_id):
                return jsonify({
                    "error": "Bad Request",
                    "message": "Field 'server_id' contains invalid characters or exceeds 64 characters",
                }), 400
            target_id = clean_id

        if body.get("clear_incidents") or body.get("reset"):
            state_manager.clear_incidents()

    success, message, restored_count, recovered_count = state_manager.restore(server_id=target_id)

    if not success:
        valid_ids = [s["id"] for s in state_manager.servers]
        audit_log("RESTORE", target=target_id, status="NOT_FOUND", details=message)
        return jsonify({
            "error": "Not Found",
            "message": message,
            "valid_server_ids": valid_ids,
        }), 404

    audit_log("RESTORE", target=target_id or "ALL", status="SUCCESS", details=f"restored={restored_count}")
    return jsonify({
        "message": message,
        "restored_count": restored_count,
        "recovered_count": recovered_count,
        "state": state_manager.get_state(),
    }), 200


@app.route("/reset", methods=["POST"])
@require_api_key
def post_reset() -> Tuple[Response, int]:
    """
    POST /reset
    Resets servers, clears incident history, restores default cost budget,
    and resets weather provider.
    """
    state_manager.reset()
    cost_manager.reset()
    weather_manager.reset()
    audit_log("RESET", target="SYSTEM", status="SUCCESS", details="Factory state restored")
    return jsonify({
        "message": "Simulated cluster, incidents, cost budget, and weather reset to defaults",
        "state": state_manager.get_state(),
        "costs": cost_manager.get_cost_summary(),
        "weather": weather_manager.get_weather(),
    }), 200


@app.route("/weather", methods=["GET"])
def get_weather() -> Tuple[Response, int]:
    """
    GET /weather
    Returns current simulated weather telemetry, conditions, humidity,
    wind speed, simulation flag, and data source status.
    """
    telemetry = weather_manager.get_weather()
    return jsonify(telemetry), 200


@app.route("/record-health-check", methods=["POST"])
@app.route("/simulate-health-check", methods=["POST"])
@require_api_key
def post_record_health_check() -> Tuple[Response, int]:
    """
    POST /record-health-check
    Records an individual health-check result for a simulated server.
    Used to test consecutive-failure thresholds without waiting for real infrastructure.
    Required JSON payload: { "server_id": "srv-api" }
    Optional fields:
      - status: "failed" (default) or "online"
    """
    if not request.is_json or not request.data:
        return jsonify({
            "error": "Bad Request",
            "message": "Request body must be a JSON object with 'server_id'",
        }), 400

    try:
        body: Dict[str, Any] = request.get_json(silent=True) or {}
    except Exception:
        return jsonify({
            "error": "Bad Request",
            "message": "Malformed JSON payload in request body",
        }), 400

    if "server_id" not in body or not isinstance(body["server_id"], str) or not body["server_id"].strip():
        return jsonify({
            "error": "Bad Request",
            "message": "Field 'server_id' is required and must be a non-empty string",
        }), 400

    raw_id = body["server_id"].strip()
    if not SERVER_ID_PATTERN.match(raw_id):
        return jsonify({
            "error": "Bad Request",
            "message": "Field 'server_id' contains invalid characters or exceeds 64 characters",
        }), 400

    target_id = raw_id
    valid_ids = [s["id"] for s in state_manager.servers]
    if target_id not in valid_ids:
        return jsonify({
            "error": "Not Found",
            "message": f"Server with id '{target_id}' not found",
            "valid_server_ids": valid_ids,
        }), 404

    raw_status = body.get("status") or body.get("result") or "failed"
    if not isinstance(raw_status, str):
        return jsonify({
            "error": "Bad Request",
            "message": "Field 'status' must be a string",
        }), 400

    clean_status = raw_status.strip()
    if not STATUS_PARAM_PATTERN.match(clean_status):
        return jsonify({
            "error": "Bad Request",
            "message": "Field 'status' contains invalid characters",
        }), 400

    normalized_status = clean_status.lower()
    if normalized_status in ("failed", "fail", "unhealthy", "error"):
        check_status = "failed"
    elif normalized_status in ("online", "healthy", "ok", "pass"):
        check_status = "online"
    else:
        return jsonify({
            "error": "Bad Request",
            "message": f"Invalid status '{raw_status}'. Must be 'failed' or 'online'",
        }), 400

    success, message, affected, created_incident = state_manager.record_health_check(
        server_id=target_id,
        status=check_status,
    )

    if not success:
        return jsonify({
            "error": "Bad Request",
            "message": message,
        }), 400

    audit_log("RECORD_HEALTH_CHECK", target=target_id, status="SUCCESS", details=f"status={check_status}")
    return jsonify({
        "message": message,
        "server_id": target_id,
        "status": check_status,
        "consecutive_failure_count": affected["consecutive_failure_count"],
        "incident_created": created_incident is not None,
        "incident": created_incident,
        "server": affected,
        "state": state_manager.get_state(),
    }), 200


@app.route("/incidents", methods=["GET"])
def get_incidents() -> Tuple[Response, int]:
    """
    GET /incidents
    Returns the in-memory incident history, newest first.
    Query parameters:
      - envelope: "true" to return { "incidents": [...], "total_incidents": N }
      - status: optional filter ("OPEN" or "RESOLVED")
      - server_id: optional filter by server
    """
    incidents = state_manager.get_incidents()

    status_filter = request.args.get("status")
    if status_filter:
        clean_status = status_filter.strip()
        if STATUS_PARAM_PATTERN.match(clean_status):
            incidents = [i for i in incidents if i["status"].upper() == clean_status.upper()]

    server_filter = request.args.get("server_id")
    if server_filter:
        clean_server = server_filter.strip()
        if SERVER_ID_PATTERN.match(clean_server):
            incidents = [i for i in incidents if i["server_id"] == clean_server]

    if request.args.get("envelope", "").lower() in ("true", "1") or request.args.get("format") in ("dict", "object"):
        return jsonify({
            "incidents": incidents,
            "total_incidents": len(incidents),
            "open_incidents_count": sum(1 for i in incidents if i["status"] == "OPEN"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }), 200

    return jsonify(incidents), 200


@app.route("/costs", methods=["GET"])
def get_costs() -> Tuple[Response, int]:
    """
    GET /costs
    Returns current cost summary, daily trend, budget status, source,
    simulation flag, and timestamp.
    """
    summary = cost_manager.get_cost_summary()
    return jsonify(summary), 200


@app.route("/costs/settings", methods=["GET"])
def get_cost_settings() -> Tuple[Response, int]:
    """
    GET /costs/settings
    Returns current budget configuration and simulation metadata.
    """
    settings = cost_manager.get_settings()
    return jsonify(settings), 200


@app.route("/costs/settings", methods=["POST"])
@require_api_key
def post_cost_settings() -> Tuple[Response, int]:
    """
    POST /costs/settings
    Validates and updates the monthly budget in memory.
    Required JSON payload: { "monthly_budget": 3000.0 } (or "budget")
    Rejects invalid, zero, negative, boolean, non-numeric, or malformed values.
    """
    if not request.is_json or not request.data:
        return jsonify({
            "error": "Bad Request",
            "message": "Request body must be a JSON object with 'monthly_budget'",
        }), 400

    try:
        body: Dict[str, Any] = request.get_json(silent=True) or {}
    except Exception:
        return jsonify({
            "error": "Bad Request",
            "message": "Malformed JSON payload in request body",
        }), 400

    if "monthly_budget" in body:
        new_budget = body["monthly_budget"]
    elif "budget" in body:
        new_budget = body["budget"]
    else:
        return jsonify({
            "error": "Bad Request",
            "message": "Field 'monthly_budget' is required",
        }), 400

    # Explicit guard against booleans
    if isinstance(new_budget, bool):
        return jsonify({
            "error": "Bad Request",
            "message": "Field 'monthly_budget' cannot be a boolean",
        }), 400

    success, message, updated_settings = cost_manager.update_budget(new_budget)

    if not success:
        audit_log("UPDATE_BUDGET", target="BUDGET", status="BAD_REQUEST", details=message)
        return jsonify({
            "error": "Bad Request",
            "message": message,
        }), 400

    audit_log("UPDATE_BUDGET", target="BUDGET", status="SUCCESS", details=f"new_budget={new_budget}")
    return jsonify({
        "message": message,
        "settings": updated_settings,
        "costs": cost_manager.get_cost_summary(),
    }), 200


# -----------------------------------------------------------------------------
# Server Configuration (Default 127.0.0.1, LAN Explicit Opt-In)
# -----------------------------------------------------------------------------
def get_server_config() -> Tuple[str, int]:
    """
    Retrieves the server host and port configuration from environment variables.
    Defaults to host '127.0.0.1' (localhost only) and port 5000.
    
    SECURITY ENFORCEMENT:
    Binding to '0.0.0.0' or external interfaces requires explicit opt-in via:
    PULSEBOX_ALLOW_LAN=true (or '1' / 'yes').
    If HOST is configured as '0.0.0.0' without explicit opt-in, it safely defaults
    back to '127.0.0.1' to prevent unintended local network exposure.
    """
    raw_host = os.environ.get("HOST", "127.0.0.1").strip()
    lan_opt_in = os.environ.get("PULSEBOX_ALLOW_LAN", "").strip().lower() in ("true", "1", "yes")

    if raw_host in ("0.0.0.0", "::"):
        if not lan_opt_in:
            print("[SECURITY] Binding to 0.0.0.0 was requested but PULSEBOX_ALLOW_LAN is not enabled.")
            print("[SECURITY] Defaulting safely to 127.0.0.1 (Localhost). Set PULSEBOX_ALLOW_LAN=true to opt in.")
            host = "127.0.0.1"
        else:
            host = "0.0.0.0"
    elif raw_host:
        host = raw_host
    else:
        host = "127.0.0.1"

    raw_port = os.environ.get("PORT", "5000").strip()
    try:
        port = int(raw_port)
        if port < 1 or port > 65535:
            port = 5000
    except ValueError:
        port = 5000

    return host, port


if __name__ == "__main__":
    host, port = get_server_config()
    if host == "0.0.0.0":
        print(f"Starting PulseBox Cyber Desk backend on {host}:{port} (LAN accessible - PULSEBOX_ALLOW_LAN enabled)...")
        print("WARNING: Binding to 0.0.0.0 exposes this service to all reachable local network interfaces.")
    else:
        print(f"Starting PulseBox Cyber Desk backend on {host}:{port} (Localhost loopback only)...")
    app.run(host=host, port=port, debug=False)
