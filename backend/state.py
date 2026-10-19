"""
In-memory state manager for the PulseBox Cyber Desk simulator backend.
Provides simulated cluster telemetry, fault injection, and recovery logic.

Overall Health Thresholds:
--------------------------
- NOMINAL:  failed_count == 0 (0 failed servers, all 6 servers online)
            All cluster nodes are healthy with baseline latencies.
- DEGRADED: failed_count == 1 (exactly 1 failed server, 5 servers online)
            A single service outage; cluster operating with reduced redundancy.
- CRITICAL: failed_count >= 2 (2 or more failed servers, <= 4 servers online)
            Multi-service cluster outage requiring immediate intervention.
"""

from datetime import datetime, timezone
import time
from typing import Any, Dict, List, Optional, Tuple

from notifier import notifier

INITIAL_SERVERS: List[Dict[str, Any]] = [
    {
        "id": "srv-api",
        "name": "API Gateway",
        "role": "Public Ingress / Envoy",
        "status": "online",
        "latency_ms": 24,
        "default_latency_ms": 24,
        "consecutive_failure_count": 0,
        "first_failure_timestamp": None,
        "last_failure_timestamp": None,
        "recovery_timestamp": None,
        "alert_triggered": False,
    },
    {
        "id": "srv-auth",
        "name": "Auth Cluster",
        "role": "JWT / OAuth2 / Vault",
        "status": "online",
        "latency_ms": 18,
        "default_latency_ms": 18,
        "consecutive_failure_count": 0,
        "first_failure_timestamp": None,
        "last_failure_timestamp": None,
        "recovery_timestamp": None,
        "alert_triggered": False,
    },
    {
        "id": "srv-db",
        "name": "PostgreSQL Primary",
        "role": "Transactional Store",
        "status": "online",
        "latency_ms": 12,
        "default_latency_ms": 12,
        "consecutive_failure_count": 0,
        "first_failure_timestamp": None,
        "last_failure_timestamp": None,
        "recovery_timestamp": None,
        "alert_triggered": False,
    },
    {
        "id": "srv-redis",
        "name": "Redis Cache Cluster",
        "role": "In-Memory Session Store",
        "status": "online",
        "latency_ms": 2,
        "default_latency_ms": 2,
        "consecutive_failure_count": 0,
        "first_failure_timestamp": None,
        "last_failure_timestamp": None,
        "recovery_timestamp": None,
        "alert_triggered": False,
    },
    {
        "id": "srv-mqtt",
        "name": "MQTT Broker",
        "role": "IoT Telemetry Pipeline",
        "status": "online",
        "latency_ms": 31,
        "default_latency_ms": 31,
        "consecutive_failure_count": 0,
        "first_failure_timestamp": None,
        "last_failure_timestamp": None,
        "recovery_timestamp": None,
        "alert_triggered": False,
    },
    {
        "id": "srv-edge",
        "name": "Edge Worker Fleet",
        "role": "Global CDN / SSR",
        "status": "online",
        "latency_ms": 45,
        "default_latency_ms": 45,
        "consecutive_failure_count": 0,
        "first_failure_timestamp": None,
        "last_failure_timestamp": None,
        "recovery_timestamp": None,
        "alert_triggered": False,
    },
]


