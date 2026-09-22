from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..audit import audit
from ..database import get_db
from ..models import User
from ..schemas import UserCreate, UserUpdate
from ..security import hash_password, require

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
def list_users(db: Session = Depends(get_db), user: User = Depends(require("users:read"))):
    rows = db.query(User).order_by(User.name).all()
    return [_out(u) for u in rows]


@router.post("")
def create_user(body: UserCreate, db: Session = Depends(get_db), admin: User = Depends(require("users:manage"))):
    if db.query(User).filter(User.email == body.email.lower()).first():
        raise HTTPException(400, "Email already registered.")
    u = User(
        email=body.email.lower(),
        name=body.name,
        password_hash=hash_password(body.password),
        role=body.role,
        designation=body.designation,
        phone=body.phone,
        station_id=body.station_id,
        mission_id=body.mission_id,
        language=body.language,
        active=body.active,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    audit(db, admin, "create", "user", str(u.id), new=body.model_dump())
    return _out(u)


@router.patch("/{user_id}")
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db), admin: User = Depends(require("users:manage"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found.")
    prev = _out(u)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        if k == "password" and v:
            setattr(u, "password_hash", hash_password(v))
        elif k != "password":
            setattr(u, k, v)
    db.commit()
    db.refresh(u)
    audit(db, admin, "update", "user", str(u.id), prev=prev, new=_out(u))
    return _out(u)


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require("users:manage"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found.")
    if u.id == admin.id:
        raise HTTPException(400, "You cannot delete your own account.")
    db.delete(u)
    db.commit()
    audit(db, admin, "delete", "user", str(user_id))
    return {"ok": True}


def _out(u):
    return {
        "id": u.id,
        "email": u.email,
        "name": u.name,
        "role": u.role,
        "designation": u.designation,
        "phone": u.phone,
        "station_id": u.station_id,
        "mission_id": u.mission_id,
        "language": u.language,
        "active": u.active,
    }