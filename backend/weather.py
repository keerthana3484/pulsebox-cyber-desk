"""
Weather Provider and Telemetry architecture for PulseBox Cyber Desk.
Provides deterministic simulation data and extensible provider interfaces
for future live weather services (e.g., OpenWeatherMap, WeatherAPI).
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, Optional


class BaseWeatherProvider(ABC):
    """
    Abstract base class for weather data sources.
    Decouples weather data provider implementation from API and presentation layers.
    """

    @abstractmethod
    def get_weather(self) -> Dict[str, Any]:
        """
        Retrieves current weather telemetry, condition, humidity, and wind.
        """
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the weather provider adapter."""
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


class SimulatedWeatherProvider(BaseWeatherProvider):
    """
    Deterministic simulated weather provider.
    Returns reproducible, internally consistent weather telemetry without connecting
    to external weather APIs or requiring API keys.
    """

    DEFAULT_LOCATION: str = "DEMO LOCATION"
    DEFAULT_TEMP_C: float = 22.0
    DEFAULT_TEMP_F: float = 71.6
    DEFAULT_FEELS_LIKE_C: float = 22.5
    DEFAULT_FEELS_LIKE_F: float = 72.5
    DEFAULT_CONDITION: str = "Partly Cloudy"
    DEFAULT_CONDITION_CODE: str = "partly_cloudy"
    DEFAULT_CONDITION_SYMBOL: str = "⛅"
    DEFAULT_HUMIDITY_PCT: int = 58
    DEFAULT_WIND_SPEED_MPH: float = 8.5
    DEFAULT_WIND_SPEED_KMH: float = 13.7
    DEFAULT_WIND_DIRECTION: str = "NW"
    DEFAULT_PRESSURE_HPA: int = 1014
    DEFAULT_UV_INDEX: int = 3
    DEFAULT_AIR_QUALITY: str = "24 AQI (Good)"

    @property
    def provider_name(self) -> str:
        return "simulated"

    @property
    def is_simulation(self) -> bool:
        return True

    @property
    def connection_status(self) -> str:
        return "No live weather connection"

    def get_weather(self) -> Dict[str, Any]:
        """
        Returns deterministic simulated weather telemetry.
        Never presents simulated weather as live data.
        """
        return {
            "location": self.DEFAULT_LOCATION,
            "temperature_c": self.DEFAULT_TEMP_C,
            "temperature_f": self.DEFAULT_TEMP_F,
            "feels_like_c": self.DEFAULT_FEELS_LIKE_C,
            "feels_like_f": self.DEFAULT_FEELS_LIKE_F,
            "condition": self.DEFAULT_CONDITION,
            "condition_code": self.DEFAULT_CONDITION_CODE,
            "condition_symbol": self.DEFAULT_CONDITION_SYMBOL,
            "humidity_pct": self.DEFAULT_HUMIDITY_PCT,
            "wind_speed_mph": self.DEFAULT_WIND_SPEED_MPH,
            "wind_speed_kmh": self.DEFAULT_WIND_SPEED_KMH,
            "wind_direction": self.DEFAULT_WIND_DIRECTION,
            "pressure_hpa": self.DEFAULT_PRESSURE_HPA,
            "uv_index": self.DEFAULT_UV_INDEX,
            "air_quality": self.DEFAULT_AIR_QUALITY,
            "source": self.provider_name,
            "data_source_status": self.connection_status,
            "simulation_mode": self.is_simulation,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


class OpenWeatherMapProvider(BaseWeatherProvider):
    """
    Adapter stub for future OpenWeatherMap API integration.
    Does not make real external network calls until API key and client are configured.
    """

    @property
    def provider_name(self) -> str:
        return "openweathermap"

    @property
    def is_simulation(self) -> bool:
        return False

    @property
    def connection_status(self) -> str:
        return "OpenWeatherMap API not configured"

    def get_weather(self) -> Dict[str, Any]:
        raise NotImplementedError("Live OpenWeatherMap adapter is not yet connected.")


class WeatherApiProvider(BaseWeatherProvider):
    """
    Adapter stub for future WeatherAPI integration.
    Does not make real external calls until API credentials are configured.
    """

    @property
    def provider_name(self) -> str:
        return "weatherapi"

    @property
    def is_simulation(self) -> bool:
        return False

    @property
    def connection_status(self) -> str:
        return "WeatherAPI not configured"

    def get_weather(self) -> Dict[str, Any]:
        raise NotImplementedError("Live WeatherAPI adapter is not yet connected.")


class WeatherManager:
    """
    Manages active weather provider and telemetry retrieval.
    """

    def __init__(self, provider: Optional[BaseWeatherProvider] = None) -> None:
        self.provider: BaseWeatherProvider = provider or SimulatedWeatherProvider()

    def get_weather(self) -> Dict[str, Any]:
        """Returns the weather telemetry from the active provider."""
        return self.provider.get_weather()

    def reset(self) -> None:
        """Resets weather manager to default simulation provider."""
        self.provider = SimulatedWeatherProvider()


# Global singleton instance
weather_manager = WeatherManager()
