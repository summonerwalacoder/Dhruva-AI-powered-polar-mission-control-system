from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Notification, User
from ..schemas import NotificationRead
from ..security import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user), unread_only: bool = Query(False)):
    q = db.query(Notification)
    if user.role != "admin":
        q = q.filter((Notification.user_id == user.id) | (Notification.user_id == None))
    if unread_only:
        q = q.filter(Notification.read == False)
    rows = q.order_by(Notification.timestamp.desc()).limit(100).all()
    return [_out(n) for n in rows]


@router.patch("/{notification_id}/read")
def mark_read(notification_id: int, body: NotificationRead, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.get(Notification, notification_id)
    if not n:
        raise HTTPException(404, "Notification not found.")
    n.read = body.read
    db.commit()
    return {"ok": True, "read": n.read}


def _out(n):
    d = {col.name: getattr(n, col.name) for col in n.__table__.columns}
    d["timestamp"] = n.timestamp.isoformat() if n.timestamp else None
    return d