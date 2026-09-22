from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..audit import audit
from ..database import get_db
from ..models import Personnel, PersonnelMovement, Task, User
from ..schemas import MovementCreate, PersonnelCreate, PersonnelUpdate, TaskCreate, TaskUpdate
from ..security import get_current_user, has_permission, mask_personnel, require

router = APIRouter(prefix="/personnel", tags=["personnel"])

MOVEMENT_LIFECYCLE = ["departure", "transit", "station", "field_camp", "return"]


@router.get("")
def list_personnel(
    db: Session = Depends(get_db),
    user: User = Depends(require("personnel:read")),
    role: str = Query(""),
    status: str = Query(""),
    movement_status: str = Query(""),
    mission_id: int = Query(None),
    q: str = Query(""),
):
    if user.role in ("scientist", "medical", "field"):
        from ..security import accessible_mission_ids

        ids = accessible_mission_ids(db, user)
        query = db.query(Personnel).filter(Personnel.mission_id == None if not ids else Personnel.mission_id.in_(ids))
    else:
        query = db.query(Personnel)
    if role:
        query = query.filter(Personnel.role == role)
    if status:
        query = query.filter(Personnel.status == status)
    if movement_status:
        query = query.filter(Personnel.movement_status == movement_status)
    if mission_id:
        query = query.filter(Personnel.mission_id == mission_id)
    rows = query.order_by(Personnel.name).all()
    if q:
        rows = [p for p in rows if q.lower() in p.name.lower() or q.lower() in (p.personnel_id or "").lower()]
    return [mask_personnel(db, user, p) for p in rows]


@router.post("")
def create_personnel(body: PersonnelCreate, db: Session = Depends(get_db), user: User = Depends(require("personnel:write"))):
    if db.query(Personnel).filter(Personnel.personnel_id == body.personnel_id).first():
        raise HTTPException(400, "Personnel ID exists.")
    if not has_permission(db, user.role, "medical:write") and body.medical_notes:
        body.medical_notes = ""
    p = Personnel(**body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    audit(db, user, "create", "personnel", p.personnel_id, new=body.model_dump())
    return mask_personnel(db, user, p)


@router.get("/{personnel_id}")
def get_personnel(personnel_id: int, db: Session = Depends(get_db), user: User = Depends(require("personnel:read"))):
    p = db.get(Personnel, personnel_id)
    if not p:
        raise HTTPException(404, "Personnel not found.")
    return {**mask_personnel(db, user, p), "movements": [m_out(m) for m in db.query(PersonnelMovement).filter(PersonnelMovement.personnel_id == p.id).order_by(
        PersonnelMovement.timestamp.desc()).all()]}


@router.patch("/{personnel_id}")
def update_personnel(personnel_id: int, body: PersonnelUpdate, db: Session = Depends(get_db), user: User = Depends(require("personnel:write"))):
    p = db.get(Personnel, personnel_id)
    if not p:
        raise HTTPException(404, "Personnel not found.")
    prev = mask_personnel(db, user, p)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    audit(db, user, "update", "personnel", p.personnel_id, prev=prev, new=mask_personnel(db, user, p))
    return mask_personnel(db, user, p)


@router.delete("/{personnel_id}")
def delete_personnel(personnel_id: int, db: Session = Depends(get_db), user: User = Depends(require("personnel:write"))):
    p = db.get(Personnel, personnel_id)
    if not p:
        raise HTTPException(404, "Personnel not found.")
    db.delete(p)
    db.commit()
    audit(db, user, "delete", "personnel", p.personnel_id)
    return {"ok": True}


@router.post("/{personnel_id}/movement")
def add_movement(personnel_id: int, body: MovementCreate, db: Session = Depends(get_db), user: User = Depends(require("personnel:write"))):
    p = db.get(Personnel, personnel_id)
    if not p:
        raise HTTPException(404, "Personnel not found.")
    if body.to_status not in MOVEMENT_LIFECYCLE:
        raise HTTPException(400, f"to_status must be one of {MOVEMENT_LIFECYCLE}")
    prev = p.movement_status
    mv = PersonnelMovement(
        personnel_id=p.id,
        from_status=prev,
        to_status=body.to_status,
        location=body.location or p.current_location,
        latitude=body.latitude,
        longitude=body.longitude,
        note=body.note,
    )
    p.movement_status = body.to_status
    p.current_location = body.location or p.current_location
    if body.latitude is not None:
        p.last_known_lat = body.latitude
    if body.longitude is not None:
        p.last_known_lng = body.longitude
    db.add(mv)
    db.commit()
    db.refresh(mv)
    audit(db, user, "movement", "personnel", p.personnel_id, prev={"movement_status": prev}, new={"movement_status": body.to_status})
    return m_out(mv)


@router.get("/{personnel_id}/movements")
def list_movements(personnel_id: int, db: Session = Depends(get_db), user: User = Depends(require("personnel:read"))):
    p = db.get(Personnel, personnel_id)
    if not p:
        raise HTTPException(404, "Personnel not found.")
    return [m_out(m) for m in db.query(PersonnelMovement).filter(PersonnelMovement.personnel_id == p.id).order_by(PersonnelMovement.timestamp.desc()).all()]


def m_out(m):
    return {
        "id": m.id,
        "personnel_id": m.personnel_id,
        "from_status": m.from_status,
        "to_status": m.to_status,
        "location": m.location,
        "latitude": m.latitude,
        "longitude": m.longitude,
        "timestamp": m.timestamp.isoformat() if m.timestamp else None,
        "note": m.note,
    }


# Tasks ---------------------------------------------------------------------
tasks = APIRouter(prefix="/tasks", tags=["tasks"])


@tasks.get("")
def list_tasks(db: Session = Depends(get_db), user: User = Depends(get_current_user), mission_id: int = Query(None), personnel_id: int = Query(None)):
    q = db.query(Task)
    if user.role in ("field",):
        q = q.filter(or_(Task.personnel_id.is_(None), Task.personnel_id == user.id))
    if mission_id:
        q = q.filter(Task.mission_id == mission_id)
    if personnel_id:
        q = q.filter(Task.personnel_id == personnel_id)
    rows = q.order_by(Task.created_at.desc()).all()
    return [task_out(t) for t in rows]


@tasks.post("")
def create_task(body: TaskCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = Task(**body.model_dump(), assigned_by=user.id)
    db.add(t)
    db.commit()
    db.refresh(t)
    audit(db, user, "create", "task", str(t.id))
    return task_out(t)


@tasks.patch("/{task_id}")
def update_task(task_id: int, body: TaskUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.get(Task, task_id)
    if not t:
        raise HTTPException(404, "Task not found.")
    prev = task_out(t)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    audit(db, user, "update", "task", str(t.id), prev=prev, new=task_out(t))
    return task_out(t)


@tasks.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.get(Task, task_id)
    if not t:
        raise HTTPException(404, "Task not found.")
    db.delete(t)
    db.commit()
    return {"ok": True}


def task_out(t):
    return {
        "id": t.id,
        "mission_id": t.mission_id,
        "personnel_id": t.personnel_id,
        "title": t.title,
        "description": t.description,
        "status": t.status,
        "priority": t.priority,
        "due_date": t.due_date,
        "assigned_by": t.assigned_by,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }