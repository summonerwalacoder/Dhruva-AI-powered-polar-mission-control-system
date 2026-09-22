from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..audit import audit
from ..database import get_db
from ..models import (
    Alert,
    Asset,
    Cargo,
    Emergency,
    InventoryItem,
    Mission,
    Personnel,
    Station,
    User,
    WeatherRecord,
)
from ..schemas import (
    AIPlanRequest,
    AIResourceSuggestion,
    MissionCreate,
    MissionUpdate,
)
from ..security import get_current_user, require
from ..services.assets import maintenance_risk
from ..services.prediction import survival_clock
from ..services.risk_engine import compute_mission_risk

router = APIRouter(prefix="/missions", tags=["missions"])


@router.get("")
def list_missions(db: Session = Depends(get_db), user: User = Depends(require("mission:read"))):
    from ..security import accessible_mission_ids

    ids = accessible_mission_ids(db, user)
    missions = db.query(Mission).filter(Mission.id.in_(ids)).order_by(Mission.created_at.desc()).all()
    return [mission_summary(db, m, user) for m in missions]


@router.post("")
def create_mission(body: MissionCreate, db: Session = Depends(get_db), user: User = Depends(require("mission:write"))):
    if db.query(Mission).filter(Mission.mission_id == body.mission_id).first():
        raise HTTPException(400, "Mission ID already exists.")
    m = Mission(**body.model_dump(), created_by=user.id)
    db.add(m)
    db.commit()
    db.refresh(m)
    audit(db, user, "create", "mission", m.mission_id, new=body.model_dump())
    _auto_alerts(db, m)
    return mission_summary(db, m, user)


