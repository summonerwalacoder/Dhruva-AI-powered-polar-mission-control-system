from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import Role, User

bearer_scheme = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    if not password or not hashed:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expires_minutes),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret_resolved, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret_resolved, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired. Please login again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid authentication token.")


# --------------------------------------------------------------------------
# Permission matrix (RBAC)
# --------------------------------------------------------------------------
ROLE_NAMES = {
    "admin": "System Administrator",
    "commander": "Expedition Commander",
    "hq": "HQ / Government Official",
    "logistics": "Logistics Officer",
    "scientist": "Scientist / Researcher",
    "medical": "Medical Officer",
    "field": "Field Operator",
}

PERMISSIONS = {
    "admin": ["*"],
    "commander": [
        "mission:read", "mission:write", "mission:delete",
        "personnel:read", "personnel:write", "medical:read",
        "cargo:read", "cargo:write",
        "inventory:read", "inventory:write",
        "assets:read", "assets:write",
        "weather:read", "weather:write",
        "alerts:read", "alerts:write", "alerts:admin",
        "emergency:report", "emergency:respond", "emergency:notify", "emergency:read",
        "simulate:use", "ai:use", "reports:use",
        "maps:read", "audit:read", "users:read", "analytics:use", "notify:send",
    ],
    "hq": [
        "mission:read", "personnel:read", "cargo:read", "inventory:read",
        "assets:read", "weather:read", "alerts:read", "alerts:write",
        "emergency:read", "emergency:respond",
        "simulate:use", "ai:use", "reports:use", "maps:read", "analytics:use",
        "medical:read", "notify:send",
    ],
    "logistics": [
        "mission:read", "personnel:read", "cargo:read", "cargo:write",
        "inventory:read", "inventory:write", "assets:read",
        "weather:read", "alerts:read", "alerts:write",
        "simulate:use", "ai:use", "reports:use", "maps:read",
        "emergency:report", "analytics:use", "notify:send",
    ],
    "scientist": [
        "mission:read", "personnel:read", "cargo:read", "inventory:read",
        "assets:read", "weather:read", "alerts:read", "maps:read",
        "simulate:use", "ai:use", "reports:use",
        "emergency:report",
    ],
    "medical": [
        "mission:read", "personnel:read", "personnel:write", "medical:read", "medical:write",
        "inventory:read", "weather:read", "alerts:read", "alerts:write",
        "emergency:report", "emergency:read", "ai:use", "maps:read",
        "assets:read", "cargo:read",
    ],
    "field": [
        "mission:read", "personnel:read", "cargo:read", "inventory:read",
        "assets:read", "assets:write", "weather:read", "alerts:read",
        "emergency:report", "ai:use", "maps:read", "tasks:use", "notify:send",
    ],
}

HIERARCHY = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def get_role_permissions(db: Session, role: str) -> list:
    if role == "admin":
        return ["*"]
    row = db.query(Role).filter(Role.code == role).first()
    if row:
        return row.permissions or []
    return PERMISSIONS.get(role, [])


def has_permission(db: Session, role: str, permission: str) -> bool:
    perms = get_role_permissions(db, role)
    if "*" in perms:
        return True
    if permission in perms:
        return True
    # prefix match, e.g. asking "cargo:write" requires "cargo:write"
    return False


def has_resource(db: Session, role: str, resource: str) -> bool:
    for p in get_role_permissions(db, role):
        if p == "*" or p.startswith(resource + ":"):
            return True
    return False


def require(permission: str):
    def checker(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        if not has_permission(db, user.role, permission):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission for this action.")
        return user

    return checker


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required.")
    payload = decode_token(credentials.credentials)
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or not user.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is inactive or missing.")
    return user


def accessible_mission_ids(db: Session, user: User) -> list:
    """Which missions a role may access."""
    from .models import Mission

    if user.role in ("admin", "commander", "hq", "logistics"):
        return [m.id for m in db.query(Mission).all()]
    if user.role in ("scientist", "medical", "field"):
        if user.mission_id:
            return [user.mission_id]
        return []
    return []


def accessible_personnel_query(db: Session, user: User):
    from .models import Personnel

    if user.role in ("scientist", "medical", "field"):
        ids = accessible_mission_ids(db, user)
        return db.query(Personnel).filter(Personnel.mission_id == None if not ids else Personnel.mission_id.in_(ids))
    return db.query(Personnel)


def can_view_medical(db: Session, user: User) -> bool:
    return has_permission(db, user.role, "medical:read")


def mask_personnel(db: Session, user: User, p) -> dict:
    """Returns a personnel dict, medical_notes only for authorized roles."""
    data = {}
    for c in p.__table__.columns:
        data[c.name] = getattr(p, c.name)
    if not can_view_medical(db, user):
        data["medical_notes"] = ""
    return data