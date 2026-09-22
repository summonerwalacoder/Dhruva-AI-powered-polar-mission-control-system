"""AI Mission Risk Engine.

Combines weather, fuel/food/medical levels, asset condition, cargo delays,
resupply ETA, personnel status, communication availability and route conditions
into a mission-level risk score with full explainability.

Risk levels: LOW / MODERATE / HIGH / CRITICAL
"""
from datetime import date

from .prediction import predict_depletion, survival_clock

LEVELS = ("LOW", "MODERATE", "HIGH", "CRITICAL")


def _grade(score):
    if score <= 1.4:
        return "LOW"
    if score <= 2.3:
        return "MODERATE"
    if score <= 3.2:
        return "HIGH"
    return "CRITICAL"


def _resupply_status(db, mission):
    today = date.today()
    try:
        start = date.fromisoformat(mission.start_date) if mission.start_date else today
        resups = mission.planned_resupplies or []
        future = [r for r in resups if isinstance(r, dict) and (r.get("date") or "") >= today.isoformat()]
        future.sort(key=lambda r: r.get("date", ""))
        if not future:
            return None, "No upcoming resupply scheduled."
        next_r = future[0]
        eta = date.fromisoformat(next_r["date"])
        days = (eta - today).days
        if days < 0:
            return 3, "Scheduled resupply date has passed - treat as delayed."
        if days <= 5:
            return 1, f"Next resupply due in {days} days."
        return 0, f"Next resupply due in {days} days."
    except Exception:
        return None, "Resupply date unparseable."


def compute_mission_risk(db, mission, override=None):
    """override: dict of scenario modifications from the simulation engine."""
    override = override or {}
    reasons = []
    actions = []
    scores = []
    bits = {}

    # -- Fuel ---------------------------------------------------------------
    fuel = _category_health(db, mission, "fuel", override)
    if fuel:
        scores.append(fuel["score"])
        reasons.append(fuel["reason"])
        if fuel["score"] >= 2.5:
            actions.append(fuel["action"])

    # -- Food ---------------------------------------------------------------
    food = _category_health(db, mission, "food", override)
    if food:
        scores.append(food["score"])
        reasons.append(food["reason"])
        if food["score"] >= 2.5:
            actions.append(food["action"])

    # -- Medical --------------------------------------------------------------
    med = _category_health(db, mission, "medical", override)
    if med:
        scores.append(med["score"])
        reasons.append(med["reason"])
        if med["score"] >= 2.5:
            actions.append(med["action"])

    # -- Emergency supplies ---------------------------------------------------
    emg = _category_health(db, mission, "emergency", override)
    if emg and emg["score"]:
        scores.append(emg["score"])

    # -- Weather ---------------------------------------------------------------
    w = _weather_health(db, mission, override)
    if w:
        scores.append(w["score"])
        reasons.append(w["reason"])
        if w["score"] >= 2.5:
            actions.append(w["action"])
        bits["weather"] = w

    # -- Cargo delays -----------------------------------------------------------
    c = _cargo_health(db, mission, override)
    if c:
        scores.append(c["score"])
        reasons.append(c["reason"])
        if c["score"] >= 2.5:
            actions.append(c["action"])
        bits["cargo"] = c

    # -- Resupply -----------------------------------------------------------------
    r = _resupply_status(db, mission)
    if r and r[0] is not None:
        scores.append(r[0])
        reasons.append(r[1])
        if r[0] >= 2.5:
            actions.append("Expedite the next resupply shipment / open command channel with HQ.")
        bits["resupply"] = r

    # -- Assets ---------------------------------------------------------------------
    a = _asset_health(db, mission)
    if a:
        scores.append(a["score"])
        reasons.append(a["reason"])
        if a["score"] >= 2.5:
            actions.append(a["action"])
        bits["assets"] = a

    # -- Personnel ---------------------------------------------------------------------
    p = _personnel_health(db, mission)
    if p:
        scores.append(p["score"])
        reasons.append(p["reason"])
        if p["score"] >= 2.0:
            actions.append("Verify wellbeing of all personnel and confirm check-in schedule.")

    # -- Communication -----------------------------------------------------------------
    comm = _comm_health(db, mission, override)
    if comm:
        scores.append(comm["score"])
        reasons.append(comm["reason"])
        if comm["score"] >= 2.5:
            actions.append("Use backup comms (satellite/IRIDIUM) and throttle non-critical traffic.")

    # -- Route / ice ----------------------------------------------------------------------
    route = _route_health(db, mission, override)
    if route:
        scores.append(route["score"])
        reasons.append(route["reason"])
        if route["score"] >= 2.5:
            actions.append(route["action"])
        bits["route"] = route

    if not scores:
        return {
            "level": "LOW", "score": 0.0, "reasons": ["No risk factors available for this mission."],
            "actions": [], "factors": [], "override": override,
        }

    avg = sum(scores) / len(scores)
    if override.get("resupply_delay_days"):
        avg = min(4.0, avg + 0.5)
        reasons.append(
            f"Scenario: resupply delayed by {override['resupply_delay_days']} days (+0.5 risk)."
        )
    if override.get("severe_weather_blocks_route"):
        avg = min(4.0, avg + 0.6)
        reasons.append("Scenario: severe weather blocks route (+0.6 risk).")
    if override.get("communication_outage"):
        avg = min(4.0, avg + 0.4)
        reasons.append("Scenario: communication outage (+0.4 risk).")
    if override.get("fuel_consumption_pct"):
        avg = min(4.0, avg + (override["fuel_consumption_pct"] - 100) / 100)
        reasons.append(f"Scenario: fuel consumption {override['fuel_consumption_pct']}% of baseline.")

    level = _grade(avg)
    return {
        "level": level,
        "score": round(avg, 2),
        "reasons": reasons,
        "actions": actions or ["Continue routine monitoring."],
        "factors": [
            {"factor": "Weather", "score": w["score"]} if w else None,
        ] + [b for b in bits.values()],
        "override": override,
    }


