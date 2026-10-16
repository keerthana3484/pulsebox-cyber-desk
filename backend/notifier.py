"""
Telegram notification manager for PulseBox Cyber Desk.
Dispatches alert and recovery notifications over Telegram Bot API HTTPS.
"""

from datetime import datetime, timezone
import json
import logging
import os
from typing import Any, Dict, Optional, Set, Tuple
import urllib.error
import urllib.request

logger = logging.getLogger("pulsebox.notifications")


class TelegramNotifier:
    """Manages Telegram alert dispatching for simulated incident events."""

    def __init__(self, timeout_seconds: float = 3.0) -> None:
        self.timeout_seconds = timeout_seconds
        self.sent_notification_keys: Set[str] = set()

    def get_credentials(self) -> Tuple[Optional[str], Optional[str]]:
        """Safely reads credentials from environment variables."""
        token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip() or None
        chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip() or None
        return token, chat_id

    def is_configured(self) -> bool:
        """Returns True if both bot token and chat ID are configured in environment."""
        token, chat_id = self.get_credentials()
        return bool(token and chat_id)

    def send_message(self, text: str) -> Tuple[bool, str]:
        """
        Sends a message via Telegram Bot API over HTTPS.
        Credentials are never printed, logged, or exposed.
        Returns: (success: bool, status_message: str)
        """
        token, chat_id = self.get_credentials()
        if not token or not chat_id:
            logger.info("Telegram notification skipped: Bot token or Chat ID not configured.")
            return False, "Not configured"

        # Telegram Bot API sendMessage endpoint
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout_seconds) as response:
                status_code = getattr(response, "status", 200)
                if status_code == 200:
                    logger.info("Telegram notification delivered successfully.")
                    return True, "Delivered"
                logger.warning("Telegram API responded with non-200 status: %s", status_code)
                return False, f"HTTP status {status_code}"
        except urllib.error.HTTPError as err:
            # Mask error reason so token in err.url is never logged
            logger.warning("Telegram notification failed (HTTPError %s: %s)", err.code, getattr(err, "reason", "HTTP Error"))
            return False, f"HTTPError {err.code}"
        except urllib.error.URLError as err:
            logger.warning("Telegram notification failed (URLError): %s", getattr(err, "reason", "Network error"))
            return False, "URLError"
        except Exception as err:
            logger.warning("Telegram notification failed (%s)", type(err).__name__)
            return False, type(err).__name__

    def notify_incident_created(self, incident: Dict[str, Any]) -> bool:
        """
        Sends a Telegram alert when a new CRITICAL incident is created after 3 consecutive failures.
        Prevents duplicate alerts for the same incident creation event.
        """
        incident_id = incident.get("id", "UNKNOWN")
        dedup_key = f"{incident_id}:CREATED"
        if dedup_key in self.sent_notification_keys:
            logger.debug("Duplicate incident alert skipped for %s", incident_id)
            return False

        server_name = incident.get("server_name") or incident.get("server_id", "Unknown Node")
        server_id = incident.get("server_id", "")
        severity = incident.get("severity", "CRITICAL")
        status = incident.get("status", "OPEN")
        created_at = (
            incident.get("created_at")
            or incident.get("created_timestamp")
            or datetime.now(timezone.utc).isoformat()
        )
        streak = incident.get("consecutive_failure_count", 3)

        text = (
            f"🚨 [PULSEBOX ALERT] NEW CRITICAL INCIDENT\n"
            f"----------------------------------------\n"
            f"Event: INCIDENT_CREATED\n"
            f"Incident ID: {incident_id}\n"
            f"Server: {server_name} ({server_id})\n"
            f"Severity: {severity}\n"
            f"Status: {status}\n"
            f"Streak: {streak} consecutive health-check failures\n"
            f"Timestamp: {created_at}\n"
            f"Mode: SIMULATION"
        )

        success, _ = self.send_message(text)
        self.sent_notification_keys.add(dedup_key)
        return success

    def notify_incident_resolved(self, incident: Dict[str, Any]) -> bool:
        """
        Sends a Telegram recovery message when an OPEN incident transitions to RESOLVED.
        Prevents duplicate notifications for the same resolution event.
        """
        incident_id = incident.get("id", "UNKNOWN")
        dedup_key = f"{incident_id}:RESOLVED"
        if dedup_key in self.sent_notification_keys:
            logger.debug("Duplicate incident resolution notification skipped for %s", incident_id)
            return False

        server_name = incident.get("server_name") or incident.get("server_id", "Unknown Node")
        server_id = incident.get("server_id", "")
        severity = incident.get("severity", "CRITICAL")
        status = incident.get("status", "RESOLVED")
        resolved_at = (
            incident.get("resolved_at")
            or incident.get("resolution_timestamp")
            or datetime.now(timezone.utc).isoformat()
        )

        text = (
            f"✅ [PULSEBOX RECOVERY] INCIDENT RESOLVED\n"
            f"----------------------------------------\n"
            f"Event: INCIDENT_RESOLVED\n"
            f"Incident ID: {incident_id}\n"
            f"Server: {server_name} ({server_id})\n"
            f"Severity: {severity}\n"
            f"Status: {status}\n"
            f"Resolved At: {resolved_at}\n"
            f"Mode: SIMULATION"
        )

        success, _ = self.send_message(text)
        self.sent_notification_keys.add(dedup_key)
        return success

    def reset(self) -> None:
        """Resets deduplication records (for test isolation)."""
        self.sent_notification_keys.clear()


# Global notifier instance
notifier = TelegramNotifier()
