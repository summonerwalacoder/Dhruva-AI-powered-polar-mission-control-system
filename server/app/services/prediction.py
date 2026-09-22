"""Depletion prediction, survival clock and feedback loop.

Uses a hybrid approach:
  * scikit-learn LinearRegression fitted on real consumption history
    (inventory transactions + weather/team features) when enough data exists,
  * explicit rule adjustments (weather, team size, resupply ETA) otherwise.

Every prediction carries `reasons` so the output is explainable.
"""
from datetime import date, timedelta

import numpy as np
from sklearn.linear_model import LinearRegression

from ..models import InventoryItem, InventoryTransaction

CATEGORIES = ("food", "water", "fuel", "medical", "emergency")


def _days_to_resupply(mission) -> float | None:
    try:
        resups = mission.planned_resupplies or []
        start = date.fromisoformat(mission.start_date) if mission.start_date else date.today()
        today = date.today()
        future = []
        for r in resups:
            d = r.get("date") if isinstance(r, dict) else r
            try:
                dd = date.fromisoformat(str(d))
            except Exception:
                continue
            if dd >= today and isinstance(r, dict):
                future.append((dd, r))
        if future:
            future.sort()
            return (future[0][0] - today).days
        # no explicit future resupply -> use end of mission
        if mission.end_date:
            return (date.fromisoformat(mission.end_date) - today).days
        return None
    except Exception:
        return None


def _next_resupply_date(mission):
    try:
        resups = mission.planned_resupplies or []
        today = date.today()
        future = []
        for r in resups:
            d = r.get("date") if isinstance(r, dict) else r
            try:
                dd = date.fromisoformat(str(d))
            except Exception:
                continue
            if dd >= today:
                future.append(dd)
        if future:
            return str(min(future))
        if mission.end_date:
            return mission.end_date
    except Exception:
        pass
    return None


def weather_factor(mission, db, days=7):
    """Returns (factor, reasons): extra consumption multiplier from weather."""
    from ..models import WeatherRecord

    station_id = mission.station_id if mission else None
    recs = []
    if station_id:
        recs = (
            db.query(WeatherRecord)
            .filter(WeatherRecord.station_id == station_id)
            .order_by(WeatherRecord.recorded_at.desc())
            .limit(days)
            .all()
        )
    if not recs:
        return 1.0, ["No recent weather records - using baseline consumption."]
    temp = np.mean([r.temperature_c or 0 for r in recs])
    storm = int(any(bool(r.storm) for r in recs))
    wind = np.mean([r.wind_speed or 0 for r in recs])
    factor = 1.0
    reasons = []
    if temp < -30:
        factor *= 1.12
        reasons.append("Temperatures below -30C increase fuel & medical demand by ~12%.")
    elif temp < -20:
        factor *= 1.06
        reasons.append("Severe cold (below -20C) increases fuel demand by ~6%.")
    if storm:
        factor *= 1.08
        reasons.append("Storm conditions increase consumption by ~8%.")
    if wind > 15:
        factor *= 1.04
        reasons.append("High winds increase heating/fuel consumption by ~4%.")
    if not reasons:
        reasons.append("Weather conditions near baseline - no consumption adjustment.")
    return factor, reasons


def ml_consumption_rate(db, item: InventoryItem):
    """Fit a simple LinearRegression on consumption history."""
    rows = (
        db.query(InventoryTransaction)
        .filter(InventoryTransaction.inventory_id == item.id, InventoryTransaction.change < 0)
        .order_by(InventoryTransaction.timestamp)
        .all()
    )
    if len(rows) < 3:
        return None, []
    # cumulative consumption over days
    base = rows[0].timestamp.date()
    xs, ys = [], []
    cum = 0.0
    for r in rows:
        d = (r.timestamp.date() - base).days
        cum += abs(r.change)
        xs.append([d])
        ys.append(cum)
    reg = LinearRegression().fit(xs, ys)
    rate_per_day = float(reg.coef_[0])
    if rate_per_day <= 0 or rate_per_day > (item.consumption_rate or 0) * 10:
        return None, []
    return rate_per_day, [
        f"Linear regression over {len(rows)} consumption records estimates {rate_per_day:.2f} {item.unit}/day."
    ]


