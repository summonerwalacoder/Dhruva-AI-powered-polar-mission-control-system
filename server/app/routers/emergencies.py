from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..audit import audit
from ..database import get_db
from ..models import Emergency, Mission, Notification, User
from ..schemas import EmergencyAIRequest, EmergencyCreate, EmergencyUpdate
from ..security import get_current_user, require
from ..services.emergency import (
    build_guidance,
    detect_emergency_type,
    estimate_severity,
    interpret_emergency,
    sos_payload,
    TYPE_LABELS,
)

router = APIRouter(prefix="/emergencies", tags=["emergencies"])


@router.get("")
def list_emergencies(db: Session = Depends(get_db), user: User = Depends(require("emergency:read")), mission_id: int = Query(None), status: str = Query("")):
    q = db.query(Emergency)
    if mission_id:
        q = q.filter(Emergency.mission_id == mission_id)
    if status:
        q = q.filter(Emergency.status == status)
    rows = q.order_by(Emergency.reported_at.desc()).all()
    return [_out(e) for e in rows]


@router.post("")
def create_emergency(body: EmergencyCreate, db: Session = Depends(get_db), user: User = Depends(require("emergency:report"))):
    import hashlib, uuid
    eid = f"EMR-{hashlib.sha1(str(datetime.now(timezone.utc)).encode()).hexdigest()[:6].upper()}"
    mission = db.get(Mission, body.mission_id) if body.mission_id else None
    e = Emergency(
        emergency_id=eid,
        mission_id=body.mission_id or (mission.id if mission else None),
        reporter_id=user.id,
        type=body.type,
        severity=body.severity,
        location=body.location,
        latitude=body.latitude,
        longitude=body.longitude,
        description=body.description,
        recommended_response=body.recommended_response,
        status=body.status,
        connectivity_status=body.connectivity_status,
        offline_queued=body.offline_queued,
        reported_at=datetime.now(timezone.utc),
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    _auto_notify(db, e, user)
    audit(db, user, "create", "emergency", eid)
    return _out(e)


@router.post("/ai-interpret")
async def ai_interpret(body: EmergencyAIRequest, db: Session = Depends(get_db), user: User = Depends(require("emergency:report"))):
    mission = db.get(Mission, body.mission_id) if body.mission_id else None
    result = await interpret_emergency(db, user, mission, body.description, body.connectivity_status, body.voice)
    guidance = build_guidance(result["emergency_type"], result["severity"])
    etype = detect_emergency_type(body.description)
    sev = estimate_severity(body.description, db, mission)
    return {
        **result,
        "guidance": guidance,
        "recommended_next_steps": [guidance],
        "suggested_emergency_create": {
            "mission_id": body.mission_id,
            "type": result["emergency_type"],
            "severity": result["severity"],
            "description": body.description,
            "recommended_response": guidance,
        },
    }


@router.get("/sos-status")
def sos_status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from ..models import SystemConfig
    cfg = db.query(SystemConfig).filter(SystemConfig.key == "emergency_policy").first()
    policy = (cfg.value if cfg and isinstance(cfg.value, dict) else {}) or {}
    return {"policy": policy, "message": "Emergency policy from system config."}


@router.get("/{emergency_id}")
def get_emergency(emergency_id: int, db: Session = Depends(get_db), user: User = Depends(require("emergency:read"))):
    e = db.query(Emergency).filter(Emergency.emergency_id == emergency_id).first()
    if not e:
        raise HTTPException(404, "Emergency not found.")
    return _out(e)


@router.patch("/{emergency_id}")
def update_emergency(emergency_id: int, body: EmergencyUpdate, db: Session = Depends(get_db), user: User = Depends(require("emergency:respond"))):
    e = db.query(Emergency).filter(Emergency.emergency_id == emergency_id).first()
    if not e:
        raise HTTPException(404, "Emergency not found.")
    prev = _out(e)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(e, k, v)
    if body.status == "resolved" and not e.resolved_at:
        e.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(e)
    audit(db, user, "update", "emergency", e.emergency_id, prev=prev, new=_out(e))
    return _out(e)


def _auto_notify(db, e: Emergency, user):
    if e.severity in ("serious", "critical"):
        db.add(Notification(
            user_id=None,
            mission_id=e.mission_id,
            title=f"EMERGENCY: {e.type} ({e.severity.upper()})",
            body=f"{e.emergency_id}: {e.description}",
            type="emergency",
            channel="inapp",
            external_status="not_configured",
        ))
        db.commit()


def _out(e):
    return {col.name: getattr(e, col.name) for col in e.__table__.columns}