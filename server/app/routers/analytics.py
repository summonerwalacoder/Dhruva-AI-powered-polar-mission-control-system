from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Alert,
    Asset,
    AIPrediction,
    Cargo,
    Emergency,
    InventoryItem,
    InventoryTransaction,
    MaintenanceRecord,
    Personnel,
    PersonnelMovement,
    Simulation,
    User,
)
from ..security import get_current_user, require
from ..services.assets import maintenance_risk

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
def analytics_summary(db: Session = Depends(get_db), user: User = Depends(require("analytics:use")), mission_id: int = None):
    m_filter = [Cargo.mission_id == mission_id] if mission_id else []

    cargo_rows = db.query(Cargo).filter(*m_filter).all()
    cargo_delivered = {c.shipment_status for c in cargo_rows}
    cargo_delayed = [c for c in cargo_rows if c.expected_arrival and c.expected_arrival < date.today().isoformat()]

    assets = db.query(Asset).filter(Asset.mission_id == mission_id).all() if mission_id else db.query(Asset).all()
    asset_risk = [maintenance_risk(a) for a in assets]
    asset_status = Counter(r["status"] for r in asset_risk)

    personnel = db.query(Personnel).filter(Personnel.mission_id == mission_id).all() if mission_id else db.query(Personnel).all()
    movement_by_status = Counter(p.movement_status for p in personnel)

    txns = db.query(InventoryTransaction).filter(InventoryTransaction.timestamp >= (datetime.utcnow() - timedelta(days=30))).all()
    cat_use = defaultdict(float)
    for t in txns:
        it = db.get(InventoryItem, t.inventory_id)
        if it and (mission_id is None or it.mission_id == mission_id) and t.change < 0:
            cat_use[it.category] += abs(t.change)

    emergencies = db.query(Emergency).all()
    if mission_id:
        emergencies = [e for e in emergencies if e.mission_id == mission_id]
    response_times = []
    for e in emergencies:
        if e.reported_at and e.resolved_at:
            delta = (e.resolved_at - e.reported_at).total_seconds() / 3600
            response_times.append(round(delta, 1))

    sims = db.query(Simulation).all()
    if mission_id:
        sims = [s for s in sims if s.mission_id == mission_id]

    alerts = db.query(Alert).all()
    if mission_id:
        alerts = [a for a in alerts if a.mission_id == mission_id]
    alert_sev = Counter(a.severity for a in alerts)
    alert_by_day = _series([a.created_at.date().isoformat() for a in alerts])

    return {
        "cargo": {
            "total": len(cargo_rows),
            "in_transit": len([c for c in cargo_rows if c.shipment_status in ("transport", "transit", "manifest")]),
            "delivered": len([c for c in cargo_rows if c.shipment_status == "inventory"]),
            "delayed": len(cargo_delayed),
            "delay_rate": round(len(cargo_delayed) / max(len(cargo_rows), 1) * 100, 1),
        },
        "inventory": {
            "consumption_30d": {k: round(v, 1) for k, v in sorted(cat_use.items())},
            "by_category": {cat: db.query(InventoryItem).filter(InventoryItem.category == cat).filter(
                InventoryItem.mission_id == mission_id if mission_id else InventoryItem.id > 0).count()
                for cat in ["food", "water", "fuel", "medical", "spares", "scientific", "emergency", "consumable"]},
        },
        "assets": {
            "total": len(assets),
            "healthy": asset_status.get("healthy", 0),
            "due": asset_status.get("due", 0),
            "high": asset_status.get("high", 0),
            "critical": asset_status.get("critical", 0),
            "uptime": round(sum(1 for a in assets if a.operational_status == "operational") / max(len(assets), 1) * 100, 1),
        },
        "personnel": {
            "total": len(personnel),
            "by_movement": dict(movement_by_status),
            "by_role": dict(Counter(p.role for p in personnel)),
        },
        "emergency": {
            "total": len(emergencies),
            "open": len([e for e in emergencies if e.status != "resolved"]),
            "by_severity": dict(Counter(e.severity for e in emergencies)),
            "avg_response_hours": round(sum(response_times) / max(len(response_times), 1), 1) if response_times else None,
        },
        "alerts": {
            "total": len(alerts),
            "by_severity": dict(alert_sev),
            "last_7d": {k: v for k, v in alert_by_day.items() if k and v},
        },
        "simulations": {
            "total": len(sims),
            "risk_after": dict(Counter(s.risk_after for s in sims)),
        },
    }


def _series(items):
    counts = Counter(items)
    out = {}
    today = date.today()
    for i in range(6, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        out[d] = counts.get(d, 0)
    return out