class CyberDeskState:
    """Manages simulated in-memory state for PulseBox Cyber Desk."""

    MAX_INCIDENTS: int = 100

    def __init__(self) -> None:
        self.start_time = time.time()
        self.servers: List[Dict[str, Any]] = [s.copy() for s in INITIAL_SERVERS]
        self.incidents: List[Dict[str, Any]] = []
        self.incident_counter: int = 0
        self.last_event: str = "System initialized in healthy state"

    def get_uptime_seconds(self) -> float:
        """Returns uptime in seconds since backend start."""
        return round(time.time() - self.start_time, 2)

    def get_server_by_id(self, server_id: str) -> Optional[Dict[str, Any]]:
        """Finds a server dict by its ID."""
        for s in self.servers:
            if s["id"] == server_id:
                return s
        return None

    def get_state(self) -> Dict[str, Any]:
        """
        Calculates and returns current system state.

        Overall Health Threshold Rules:
        - 0 failed servers: "NOMINAL"
        - 1 failed server:  "DEGRADED"
        - >= 2 failed servers: "CRITICAL"
        """
        total_servers = len(self.servers)
        failed_servers = [s for s in self.servers if s["status"] != "online"]
        failed_count = len(failed_servers)
        online_count = total_servers - failed_count

        if failed_count == 0:
            overall_health = "NOMINAL"
        elif failed_count == 1:
            overall_health = "DEGRADED"
        else:
            overall_health = "CRITICAL"

        # Calculate average latency across all servers
        if total_servers > 0:
            avg_latency = round(sum(s["latency_ms"] for s in self.servers) / total_servers, 1)
        else:
            avg_latency = 0.0

        return {
            "overall_health": overall_health,
            "server_count": total_servers,
            "failed_server_count": failed_count,
            "online_server_count": online_count,
            "average_latency_ms": avg_latency,
            "simulation_mode": True,
            "last_event": self.last_event,
            "open_incidents_count": sum(1 for i in self.incidents if i["status"] == "OPEN"),
            "servers": [
                {
                    "id": s["id"],
                    "name": s["name"],
                    "role": s["role"],
                    "status": s["status"],
                    "latency_ms": s["latency_ms"],
                    "consecutive_failure_count": s.get("consecutive_failure_count", 0),
                    "first_failure_timestamp": s.get("first_failure_timestamp"),
                    "last_failure_timestamp": s.get("last_failure_timestamp"),
                    "recovery_timestamp": s.get("recovery_timestamp"),
                }
                for s in self.servers
            ],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def simulate_failure(self, server_id: Optional[str] = None) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        """
        Simulates one server failure.
        If server_id is provided, fails that specific server.
        If server_id is None, fails the first online server found.
        Returns: (success, message, affected_server_dict)
        """
        target_server = None

        if server_id is not None:
            target_server = self.get_server_by_id(server_id)
            if not target_server:
                return False, f"Server with id '{server_id}' not found", None
            if target_server["status"] == "failed":
                return False, f"Server '{target_server['name']}' ({server_id}) is already failed", target_server
        else:
            # Pick first currently online server
            for s in self.servers:
                if s["status"] == "online":
                    target_server = s
                    break

            if not target_server:
                return False, "All servers are already in a failed state", None

        # Apply failure (one manual event, count transitions to 1)
        now_iso = datetime.now(timezone.utc).isoformat()
        target_server["status"] = "failed"
        target_server["latency_ms"] = 999
        target_server["consecutive_failure_count"] = 1
        target_server["first_failure_timestamp"] = now_iso
        target_server["last_failure_timestamp"] = now_iso
        target_server["recovery_timestamp"] = None
        target_server["alert_triggered"] = False
        self.last_event = f"Simulated failure injected on {target_server['name']} ({target_server['id']})"

        return True, f"Simulated failure applied to '{target_server['name']}' ({target_server['id']})", {
            "id": target_server["id"],
            "name": target_server["name"],
            "status": target_server["status"],
            "latency_ms": target_server["latency_ms"],
            "consecutive_failure_count": target_server["consecutive_failure_count"],
            "first_failure_timestamp": target_server["first_failure_timestamp"],
            "last_failure_timestamp": target_server["last_failure_timestamp"],
            "recovery_timestamp": target_server["recovery_timestamp"],
        }

    def record_health_check(
        self, server_id: str, status: str = "failed"
    ) -> Tuple[bool, str, Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        Records an individual health-check result for a server.
        status: "failed" or "online"
        Rule: 3 consecutive failed health-check results triggers a CRITICAL incident (once per streak).
        Returns: (success, message, affected_server_dict, created_incident_dict)
        """
        target_server = self.get_server_by_id(server_id)
        if not target_server:
            return False, f"Server with id '{server_id}' not found", None, None

        now_iso = datetime.now(timezone.utc).isoformat()
        created_incident = None

        if status == "failed":
            was_online = target_server["status"] == "online"
            target_server["status"] = "failed"
            target_server["latency_ms"] = 999
            target_server["consecutive_failure_count"] += 1
            if was_online or target_server["first_failure_timestamp"] is None:
                target_server["first_failure_timestamp"] = now_iso
            target_server["last_failure_timestamp"] = now_iso
            target_server["recovery_timestamp"] = None

            streak = target_server["consecutive_failure_count"]

            # Alert Rule: exactly at/above 3 consecutive failed results, trigger CRITICAL incident once per streak
            if streak >= 3 and not target_server.get("alert_triggered", False):
                target_server["alert_triggered"] = True
                self.incident_counter += 1
                incident_id = f"INC-{self.incident_counter:03d}"
                msg = f"Server '{target_server['name']}' ({target_server['id']}) reached {streak} consecutive failed health checks"
                incident = {
                    "id": incident_id,
                    "server_id": target_server["id"],
                    "server_name": target_server["name"],
                    "severity": "CRITICAL",
                    "message": msg,
                    "created_at": now_iso,
                    "created_timestamp": now_iso,
                    "consecutive_failure_count": streak,
                    "status": "OPEN",
                    "resolved_at": None,
                    "resolution_timestamp": None,
                    "service": target_server["name"],
                    "title": f"Consecutive Health-Check Failures on {target_server['name']}",
                    "detail": msg,
                }
                self.incidents.append(incident)
                if len(self.incidents) > self.MAX_INCIDENTS:
                    self.incidents = self.incidents[-self.MAX_INCIDENTS:]
                created_incident = incident
                self.last_event = f"CRITICAL incident {incident_id} created: {msg}"
                message = f"Health check failed on '{target_server['name']}' (streak: {streak}). Incident {incident_id} created."
                try:
                    notifier.notify_incident_created(incident)
                except Exception:
                    pass
            else:
                self.last_event = f"Health check failed on {target_server['name']} ({target_server['id']}) (streak: {streak})"
                message = f"Health check failed on '{target_server['name']}' (streak: {streak})"

        elif status == "online":
            was_failed = (target_server["status"] != "online" or target_server["consecutive_failure_count"] > 0)
            target_server["status"] = "online"
            target_server["latency_ms"] = target_server["default_latency_ms"]
            target_server["consecutive_failure_count"] = 0
            target_server["recovery_timestamp"] = now_iso
            target_server["alert_triggered"] = False

            if was_failed:
                # Resolve open incidents for this server
                for inc in self.incidents:
                    if inc["server_id"] == target_server["id"] and inc["status"] == "OPEN":
                        inc["status"] = "RESOLVED"
                        inc["resolved_at"] = now_iso
                        inc["resolution_timestamp"] = now_iso
                        try:
                            notifier.notify_incident_resolved(inc)
                        except Exception:
                            pass
                self.last_event = f"Server {target_server['name']} ({target_server['id']}) passed health check and restored"
                message = f"Health check passed for '{target_server['name']}'. Server restored and open incidents resolved."
            else:
                message = f"Health check passed for '{target_server['name']}'"
        else:
            return False, f"Unknown status '{status}'", None, None

        affected_data = {
            "id": target_server["id"],
            "name": target_server["name"],
            "status": target_server["status"],
            "latency_ms": target_server["latency_ms"],
            "consecutive_failure_count": target_server["consecutive_failure_count"],
            "first_failure_timestamp": target_server["first_failure_timestamp"],
            "last_failure_timestamp": target_server["last_failure_timestamp"],
            "recovery_timestamp": target_server["recovery_timestamp"],
        }
        return True, message, affected_data, created_incident

    def restore(self, server_id: Optional[str] = None) -> Tuple[bool, str, int, int]:
        """
        Restores simulated servers to healthy online status.
        If server_id is provided, restores only that server (restored_count=1).
        If server_id is None, restores all servers (restored_count=len(self.servers)).
        Resolves open incidents for the restored server(s). Historical incidents are preserved.
        Returns: (success, message, restored_count, recovered_count)
        """
        now_iso = datetime.now(timezone.utc).isoformat()

        if server_id is not None:
            target_server = self.get_server_by_id(server_id)
            if not target_server:
                return False, f"Server with id '{server_id}' not found", 0, 0

            was_failed = (target_server["status"] != "online" or target_server["consecutive_failure_count"] > 0)
            target_server["status"] = "online"
            target_server["latency_ms"] = target_server["default_latency_ms"]
            target_server["consecutive_failure_count"] = 0
            target_server["recovery_timestamp"] = now_iso
            target_server["alert_triggered"] = False

            # Resolve open incidents for this server
            for inc in self.incidents:
                if inc["server_id"] == target_server["id"] and inc["status"] == "OPEN":
                    inc["status"] = "RESOLVED"
                    inc["resolved_at"] = now_iso
                    inc["resolution_timestamp"] = now_iso
                    try:
                        notifier.notify_incident_resolved(inc)
                    except Exception:
                        pass

            self.last_event = f"Server {target_server['name']} ({target_server['id']}) restored to healthy state"
            return True, f"Server '{target_server['name']}' restored to online", 1, (1 if was_failed else 0)

        # Restore all servers
        recovered_count = 0
        for s in self.servers:
            was_failed = (s["status"] != "online" or s["consecutive_failure_count"] > 0)
            if was_failed:
                recovered_count += 1
            s["status"] = "online"
            s["latency_ms"] = s["default_latency_ms"]
            s["consecutive_failure_count"] = 0
            s["recovery_timestamp"] = now_iso
            s["alert_triggered"] = False

        # Resolve all open incidents
        for inc in self.incidents:
            if inc["status"] == "OPEN":
                inc["status"] = "RESOLVED"
                inc["resolved_at"] = now_iso
                inc["resolution_timestamp"] = now_iso
                try:
                    notifier.notify_incident_resolved(inc)
                except Exception:
                    pass

        total_restored = len(self.servers)
        self.last_event = f"All {total_restored} servers restored to healthy state"
        return True, f"All {total_restored} simulated servers restored to healthy status", total_restored, recovered_count

    def get_incidents(self) -> List[Dict[str, Any]]:
        """Returns the in-memory incident history, sorted newest first."""
        return sorted(self.incidents, key=lambda x: x.get("created_at", ""), reverse=True)

    def clear_incidents(self) -> None:
        """Clears in-memory incident history (for test isolation)."""
        self.incidents = []
        self.incident_counter = 0

    def reset(self) -> None:
        """Full reset of servers, incident history, and notification deduplication (for test isolation)."""
        self.restore()
        self.clear_incidents()
        notifier.reset()


# Global singleton in-memory state instance
state_manager = CyberDeskState()
