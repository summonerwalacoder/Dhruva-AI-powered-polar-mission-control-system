"""Resource Optimization / prioritization engine.

Scores inventory items by mission importance, personnel needs, emergency
status, current stock, resupply ETA, weather, distance and criticality to
recommend where limited resources should be allocated.
"""
from datetime import date

from .prediction import predict_depletion, _days_to_resupply

CATEGORY_WEIGHT = {
    "emergency": 10, "medical": 9, "water": 8, "fuel": 7, "food": 7,
    "food": 7, "scientific": 3, "spares": 4, "consumable": 2,
}


def optimize_allocation(db, mission):
    from ..models import InventoryItem

    items = db.query(InventoryItem).filter(InventoryItem.mission_id == mission.id).all()
    today = date.today()
    dtr = _days_to_resupply(mission)

    out = []
    for it in items:
        pred = predict_depletion(db, it, mission)
        days = pred["days_remaining"]
        base = CATEGORY_WEIGHT.get(it.category, 3)
        score = float(base)
        reasons = []
        if days is not None and dtr:
            if days < dtr:
                score += 3
                reasons.append(f"Depletes before resupply (in {days}d).")
            elif days < dtr + 5:
                score += 1
                reasons.append("Close to resupply arrival.")
        criticality_bump = {"critical": 3, "high": 2, "normal": 1, "low": 0}.get(it.criticality or "normal", 1)
        score += criticality_bump
        reasons.append(f"Criticality {it.criticality} (+{criticality_bump}).")
        if it.quantity <= (it.reorder_level or 0):
            score += 2
            reasons.append("At/below reorder level.")
        out.append({
            "item_id": it.id,
            "item": it.item,
            "category": it.category,
            "quantity": it.quantity,
            "unit": it.unit,
            "days_remaining": days,
            "priority_score": round(score, 1),
            "allocation_recommendation": _recommendation(score, days, reasons),
            "reasons": reasons,
        })

    out.sort(key=lambda r: -r["priority_score"])
    return {
        "mission": mission.name,
        "as_of": today.isoformat(),
        "next_resupply_days": dtr,
        "items": out,
    }


def _recommendation(score, days, reasons):
    if score >= 14:
        return "ALLOCATE IMMEDIATELY - highest priority"
    if score >= 10 or (days is not None and days < 7):
        return "PRIORITIZE - secure at next resupply"
    if score >= 7:
        return "MONITOR - normal allocation"
    return "DEFER - sufficient stock"


def allocation_summary(db, mission):
    data = optimize_allocation(db, mission)
    items = data["items"]
    return {
        "urgent": [i for i in items if i["allocation_recommendation"].startswith("ALLOCATE") or i["allocation_recommendation"].startswith("PRIORITIZE")],
        "monitor": [i for i in items if i["allocation_recommendation"].startswith("MONITOR")],
        "defer": [i for i in items if i["allocation_recommendation"].startswith("DEFER")],
        "as_of": data["as_of"],
    }