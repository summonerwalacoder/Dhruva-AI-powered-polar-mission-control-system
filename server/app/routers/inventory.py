from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..audit import audit
from ..database import get_db
from ..models import InventoryItem, InventoryTransaction, Mission, User
from ..schemas import InventoryCreate, InventoryTxCreate, InventoryUpdate
from ..security import get_current_user, require
from ..services.prediction import predict_depletion, survival_clock

router = APIRouter(prefix="/inventory", tags=["inventory"])

CATEGORY_OPTIONS = ["food", "water", "fuel", "medical", "spares", "scientific", "emergency", "consumable"]


@router.get("")
def list_inventory(
    db: Session = Depends(get_db),
    user: User = Depends(require("inventory:read")),
    mission_id: int = Query(None),
    category: str = Query(""),
    q: str = Query(""),
):
    query = db.query(InventoryItem)
    if mission_id:
        query = query.filter(InventoryItem.mission_id == mission_id)
    if category:
        query = query.filter(InventoryItem.category == category)
    rows = query.order_by(InventoryItem.item).all()
    if q:
        rows = [i for i in rows if q.lower() in i.item.lower() or q.lower() in (i.batch or "").lower()]
    return [_out(i) for i in rows]


@router.post("")
def create_inventory(body: InventoryCreate, db: Session = Depends(get_db), user: User = Depends(require("inventory:write"))):
    it = InventoryItem(**body.model_dump())
    db.add(it)
    db.commit()
    db.refresh(it)
    audit(db, user, "create", "inventory", str(it.id), new=body.model_dump())
    return _out(it)


@router.get("/{item_id}")
def get_inventory(item_id: int, db: Session = Depends(get_db), user: User = Depends(require("inventory:read"))):
    it = db.get(InventoryItem, item_id)
    if not it:
        raise HTTPException(404, "Inventory item not found.")
    txns = (
        db.query(InventoryTransaction)
        .filter(InventoryTransaction.inventory_id == item_id)
        .order_by(InventoryTransaction.timestamp.desc())
        .limit(20)
        .all()
    )
    mission = db.get(Mission, it.mission_id) if it.mission_id else None
    pred = predict_depletion(db, it, mission)
    return {**_out(it), "transactions": [_tx_out(t) for t in txns], "prediction": pred}


@router.patch("/{item_id}")
def update_inventory(item_id: int, body: InventoryUpdate, db: Session = Depends(get_db), user: User = Depends(require("inventory:write"))):
    it = db.get(InventoryItem, item_id)
    if not it:
        raise HTTPException(404, "Inventory item not found.")
    prev = _out(it)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(it, k, v)
    db.commit()
    db.refresh(it)
    audit(db, user, "update", "inventory", str(it.id), prev=prev, new=_out(it))
    return _out(it)


@router.post("/{item_id}/transaction")
def add_transaction(item_id: int, body: InventoryTxCreate, db: Session = Depends(get_db), user: User = Depends(require("inventory:write"))):
    it = db.get(InventoryItem, item_id)
    if not it:
        raise HTTPException(404, "Inventory item not found.")
    tx = InventoryTransaction(
        inventory_id=it.id,
        change=body.change,
        unit=body.unit or it.unit,
        type=body.type,
        note=body.note,
        user_id=user.id,
    )
    it.quantity = max(0, (it.quantity or 0) + body.change)
    db.add(tx)
    db.commit()
    db.refresh(tx)
    audit(db, user, "inventory_transaction", "inventory", str(it.id), prev={"quantity": it.quantity - body.change}, new={"quantity": it.quantity})
    _check_alerts(db, it)
    return {"ok": True, "item": _out(it), "tx": _tx_out(tx)}


@router.get("/{item_id}/transactions")
def list_transactions(item_id: int, db: Session = Depends(get_db), user: User = Depends(require("inventory:read"))):
    rows = (
        db.query(InventoryTransaction)
        .filter(InventoryTransaction.inventory_id == item_id)
        .order_by(InventoryTransaction.timestamp.desc())
        .all()
    )
    return [_tx_out(t) for t in rows]


@router.delete("/{item_id}")
def delete_inventory(item_id: int, db: Session = Depends(get_db), user: User = Depends(require("inventory:write"))):
    it = db.get(InventoryItem, item_id)
    if not it:
        raise HTTPException(404, "Inventory item not found.")
    db.delete(it)
    db.commit()
    audit(db, user, "delete", "inventory", str(item_id))
    return {"ok": True}


@router.get("/predictions/all")
def predictions_all(mission_id: int = Query(...), db: Session = Depends(get_db), user: User = Depends(require("inventory:read"))):
    mission = db.get(Mission, mission_id)
    if not mission:
        raise HTTPException(404, "Mission not found.")
    items = db.query(InventoryItem).filter(InventoryItem.mission_id == mission_id).all()
    return [predict_depletion(db, it, mission) for it in items]


@router.get("/survival-clock/all")
def survival_clock_all(mission_id: int = Query(...), db: Session = Depends(get_db), user: User = Depends(require("inventory:read"))):
    return survival_clock(db, mission_id)


def _check_alerts(db, it):
    from ..models import Alert

    if it.quantity <= (it.reorder_level or 0) * 0.5:
        db.add(Alert(
            mission_id=it.mission_id,
            type=f"low_stock_{it.category}",
            severity="critical",
            title=f"{it.category.title()} critically low: {it.item}",
            message=f"{it.item} dropped to {it.quantity} {it.unit} - below reorder threshold.",
            entity_type="inventory",
            entity_id=str(it.id),
            source="system",
        ))
        db.commit()


def _out(it):
    d = {col.name: getattr(it, col.name) for col in it.__table__.columns}
    d["min_stock"] = it.reorder_level
    d["is_low"] = it.reorder_level is not None and it.quantity <= it.reorder_level
    return d


def _tx_out(t):
    return {
        "id": t.id,
        "inventory_id": t.inventory_id,
        "change": t.change,
        "unit": t.unit,
        "type": t.type,
        "note": t.note,
        "user_id": t.user_id,
        "timestamp": t.timestamp.isoformat() if t.timestamp else None,
    }