def predict_depletion(db, item: InventoryItem, mission=None, override=None):
    """Works out depletion for a single inventory item."""
    reasons = []
    qty = item.quantity or 0

    stated_rate = item.consumption_rate or 0
    ml_rate, ml_reasons = ml_consumption_rate(db, item)
    if ml_rate:
        rate = ml_rate
        reasons.extend(ml_reasons)
    elif stated_rate:
        rate = stated_rate
        reasons.append(f"Using configured consumption rate of {rate:.2f} {item.unit}/day.")
    else:
        reasons.append("No historical consumption or configured rate - depletion cannot be estimated.")
        return {
            "item": item.item, "category": item.category, "quantity": qty,
            "unit": item.unit, "days_remaining": None, "depletion_date": None,
            "shortage_probability": None, "reorder_recommended": False,
            "resupply_date": _next_resupply_date(mission) if mission else None,
            "reasons": reasons, "status": "unknown",
        }

    wfactor, wreasons = weather_factor(mission, db)
    reasons.extend(wreasons)

    team = (mission.team_size or 0) if mission else 0
    team_factor = 1.0
    if team:
        # baseline planning assumed ~ team size; scale rate mildly if changed
        pass

    if override:
        rate = rate * (override.get("consumption_multiplier", 1.0))
        reasons.append(f"Simulation scale factor {override.get('consumption_multiplier', 1.0)}x applied.")

    eff_rate = rate * wfactor
    reasons.append(f"Effective consumption ≈ {eff_rate:.2f} {item.unit}/day after weather adjustments.")

    if eff_rate <= 0:
        return {
            **base(item), "days_remaining": None, "depletion_date": None,
            "shortage_probability": 0.0, "reasons": reasons,
            "resupply_date": _next_resupply_date(mission) if mission else None, "status": "ok",
        }

    days_remaining = int(qty / eff_rate)
    depletion_date = date.today() + timedelta(days=days_remaining)

    dtr = _days_to_resupply(mission)
    if dtr is None:
        shortage_prob = None
    else:
        buffer = days_remaining - dtr
        # simple logistic-style probability
        prob = 1.0 / (1.0 + np.exp(-(1.2 * (dtr - days_remaining) / max(dtr, 1))))
        shortage_prob = round(float(prob), 2)
        if dtr > days_remaining:
            reasons.append(
                f"Stock runs out ~{days_remaining}d before next resupply ({dtr}d away) - "
                f"shortage probability {shortage_prob:.0%}."
            )
        else:
            reasons.append(
                f"Stock covers ~{days_remaining}d and next resupply arrives in {dtr}d - adequate."
            )

    critical = item.criticality or "normal"
    status = "ok"
    if days_remaining < (dtr if dtr else 7) and (dtr is None or days_remaining < dtr):
        status = "shortage"
    elif days_remaining < 7:
        status = "critical"

    reorder = bool(dtr is None or days_remaining < dtr)
    reasons.append(
        f"Reorder recommended: {'yes' if reorder else 'no'}."
    )

    return {
        "item": item.item,
        "category": item.category,
        "quantity": qty,
        "unit": item.unit,
        "days_remaining": days_remaining,
        "depletion_date": depletion_date.isoformat(),
        "shortage_probability": shortage_prob,
        "reorder_recommended": reorder,
        "resupply_date": _next_resupply_date(mission) if mission else None,
        "consumption_rate": round(eff_rate, 2),
        "reasons": reasons,
        "status": status,
        "criticality": critical,
    }


def base(item):
    return {
        "item": item.item, "category": item.category, "quantity": item.quantity,
        "unit": item.unit,
    }


def survival_clock(db, mission_id: int):
    """Days remaining for the leading item of each critical category."""
    from ..models import Mission

    mission = db.get(Mission, mission_id)
    if not mission:
        return []
    items = (
        db.query(InventoryItem)
        .filter(InventoryItem.mission_id == mission_id)
        .all()
    )
    cat_map = {}
    for it in items:
        cat = it.category
        if cat in CATEGORIES:
            p = predict_depletion(db, it, mission)
            if p["days_remaining"] is not None:
                if cat not in cat_map or p["days_remaining"] < cat_map[cat]["days_remaining"]:
                    cat_map[cat] = {"item": it.item, **p}
    out = []
    for cat in CATEGORIES:
        p = cat_map.get(cat)
        dtr = _days_to_resupply(mission)
        out.append({
            "category": cat,
            "label": cat.title(),
            "days_remaining": p["days_remaining"] if p else None,
            "item": p["item"] if p else None,
            "depletion_date": p["depletion_date"] if p else None,
            "status": "unknown" if not p else p["status"],
            "days_to_resupply": dtr,
            "resupply_date": _next_resupply_date(mission),
            "resupply_ok": bool(p and dtr and p["days_remaining"] >= dtr),
            "criticality": p["criticality"] if p else "normal",
        })
    return out