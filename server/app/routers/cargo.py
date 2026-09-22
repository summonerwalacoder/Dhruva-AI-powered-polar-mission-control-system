from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..audit import audit
from ..database import get_db
from ..models import Cargo, CargoMovement, Container, Shipment, User
from ..schemas import CargoCreate, CargoMovementCreate, CargoUpdate
from ..security import get_current_user, require
from ..services.packing import packing_plan

router = APIRouter(prefix="/cargo", tags=["cargo"])

STATUS_LIFECYCLE = [
    "requirement", "indent", "approval", "packing", "container_assigned",
    "manifest", "transport", "transit", "station_arrival", "inspection", "inventory",
]


@router.get("")
def list_cargo(
    db: Session = Depends(get_db),
    user: User = Depends(require("cargo:read")),
    mission_id: int = Query(None),
    status: str = Query(""),
    q: str = Query(""),
    category: str = Query(""),
):
    query = db.query(Cargo)
    if mission_id:
        query = query.filter(Cargo.mission_id == mission_id)
    if status:
        query = query.filter(Cargo.shipment_status == status)
    if category:
        query = query.filter(Cargo.category == category)
    rows = query.order_by(Cargo.created_at.desc()).all()
    if q:
        rows = [c for c in rows if q.lower() in c.item_name.lower() or q.lower() in (c.cargo_id or "").lower() or q.lower() in (c.qr_code or "").lower()]
    return [cargo_out(c, db) for c in rows]


@router.post("")
def create_cargo(body: CargoCreate, db: Session = Depends(get_db), user: User = Depends(require("cargo:write"))):
    if db.query(Cargo).filter(Cargo.cargo_id == body.cargo_id).first():
        raise HTTPException(400, "Cargo ID exists.")
    c = Cargo(**body.model_dump())
    if not c.qr_code:
        c.qr_code = _make_qr(c.cargo_id, c.mission_id)
    db.add(c)
    db.commit()
    db.refresh(c)
    db.add(CargoMovement(cargo_id=c.id, status=c.shipment_status, location="Created", note="Cargo record created."))
    db.commit()
    audit(db, user, "create", "cargo", c.cargo_id, new=body.model_dump())
    return cargo_out(c, db)


@router.get("/{cargo_id}")
def get_cargo(cargo_id: int, db: Session = Depends(get_db), user: User = Depends(require("cargo:read"))):
    c = db.get(Cargo, cargo_id)
    if not c:
        raise HTTPException(404, "Cargo not found.")
    return cargo_out(c, db, with_movements=True)


@router.patch("/{cargo_id}")
def update_cargo(cargo_id: int, body: CargoUpdate, db: Session = Depends(get_db), user: User = Depends(require("cargo:write"))):
    c = db.get(Cargo, cargo_id)
    if not c:
        raise HTTPException(404, "Cargo not found.")
    prev = cargo_out(c, db)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    audit(db, user, "update", "cargo", c.cargo_id, prev=prev, new=cargo_out(c, db))
    return cargo_out(c, db)


@router.post("/{cargo_id}/status")
def advance_cargo_status(cargo_id: int, body: CargoMovementCreate, db: Session = Depends(get_db), user: User = Depends(require("cargo:write"))):
    c = db.get(Cargo, cargo_id)
    if not c:
        raise HTTPException(404, "Cargo not found.")
    if body.status not in STATUS_LIFECYCLE:
        raise HTTPException(400, f"status must be one of {STATUS_LIFECYCLE}")
    prev = c.shipment_status
    c.shipment_status = body.status
    db.add(CargoMovement(cargo_id=c.id, status=body.status, location=body.location, note=body.note))
    db.commit()
    db.refresh(c)
    audit(db, user, "cargo_status", "cargo", c.cargo_id, prev={"shipment_status": prev}, new={"shipment_status": body.status})
    return cargo_out(c, db, with_movements=True)


@router.post("/{cargo_id}/movement")
def add_cargo_movement(cargo_id: int, body: CargoMovementCreate, db: Session = Depends(get_db), user: User = Depends(require("cargo:write"))):
    c = db.get(Cargo, cargo_id)
    if not c:
        raise HTTPException(404, "Cargo not found.")
    mv = CargoMovement(cargo_id=c.id, status=body.status or c.shipment_status, location=body.location, note=body.note)
    db.add(mv)
    db.commit()
    db.refresh(mv)
    return {"ok": True, "movement": {"id": mv.id, "status": mv.status, "location": mv.location, "timestamp": mv.timestamp.isoformat(), "note": mv.note}}


@router.get("/{cargo_id}/movements")
def list_cargo_movements(cargo_id: int, db: Session = Depends(get_db), user: User = Depends(require("cargo:read"))):
    c = db.get(Cargo, cargo_id)
    if not c:
        raise HTTPException(404, "Cargo not found.")
    rows = db.query(CargoMovement).filter(CargoMovement.cargo_id == c.id).order_by(CargoMovement.timestamp.desc()).all()
    return [{"id": r.id, "status": r.status, "location": r.location, "note": r.note,
             "timestamp": r.timestamp.isoformat() if r.timestamp else None} for r in rows]


@router.delete("/{cargo_id}")
def delete_cargo(cargo_id: int, db: Session = Depends(get_db), user: User = Depends(require("cargo:write"))):
    c = db.get(Cargo, cargo_id)
    if not c:
        raise HTTPException(404, "Cargo not found.")
    db.delete(c)
    db.commit()
    audit(db, user, "delete", "cargo", c.cargo_id)
    return {"ok": True}