def _category_health(db, mission, category, override):
    from ..models import InventoryItem

    item = (
        db.query(InventoryItem)
        .filter(InventoryItem.mission_id == mission.id, InventoryItem.category == category)
        .order_by(InventoryItem.quantity.asc())
        .first()
    )
    if not item:
        return None
    pred = predict_depletion(db, item, mission, override)
    days = pred["days_remaining"]
    if days is None:
        return None
    if pred["status"] == "shortage":
        score, msg = min(4.0, 2.5 + (30 - days) / 12), (
            f"{category.title()} shortage risk: {item.item} depleted in ~{days} days "
            f"before next resupply."
        )
    elif pred["status"] == "critical":
        score, msg = 4.0, f"{category.title()} CRITICAL: {item.item} has ~{days} days left."
    elif days < 10:
        score, msg = 2.5, f"{category.title()} getting low: ~{days} days remaining."
    else:
        score, msg = 1.0, f"{category.title()} stock healthy with ~{days} days remaining."

    action = (
        f"Place urgent {category} order and ration non-critical use."
        if score >= 2.5 else
        f"Monitor {category} levels with consumption trend."
        if score >= 2.0 else ""
    )
    return {"score": score, "reason": msg, "action": action, "prediction": pred}


def _weather_health(db, mission, override):
    from ..models import WeatherRecord

    rec = (
        db.query(WeatherRecord)
        .filter(WeatherRecord.station_id == mission.station_id)
        .order_by(WeatherRecord.recorded_at.desc())
        .first()
    )
    if not rec:
        return {"score": 1.0, "reason": "No weather data available.", "action": ""}
    score = 1.0
    msg = []
    if (rec.storm or False):
        score = max(score, 3.0)
        msg.append("storm conditions")
    if (rec.temperature_c or 0) <= -35:
        score = max(score, 3.4)
        msg.append("extreme cold")
    elif (rec.temperature_c or 0) <= -25:
        score = max(score, 2.4)
    if (rec.wind_speed or 0) >= 25:
        score = max(score, 2.8)
        msg.append("high winds")
    if (rec.visibility_km or 0) < 1:
        score = max(score, 2.6)
        msg.append("near-zero visibility")
    if (rec.ice_route_condition or "open") in ("unstable", "closed"):
        score = max(score, 3.2)
        msg.append(f"route ice {rec.ice_route_condition}")
    if override.get("severe_weather_blocks_route"):
        score = max(score, 4.0)
        msg.append("blocked by severe weather (scenario)")
    reason = f"Weather at station: {' + '.join(msg) or 'benign'} conditions."
    return {"score": round(score, 2), "reason": reason, "action": "Hold outdoor operations and secure assets." if score >= 2.5 else ""}


