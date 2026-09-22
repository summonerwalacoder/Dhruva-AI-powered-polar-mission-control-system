from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..audit import audit
from ..database import get_db
from ..models import Asset, MaintenanceRecord, User
from ..schemas import AssetCreate, AssetUpdate, MaintenanceCreate
from ..security import get_current_user, require
from ..services.assets import asset_status_ranges, maintenance_risk

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("")
def list_assets(
    db: Session = Depends(get_db),
    user: User = Depends(require("assets:read")),
    mission_id: int = Query(None),
    category: str = Query(""),
    q: str = Query(""),
):
    query = db.query(Asset)
    if mission_id:
        query = query.filter(Asset.mission_id == mission_id)
    if category:
        query = query.filter(Asset.category == category)
    rows = query.order_by(Asset.name).all()
    if q:
        rows = [a for a in rows if q.lower() in a.name.lower() or q.lower() in (a.asset_id or "").lower()]
    return [_out(a) for a in rows]


@router.get("/predictive")
def predictive_overview(mission_id: int = Query(None), db: Session = Depends(get_db), user: User = Depends(require("assets:read"))):
    query = db.query(Asset)
    if mission_id:
        query = query.filter(Asset.mission_id == mission_id)
    rows = query.all()
    risks = [maintenance_risk(a) for a in rows]
    out = {"assets": risks, "ranges": asset_status_ranges()}
    out["counts"] = {s: sum(1 for r in risks if r["status"] == s) for s in asset_status_ranges()}
    return out


@router.post("")
def create_asset(body: AssetCreate, db: Session = Depends(get_db), user: User = Depends(require("assets:write"))):
    if db.query(Asset).filter(Asset.asset_id == body.asset_id).first():
        raise HTTPException(400, "Asset ID exists.")
    a = Asset(**body.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    audit(db, user, "create", "asset", a.asset_id, new=body.model_dump())
    return _out(a)


@router.get("/{asset_id_int}")
def get_asset(asset_id_int: int, db: Session = Depends(get_db), user: User = Depends(require("assets:read"))):
    a = db.get(Asset, asset_id_int)
    if not a:
        raise HTTPException(404, "Asset not found.")
    risk = maintenance_risk(a)
    maints = db.query(MaintenanceRecord).filter(MaintenanceRecord.asset_id == a.id).order_by(MaintenanceRecord.date.desc()).all()
    return {**_out(a), "risk": risk, "maintenance": [maint_out(m) for m in maints]}


@router.patch("/{asset_id_int}")
def update_asset(asset_id_int: int, body: AssetUpdate, db: Session = Depends(get_db), user: User = Depends(require("assets:write"))):
    a = db.get(Asset, asset_id_int)
    if not a:
        raise HTTPException(404, "Asset not found.")
    prev = _out(a)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    audit(db, user, "update", "asset", a.asset_id, prev=prev, new=_out(a))
    return _out(a)


@router.delete("/{asset_id_int}")
def delete_asset(asset_id_int: int, db: Session = Depends(get_db), user: User = Depends(require("assets:write"))):
    a = db.get(Asset, asset_id_int)
    if not a:
        raise HTTPException(404, "Asset not found.")
    db.delete(a)
    db.commit()
    audit(db, user, "delete", "asset", a.asset_id)
    return {"ok": True}


@router.post("/{asset_id_int}/maintenance")
def add_maintenance(asset_id_int: int, body: MaintenanceCreate, db: Session = Depends(get_db), user: User = Depends(require("assets:write"))):
    a = db.get(Asset, asset_id_int)
    if not a:
        raise HTTPException(404, "Asset not found.")
    rec = MaintenanceRecord(
        asset_id=a.id, date=body.date or date.today().isoformat(),
        type=body.type, note=body.note, performed_by=body.performed_by,
        next_due=body.next_due,
    )
    a.last_maintenance = body.date or date.today().isoformat()
    if body.next_due:
        a.next_maintenance = body.next_due
    a.runtime_hours = 0
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return {"ok": True, "maintenance": maint_out(rec)}


def _out(a):
    d = {col.name: getattr(a, col.name) for col in a.__table__.columns}
    d["risk"] = maintenance_risk(a)
    return d


def maint_out(m):
    return {col.name: getattr(m, col.name) for col in m.__table__.columns}