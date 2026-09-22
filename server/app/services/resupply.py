"""Smart Resupply Planner.

Calculates a recommended resupply date using current stock, consumption rate,
mission duration, transport lead time, weather and cargo preparation time.
"""
from datetime import date, timedelta

from .prediction import _days_to_resupply, predict_depletion


def resupply_plan(db, mission, categories=("food", "water", "fuel", "medical", "emergency")):
    from ..models import InventoryItem

    lead_time_days = _transport_lead_time(mission)
    prep_days = _prep_days()
    today = date.today()

    items = db.query(InventoryItem).filter(InventoryItem.mission_id == mission.id).all()
    rows = []
    earliest_depletion = None
    earliest_item = None
    for it in items:
        if it.category not in categories:
            continue
        pred = predict_depletion(db, it, mission)
        days = pred.get("days_remaining")
        if days is None:
            continue
        depletion_date = date.fromisoformat(pred["depletion_date"]) if pred.get("depletion_date") else today + timedelta(days=days)
        rec = depletion_date - timedelta(days=lead_time_days + prep_days)
        rows.append({
            "item": it.item,
            "category": it.category,
            "days_remaining": days,
            "depletion_date": pred["depletion_date"],
            "recommended_date": rec.isoformat(),
            "priority": "CRITICAL" if pred["status"] == "shortage" else
                       "HIGH" if pred["status"] == "critical" else "MEDIUM",
            "required_qty_hint": round(it.quantity * 0.1, 1),
        })
        if earliest_depletion is None or days < earliest_depletion:
            earliest_depletion = days
            earliest_item = it.item

    if earliest_depletion is None:
        return {"recommended_date": None, "reason": "No inventory tracked.", "rows": []}

    recommended = today + timedelta(days=max(1, earliest_depletion - (lead_time_days + prep_days)))
    reasons = [
        f"Lead item '{earliest_item}' depletes in ~{earliest_depletion} days.",
        f"Transport lead time {lead_time_days}d + cargo preparation {prep_days}d.",
        f"Recommended dispatch date {recommended.isoformat()} so stock arrives before {earliest_depletion}-day mark.",
    ]
    weather_note = _weather_note(db, mission)
    if weather_note:
        reasons.append(weather_note)
    return {
        "recommended_date": recommended.isoformat(),
        "recommended_days_out": (recommended - today).days,
        "lead_time_days": lead_time_days,
        "prep_days": prep_days,
        "reason": " ".join(reasons),
        "reasons": reasons,
        "rows": rows,
    }


def _transport_lead_time(mission):
    try:
        route = mission.route or []
        legs = [l for l in route if isinstance(l, dict) and l.get("lead_days")]
        if legs:
            return int(sum(l["lead_days"] for l in legs))
    except Exception:
        pass
    return 7


def _prep_days():
    return 4


def _weather_note(db, mission):
    from ..models import WeatherRecord

    rec = (
        db.query(WeatherRecord)
        .filter(WeatherRecord.station_id == mission.station_id)
        .order_by(WeatherRecord.recorded_at.desc())
        .first()
    )
    if rec and (rec.storm or rec.ice_route_condition == "closed"):
        return "Note: current weather may extend transport lead time - add buffer to the estimate."
    return ""