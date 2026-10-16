"""
Comprehensive test suite for PulseBox Cyber Desk Flask backend API and state manager.

Tests:
- GET /health
- GET /state
- POST /simulate-failure (single and multiple failures, health threshold transitions)
- POST /restore (single server restore and all-servers restore)
- Input validation and error responses (400, 404)
"""

import sys
from pathlib import Path
import pytest

# Ensure backend directory is in python import path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app import app, get_server_config, ALLOWED_ORIGINS
from state import state_manager
from costs import (
    cost_manager,
    SimulatedBillingProvider,
    AWSBillingProvider,
    AzureBillingProvider,
)
from weather import (
    weather_manager,
    SimulatedWeatherProvider,
    OpenWeatherMapProvider,
    WeatherApiProvider,
)
from notifier import notifier


@pytest.fixture(autouse=True)
def reset_state(monkeypatch):
    """Ensure every test starts with all servers in healthy online state, clean incidents, default costs, weather, and clean env."""
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
    state_manager.reset()
    cost_manager.reset()
    weather_manager.reset()
    yield
    state_manager.reset()
    cost_manager.reset()
    weather_manager.reset()


@pytest.fixture
def client():
    """Flask test client."""
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


# ============================================================================
# 1. HEALTH ENDPOINT TEST
# ============================================================================

