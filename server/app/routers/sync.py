from datetime import datetime, timezone

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
    SyncLog,
    SyncOutbox,
    Task,
    User,
)
from ..schemas import SyncPush
from ..security import get_current_user

router = APIRouter(prefix="/sync", tags=["sync"])

# Tables writable by offline clients during disconnected operation
ENTITY_MODELS = {
    "mission": Mission,
    "personnel": Personnel,
    "cargo": Cargo,
    "inventory": InventoryItem,
    "asset": Asset,
    "alert": Alert,
    "task": Task,
    "emergency": Emergency,
}


@router.post("/push")
def push_offline(body: SyncPush, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    accepted, conflicts, errors = [], [], []
    for item in body.items or []:
        entity = item.get("entity")
        model = ENTITY_MODELS.get(entity)
        if not model:
            errors.append({"entity_id": item.get("entity_id", ""), "error": "unknown entity"})
            continue
        try:
            row_id = item.get("row_id")
            if item.get("operation") == "delete":
                obj = db.get(model, row_id) if row_id else None
                if obj:
                    db.delete(obj)
                    db.commit()
                    accepted.append({"entity": entity, "entity_id": item.get("entity_id"), "op": "delete"})
                continue

            payload = dict(item.get("payload") or {})
            payload.pop("id", None)
            obj = db.get(model, row_id) if row_id else None
            if obj:
                for k, v in payload.items():
                    if hasattr(model, k):
                        setattr(obj, k, v)
            else:
                obj = model(**payload)
                db.add(obj)
            db.commit()
            db.refresh(obj)
            accepted.append({"entity": entity, "entity_id": getattr(obj, "id", None), "op": "upsert"})
        except Exception as e:
            db.rollback()
            errors.append({"entity": entity, "entity_id": item.get("entity_id", ""), "error": str(e)})

    db.add(SyncLog(action="push", detail=f"{len(accepted)} accepted, {len(conflicts)} conflicts, {len(errors)} errors"))
    db.commit()
    return {"accepted": accepted, "conflicts": conflicts, "errors": errors}


@router.get("/pull")
def pull_snapshot(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Full snapshot used by the client to warm its offline cache."""
    from ..security import accessible_mission_ids

    ids = accessible_mission_ids(db, user)
    data = {
        "missions": [serialize(m) for m in db.query(Mission).all()],
        "personnel": [serialize(p) for p in db.query(Personnel).all()],
        "cargo": [serialize(c) for c in db.query(Cargo).all()],
        "inventory": [serialize(i) for i in db.query(InventoryItem).all()],
        "assets": [serialize(a) for a in db.query(Asset).all()],
        "alerts": [serialize(a) for a in db.query(Alert).all()],
        "tasks": [serialize(t) for t in db.query(Task).all()],
        "emergencies": [serialize(e) for e in db.query(Emergency).all()],
    }
    db.add(SyncLog(action="pull", detail=f"snapshot served to {user.email}"))
    db.commit()
    return {"data": data, "server_time": datetime.now(timezone.utc).isoformat()}


@router.get("/outbox")
def outbox_status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(SyncOutbox).order_by(SyncOutbox.created_at.desc()).limit(50).all()
    return [{"id": r.id, "entity": r.entity, "entity_id": r.entity_id, "operation": r.operation,
             "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]


def serialize(obj):
    d = {col.name: getattr(obj, col.name) for col in obj.__table__.columns}
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d