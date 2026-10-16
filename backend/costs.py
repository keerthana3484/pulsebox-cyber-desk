"""
Cloud Cost Monitoring and Billing Provider architecture for PulseBox Cyber Desk.
Provides deterministic simulation data and extensible provider interfaces
for future live cloud billing connections (AWS, Azure).
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional, Tuple


class BaseBillingProvider(ABC):
    """
    Abstract base class for cloud billing data sources.
    Decouples billing provider implementation from API and presentation layers.
    """

    @abstractmethod
    def get_costs(self, monthly_budget: float) -> Dict[str, Any]:
        """
        Retrieves cost summary, daily trend, and service breakdown for the current cycle.
        """
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the billing provider adapter."""
        pass

    @property
    @abstractmethod
    def is_simulation(self) -> bool:
        """Indicates whether this provider returns simulated telemetry."""
        pass

    @property
    @abstractmethod
    def connection_status(self) -> str:
        """Human-readable status of the provider connection."""
        pass


class SimulatedBillingProvider(BaseBillingProvider):
    """
    Deterministic simulated cloud billing provider.
    Returns reproducible, internally consistent cost telemetry without connecting
    to live cloud APIs or requiring cloud credentials.
    """

    # Deterministic sample dataset for predictability across tests and UI
    SAMPLE_TODAY_SPEND: float = 64.20
    SAMPLE_MONTH_SPEND: float = 1842.60
    SAMPLE_DAYS_REMAINING: int = 15

    # 15 days of deterministic daily spend telemetry
    SAMPLE_DAILY_TREND: List[Dict[str, Any]] = [
        {"day": 1, "amount": 118.0},
        {"day": 2, "amount": 122.5},
        {"day": 3, "amount": 124.0},
        {"day": 4, "amount": 119.5},
        {"day": 5, "amount": 128.0},
        {"day": 6, "amount": 121.0},
        {"day": 7, "amount": 116.5},
        {"day": 8, "amount": 126.0},
        {"day": 9, "amount": 132.5},
        {"day": 10, "amount": 129.0},
        {"day": 11, "amount": 122.0},
        {"day": 12, "amount": 120.5},
        {"day": 13, "amount": 118.5},
        {"day": 14, "amount": 124.0},
        {"day": 15, "amount": 64.20},  # Today's partial day spend
    ]

    # Service category breakdown matching month-to-date total ($1842.60)
    SAMPLE_BREAKDOWN: List[Dict[str, Any]] = [
        {"name": "Compute (K8s/EC2)", "amount": 980.40, "percentage": 53.2, "color": "#FF5722"},
        {"name": "Managed DB (RDS)", "amount": 462.10, "percentage": 25.1, "color": "#FFB300"},
        {"name": "Storage & Backups", "amount": 218.30, "percentage": 11.8, "color": "#FF8A65"},
        {"name": "Network & CDN Egress", "amount": 181.80, "percentage": 9.9, "color": "#FFE082"},
    ]

    @property
    def provider_name(self) -> str:
        return "simulated"

    @property
    def is_simulation(self) -> bool:
        return True

    @property
    def connection_status(self) -> str:
        return "No live billing connection"

    def get_costs(self, monthly_budget: float) -> Dict[str, Any]:
        """
        Calculates budget utilization and status thresholds safely.
        Never divides by zero.
        """
        today_spend = self.SAMPLE_TODAY_SPEND
        month_spend = self.SAMPLE_MONTH_SPEND

        # Safe division guard: zero or negative budget handling
        if monthly_budget > 0:
            budget_used_pct = round((month_spend / monthly_budget) * 100.0, 1)
            remaining_budget = round(max(0.0, monthly_budget - month_spend), 2)
        else:
            budget_used_pct = 100.0 if month_spend > 0 else 0.0
            remaining_budget = 0.0

        # Warning threshold rules:
        # - NORMAL: < 75%
        # - WARNING: 75% to 99.99%
        # - BUDGET EXCEEDED: >= 100%
        if budget_used_pct < 75.0:
            budget_status = "NORMAL"
        elif budget_used_pct < 100.0:
            budget_status = "WARNING"
        else:
            budget_status = "BUDGET EXCEEDED"

        return {
            "currency": "USD",
            "today_spend": today_spend,
            "month_spend": month_spend,
            "monthly_budget": round(monthly_budget, 2),
            "budget_used_pct": budget_used_pct,
            "remaining_budget": remaining_budget,
            "budget_status": budget_status,
            "days_remaining": self.SAMPLE_DAYS_REMAINING,
            "daily_trend": [dict(p) for p in self.SAMPLE_DAILY_TREND],
            "breakdown": [dict(b) for b in self.SAMPLE_BREAKDOWN],
            "source": self.provider_name,
            "data_source_status": self.connection_status,
            "simulation_mode": self.is_simulation,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


class AWSBillingProvider(BaseBillingProvider):
    """
    Adapter stub for future AWS Cost Explorer / Cost & Usage Reports integration.
    Does not make real AWS API calls until live credentials and SDK are configured.
    """

    @property
    def provider_name(self) -> str:
        return "aws"

    @property
    def is_simulation(self) -> bool:
        return False

    @property
    def connection_status(self) -> str:
        return "AWS Cost Explorer not configured"

    def get_costs(self, monthly_budget: float) -> Dict[str, Any]:
        raise NotImplementedError("Live AWS billing adapter is not yet connected.")


class AzureBillingProvider(BaseBillingProvider):
    """
    Adapter stub for future Azure Cost Management API integration.
    Does not make real Azure calls until live credentials and SDK are configured.
    """

    @property
    def provider_name(self) -> str:
        return "azure"

    @property
    def is_simulation(self) -> bool:
        return False

    @property
    def connection_status(self) -> str:
        return "Azure Cost Management not configured"

    def get_costs(self, monthly_budget: float) -> Dict[str, Any]:
        raise NotImplementedError("Live Azure billing adapter is not yet connected.")


class CostManager:
    """
    Manages cloud billing provider and in-memory budget settings.
    Resets to default monthly budget ($2500.00) when backend restarts.
    """

    DEFAULT_BUDGET: float = 2500.00

    def __init__(self, provider: Optional[BaseBillingProvider] = None) -> None:
        self.provider: BaseBillingProvider = provider or SimulatedBillingProvider()
        self.monthly_budget: float = self.DEFAULT_BUDGET

    def get_cost_summary(self) -> Dict[str, Any]:
        """Returns the full cost summary and telemetry from the active provider."""
        return self.provider.get_costs(self.monthly_budget)

    def get_settings(self) -> Dict[str, Any]:
        """Returns current budget configuration settings."""
        return {
            "monthly_budget": round(self.monthly_budget, 2),
            "currency": "USD",
            "simulation_mode": self.provider.is_simulation,
            "source": self.provider.provider_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def update_budget(self, new_budget: Any) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        """
        Validates and updates the monthly budget.
        Rejects non-numeric, negative, zero, NaN, and Infinite values.
        Returns: (success: bool, message: str, updated_settings_dict)
        """
        if new_budget is None:
            return False, "Field 'monthly_budget' is required", None

        # Disallow booleans (in Python, bool is a subclass of int: isinstance(True, int) is True)
        if isinstance(new_budget, bool):
            return False, "Budget must be a positive numeric value, not a boolean", None

        try:
            val = float(new_budget)
        except (ValueError, TypeError):
            return False, f"Invalid budget value '{new_budget}'. Must be a positive number.", None

        if math.isnan(val) or math.isinf(val):
            return False, "Budget must be a finite positive number", None

        if val <= 0:
            return False, "Budget must be a positive numeric amount greater than zero", None

        # Accept valid budget (rounded to 2 decimal places)
        self.monthly_budget = round(val, 2)
        return True, f"Monthly budget updated to ${self.monthly_budget:.2f}", self.get_settings()

    def reset(self) -> None:
        """Resets cost settings to defaults (for test isolation)."""
        self.monthly_budget = self.DEFAULT_BUDGET


# Global singleton instance
cost_manager = CostManager()