def _cargo_health(db, mission, override):
    from ..models import Cargo

    rows = (
        db.query(Cargo)
        .filter(Cargo.mission_id == mission.id, Cargo.shipment_status.in_(["transport", "transit", "manifest", "packing"]))
        .all()
    )
    delayed = [c for c in rows if c.expected_arrival and c.expected_arrival < date.today().isoformat()]
    soon = [c for c in rows if c.expected_arrival and c.expected_arrival >= date.today().isoformat()]
    if override.get("cargo_lost"):
        delayed = delayed or ["simulated lost cargo"]
        score = 3.6
        reason = "Scenario: cargo lost/delayed in transit."
    elif delayed:
        score = min(4.0, 2.6 + 0.3 * len(delayed))
        names = ", ".join([c.item_name for c in delayed[:3]])
        reason = f"{len(delayed)} cargo item(s) delayed: {names}."
    elif rows and not soon:
        score = 2.0
        reason = "Cargo in transit with no confirmed arrival dates."
    else:
        score = 0.8
        reason = "No cargo delays detected."
    action = "Chase shipment/handler and re-plan resupply integration." if score >= 2.5 else ""
    return {"score": round(score, 2), "reason": reason, "action": action, "count": len(delayed) if isinstance(delayed, list) else 0}


def _asset_health(db, mission):
    from ..models import Asset
    from .assets import maintenance_risk

    rows = db.query(Asset).filter(Asset.mission_id == mission.id).all()
    if not rows:
        return None
    risky = [maintenance_risk(a) for a in rows]
    failed = [r for r in risky if r["status"] == "critical"]
    high = [r for r in risky if r["status"] == "high"]
    if failed:
        score = 3.6
        reason = f"{len(failed)} critical asset(s): {', '.join(r['name'] for r in failed)}."
        action = "Immediate maintenance priority on critical assets."
    elif high:
        score = 2.6
        reason = f"{len(high)} asset(s) require maintenance soon."
        action = "Schedule maintenance for high-risk assets."
    else:
        score = 1.0
        reason = "No major asset risks detected."
        action = ""
    return {"score": round(score, 2), "reason": reason, "action": action}


def _personnel_health(db, mission):
    from ..models import Personnel

    rows = db.query(Personnel).filter(Personnel.mission_id == mission.id).all()
    if not rows:
        return None
    unaccounted = [p for p in rows if p.status in ("inactive", "emergency")]
    transit = [p for p in rows if p.movement_status == "transit"]
    if unaccounted:
        score = 3.4
        reason = f"{len(unaccounted)} personnel in abnormal status."
    elif len(transit) > len(rows) * 0.5:
        score = 2.2
        reason = f"Large share of team in transit ({len(transit)} persons)."
    else:
        score = 0.8
        reason = "Personnel accounted for."
    return {"score": round(score, 2), "reason": reason}


def _comm_health(db, mission, override):
    if override.get("communication_outage"):
        return {"score": 3.4, "reason": "Communication outage (scenario). Fallback channels active."}
    return {"score": 0.8, "reason": "Communication channels operational."}


def _route_health(db, mission, override):
    from ..models import WeatherRecord

    if override.get("severe_weather_blocks_route"):
        return {"score": 3.6, "reason": "Route blocked by severe weather (scenario).", "action": "Abort or re-route overland movement."}
    rec = (
        db.query(WeatherRecord)
        .filter(WeatherRecord.station_id == mission.station_id)
        .order_by(WeatherRecord.recorded_at.desc())
        .first()
    )
    if rec and (rec.ice_route_condition or "open") == "closed":
        return {"score": 3.0, "reason": "Route ice condition closed.", "action": "Hold vehicular movement."}
    return {"score": 0.8, "reason": "Route conditions open for movement."}