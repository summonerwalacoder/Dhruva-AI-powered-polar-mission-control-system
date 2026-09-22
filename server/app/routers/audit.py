from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AuditLog, User
from ..security import require

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def list_audit(
    db: Session = Depends(get_db),
    user: User = Depends(require("audit:read")),
    entity: str = Query(""),
    action: str = Query(""),
    q: str = Query(""),
    limit: int = Query(200, le=1000),
):
    query = db.query(AuditLog)
    if entity:
        query = query.filter(AuditLog.entity == entity)
    if action:
        query = query.filter(AuditLog.action == action)
    rows = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
    out = []
    for r in rows:
        d = {c.name: getattr(r, c.name) for c in r.__table__.columns}
        d["timestamp"] = r.timestamp.isoformat() if r.timestamp else None
        out.append(d)
    if q:
        out = [d for d in out if q.lower() in d.get("user_email", "").lower() or q.lower() in d.get("entity", "").lower() or q.lower() in str(d.get("entity_id", "")).lower()]
    return out


@router.get("/stats")
def audit_stats(user: User = Depends(require("audit:read")), db: Session = Depends(get_db)):
    rows = db.query(AuditLog).all()
    action_count = {}
    for r in rows:
        action_count[r.action] = action_count.get(r.action, 0) + 1
    return {"total": len(rows), "by_action": action_count}