from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..audit import audit
from ..database import get_db
from ..models import Notification, Role, User
from ..schemas import LoginRequest, RoleCreate, UserCreate, UserUpdate
from ..security import (
    create_access_token,
    get_current_user,
    hash_password,
    require,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower().strip()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password.")
    if not user.active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is deactivated.")
    token = create_access_token(user)
    audit(db, user, "login", "user", str(user.id))
    return {"token": token, "user": _user_out(user, db)}


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _user_out(user, db)


@router.get("/roles", dependencies=[Depends(require("users:read"))])
def list_roles(db: Session = Depends(get_db)):
    roles = db.query(Role).all()
    return [{"id": r.id, "code": r.code, "name": r.name, "description": r.description, "permissions": r.permissions} for r in roles]


@router.post("/roles", dependencies=[Depends(require("users:manage"))])
def create_role(body: RoleCreate, db: Session = Depends(get_db)):
    if db.query(Role).filter(Role.code == body.code).first():
        raise HTTPException(400, "Role code already exists.")
    role = Role(code=body.code, name=body.name, description=body.description, permissions=body.permissions)
    db.add(role)
    db.commit()
    db.refresh(role)
    return {"id": role.id, "code": role.code, "permissions": role.permissions}


def _user_out(user, db):
    from ..models import Station

    st = db.get(Station, user.station_id) if user.station_id else None
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "designation": user.designation,
        "phone": user.phone,
        "language": user.language,
        "station_id": user.station_id,
        "station_name": st.name if st else None,
        "mission_id": user.mission_id,
        "active": user.active,
    }