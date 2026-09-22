import json

from sqlalchemy.orm import Session

from .models import AuditLog


def _clean(value):
    if value is None:
        return None
    if hasattr(value, "__table__"):  # ORM object
        return {c.name: getattr(value, c.name) for c in value.__table__.columns}
    return value


def audit(
    db: Session,
    user,
    action: str,
    entity: str,
    entity_id: str = "",
    prev=None,
    new=None,
    commit: bool = True,
):
    if user is None:
        user_email, user_id = "", None
    else:
        user_email, user_id = getattr(user, "email", ""), getattr(user, "id", None)
    log = AuditLog(
        user_id=user_id,
        user_email=user_email,
        action=action,
        entity=entity,
        entity_id=str(entity_id or ""),
        prev=_clean(prev),
        new=_clean(new),
    )
    db.add(log)
    if commit:
        try:
            db.commit()
        except Exception:
            db.rollback()
    return log


def serialize_json(obj):
    return json.dumps(obj, default=str, ensure_ascii=False)