@router.get("/{mission_id}")
def get_mission(mission_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = db.get(Mission, mission_id)
    if not m:
        raise HTTPException(404, "Mission not found.")
    _check_access(db, user, m)
    return mission_summary(db, m, user)


@router.patch("/{mission_id}")
def update_mission(mission_id: int, body: MissionUpdate, db: Session = Depends(get_db), user: User = Depends(require("mission:write"))):
    m = db.get(Mission, mission_id)
    if not m:
        raise HTTPException(404, "Mission not found.")
    _check_access(db, user, m)
    prev = {c.name: getattr(m, c.name) for c in m.__table__.columns}
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    audit(db, user, "update", "mission", m.mission_id, prev=prev, new={c.name: getattr(m, c.name) for c in m.__table__.columns})
    _auto_alerts(db, m)
    return mission_summary(db, m, user)


@router.delete("/{mission_id}")
def delete_mission(mission_id: int, db: Session = Depends(get_db), user: User = Depends(require("mission:delete"))):
    m = db.get(Mission, mission_id)
    if not m:
        raise HTTPException(404, "Mission not found.")
    db.delete(m)
    db.commit()
    audit(db, user, "delete", "mission", m.mission_id)
    return {"ok": True}


@router.get("/{mission_id}/overview")
def mission_overview(mission_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = db.get(Mission, mission_id)
    if not m:
        raise HTTPException(404, "Mission not found.")
    _check_access(db, user, m)
    return overview(db, m)


def overview(db, m: Mission):
    from ..services.resupply import resupply_plan
    from ..services.prediction import _next_resupply_date

    today = date.today()
    start = date.fromisoformat(m.start_date) if m.start_date else today
    end = date.fromisoformat(m.end_date) if m.end_date else today
    elapsed = max(0, (today - start).days)
    total = max(1, (end - start).days)
    remaining = max(0, total - elapsed)

    personnel = db.query(Personnel).filter(Personnel.mission_id == m.id).all()
    cargo = db.query(Cargo).filter(Cargo.mission_id == m.id).all()
    inventory = db.query(InventoryItem).filter(InventoryItem.mission_id == m.id).all()
    assets = db.query(Asset).filter(Asset.mission_id == m.id).all()
    alerts = db.query(Alert).filter(Alert.mission_id == m.id, Alert.status == "active").all()

    clock = survival_clock(db, m.id)
    clock_map = {c["category"]: c for c in clock}

    food = clock_map.get("food") or {}
    fuel = clock_map.get("fuel") or {}
    med = clock_map.get("medical") or {}

    delayed_cargo = [c for c in cargo if c.expected_arrival and c.expected_arrival < today.isoformat()]
    critical_assets = [maintenance_risk(a) for a in assets if maintenance_risk(a)["status"] in ("high", "critical")]
    weather = db.query(WeatherRecord).filter(WeatherRecord.station_id == m.station_id).order_by(WeatherRecord.recorded_at.desc()).first() if m.station_id else None
    risk = compute_mission_risk(db, m)
    replen = resupply_plan(db, m)
    emergencies = db.query(Emergency).filter(Emergency.mission_id == m.id, Emergency.status != "resolved").count()

    return {
        "mission": {
            "id": m.id,
            "mission_id": m.mission_id,
            "name": m.name,
            "destination": m.destination,
            "status": m.status,
            "progress": m.progress or 0,
            "elapsed_days": elapsed,
            "total_days": total,
            "remaining_days": remaining,
            "team_size_planned": m.team_size,
            "team_size_actual": len(personnel),
            "start_date": m.start_date,
            "end_date": m.end_date,
            "objective": m.objective,
            "emergency_contact": m.emergency_contact,
            "station": {"id": m.station.id, "name": m.station.name, "code": m.station.code} if m.station else None,
            "commander": _personnel_out(m.commander) if m.commander else None,
        },
        "counts": {
            "personnel": len(personnel),
            "cargo_items": len(cargo),
            "containers": len({c.container_id for c in cargo if c.container_id}),
            "inventory_items": len(inventory),
            "assets": len(assets),
            "active_alerts": len(alerts),
            "open_emergencies": emergencies,
            "delayed_cargo": len(delayed_cargo),
            "critical_assets": len(critical_assets),
        },
        "resources": {
            "food_days": food.get("days_remaining"),
            "food_status": food.get("status"),
            "fuel_days": fuel.get("days_remaining"),
            "fuel_status": fuel.get("status"),
            "medical_days": med.get("days_remaining"),
            "medical_status": med.get("status"),
            "resupply_date": clock_map.get("food", {}).get("resupply_date"),
        },
        "weather": _weather_out(weather),
        "risk": risk,
        "survival_clock": clock,
        "resupply_plan": replen.get("recommended_date"),
        "next_resupply": _next_resupply_date(m),
    }


# AI Planning Assistant -----------------------------------------------------
AI_PLAN_CATALOG = {
    "food": {"unit": "kg", "qty_per_person_day": 2.0, "label": "Food (rations)"},
    "water": {"unit": "L", "qty_per_person_day": 4.0, "label": "Water / melt + storage"},
    "fuel": {"unit": "L", "qty_per_person_day": 3.5, "label": "Heating + gen fuel"},
    "medical": {"unit": "kit", "qty_per_person_day": 0.02, "label": "Medical supply kits"},
    "emergency": {"unit": "pack", "qty_per_person_day": 0.01, "label": "Emergency reserve packs"},
    "scientific": {"unit": "set", "qty_per_person_day": 0.0, "label": "Scientific equipment"},
}


@router.post("/{mission_id}/plan", dependencies=[])
def ai_plan(mission_id: int, body: AIPlanRequest, db: Session = Depends(get_db), user: User = Depends(require("mission:write"))):
    m = db.get(Mission, mission_id)
    if not m:
        raise HTTPException(404, "Mission not found.")
    _check_access(db, user, m)

    duration = max(1, body.duration_days or m.duration_days or 1)
    team = max(1, body.team_size or m.team_size or 1)

    # destination cold factor
    dest = (body.destination or m.destination or "").lower()
    cold_factor = 1.15 if any(k in dest for k in ["bharati", "maitri", "antarctica", "south pole"]) else 1.0

    suggestions = []
    for key, meta in AI_PLAN_CATALOG.items():
        qty = round(meta["qty_per_person_day"] * team * duration * cold_factor, 1)
        reasons = {
            "food": f"{team} people × {duration} days × {meta['qty_per_person_day']} kg/day (+cold margin).",
            "water": f"{team} people × {duration} days × {meta['qty_per_person_day']} L/day for drinking + cooking.",
            "fuel": f"Heating/genset estimate {meta['qty_per_person_day']} L/person/day over {duration} days, adjusted for {dest or 'destination'} climate.",
            "medical": f"Standard medley for {team} persons over {duration} days including first-aid and cold-injury stock.",
            "emergency": f"Emergency reserves ~1 pack per {int(1/meta['qty_per_person_day'])} persons for a contingency window.",
            "scientific": "Base allocation for deployed research equipment sets.",
        }[key]
        suggestions.append(AIResourceSuggestion(category=key, quantity=qty, unit=meta["unit"], reason=reasons))

    return {
        "generated_for": f"{mission_id}",
        "duration_days": duration,
        "team_size": team,
        "destination": body.destination or m.destination,
        "objective": body.objective or m.objective,
        "suggestions": suggestions,
        "explanation": (
            "Recommendations are heuristics: per-person/day consumption scaled to the "
            "mission duration and team size, with a cold-climate margin. Review and edit "
            "before saving; they do not replace an expert logistics plan."
        ),
    }


# ---------------------------------------------------------------------------
def mission_summary(db, m: Mission, user=None):
    today = date.today()
    start = date.fromisoformat(m.start_date) if m.start_date else today
    end = date.fromisoformat(m.end_date) if m.end_date else today
    elapsed = max(0, (today - start).days)
    total = max(1, (end - start).days)
    active_alerts = db.query(Alert).filter(Alert.mission_id == m.id, Alert.status == "active").count()
    risk = compute_mission_risk(db, m)
    clock = survival_clock(db, m.id)
    clock_map = {c["category"]: c for c in clock}
    return {
        "id": m.id,
        "mission_id": m.mission_id,
        "name": m.name,
        "region": m.region,
        "destination": m.destination,
        "start_date": m.start_date,
        "end_date": m.end_date,
        "duration_days": m.duration_days,
        "elapsed_days": elapsed,
        "total_days": total,
        "objective": m.objective,
        "team_size": m.team_size,
        "status": m.status,
        "progress": m.progress or 0,
        "emergency_contact": m.emergency_contact,
        "planned_resupplies": m.planned_resupplies,
        "route": m.route,
        "commander_id": m.commander_id,
        "station": {"id": m.station.id, "name": m.station.name, "code": m.station.code} if m.station else None,
        "station_id": m.station_id,
        "active_alerts": active_alerts,
        "risk_level": risk["level"],
        "food_days": clock_map.get("food", {}).get("days_remaining"),
        "fuel_days": clock_map.get("fuel", {}).get("days_remaining"),
        "personnel_count": db.query(Personnel).filter(Personnel.mission_id == m.id).count(),
        "cargo_count": db.query(Cargo).filter(Cargo.mission_id == m.id).count(),
        "asset_count": db.query(Asset).filter(Asset.mission_id == m.id).count(),
        "created_at": m.created_at,
    }


def _check_access(db, user, m):
    from ..security import accessible_mission_ids

    ids = accessible_mission_ids(db, user)
    if m.id not in ids:
        raise HTTPException(403, "You do not have access to this mission.")


def _personnel_out(p):
    return {
        "id": p.id,
        "personnel_id": p.personnel_id,
        "name": p.name,
        "role": p.role,
        "contact": p.contact,
    }


def _weather_out(w):
    if not w:
        return {"source": "none", "label": "No weather data", "temperature_c": None, "wind_speed": None, "condition": None, "storm": False}
    return {
        "source": w.source,
        "label": w.source_label or w.source,
        "temperature_c": w.temperature_c,
        "wind_speed": w.wind_speed,
        "visibility_km": w.visibility_km,
        "condition": w.condition,
        "storm": w.storm,
        "ice_route_condition": w.ice_route_condition,
        "recorded_at": w.recorded_at.isoformat() if w.recorded_at else None,
    }


def _auto_alerts(db, m):
    # Create sensible alerts derived from mission state (idempotent-ish)
    from ..models import Alert

    today = date.today()
    if m.end_date and m.end_date < today.isoformat() and m.status not in ("completed",):
        db.add(Alert(mission_id=m.id, type="mission_overdue", severity="high",
                     title="Mission past planned end date", message="Update the mission status or extend the plan.",
                     source="system"))
    db.commit()