@router.post("/pack-plan")
def get_packing_plan(db: Session = Depends(get_db), user: User = Depends(require("cargo:write")), mission_id: int = Query(None), container_id: str = Query("")):
    container = None
    if container_id:
        container = db.query(Container).filter(Container.container_id == container_id).first()
    return packing_plan(db, mission_id=mission_id, container=container)


def _make_qr(cargo_id, mission_id):
    import hashlib

    h = hashlib.sha1(f"{cargo_id}:{mission_id or ''}".encode()).hexdigest()[:12]
    return f"DHU-{cargo_id}-{h}".upper()


def cargo_out(c, db, with_movements=False):
    data = {col.name: getattr(c, col.name) for col in c.__table__.columns}
    if with_movements:
        data["history"] = [{"status": r.status, "location": r.location, "note": r.note,
                            "timestamp": r.timestamp.isoformat() if r.timestamp else None}
                           for r in db.query(CargoMovement).filter(CargoMovement.cargo_id == c.id).order_by(CargoMovement.timestamp.desc()).all()]
    delayed = bool(c.expected_arrival and c.expected_arrival < date.today().isoformat() and c.shipment_status not in ("inventory", "station_arrival", "inspection"))
    data["delayed"] = delayed
    return data
containers = APIRouter(prefix="/containers", tags=["containers"])


@containers.get("")
def list_containers(db: Session = Depends(get_db), user: User = Depends(require("cargo:read"))):
    rows = db.query(Container).all()
    return [container_out(c) for c in rows]


@containers.post("")
def create_container(body: dict, db: Session = Depends(get_db), user: User = Depends(require("cargo:write"))):
    from ..schemas import CargoCreate
    if not body.get("container_id"):
        raise HTTPException(400, "container_id required")
    if db.query(Container).filter(Container.container_id == body["container_id"]).first():
        raise HTTPException(400, "Container ID exists.")
    c = Container(
        container_id=body["container_id"],
        capacity_kg=float(body.get("capacity_kg", 0)),
        used_kg=float(body.get("used_kg", 0)),
        location=body.get("location", ""),
        status=body.get("status", "empty"),
        mission_id=body.get("mission_id"),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return container_out(c)


@containers.get("/{container_id}")
def get_container(container_id: int, db: Session = Depends(get_db), user: User = Depends(require("cargo:read"))):
    c = db.get(Container, container_id)
    if not c:
        raise HTTPException(404, "Container not found.")
    items = db.query(Cargo).filter(Cargo.container_id == c.container_id).all()
    return {**container_out(c), "items": [cargo_out(i, db) for i in items]}


@containers.patch("/{container_id}")
def update_container(container_id: int, body: dict, db: Session = Depends(get_db), user: User = Depends(require("cargo:write"))):
    c = db.get(Container, container_id)
    if not c:
        raise HTTPException(404, "Container not found.")
    for k in ("capacity_kg", "used_kg", "location", "status", "mission_id"):
        if k in body:
            setattr(c, k, body[k])
    db.commit()
    db.refresh(c)
    return container_out(c)


@containers.delete("/{container_id}")
def delete_container(container_id: int, db: Session = Depends(get_db), user: User = Depends(require("cargo:write"))):
    c = db.get(Container, container_id)
    if not c:
        raise HTTPException(404, "Container not found.")
    db.delete(c)
    db.commit()
    return {"ok": True}


def container_out(c):
    return {col.name: getattr(c, col.name) for col in c.__table__.columns}


shipments = APIRouter(prefix="/shipments", tags=["shipments"])


@shipments.get("")
def list_shipments(db: Session = Depends(get_db), user: User = Depends(require("cargo:read"))):
    rows = db.query(Shipment).order_by(Shipment.created_at.desc()).all()
    return [shipment_out(s, db) for s in rows]


@shipments.post("")
def create_shipment(body: dict, db: Session = Depends(get_db), user: User = Depends(require("cargo:write"))):
    if not body.get("shipment_id"):
        body["shipment_id"] = f"SHP-{len(db.query(Shipment).all()) + 1}"
    s = Shipment(
        shipment_id=body["shipment_id"],
        name=body.get("name", ""),
        origin=body.get("origin", ""),
        destination=body.get("destination", ""),
        status=body.get("status", "planned"),
        eta=body.get("eta", ""),
        carrier=body.get("carrier", ""),
        handler=body.get("handler", ""),
        mission_id=body.get("mission_id"),
        cargo_ids=body.get("cargo_ids", []),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return shipment_out(s, db)


@shipments.patch("/{shipment_id}")
def update_shipment(shipment_id: int, body: dict, db: Session = Depends(get_db), user: User = Depends(require("cargo:write"))):
    s = db.get(Shipment, shipment_id)
    if not s:
        raise HTTPException(404, "Shipment not found.")
    for k in ("name", "origin", "destination", "status", "eta", "carrier", "handler", "mission_id", "cargo_ids"):
        if k in body:
            setattr(s, k, body[k])
    db.commit()
    db.refresh(s)
    return shipment_out(s, db)


@shipments.delete("/{shipment_id}")
def delete_shipment(shipment_id: int, db: Session = Depends(get_db), user: User = Depends(require("cargo:write"))):
    s = db.get(Shipment, shipment_id)
    if not s:
        raise HTTPException(404, "Shipment not found.")
    db.delete(s)
    db.commit()
    return {"ok": True}


def shipment_out(s, db):
    data = {col.name: getattr(s, col.name) for col in s.__table__.columns}
    data["cargo_items"] = [
        {"id": c.id, "cargo_id": c.cargo_id, "item_name": c.item_name, "shipment_status": c.shipment_status}
        for c in db.query(Cargo).filter(Cargo.id.in_(s.cargo_ids or [])).all()
    ]
    return data
