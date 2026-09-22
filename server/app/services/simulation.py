"""What-if mission simulation engine.

Takes scenario modifications and recalculates resource availability,
days remaining, risk level, mission impact and recommended actions.
Produces a before/after structure for comparison.
"""
from datetime import date

from .risk_engine import compute_mission_risk
from .prediction import survival_clock, weather_factor

SCENARIO_FIELDS = {
    "resupply_delay_days": "Resupply delayed by N days",
    "fuel_consumption_pct": "Fuel consumption at N% of baseline",
    "team_increase": "Team size increased by N",
    "generator_fail": "Generator fails",
    "vehicle_unavailable": "A vehicle becomes unavailable",
    "severe_weather_blocks_route": "Severe weather blocks the route",
    "cargo_lost": "Cargo lost/delayed",
    "communication_outage": "Communication outage",
}


def _default_scenario():
    return {
        "resupply_delay_days": 0,
        "fuel_consumption_pct": 100,
        "team_increase": 0,
        "generator_fail": False,
        "vehicle_unavailable": False,
        "severe_weather_blocks_route": False,
        "cargo_lost": False,
        "communication_outage": False,
    }


def build_scenario_from_text(text):
    """Extracts scenario modifications from a natural language request."""
    sc = _default_scenario()
    low = text.lower()
    if "resupply" in low and ("delay" in low or "देर" in low) or "resupply delayed" in low:
        import re
        m = re.search(r"(\d+)\s*(?:din|days?|दिन)", low)
        if m:
            sc["resupply_delay_days"] = int(m.group(1))
        else:
            sc["resupply_delay_days"] = 10
    if "fuel" in low and ("consump" in low or "up" in low or "%" in low):
        import re
        m = re.search(r"(\d+)\s*%", low)
        sc["fuel_consumption_pct"] = int(m.group(1)) if m else 120
    if "team" in low and ("increase" in low or "badh" in low or "increase" in low or "up" in low):
        import re
        m = re.search(r"(\d+)\s*(?:log|members|people|person|लोग)", low)
        sc["team_increase"] = int(m.group(1)) if m else 3
    if "generator" in low and ("fail" in low or "band" in low or "fail" in low):
        sc["generator_fail"] = True
    if "vehicle" in low and ("unavail" in low or "out" in low or "kharab" in low):
        sc["vehicle_unavailable"] = True
    if "weather" in low and ("block" in low or "severe" in low or "kharab" in low):
        sc["severe_weather_blocks_route"] = True
    if "cargo" in low and ("lost" in low or "delay" in low or "kho" in low):
        sc["cargo_lost"] = True
    if "comm" in low and ("out" in low or "fail" in low or "band" in low):
        sc["communication_outage"] = True
    return sc


def run_simulation(db, mission, scenario=None):
    from ..models import AIPrediction, Simulation

    scenario = scenario or _default_scenario()

    base_clock = survival_clock(db, mission.id)
    base_risk = compute_mission_risk(db, mission, override=None)

    now = date.today()
    baseline = {
        "date": now.isoformat(),
        "survival_clock": base_clock,
        "risk": base_risk["level"],
        "risk_score": base_risk["score"],
    }

    result_clock = survival_clock(db, mission.id)
    result_risk = compute_mission_risk(db, mission, override=scenario)

    # enrich predicted days of affected categories
    if scenario.get("resupply_delay_days"):
        for c in result_clock:
            if c["days_to_resupply"] is not None and scenario["resupply_delay_days"]:
                c["days_to_resupply_adjusted"] = c["days_to_resupply"] + scenario["resupply_delay_days"]

    result = {
        "date": now.isoformat(),
        "survival_clock": result_clock,
        "risk": result_risk["level"],
        "risk_score": result_risk["score"],
        "risk_reasons": result_risk["reasons"],
        "actions": result_risk["actions"],
    }

    impact = {
        "severity": result_risk["level"],
        "critical_dependencies": _critical_dependencies(db, mission, scenario),
        "mission_impact": _mission_impact(base_clock, result_clock),
    }

    sim = Simulation(
        mission_id=mission.id,
        name="Scenario simulation",
        scenario=scenario,
        baseline=baseline,
        result={**result, "impact": impact},
        risk_before=base_risk["level"],
        risk_after=result_risk["level"],
    )
    db.add(sim)
    db.commit()
    db.refresh(sim)

    return {
        "id": sim.id,
        "name": sim.name,
        "scenario": scenario,
        "baseline": baseline,
        "result": result,
        "impact": impact,
        "before": {"risk": base_risk["level"], "clock": base_clock},
        "after": {"risk": result_risk["level"], "clock": result_clock},
        "risk_before": base_risk["level"],
        "risk_after": result_risk["level"],
    }


def _critical_dependencies(db, mission, scenario):
    deps = []
    if scenario.get("resupply_delay_days"):
        deps.append({"resource": "Resupply chain", "detail": f"All stocks dependent on resupply shift by {scenario['resupply_delay_days']} days."})
    if scenario.get("generator_fail"):
        deps.append({"resource": "Power / heating", "detail": "Generator failure impacts heating and medical equipment. Check fuel heaters."})
    if scenario.get("vehicle_unavailable"):
        deps.append({"resource": "Mobility", "detail": "Reduced vehicle availability slows reconnaissance and resupply shuttling."})
    if scenario.get("communication_outage"):
        deps.append({"resource": "Communications", "detail": "Outage reduces coordination and emergency dispatch."})
    return deps


def _mission_impact(base_clock, result_clock):
    out = []
    for b in base_clock:
        item = next((r for r in result_clock if r["category"] == b["category"]), None)
        if item and b["days_remaining"] != item["days_remaining"]:
            out.append({
                "resource": b["category"].title(),
                "was": b["days_remaining"],
                "now": item["days_remaining"],
                "impacted": item["days_remaining"] < (b["days_remaining"] or 0),
            })
    return out