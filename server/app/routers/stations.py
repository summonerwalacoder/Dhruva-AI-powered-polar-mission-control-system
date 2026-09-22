from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..audit import audit
from ..database import get_db
from ..models import Station, User
from ..schemas import StationCreate
from ..security import get_current_user, require

router = APIRouter(tags=["stations"])


@router.get("/stations")
def list_stations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [station_out(s) for s in db.query(Station).order_by(Station.name).all()]


@router.post("/stations")
def create_station(body: StationCreate, db: Session = Depends(get_db), user: User = Depends(require("mission:write"))):
    if db.query(Station).filter(Station.code == body.code).first():
        raise HTTPException(400, "Station code exists.")
    s = Station(**body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    audit(db, user, "create", "station", s.code)
    return station_out(s)


@router.patch("/stations/{station_id}")
def update_station(station_id: int, body: StationCreate, db: Session = Depends(get_db), user: User = Depends(require("mission:write"))):
    s = db.get(Station, station_id)
    if not s:
        raise HTTPException(404, "Station not found.")
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    audit(db, user, "update", "station", s.code)
    return station_out(s)


@router.delete("/stations/{station_id}")
def delete_station(station_id: int, db: Session = Depends(get_db), user: User = Depends(require("mission:delete"))):
    s = db.get(Station, station_id)
    if not s:
        raise HTTPException(404, "Station not found.")
    db.delete(s)
    db.commit()
    audit(db, user, "delete", "station", s.code)
    return {"ok": True}


def station_out(s):
    return {
        "id": s.id,
        "code": s.code,
        "name": s.name,
        "type": s.type,
        "region": s.region,
        "latitude": s.latitude,
        "longitude": s.longitude,
        "elevation_m": s.elevation_m,
        "country": s.country,
        "description": s.description,
        "active": s.active,
    }