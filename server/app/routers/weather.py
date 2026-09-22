from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..audit import audit
from ..database import get_db
from ..models import Station, User, WeatherRecord
from ..schemas import WeatherCreate
from ..security import get_current_user, require
from ..services.weather import fetch_openweathermap, weather_source_status

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("")
def list_weather(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    station_id: int = Query(None),
):
    q = db.query(WeatherRecord)
    if station_id:
        q = q.filter(WeatherRecord.station_id == station_id)
    rows = q.order_by(WeatherRecord.recorded_at.desc()).limit(50).all()
    return [_out(r) for r in rows]


@router.post("")
def create_weather(body: WeatherCreate, db: Session = Depends(get_db), user: User = Depends(require("weather:write"))):
    r = WeatherRecord(**body.model_dump(), source_label=body.source_label or "Manual entry")
    db.add(r)
    db.commit()
    db.refresh(r)
    audit(db, user, "create", "weather", str(r.id))
    return _out(r)


@router.get("/live")
async def weather_live(station_id: int = Query(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    station = db.get(Station, station_id)
    if not station:
        return {"error": "Station not found.", "status": "not_configured"}
    data = await fetch_openweathermap(station.latitude, station.longitude)
    if data and not data.get("error"):
        r = WeatherRecord(station_id=station.id, source="api", source_label=data["source_label"],
                          temperature_c=data.get("temperature_c"), wind_speed=data.get("wind_speed"),
                          wind_direction=data.get("wind_direction"), visibility_km=data.get("visibility_km"),
                          condition=data.get("condition", ""), humidity=data.get("humidity"),
                          storm=data.get("storm", False), ice_route_condition=data.get("ice_route_condition", "open"),
                          forecast_alerts=data.get("forecast_alerts", []))
        db.add(r)
        db.commit()
        return {**_out(r), "fetched_live": True}
    return {"error": data.get("error", "OWM API not configured or request failed."),
            "status": "not_configured",
            "message": "Set OWM_API_KEY in .env to enable live weather retrieval."}


@router.get("/status")
def weather_status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return weather_source_status(db)


def _out(r):
    return {col.name: getattr(r, col.name) for col in r.__table__.columns}