def test_get_health(client):
    """Verify GET /health returns 200 with service and uptime."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "healthy"
    assert data["service"] == "PulseBox Cyber Desk Backend"
    assert "uptime_seconds" in data
    assert data["uptime_seconds"] >= 0
    assert "timestamp" in data


# ============================================================================
# 2. INITIAL NOMINAL STATE TEST
# ============================================================================

def test_initial_nominal_state(client):
    """Verify initial cluster status is NOMINAL with all 6 servers online."""
    res = client.get("/state")
    assert res.status_code == 200
    data = res.get_json()
    assert data["overall_health"] == "NOMINAL"
    assert data["server_count"] == 6
    assert data["failed_server_count"] == 0
    assert data["online_server_count"] == 6
    assert data["average_latency_ms"] == 22.0
    assert len(data["servers"]) == 6
    for s in data["servers"]:
        assert s["status"] == "online"


# ============================================================================
# 3. FAILING ONE SERVER (NOMINAL -> DEGRADED)
# ============================================================================

def test_fail_one_server(client):
    """
    Failing 1 server must transition overall_health from NOMINAL to DEGRADED.
    Threshold rule: failed_count == 1 -> DEGRADED
    """
    res = client.post("/simulate-failure", json={"server_id": "srv-api"})
    assert res.status_code == 200
    data = res.get_json()

    assert data["affected_server"]["id"] == "srv-api"
    assert data["affected_server"]["status"] == "failed"
    assert data["affected_server"]["latency_ms"] == 999

    state = data["state"]
    assert state["server_count"] == 6
    assert state["failed_server_count"] == 1
    assert state["online_server_count"] == 5
    assert state["overall_health"] == "DEGRADED"
    # Latency increases with 999ms on srv-api
    assert state["average_latency_ms"] > 100.0


# ============================================================================
# 4. FAILING MULTIPLE SERVERS (DEGRADED -> CRITICAL)
# ============================================================================

def test_fail_multiple_servers(client):
    """
    Failing 2 or more servers must transition overall_health to CRITICAL.
    Threshold rule: failed_count >= 2 -> CRITICAL
    """
    # 1st failure: srv-api
    res1 = client.post("/simulate-failure", json={"server_id": "srv-api"})
    assert res1.status_code == 200
    assert res1.get_json()["state"]["overall_health"] == "DEGRADED"

    # 2nd failure: srv-edge -> CRITICAL
    res2 = client.post("/simulate-failure", json={"server_id": "srv-edge"})
    assert res2.status_code == 200
    state2 = res2.get_json()["state"]
    assert state2["failed_server_count"] == 2
    assert state2["online_server_count"] == 4
    assert state2["overall_health"] == "CRITICAL"

    # 3rd failure: srv-db -> still CRITICAL
    res3 = client.post("/simulate-failure", json={"server_id": "srv-db"})
    assert res3.status_code == 200
    state3 = res3.get_json()["state"]
    assert state3["failed_server_count"] == 3
    assert state3["online_server_count"] == 3
    assert state3["overall_health"] == "CRITICAL"


# ============================================================================
# 5. RESTORING ONE SERVER
# ============================================================================

def test_restore_one_server(client):
    """
    Restoring one server reduces failed_server_count by 1 and updates health threshold.
    """
    # Fail 2 servers (srv-api, srv-edge)
    client.post("/simulate-failure", json={"server_id": "srv-api"})
    client.post("/simulate-failure", json={"server_id": "srv-edge"})

    # Check CRITICAL
    assert client.get("/state").get_json()["overall_health"] == "CRITICAL"

    # Restore srv-api
    res = client.post("/restore", json={"server_id": "srv-api"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["restored_count"] == 1
    assert data["recovered_count"] == 1

    state = data["state"]
    assert state["failed_server_count"] == 1
    assert state["online_server_count"] == 5
    # Since only 1 server remains failed, health transitions back to DEGRADED
    assert state["overall_health"] == "DEGRADED"

    # Verify srv-api is back to nominal latency
    srv_api = next(s for s in state["servers"] if s["id"] == "srv-api")
    assert srv_api["status"] == "online"
    assert srv_api["latency_ms"] == 24


# ============================================================================
# 6. RESTORING ALL SERVERS WITHOUT SERVER_ID
# ============================================================================

def test_restore_all_servers_without_server_id(client):
    """
    POST /restore without server_id must restore all 6 servers.
    restored_count must be 6, and overall_health must be NOMINAL.
    """
    # Fail multiple servers
    client.post("/simulate-failure", json={"server_id": "srv-api"})
    client.post("/simulate-failure", json={"server_id": "srv-auth"})
    client.post("/simulate-failure", json={"server_id": "srv-edge"})

    # Check state before restore
    pre_state = client.get("/state").get_json()
    assert pre_state["failed_server_count"] == 3
    assert pre_state["overall_health"] == "CRITICAL"

    # Restore all without server_id
    res = client.post("/restore")
    assert res.status_code == 200
    data = res.get_json()

    # Verify restored_count is 6 (all six servers restored to healthy)
    assert data["restored_count"] == 6
    assert data["recovered_count"] == 3
    assert "All 6 simulated servers restored" in data["message"]

    state = data["state"]
    assert state["server_count"] == 6
    assert state["failed_server_count"] == 0
    assert state["online_server_count"] == 6
    assert state["overall_health"] == "NOMINAL"
    assert state["average_latency_ms"] == 22.0

    for s in state["servers"]:
        assert s["status"] == "online"
        assert s["latency_ms"] in (24, 18, 12, 2, 31, 45)


def test_restore_all_when_none_failed(client):
    """
    POST /restore without server_id when all are already online
    must still return restored_count == 6 and NOMINAL.
    """
    res = client.post("/restore", json={})
    assert res.status_code == 200
    data = res.get_json()
    assert data["restored_count"] == 6
    assert data["recovered_count"] == 0
    assert data["state"]["overall_health"] == "NOMINAL"
    assert data["state"]["failed_server_count"] == 0


# ============================================================================
# 7. INPUT VALIDATION & ERROR HANDLING
# ============================================================================

def test_simulate_failure_validation(client):
    """Verify 404 for unknown server_id and 400 for bad payloads."""
    # Unknown ID -> 404
    res_404 = client.post("/simulate-failure", json={"server_id": "srv-unknown"})
    assert res_404.status_code == 404
    assert res_404.get_json()["error"] == "Not Found"
    assert "valid_server_ids" in res_404.get_json()

    # Non-string ID -> 400
    res_400 = client.post("/simulate-failure", json={"server_id": 9999})
    assert res_400.status_code == 400
    assert res_400.get_json()["error"] == "Bad Request"

    # Already failed server -> 400
    client.post("/simulate-failure", json={"server_id": "srv-api"})
    res_dup = client.post("/simulate-failure", json={"server_id": "srv-api"})
    assert res_dup.status_code == 400
    assert "already failed" in res_dup.get_json()["message"]


def test_restore_validation(client):
    """Verify 404 for unknown server_id on restore."""
    res_404 = client.post("/restore", json={"server_id": "srv-notfound"})
    assert res_404.status_code == 404
    assert res_404.get_json()["error"] == "Not Found"

    res_400 = client.post("/restore", json={"server_id": 1234})
    assert res_400.status_code == 400


# ============================================================================
# 8. CONSECUTIVE FAILURE & AUTOMATIC ALERT TESTS (1 TO 6)
# ============================================================================

def test_single_failed_health_check_no_incident(client):
    """
    Scenario 1: A single failed health-check result does not create a three-failure incident.
    Consecutive failure count transitions to 1.
    """
    res = client.post("/record-health-check", json={"server_id": "srv-api", "status": "failed"})
    assert res.status_code == 200
    data = res.get_json()

    assert data["consecutive_failure_count"] == 1
    assert data["incident_created"] is False
    assert data["incident"] is None
    assert data["server"]["status"] == "failed"
    assert data["server"]["consecutive_failure_count"] == 1
    assert data["server"]["first_failure_timestamp"] is not None
    assert data["server"]["last_failure_timestamp"] is not None

    # Check GET /incidents has 0 incidents
    inc_res = client.get("/incidents")
    assert inc_res.status_code == 200
    incidents = inc_res.get_json()
    assert isinstance(incidents, list)
    assert len(incidents) == 0


def test_two_consecutive_failed_health_checks_no_incident(client):
    """
    Scenario 2: Two consecutive failed results do not create the incident.
    Consecutive failure count transitions from 1 to 2.
    """
    # 1st failure
    client.post("/record-health-check", json={"server_id": "srv-auth", "status": "failed"})
    # 2nd failure
    res2 = client.post("/record-health-check", json={"server_id": "srv-auth", "status": "failed"})
    assert res2.status_code == 200
    data2 = res2.get_json()

    assert data2["consecutive_failure_count"] == 2
    assert data2["incident_created"] is False
    assert data2["incident"] is None

    # Check GET /incidents still has 0 incidents
    inc_res = client.get("/incidents")
    assert len(inc_res.get_json()) == 0


def test_three_consecutive_failed_health_checks_creates_single_incident(client):
    """
    Scenario 3: Three consecutive failed results create exactly one CRITICAL incident.
    Incident contains: id, server_id, server_name, severity, message, created_at,
    consecutive_failure_count, status="OPEN", resolved_at=None.
    """
    # 1st failure
    client.post("/record-health-check", json={"server_id": "srv-db", "status": "failed"})
    # 2nd failure
    client.post("/record-health-check", json={"server_id": "srv-db", "status": "failed"})
    # 3rd failure -> Trigger
    res3 = client.post("/record-health-check", json={"server_id": "srv-db", "status": "failed"})
    assert res3.status_code == 200
    data3 = res3.get_json()

    assert data3["consecutive_failure_count"] == 3
    assert data3["incident_created"] is True
    incident = data3["incident"]
    assert incident is not None
    assert incident["id"].startswith("INC-")
    assert incident["server_id"] == "srv-db"
    assert incident["server_name"] == "PostgreSQL Primary"
    assert incident["severity"] == "CRITICAL"
    assert "consecutive failed health checks" in incident["message"]
    assert incident["consecutive_failure_count"] == 3
    assert incident["status"] == "OPEN"
    assert incident["created_at"] is not None
    assert incident["resolved_at"] is None

    # Check GET /incidents returns exactly 1 incident
    inc_res = client.get("/incidents")
    assert inc_res.status_code == 200
    incidents = inc_res.get_json()
    assert len(incidents) == 1
    assert incidents[0]["id"] == incident["id"]
    assert incidents[0]["status"] == "OPEN"


def test_additional_failures_same_streak_no_duplicate_incident(client):
    """
    Scenario 4: Additional failed results during the same streak do not duplicate the incident.
    """
    # 3 consecutive failures to trigger incident
    for _ in range(3):
        client.post("/record-health-check", json={"server_id": "srv-redis", "status": "failed"})

    inc_res1 = client.get("/incidents")
    incidents1 = inc_res1.get_json()
    assert len(incidents1) == 1
    first_incident_id = incidents1[0]["id"]

    # 4th failure in same streak
    res4 = client.post("/record-health-check", json={"server_id": "srv-redis", "status": "failed"})
    assert res4.status_code == 200
    data4 = res4.get_json()
    assert data4["consecutive_failure_count"] == 4
    assert data4["incident_created"] is False
    assert data4["incident"] is None

    # 5th failure in same streak
    res5 = client.post("/record-health-check", json={"server_id": "srv-redis", "status": "failed"})
    assert res5.status_code == 200
    data5 = res5.get_json()
    assert data5["consecutive_failure_count"] == 5
    assert data5["incident_created"] is False

    # Check GET /incidents STILL has only 1 incident
    inc_res2 = client.get("/incidents")
    incidents2 = inc_res2.get_json()
    assert len(incidents2) == 1
    assert incidents2[0]["id"] == first_incident_id


def test_restoring_server_resolves_open_incident_and_resets_streak(client):
    """
    Scenario 5: Restoring a server resolves its open incident and resets its failure streak.
    Historical incident is NOT deleted.
    """
    # Trigger 3 failures on srv-mqtt
    for _ in range(3):
        client.post("/record-health-check", json={"server_id": "srv-mqtt", "status": "failed"})

    # Verify 1 open incident
    incidents = client.get("/incidents").get_json()
    assert len(incidents) == 1
    assert incidents[0]["status"] == "OPEN"
    assert incidents[0]["resolved_at"] is None

    # Restore srv-mqtt
    res_restore = client.post("/restore", json={"server_id": "srv-mqtt"})
    assert res_restore.status_code == 200

    # Verify server state reset
    state = client.get("/state").get_json()
    srv_mqtt = next(s for s in state["servers"] if s["id"] == "srv-mqtt")
    assert srv_mqtt["status"] == "online"
    assert srv_mqtt["consecutive_failure_count"] == 0
    assert srv_mqtt["recovery_timestamp"] is not None

    # Verify incident is RESOLVED and not deleted
    incidents_after = client.get("/incidents").get_json()
    assert len(incidents_after) == 1
    assert incidents_after[0]["id"] == incidents[0]["id"]
    assert incidents_after[0]["status"] == "RESOLVED"
    assert incidents_after[0]["resolved_at"] is not None


def test_later_failure_streak_creates_new_incident(client):
    """
    Scenario 6: A later failure streak can create a new incident.
    Order must be newest first.
    """
    # 1st streak: 3 failures on srv-edge -> INC-001
    for _ in range(3):
        client.post("/record-health-check", json={"server_id": "srv-edge", "status": "failed"})
    inc1 = client.get("/incidents").get_json()
    assert len(inc1) == 1
    id1 = inc1[0]["id"]

    # Restore server -> resolves INC-001
    client.post("/restore", json={"server_id": "srv-edge"})
    inc1_resolved = client.get("/incidents").get_json()
    assert inc1_resolved[0]["status"] == "RESOLVED"

    # 2nd streak: 1st failure (count 1, no incident)
    client.post("/record-health-check", json={"server_id": "srv-edge", "status": "failed"})
    # 2nd failure (count 2, no incident)
    client.post("/record-health-check", json={"server_id": "srv-edge", "status": "failed"})
    # 3rd failure (count 3, creates NEW incident INC-002)
    res_streak2 = client.post("/record-health-check", json={"server_id": "srv-edge", "status": "failed"})
    assert res_streak2.status_code == 200
    assert res_streak2.get_json()["incident_created"] is True

    # Check GET /incidents has 2 incidents, sorted newest first
    inc_all = client.get("/incidents").get_json()
    assert len(inc_all) == 2
    assert inc_all[0]["status"] == "OPEN"
    assert inc_all[0]["id"] != id1
    assert inc_all[1]["id"] == id1
    assert inc_all[1]["status"] == "RESOLVED"


def test_record_health_check_validation_invalid_ids(client):
    """
    Scenario 7: Invalid server IDs and bad payloads return appropriate HTTP errors.
    """
    # Missing server_id
    res_missing = client.post("/record-health-check", json={"status": "failed"})
    assert res_missing.status_code == 400
    assert "server_id" in res_missing.get_json()["message"]

    # Unknown server_id -> 404
    res_unknown = client.post("/record-health-check", json={"server_id": "srv-nonexistent"})
    assert res_unknown.status_code == 404
    assert "not found" in res_unknown.get_json()["message"]

    # Non-string server_id -> 400
    res_num = client.post("/record-health-check", json={"server_id": 999})
    assert res_num.status_code == 400

    # Invalid status -> 400
    res_bad_status = client.post("/record-health-check", json={"server_id": "srv-api", "status": "flying"})
    assert res_bad_status.status_code == 400

    # Non-JSON payload -> 400
    res_no_json = client.post("/record-health-check", data="not json")
    assert res_no_json.status_code == 400


def test_manual_simulate_failure_single_event_not_three_failures(client):
    """
    Verify requirement 2: A manual POST /simulate-failure action represents one
    simulated failure event, not three separate health-check results.
    Does not trigger the three-failure alert.
    Repeated failure on already failed server returns 400 and does not increase count.
    """
    res = client.post("/simulate-failure", json={"server_id": "srv-api"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["affected_server"]["consecutive_failure_count"] == 1

    # Incidents must remain empty
    incidents = client.get("/incidents").get_json()
    assert len(incidents) == 0

    # Repeated simulate-failure must NOT artificially increase failure count
    res_repeat = client.post("/simulate-failure", json={"server_id": "srv-api"})
    assert res_repeat.status_code == 400

    state = client.get("/state").get_json()
    srv_api = next(s for s in state["servers"] if s["id"] == "srv-api")
    assert srv_api["consecutive_failure_count"] == 1

    # Still no incidents
    assert len(client.get("/incidents").get_json()) == 0


def test_restore_all_resolves_all_open_incidents(client):
    """
    Verify restore-all resolves open incidents across multiple servers
    while keeping the historical records intact.
    """
    # Create 3-failure incident on srv-api
    for _ in range(3):
        client.post("/record-health-check", json={"server_id": "srv-api", "status": "failed"})

    # Create 3-failure incident on srv-auth
    for _ in range(3):
        client.post("/record-health-check", json={"server_id": "srv-auth", "status": "failed"})

    incidents_before = client.get("/incidents").get_json()
    assert len(incidents_before) == 2
    assert all(i["status"] == "OPEN" for i in incidents_before)

    # Restore all servers
    res = client.post("/restore")
    assert res.status_code == 200
    data = res.get_json()
    assert data["restored_count"] == 6
    assert data["recovered_count"] == 2
    assert data["state"]["overall_health"] == "NOMINAL"

    # All incidents must now be RESOLVED
    incidents_after = client.get("/incidents").get_json()
    assert len(incidents_after) == 2
    assert all(i["status"] == "RESOLVED" for i in incidents_after)
    assert all(i["resolved_at"] is not None for i in incidents_after)


# ============================================================================
# 9. TELEGRAM NOTIFICATION TESTS (1 TO 8)
# ============================================================================

import json
import logging
import urllib.error
from unittest.mock import MagicMock, patch


class MockTelegramResponse:
    def __init__(self, status=200):
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def read(self):
        return b'{"ok": true, "result": {}}'


def test_telegram_missing_credentials_works_normally(client):
    """
    Scenario 1: Missing credentials - application still works normally.
    No exceptions or crashes; incident created & resolved smoothly.
    """
    assert notifier.is_configured() is False

    health_res = client.get("/health")
    assert health_res.status_code == 200
    assert health_res.get_json()["notifications_configured"] is False

    # Trigger 3 failures -> incident created without error
    for _ in range(3):
        res = client.post("/record-health-check", json={"server_id": "srv-api", "status": "failed"})
        assert res.status_code == 200

    incidents = client.get("/incidents").get_json()
    assert len(incidents) == 1
    assert incidents[0]["status"] == "OPEN"

    # Restore server -> resolved without error
    restore_res = client.post("/restore", json={"server_id": "srv-api"})
    assert restore_res.status_code == 200
    incidents_after = client.get("/incidents").get_json()
    assert incidents_after[0]["status"] == "RESOLVED"


def test_telegram_successful_mocked_incident_notification(client, monkeypatch):
    """
    Scenario 2: Successful mocked incident notification.
    Verifies payload contains incident ID, server name, severity, event type,
    UTC timestamp, and OPEN status.
    """
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "test_bot_token_123")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "test_chat_id_456")
    assert notifier.is_configured() is True

    captured_requests = []

    def mock_urlopen(req, timeout=3.0):
        captured_requests.append(req)
        return MockTelegramResponse(status=200)

    with patch("urllib.request.urlopen", side_effect=mock_urlopen):
        # Trigger 3 failures on srv-api
        for _ in range(3):
            client.post("/record-health-check", json={"server_id": "srv-api", "status": "failed"})

    assert len(captured_requests) == 1
    req = captured_requests[0]

    # Verify HTTPS Bot API endpoint (contains token in path per Telegram spec)
    assert req.full_url == "https://api.telegram.org/bottest_bot_token_123/sendMessage"
    assert req.headers["Content-type"] == "application/json"

    payload = json.loads(req.data.decode("utf-8"))
    assert payload["chat_id"] == "test_chat_id_456"
    msg_text = payload["text"]

    # Verify all required message fields
    assert "INC-001" in msg_text
    assert "API Gateway" in msg_text
    assert "CRITICAL" in msg_text
    assert "INCIDENT_CREATED" in msg_text
    assert "OPEN" in msg_text
    assert "SIMULATION" in msg_text
    assert "Timestamp:" in msg_text


def test_telegram_successful_mocked_recovery_notification(client, monkeypatch):
    """
    Scenario 3: Successful mocked recovery notification.
    Verifies notification is sent when an OPEN incident transitions to RESOLVED.
    """
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "test_bot_token_123")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "test_chat_id_456")

    captured_requests = []

    def mock_urlopen(req, timeout=3.0):
        captured_requests.append(req)
        return MockTelegramResponse(status=200)

    with patch("urllib.request.urlopen", side_effect=mock_urlopen):
        # 1. Trigger incident on srv-auth
        for _ in range(3):
            client.post("/record-health-check", json={"server_id": "srv-auth", "status": "failed"})
        assert len(captured_requests) == 1

        # Clear creation request
        captured_requests.clear()

        # 2. Restore srv-auth -> should trigger recovery message
        res_restore = client.post("/restore", json={"server_id": "srv-auth"})
        assert res_restore.status_code == 200

    assert len(captured_requests) == 1
    req = captured_requests[0]
    payload = json.loads(req.data.decode("utf-8"))
    assert payload["chat_id"] == "test_chat_id_456"
    msg_text = payload["text"]

    assert "INC-001" in msg_text
    assert "Auth Cluster" in msg_text
    assert "CRITICAL" in msg_text
    assert "INCIDENT_RESOLVED" in msg_text
    assert "RESOLVED" in msg_text
    assert "Resolved At:" in msg_text
    assert "SIMULATION" in msg_text


def test_telegram_api_failure_does_not_break_incident_creation(client, monkeypatch):
    """
    Scenario 4: Telegram API/network failure does not break incident creation.
    """
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "test_bot_token_123")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "test_chat_id_456")

    def mock_urlopen_failing(req, timeout=3.0):
        raise urllib.error.URLError("Network connection timed out")

    with patch("urllib.request.urlopen", side_effect=mock_urlopen_failing):
        for i in range(3):
            res = client.post("/record-health-check", json={"server_id": "srv-db", "status": "failed"})
            assert res.status_code == 200

    # Verify incident was still created despite Telegram network outage
    incidents = client.get("/incidents").get_json()
    assert len(incidents) == 1
    assert incidents[0]["server_id"] == "srv-db"
    assert incidents[0]["status"] == "OPEN"

    # State reflects failure
    state = client.get("/state").get_json()
    assert state["overall_health"] == "DEGRADED"


def test_telegram_api_failure_does_not_break_recovery(client, monkeypatch):
    """
    Scenario 5: Telegram API/network failure does not break recovery.
    """
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "test_bot_token_123")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "test_chat_id_456")

    # Create incident on srv-redis
    for _ in range(3):
        client.post("/record-health-check", json={"server_id": "srv-redis", "status": "failed"})

    def mock_urlopen_http_error(req, timeout=3.0):
        raise urllib.error.HTTPError("https://api.telegram.org", 502, "Bad Gateway", {}, None)

    with patch("urllib.request.urlopen", side_effect=mock_urlopen_http_error):
        res_restore = client.post("/restore", json={"server_id": "srv-redis"})
        assert res_restore.status_code == 200

    # Verify server recovered and incident resolved despite Telegram error
    state = client.get("/state").get_json()
    assert state["overall_health"] == "NOMINAL"
    incidents = client.get("/incidents").get_json()
    assert incidents[0]["status"] == "RESOLVED"


def test_telegram_duplicate_incident_notification_prevention(client, monkeypatch):
    """
    Scenario 6: Avoid sending duplicate notifications when the same failure streak continues.
    """
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "test_bot_token_123")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "test_chat_id_456")

    call_count = 0

    def mock_urlopen(req, timeout=3.0):
        nonlocal call_count
        call_count += 1
        return MockTelegramResponse(status=200)

    with patch("urllib.request.urlopen", side_effect=mock_urlopen):
        # 3 failures -> triggers notification (call_count = 1)
        for _ in range(3):
            client.post("/record-health-check", json={"server_id": "srv-mqtt", "status": "failed"})
        assert call_count == 1

        # 4th failure in same streak -> must NOT trigger notification
        client.post("/record-health-check", json={"server_id": "srv-mqtt", "status": "failed"})
        assert call_count == 1

        # 5th failure in same streak -> must NOT trigger notification
        client.post("/record-health-check", json={"server_id": "srv-mqtt", "status": "failed"})
        assert call_count == 1

        # Explicit notify call on same incident -> deduplication prevents resend
        inc = client.get("/incidents").get_json()[0]
        res_dedup = notifier.notify_incident_created(inc)
        assert res_dedup is False
        assert call_count == 1


def test_telegram_no_recovery_notification_if_no_open_incident(client, monkeypatch):
    """
    Scenario 7: Send recovery notification only when an incident actually transitions
    from OPEN to RESOLVED. No notification if there was no OPEN incident.
    """
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "test_bot_token_123")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "test_chat_id_456")

    call_count = 0

    def mock_urlopen(req, timeout=3.0):
        nonlocal call_count
        call_count += 1
        return MockTelegramResponse(status=200)

    with patch("urllib.request.urlopen", side_effect=mock_urlopen):
        # 1. Restore an already online server
        res1 = client.post("/restore", json={"server_id": "srv-edge"})
        assert res1.status_code == 200
        assert call_count == 0

        # 2. Fail 1 time manually (1 manual failure does NOT trigger an incident)
        client.post("/simulate-failure", json={"server_id": "srv-edge"})
        assert call_count == 0

        # 3. Restore the manually failed server (no open incident existed)
        res2 = client.post("/restore", json={"server_id": "srv-edge"})
        assert res2.status_code == 200
        assert call_count == 0

        # 4. Restore all when all are nominal
        res3 = client.post("/restore")
        assert res3.status_code == 200
        assert call_count == 0


def test_telegram_credentials_never_appear_in_logs_or_api_responses(client, monkeypatch, caplog):
    """
    Scenario 8: Credentials never appear in logs or public API responses.
    """
    secret_token = "SECRET_BOT_TOKEN_SUPER_CONFIDENTIAL_9988"
    secret_chat_id = "SECRET_CHAT_ID_554433"
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", secret_token)
    monkeypatch.setenv("TELEGRAM_CHAT_ID", secret_chat_id)

    # Cause an error in Telegram API
    def mock_urlopen_http_err(req, timeout=3.0):
        raise urllib.error.HTTPError(
            f"https://api.telegram.org/bot{secret_token}/sendMessage",
            401,
            "Unauthorized",
            {},
            None,
        )

    with caplog.at_level(logging.DEBUG), patch("urllib.request.urlopen", side_effect=mock_urlopen_http_err):
        # Trigger incident and restoration
        for _ in range(3):
            client.post("/record-health-check", json={"server_id": "srv-api", "status": "failed"})
        client.post("/restore", json={"server_id": "srv-api"})

    # Check logs: the secret token must NOT be present anywhere in captured log text
    all_log_text = caplog.text
    assert secret_token not in all_log_text, "Secret token leaked in application logs!"

    # Check API responses: secret token must NOT appear in any response body
    res_health = client.get("/health").get_data(as_text=True)
    assert secret_token not in res_health
    assert secret_chat_id not in res_health

    res_state = client.get("/state").get_data(as_text=True)
    assert secret_token not in res_state
    assert secret_chat_id not in res_state

    res_inc = client.get("/incidents").get_data(as_text=True)
    assert secret_token not in res_inc
    assert secret_chat_id not in res_inc


# ============================================================================
# 13. CLOUD COST MONITORING TESTS
# ============================================================================

def test_get_costs_structure(client):
    """Verify GET /costs returns expected JSON schema and fields."""
    res = client.get("/costs")
    assert res.status_code == 200
    data = res.get_json()

    required_keys = [
        "currency",
        "today_spend",
        "month_spend",
        "monthly_budget",
        "budget_used_pct",
        "remaining_budget",
        "budget_status",
        "days_remaining",
        "daily_trend",
        "breakdown",
        "source",
        "data_source_status",
        "simulation_mode",
        "timestamp",
    ]
    for key in required_keys:
        assert key in data, f"Missing key '{key}' in /costs response"

    assert isinstance(data["daily_trend"], list)
    assert isinstance(data["breakdown"], list)
    assert isinstance(data["simulation_mode"], bool)


def test_get_costs_deterministic_data(client):
    """Verify deterministic simulation dataset consistency and values."""
    res = client.get("/costs")
    assert res.status_code == 200
    data = res.get_json()

    assert data["currency"] == "USD"
    assert data["today_spend"] == 64.20
    assert data["month_spend"] == 1842.60
    assert data["monthly_budget"] == 2500.00
    assert data["budget_used_pct"] == 73.7
    assert data["remaining_budget"] == 657.40
    assert data["budget_status"] == "NORMAL"
    assert data["simulation_mode"] is True
    assert data["data_source_status"] == "No live billing connection"
    assert data["source"] == "simulated"

    # Daily trend verification
    assert len(data["daily_trend"]) == 15
    assert data["daily_trend"][0]["day"] == 1
    assert data["daily_trend"][0]["amount"] == 118.0
    assert data["daily_trend"][-1]["day"] == 15
    assert data["daily_trend"][-1]["amount"] == 64.20

    # Breakdown verification
    assert len(data["breakdown"]) == 4
    total_breakdown = sum(item["amount"] for item in data["breakdown"])
    assert total_breakdown == pytest.approx(1842.60, 0.01)


def test_get_cost_settings(client):
    """Verify GET /costs/settings returns current budget config and metadata."""
    res = client.get("/costs/settings")
    assert res.status_code == 200
    data = res.get_json()

    assert data["monthly_budget"] == 2500.00
    assert data["currency"] == "USD"
    assert data["simulation_mode"] is True
    assert data["source"] == "simulated"
    assert "timestamp" in data


def test_post_cost_settings_valid_update(client):
    """Verify updating the budget updates both settings and /costs summary."""
    res = client.post("/costs/settings", json={"monthly_budget": 3000.0})
    assert res.status_code == 200
    data = res.get_json()

    assert data["settings"]["monthly_budget"] == 3000.0
    assert "Monthly budget updated to $3000.00" in data["message"]

    # Verify updated calculations in /costs
    cost_res = client.get("/costs")
    cost_data = cost_res.get_json()
    assert cost_data["monthly_budget"] == 3000.0
    # 1842.60 / 3000.0 * 100 = 61.4%
    assert cost_data["budget_used_pct"] == 61.4
    assert cost_data["remaining_budget"] == 1157.40
    assert cost_data["budget_status"] == "NORMAL"


def test_post_cost_settings_budget_alias(client):
    """Verify 'budget' key works as an alias for 'monthly_budget'."""
    res = client.post("/costs/settings", json={"budget": 2800.0})
    assert res.status_code == 200
    data = res.get_json()
    assert data["settings"]["monthly_budget"] == 2800.0


def test_post_cost_settings_string_coercion(client):
    """Verify numeric strings are safely parsed as numbers."""
    res = client.post("/costs/settings", json={"monthly_budget": "3200.50"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["settings"]["monthly_budget"] == 3200.50


def test_post_cost_settings_invalid_negative(client):
    """Verify negative budget amounts are rejected with 400 Bad Request."""
    res = client.post("/costs/settings", json={"monthly_budget": -500.0})
    assert res.status_code == 400
    data = res.get_json()
    assert "positive numeric amount" in data["message"].lower()

    # Verify budget was not modified
    settings = client.get("/costs/settings").get_json()
    assert settings["monthly_budget"] == 2500.00


def test_post_cost_settings_invalid_zero(client):
    """Verify zero budget is rejected with 400 Bad Request."""
    res = client.post("/costs/settings", json={"monthly_budget": 0})
    assert res.status_code == 400
    data = res.get_json()
    assert "greater than zero" in data["message"].lower()


def test_post_cost_settings_invalid_non_numeric(client):
    """Verify non-numeric strings are rejected with 400 Bad Request."""
    res = client.post("/costs/settings", json={"monthly_budget": "invalid_number"})
    assert res.status_code == 400
    data = res.get_json()
    assert "invalid budget value" in data["message"].lower()


def test_post_cost_settings_invalid_boolean(client):
    """Verify boolean values are explicitly rejected (not coerced to 1.0 / 0.0)."""
    res_true = client.post("/costs/settings", json={"monthly_budget": True})
    assert res_true.status_code == 400
    assert "boolean" in res_true.get_json()["message"].lower()

    res_false = client.post("/costs/settings", json={"monthly_budget": False})
    assert res_false.status_code == 400
    assert "boolean" in res_false.get_json()["message"].lower()


def test_post_cost_settings_missing_field(client):
    """Verify payload without monthly_budget is rejected with 400 Bad Request."""
    res = client.post("/costs/settings", json={"other_key": 1000})
    assert res.status_code == 400
    data = res.get_json()
    assert "field 'monthly_budget' is required" in data["message"].lower()


def test_post_cost_settings_empty_and_non_json(client):
    """Verify empty or non-JSON payloads are handled with 400 Bad Request."""
    res_empty = client.post("/costs/settings", data="")
    assert res_empty.status_code == 400

    res_text = client.post("/costs/settings", data="not json", content_type="text/plain")
    assert res_text.status_code == 400


def test_cost_threshold_transitions(client):
    """Verify NORMAL, WARNING, and BUDGET EXCEEDED thresholds."""
    # Month spend is 1842.60

    # 1. NORMAL: < 75%
    # With budget = $3000: 1842.60 / 3000 = 61.4% (< 75%)
    client.post("/costs/settings", json={"monthly_budget": 3000.0})
    res_normal = client.get("/costs").get_json()
    assert res_normal["budget_used_pct"] < 75.0
    assert res_normal["budget_status"] == "NORMAL"

    # 2. WARNING: 75% to 99.99%
    # With budget = $2000: 1842.60 / 2000 = 92.1% (>= 75% and < 100%)
    client.post("/costs/settings", json={"monthly_budget": 2000.0})
    res_warning = client.get("/costs").get_json()
    assert 75.0 <= res_warning["budget_used_pct"] < 100.0
    assert res_warning["budget_status"] == "WARNING"

    # Exactly at boundary: budget = $2456.80 -> 1842.60 / 2456.80 = 75.0%
    client.post("/costs/settings", json={"monthly_budget": 2456.80})
    res_boundary = client.get("/costs").get_json()
    assert res_boundary["budget_used_pct"] == 75.0
    assert res_boundary["budget_status"] == "WARNING"

    # 3. BUDGET EXCEEDED: >= 100%
    # With budget = $1842.60: 1842.60 / 1842.60 = 100.0%
    client.post("/costs/settings", json={"monthly_budget": 1842.60})
    res_exact_exceeded = client.get("/costs").get_json()
    assert res_exact_exceeded["budget_used_pct"] >= 100.0
    assert res_exact_exceeded["budget_status"] == "BUDGET EXCEEDED"

    # With budget = $1500.0: 1842.60 / 1500 = 122.8%
    client.post("/costs/settings", json={"monthly_budget": 1500.0})
    res_over = client.get("/costs").get_json()
    assert res_over["budget_used_pct"] >= 100.0
    assert res_over["budget_status"] == "BUDGET EXCEEDED"
    assert res_over["remaining_budget"] == 0.0


def test_zero_and_negative_budget_provider_safety():
    """Verify SimulatedBillingProvider handles zero and negative budgets safely without ZeroDivisionError."""
    provider = SimulatedBillingProvider()

    # Zero budget
    zero_result = provider.get_costs(0.0)
    assert zero_result["budget_used_pct"] == 100.0
    assert zero_result["budget_status"] == "BUDGET EXCEEDED"
    assert zero_result["remaining_budget"] == 0.0

    # Negative budget
    neg_result = provider.get_costs(-100.0)
    assert neg_result["budget_used_pct"] == 100.0
    assert neg_result["budget_status"] == "BUDGET EXCEEDED"
    assert neg_result["remaining_budget"] == 0.0


def test_provider_adapters_aws_azure_stubs():
    """Verify provider interface structure and future AWS/Azure adapter stubs."""
    aws = AWSBillingProvider()
    assert aws.provider_name == "aws"
    assert aws.is_simulation is False
    assert "not configured" in aws.connection_status
    with pytest.raises(NotImplementedError, match="AWS billing adapter"):
        aws.get_costs(2500.0)

    azure = AzureBillingProvider()
    assert azure.provider_name == "azure"
    assert azure.is_simulation is False
    assert "not configured" in azure.connection_status
    with pytest.raises(NotImplementedError, match="Azure billing adapter"):
        azure.get_costs(2500.0)


def test_cost_endpoints_do_not_leak_secrets(client, monkeypatch):
    """Verify secret credentials never appear in /costs or /costs/settings responses."""
    secret = "SUPER_SECRET_BILLING_KEY_XYZ123"
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", secret)

    res_costs = client.get("/costs").get_data(as_text=True)
    assert secret not in res_costs

    res_settings = client.get("/costs/settings").get_data(as_text=True)
    assert secret not in res_settings


def test_cost_endpoints_preserve_server_and_incident_behavior(client):
    """Verify cost operations do not alter server health, consecutive failures, or incidents."""
    # 1. Update budget
    client.post("/costs/settings", json={"monthly_budget": 5000.0})

    # 2. Check server state is completely intact
    state = client.get("/state").get_json()
    assert state["overall_health"] == "NOMINAL"
    assert state["online_server_count"] == 6
    assert state["failed_server_count"] == 0

    # 3. Simulate failure and record streak
    for _ in range(3):
        client.post("/record-health-check", json={"server_id": "srv-api", "status": "failed"})

    incidents = client.get("/incidents").get_json()
    assert len(incidents) == 1
    assert incidents[0]["server_id"] == "srv-api"
    assert incidents[0]["severity"] == "CRITICAL"
    assert incidents[0]["status"] == "OPEN"

    # 4. Restore server
    client.post("/restore", json={"server_id": "srv-api"})
    incidents_after = client.get("/incidents").get_json()
    assert incidents_after[0]["status"] == "RESOLVED"

    # 5. Cost summary remains valid and unaffected
    cost = client.get("/costs").get_json()
    assert cost["monthly_budget"] == 5000.0


# ============================================================================
# 14. WEATHER & SYSTEM RESET TESTS
# ============================================================================

def test_get_weather_structure(client):
    """Verify GET /weather returns expected JSON schema and fields."""
    res = client.get("/weather")
    assert res.status_code == 200
    data = res.get_json()

    required_keys = [
        "location",
        "temperature_c",
        "temperature_f",
        "feels_like_c",
        "feels_like_f",
        "condition",
        "condition_code",
        "condition_symbol",
        "humidity_pct",
        "wind_speed_mph",
        "wind_speed_kmh",
        "wind_direction",
        "pressure_hpa",
        "uv_index",
        "air_quality",
        "source",
        "data_source_status",
        "simulation_mode",
        "timestamp",
    ]
    for key in required_keys:
        assert key in data, f"Missing key '{key}' in /weather response"

    assert isinstance(data["temperature_c"], (int, float))
    assert isinstance(data["temperature_f"], (int, float))
    assert isinstance(data["humidity_pct"], int)
    assert isinstance(data["simulation_mode"], bool)


def test_get_weather_deterministic_data(client):
    """Verify deterministic simulated weather telemetry values and labeling."""
    res = client.get("/weather")
    assert res.status_code == 200
    data = res.get_json()

    assert data["location"] == "DEMO LOCATION"
    assert data["temperature_c"] == 22.0
    assert data["temperature_f"] == 71.6
    assert data["feels_like_c"] == 22.5
    assert data["feels_like_f"] == 72.5
    assert data["condition"] == "Partly Cloudy"
    assert data["humidity_pct"] == 58
    assert data["wind_speed_mph"] == 8.5
    assert data["wind_direction"] == "NW"
    assert data["simulation_mode"] is True
    assert data["data_source_status"] == "No live weather connection"
    assert data["source"] == "simulated"


def test_weather_provider_adapters_stubs():
    """Verify weather provider interface structure and future adapter stubs."""
    owm = OpenWeatherMapProvider()
    assert owm.provider_name == "openweathermap"
    assert owm.is_simulation is False
    assert "not configured" in owm.connection_status
    with pytest.raises(NotImplementedError, match="OpenWeatherMap adapter"):
        owm.get_weather()

    wapi = WeatherApiProvider()
    assert wapi.provider_name == "weatherapi"
    assert wapi.is_simulation is False
    assert "not configured" in wapi.connection_status
    with pytest.raises(NotImplementedError, match="WeatherAPI adapter"):
        wapi.get_weather()


def test_post_reset_endpoint(client):
    """Verify POST /reset resets cluster nodes, clears incidents, and resets costs & weather."""
    # Modify state: fail a server, record incident, change budget
    client.post("/simulate-failure", json={"server_id": "srv-api"})
    for _ in range(3):
        client.post("/record-health-check", json={"server_id": "srv-auth", "status": "failed"})
    client.post("/costs/settings", json={"monthly_budget": 9999.0})

    # Call reset
    res = client.post("/reset")
    assert res.status_code == 200
    data = res.get_json()

    assert "reset to defaults" in data["message"].lower()

    # Verify cluster state is pristine NOMINAL
    state = client.get("/state").get_json()
    assert state["overall_health"] == "NOMINAL"
    assert state["failed_server_count"] == 0
    assert state["online_server_count"] == 6

    # Verify incidents are cleared
    incidents = client.get("/incidents").get_json()
    assert len(incidents) == 0

    # Verify costs are reset to default 2500
    costs = client.get("/costs").get_json()
    assert costs["monthly_budget"] == 2500.00

    # Verify weather is nominal
    weather = client.get("/weather").get_json()
    assert weather["location"] == "DEMO LOCATION"


def test_weather_endpoint_does_not_leak_secrets(client, monkeypatch):
    """Verify secret credentials never appear in /weather response."""
    secret = "SUPER_SECRET_WEATHER_API_KEY_9988"
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", secret)

    res_weather = client.get("/weather").get_data(as_text=True)
    assert secret not in res_weather


# ============================================================================
# 16. SERVER CONFIGURATION & HOST/PORT BINDING TESTS
# ============================================================================

def test_server_config_defaults(monkeypatch):
    """Verify default host is 127.0.0.1 (localhost) and port is 5000."""
    monkeypatch.delenv("HOST", raising=False)
    monkeypatch.delenv("PORT", raising=False)
    host, port = get_server_config()
    assert host == "127.0.0.1"
    assert port == 5000


def test_server_config_custom_host_lan(monkeypatch):
    """Verify setting HOST=0.0.0.0 is respected for LAN accessibility."""
    monkeypatch.setenv("HOST", "0.0.0.0")
    monkeypatch.delenv("PORT", raising=False)
    host, port = get_server_config()
    assert host == "0.0.0.0"
    assert port == 5000


def test_server_config_custom_port(monkeypatch):
    """Verify custom PORT is parsed as an integer."""
    monkeypatch.setenv("PORT", "5001")
    monkeypatch.delenv("HOST", raising=False)
    host, port = get_server_config()
    assert host == "127.0.0.1"
    assert port == 5001


def test_server_config_both_host_and_port(monkeypatch):
    """Verify both custom HOST and PORT are applied together."""
    monkeypatch.setenv("HOST", "0.0.0.0")
    monkeypatch.setenv("PORT", "8080")
    host, port = get_server_config()
    assert host == "0.0.0.0"
    assert port == 8080


def test_server_config_invalid_port_fallback(monkeypatch):
    """Verify non-numeric or out-of-range port safely falls back to default 5000."""
    monkeypatch.setenv("PORT", "invalid-port")
    host, port = get_server_config()
    assert port == 5000

    monkeypatch.setenv("PORT", "99999")
    host, port = get_server_config()
    assert port == 5000


def test_cors_configuration_remains_strict():
    """Verify CORS is restricted to trusted local development origins and does NOT allow wildcard *."""
    assert "*" not in ALLOWED_ORIGINS
    for origin in ALLOWED_ORIGINS:
        assert origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:")



