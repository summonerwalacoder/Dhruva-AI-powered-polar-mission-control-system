"""Weather retrieval service.

Always clearly communicates the data source and connection status.
When no external API key is configured, it reports the data source as
"Manual entry" / "Not configured" rather than pretending the data is live.
"""
import httpx

from ..config import settings
from ..models import WeatherRecord, Station


async def fetch_openweathermap(lat: float, lng: float) -> dict | None:
    if not settings.owm_api_key:
        return None
    url = f"{settings.owm_base_url}/weather"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, params={"lat": lat, "lon": lng, "appid": settings.owm_api_key, "units": "metric"})
            if resp.status_code != 200:
                return {"error": f"OWM API returned status {resp.status_code}"}
            d = resp.json()
            w = d.get("weather", [{}])[0]
            m = d.get("main", {})
            wind = d.get("wind", {})
            return {
                "source": "api",
                "source_label": "OpenWeatherMap Live",
                "temperature_c": m.get("temp"),
                "wind_speed": wind.get("speed"),
                "wind_direction": _wind_dir(wind.get("deg", 0)),
                "visibility_km": round((d.get("visibility") or 0) / 1000, 1),
                "condition": w.get("description", "N/A"),
                "humidity": m.get("humidity"),
                "storm": bool("storm" in (w.get("description") or "").lower() or (wind.get("speed") or 0) > 20),
                "ice_route_condition": "unstable" if (m.get("temp") or 0) < -10 and (wind.get("speed") or 0) > 15 else "open",
                "forecast_alerts": [],
                "status": "live",
            }
    except Exception as e:
        return {"error": str(e)}


def _wind_dir(deg):
    dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return dirs[int((deg + 22.5) / 45) % 8]


def weather_source_status(db):
    has_owm = bool(settings.owm_api_key)
    manual_count = db.query(WeatherRecord).filter(WeatherRecord.source == "manual").count()
    api_count = db.query(WeatherRecord).filter(WeatherRecord.source == "api").count()
    sim_count = db.query(WeatherRecord).filter(WeatherRecord.source == "simulated").count()
    last = db.query(WeatherRecord).order_by(WeatherRecord.recorded_at.desc()).first()
    return {
        "owm_configured": has_owm,
        "owm_available": has_owm,
        "manual_records": manual_count,
        "api_records": api_count,
        "simulated_records": sim_count,
        "last_updated": last.recorded_at.isoformat() if last else None,
        "status": "live" if has_owm else "offline",
        "message": (
            "Connected to OpenWeatherMap API. Live data shown when available."
            if has_owm else
            "OpenWeatherMap API key not configured. Weather data is manually entered or simulated. "
            "Set OWM_API_KEY in .env to enable live weather."
        ),
    }