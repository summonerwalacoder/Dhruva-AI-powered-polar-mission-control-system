from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..audit import audit
from ..database import get_db
from ..models import Alert, User
from ..schemas import AlertCreate, AlertUpdate
from ..security import get_current_user, require

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def list_alerts(db: Session = Depends(get_db), user: User = Depends(require("alerts:read")), mission_id: int = Query(None), severity: str = Query(""), status: str = Query("")):
    q = db.query(Alert)
    if mission_id:
        q = q.filter(Alert.mission_id == mission_id)
    if severity:
        q = q.filter(Alert.severity == severity)
    if status:
        q = q.filter(Alert.status == status)
    rows = q.order_by(Alert.created_at.desc()).all()
    return [_out(a) for a in rows]


@router.post("")
def create_alert(body: AlertCreate, db: Session = Depends(get_db), user: User = Depends(require("alerts:write"))):
    a = Alert(**body.model_dump(), source=user.role)
    db.add(a)
    db.commit()
    db.refresh(a)
    audit(db, user, "create", "alert", str(a.id))
    return _out(a)


@router.patch("/{alert_id}")
def update_alert(alert_id: int, body: AlertUpdate, db: Session = Depends(get_db), user: User = Depends(require("alerts:write"))):
    a = db.get(Alert, alert_id)
    if not a:
        raise HTTPException(404, "Alert not found.")
    prev = _out(a)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    if body.status == "resolved" and not a.resolved_at:
        from datetime import datetime, timezone
        a.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(a)
    audit(db, user, "update", "alert", str(a.id), prev=prev, new=_out(a))
    return _out(a)


def _out(a):
    return {col.name: getattr(a, col.name) for col in a.__table__.columns}