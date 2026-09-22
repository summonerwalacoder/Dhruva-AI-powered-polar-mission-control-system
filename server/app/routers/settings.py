from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..audit import audit
from ..database import get_db
from ..models import SystemConfig, User, UserSetting
from ..schemas import ConfigUpdate, SettingsUpdate
from ..security import get_current_user, require

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
def my_settings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.query(UserSetting).filter(UserSetting.user_id == user.id).first()
    if not s:
        s = UserSetting(user_id=user.id)
        db.add(s)
        db.commit()
        db.refresh(s)
    return {
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role,
                 "designation": user.designation, "phone": user.phone, "language": user.language},
        "settings": {col.name: getattr(s, col.name) for col in s.__table__.columns if col.name != "id"},
    }


@router.patch("")
def update_settings(body: SettingsUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.query(UserSetting).filter(UserSetting.user_id == user.id).first()
    if not s:
        s = UserSetting(user_id=user.id)
        db.add(s)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    if body.language:
        user.language = body.language
    db.commit()
    return {"ok": True}


config_router = APIRouter(prefix="/config", tags=["config"])


@config_router.get("")
def list_config(db: Session = Depends(get_db), user: User = Depends(require("users:manage"))):
    rows = db.query(SystemConfig).all()
    return [{"key": r.key, "value": r.value} for r in rows]


@config_router.put("/{key}")
def set_config(key: str, body: ConfigUpdate, db: Session = Depends(get_db), user: User = Depends(require("users:manage"))):
    row = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    if not row:
        row = SystemConfig(key=key, value=body.value)
        db.add(row)
    else:
        row.value = body.value
    from datetime import datetime, timezone
    audit(db, user, "config_update", "config", key, new=body.value)
    db.commit()
    return {"key": key, "value": body.value}