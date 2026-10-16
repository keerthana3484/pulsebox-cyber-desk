"""
PulseBox Cyber Desk - Flask API Backend (v1.0)
Provides REST endpoints for simulated system state, failure injection, and health checks.
"""

from datetime import datetime, timezone
import os
from typing import Any, Dict, Tuple
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

# Configure CORS restricted to local development origins
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
    allow_headers=["Content-Type"],
)


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


@app.errorhandler(500)
def handle_server_error(e: Any) -> Tuple[Response, int]:
    return jsonify({
        "error": "Internal Server Error",
        "message": "An unexpected server error occurred",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), 500


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
            if not isinstance(body["server_id"], str) or not body["server_id"].strip():
                return jsonify({
                    "error": "Bad Request",
                    "message": "Field 'server_id' must be a non-empty string",
                }), 400
            target_id = body["server_id"].strip()

    success, message, affected = state_manager.simulate_failure(server_id=target_id)

    if not success:
        # Determine whether 404 (not found) or 400 (already failed / all failed)
        valid_ids = [s["id"] for s in state_manager.servers]
        if target_id and target_id not in valid_ids:
            return jsonify({
                "error": "Not Found",
                "message": message,
                "valid_server_ids": valid_ids,
            }), 404
        else:
            return jsonify({
                "error": "Bad Request",
                "message": message,
                "current_state": state_manager.get_state(),
            }), 400

    return jsonify({
        "message": message,
        "affected_server": affected,
        "state": state_manager.get_state(),
    }), 200


@app.route("/restore", methods=["POST"])
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
            if not isinstance(body["server_id"], str) or not body["server_id"].strip():
                return jsonify({
                    "error": "Bad Request",
                    "message": "Field 'server_id' must be a non-empty string",
                }), 400
            target_id = body["server_id"].strip()

        if body.get("clear_incidents") or body.get("reset"):
            state_manager.clear_incidents()

    success, message, restored_count, recovered_count = state_manager.restore(server_id=target_id)

    if not success:
        valid_ids = [s["id"] for s in state_manager.servers]
        return jsonify({
            "error": "Not Found",
            "message": message,
            "valid_server_ids": valid_ids,
        }), 404

    return jsonify({
        "message": message,
        "restored_count": restored_count,
        "recovered_count": recovered_count,
        "state": state_manager.get_state(),
    }), 200


@app.route("/reset", methods=["POST"])
def post_reset() -> Tuple[Response, int]:
    """
    POST /reset
    Resets servers, clears incident history, restores default cost budget,
    and resets weather provider.
    """
    state_manager.reset()
    cost_manager.reset()
    weather_manager.reset()
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

    target_id = body["server_id"].strip()
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

    normalized_status = raw_status.strip().lower()
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
        incidents = [i for i in incidents if i["status"].upper() == status_filter.upper()]

    server_filter = request.args.get("server_id")
    if server_filter:
        incidents = [i for i in incidents if i["server_id"] == server_filter]

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

    # Accept either monthly_budget or budget key
    if "monthly_budget" in body:
        new_budget = body["monthly_budget"]
    elif "budget" in body:
        new_budget = body["budget"]
    else:
        return jsonify({
            "error": "Bad Request",
            "message": "Field 'monthly_budget' is required",
        }), 400

    success, message, updated_settings = cost_manager.update_budget(new_budget)

    if not success:
        return jsonify({
            "error": "Bad Request",
            "message": message,
        }), 400

    return jsonify({
        "message": message,
        "settings": updated_settings,
        "costs": cost_manager.get_cost_summary(),
    }), 200


def get_server_config() -> Tuple[str, int]:
    """
    Retrieves the server host and port configuration from environment variables.
    Defaults to host '127.0.0.1' (localhost only) and port 5000.
    Setting HOST='0.0.0.0' allows external devices (such as an ESP32 on the same trusted LAN)
    to connect to the backend.
    """
    raw_host = os.environ.get("HOST", "127.0.0.1").strip()
    host = raw_host if raw_host else "127.0.0.1"

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
        print(f"Starting PulseBox Cyber Desk backend on {host}:{port} (LAN accessible)...")
        print("WARNING: Binding to 0.0.0.0 exposes this service to all reachable local network interfaces.")
    else:
        print(f"Starting PulseBox Cyber Desk backend on {host}:{port} (Localhost only)...")
    app.run(host=host, port=port, debug=False)

