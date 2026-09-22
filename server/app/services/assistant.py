"""AI Mission Assistant - central intelligence layer.

Pipeline: User Question -> Language Detection -> Intent Detection ->
Permission Check -> Mission DB retrieval -> Reasoning -> Response (optional action)

For the LLM path we build a permission-scoped evidence/context block from the
authorized mission data (RAG-style) and let the LLM phrase the answer. The
rule-engine path answers deterministically from the same evidence so DHRUVA
always works, even with no external API configured.
"""
import re
from datetime import date

from ..i18n import detect_language
from .llm import complete, provider_name, llm_available
from .risk_engine import compute_mission_risk
from .prediction import predict_depletion, survival_clock
from .simulation import run_simulation, build_scenario_from_text
from .assets import maintenance_risk

QUICK_ACTIONS = {
    "mission_status": "Mission Status",
    "fuel_forecast": "Fuel Forecast",
    "food_forecast": "Food Forecast",
    "cargo_delays": "Cargo Delays",
    "asset_risks": "Asset Risks",
    "current_alerts": "Current Alerts",
    "simulate": "Simulate Scenario",
    "emergency_help": "Emergency Help",
}


class Evidence:
    """Permission-scoped facts collected for a question."""

    def __init__(self):
        self.facts = []
        self.warnings = []

    def add(self, fact):
        if fact:
            self.facts.append(str(fact))

    def text(self):
        return "\n".join(self.facts)


def detect_intent(question: str) -> str:
    q = question.lower()
    patterns = {
        "mission_status": [r"mission status", r"mission status", r"today.?s (mission )?status", r"summary", r"summarize", r"overview", r"brief",
                           r"क्या चल रहा", r"स्थिति", r"मिशन स्टेटस", r"सारांश", r"what is the state", r"status of the mission"],
        "fuel": [r"fuel", r"ईंधन", r"petrol", r"diesel", r"generator.*run", r"run.*generator"],
        "food": [r"food", r"ration", r"stock run out", r"eat", r"खाना", r"भोजन", r"ration"],
        "water": [r"water", r"पानी", r"drinking"],
        "cargo_delays": [r"cargo.*delay", r"delayed", r"shipment", r"container", r"कार्गो", r"विलंब"],
        "assets": [r"asset", r"maintenance", r"vehicle", r"generator", r"snow vehicle", r"संसाधन", r"मशीन", r"रखरखाव"],
        "alerts": [r"alert", r"critical alert", r"अलर्ट", r"warnings", r"चेतावनी"],
        "simulate": [r"what if", r"what happens if", r"simulat", r"scenario", r"if the resupply", r"अगर", r"क्या होगा", r"सिमुलेट"],
        "resources_risk": [r"at risk", r"resource", r"shortage", r"deplet", r"risk", r"स्टॉक", r"कमी", r"जोखिम"],
        "emergency": [r"emergency", r"sos", r"help", r"आपात", r"बचाव", r"सहायता"],
        "weather": [r"weather", r"temperature", r"storm", r"मौसम", r"तापमान", r"wind"],
        "personnel": [r"personnel", r"team", r"staff", r"who", r"दल", r"लोग", r"कितने लोग"],
        "nearest_asset": [r"nearest", r"closest", r"nearby", r"available emergency"],
    }
    for intent, pats in patterns.items():
        for p in pats:
            if re.search(p, q):
                return intent
    return "general"


def answer_question(db, user, question: str, mission_id=None, channel="text"):
    lang = detect_language(question)
    intent = detect_intent(question)
    evidence = Evidence()

    mission = _pick_mission(db, user, mission_id)

    if not mission:
        evidence.add("No mission selected or no mission accessible for your role.")
        reply = _reply_for(evidence, intent, lang, "no_mission")
        return _build_result(reply, lang, intent, evidence, "select mission first, then try again.")

    if intent == "simulate":
        return _handle_simulate(db, user, mission, question, lang, evidence, channel)

    if intent == "mission_status":
        evidence.add(_mission_status_facts(db, mission))
    elif intent in ("fuel", "food", "water"):
        category = {"fuel": "fuel", "food": "food", "water": "water"}[intent]
        evidence.add(_resource_facts(db, mission, category))
    elif intent == "cargo_delays":
        evidence.add(_cargo_facts(db, mission))
    elif intent == "assets":
        evidence.add(_asset_facts(db, mission))
    elif intent == "alerts":
        evidence.add(_alert_facts(db, mission))
    elif intent == "resources_risk":
        evidence.add(_risk_facts(db, mission))
        evidence.add(_resource_facts(db, mission, None, all_critical=True))
    elif intent == "emergency":
        evidence.add(_emergency_facts(db, mission))
    elif intent == "weather":
        evidence.add(_weather_facts(db, mission))
    elif intent == "personnel":
        evidence.add(_personnel_facts(db, mission, user))
    elif intent == "nearest_asset":
        evidence.add(_nearest_facts(db, mission))
    else:
        evidence.add(_general_facts(db, mission))
        evidence.add(_risk_facts(db, mission))

    reply = _reply_for(evidence, intent, lang, "ok")
    action = _action_for(intent)
    return _build_result(reply, lang, intent, evidence, action)


def _build_result(reply, lang, intent, evidence, action=""):
    return {
        "reply": reply,
        "language": lang,
        "intent": intent,
        "provider": provider_name(),
        "model": None if not llm_available() else "gemini",
        "evidence": evidence.facts,
        "warnings": evidence.warnings,
        "action": {"type": action} if action else None,
    }


def _pick_mission(db, user, mission_id):
    from ..security import accessible_mission_ids
    from ..models import Mission

    ids = accessible_mission_ids(db, user)
    if mission_id:
        m = db.get(Mission, mission_id)
        if m and m.id in ids:
            return m
    if ids:
        # pick first active mission
        for m in db.query(Mission).filter(Mission.id.in_(ids)).all():
            if m.status == "active":
                return m
        return db.get(Mission, ids[0])
    return None


def _mission_status_facts(db, mission):
    from ..models import Personnel, Cargo, Alert

    today = date.today()
    pc = db.query(Personnel).filter(Personnel.mission_id == mission.id).count()
    cc = db.query(Cargo).filter(Cargo.mission_id == mission.id).count()
    ac = db.query(Alert).filter(Alert.mission_id == mission.id, Alert.status == "active").count()
    clock = survival_clock(db, mission.id)
    out = [
        f"Mission {mission.mission_id} ({mission.name}) at {mission.destination}.",
        f"Status: {mission.status}, started {mission.start_date}, ends {mission.end_date} (progress {mission.progress or 0}%).",
        f"Team size: {mission.team_size} personnel records: {pc}.",
        f"Cargo items: {cc}. Active alerts: {ac}.",
    ]
    parts = {c["category"]: c["days_remaining"] for c in clock}
    if parts:
        desc = ", ".join(f"{k}: {v}d" for k, v in parts.items() if v is not None)
        out.append(f"Survival clock - {desc}.")
    return out


def _resource_facts(db, mission, category, all_critical=False):
    from ..models import InventoryItem

    q = db.query(InventoryItem).filter(InventoryItem.mission_id == mission.id)
    if category and not all_critical:
        q = q.filter(InventoryItem.category == category)
    items = q.all()
    if not items:
        return [f"No {category or 'inventory'} tracked for this mission."]
    out = []
    for it in items:
        pred = predict_depletion(db, it, mission)
        d = pred["days_remaining"]
        if d is None:
            out.append(f"{it.item}: {it.quantity} {it.unit}, no depletion estimate.")
        else:
            out.append(
                f"{it.item} ({it.category}): {it.quantity} {it.unit}, ~{d} days left, "
                f"depletes by {pred['depletion_date']}, shortage probability {pred['shortage_probability']}."
            )
    return out


def _cargo_facts(db, mission):
    from ..models import Cargo

    today = date.today()
    rows = db.query(Cargo).filter(Cargo.mission_id == mission.id).all()
    if not rows:
        return ["No cargo records for this mission."]
    delayed = [c for c in rows if c.expected_arrival and c.expected_arrival < today.isoformat()]
    in_transit = [c for c in rows if c.shipment_status in ("transport", "transit", "manifest")]
    out = [f"Total cargo items: {len(rows)}."]
    if delayed:
        out.append(f"DELAYED ({len(delayed)}): " + ", ".join(f"{c.item_name} (eta {c.expected_arrival})" for c in delayed))
    else:
        out.append("No delayed cargo detected.")
    if in_transit:
        out.append(f"In transit ({len(in_transit)}): " + ", ".join(c.item_name for c in in_transit))
    return out


def _asset_facts(db, mission):
    from ..models import Asset

    rows = db.query(Asset).filter(Asset.mission_id == mission.id).all()
    if not rows:
        return ["No assets tracked for this mission."]
    out = []
    risky = [maintenance_risk(a) for a in rows]
    due = [r for r in risky if r["status"] in ("due", "high", "critical")]
    if due:
        out.append(f"Assets needing attention ({len(due)}): " + ", ".join(
            f"{r['name']} - {r['status_label']}" for r in due))
    else:
        out.append("All assets within healthy maintenance windows.")
    failed = [a for a in rows if a.operational_status == "failed"]
    if failed:
        out.append("Failed/offline assets: " + ", ".join(a.name for a in failed))
    out.append(f"Total assets: {len(rows)}.")
    return out


def _alert_facts(db, mission):
    from ..models import Alert

    rows = db.query(Alert).filter(Alert.mission_id == mission.id, Alert.status == "active").order_by(Alert.created_at.desc()).all()
    if not rows:
        return ["No active alerts."]
    return [f"[{a.severity.upper()}]: {a.title} - {a.message}" for a in rows[:8]]


def _weather_facts(db, mission):
    from ..models import WeatherRecord

    rec = db.query(WeatherRecord).filter(WeatherRecord.station_id == mission.station_id).order_by(WeatherRecord.recorded_at.desc()).first()
    if not rec:
        return ["No weather data recorded (source not configured or no entry)."]
    return [
        f"Weather ({rec.source_label or rec.source}): temp {rec.temperature_c}C, wind {rec.wind_speed} km/h, "
        f"visibility {rec.visibility_km} km, condition {rec.condition}, storm {'yes' if rec.storm else 'no'}, "
        f"ice route {rec.ice_route_condition}.",
    ]


def _personnel_facts(db, mission, user):
    from ..security import accessible_personnel_query, can_view_medical
    from ..models import Personnel

    rows = accessible_personnel_query(db, user).filter(Personnel.mission_id == mission.id).all()
    if not rows:
        return ["No personnel records."]
    by_status = {}
    for p in rows:
        by_status.setdefault(p.movement_status, 0)
        by_status[p.movement_status] += 1
    out = [f"{len(rows)} personnel.",
           "Movement: " + ", ".join(f"{k.replace('_',' ')} {v}" for k, v in by_status.items()) + "."]
    if can_view_medical(db, user):
        ill = [p for p in rows if p.health_status and p.health_status != "fit"]
        if ill:
            out.append(f"Health flag on: {', '.join(p.name for p in ill)}.")
    return out


def _risk_facts(db, mission):
    risk = compute_mission_risk(db, mission)
    parts = []
    if risk["level"] in ("HIGH", "CRITICAL"):
        parts.append(f"Overall mission risk: {risk['level']} (score {risk['score']}).")
    else:
        parts.append(f"Overall mission risk: {risk['level']} (score {risk['score']}).")
    parts.extend(" - " + r for r in risk["reasons"][:5])
    parts.append("Recommended actions: " + "; ".join(risk["actions"][:4]) + ".")
    return parts


def _emergency_facts(db, mission):
    from ..models import Emergency

    rows = db.query(Emergency).filter(Emergency.mission_id == mission.id).order_by(Emergency.reported_at.desc()).limit(5).all()
    if not rows:
        return ["No recent emergencies."]
    return [f"{e.emergency_id}: {e.type} ({e.severity}) status {e.status} - {e.description[:80]}" for e in rows]


def _general_facts(db, mission):
    return [_mission_status_facts(db, mission)[0], f"Team size: {mission.team_size}."]


def _nearest_facts(db, mission):
    from ..models import Asset, Personnel

    # Mission has no lat/lng directly; use station coordinates
    station = mission.station
    if station:
        loc = (station.latitude, station.longitude)
    else:
        loc = None
    assets = db.query(Asset).filter(Asset.mission_id == mission.id, Asset.operational_status == "operational").all()
    if not assets:
        return ["No operational assets found for this mission."]
    out = ["Operational assets available:"]
    for a in assets[:8]:
        out.append(f"  {a.name} ({a.asset_id}) at {a.location}.")
    if loc:
        out.append(f"Nearest station {station.name} at {loc[0]:.2f}, {loc[1]:.2f}.")
    return out


def _action_for(intent):
    if intent == "simulate":
        return "open_simulations"
    if intent == "emergency":
        return "open_emergency"
    if intent == "cargo_delays":
        return "open_cargo"
    if intent == "assets":
        return "open_assets"
    if intent == "alerts":
        return "open_alerts"
    if intent == "weather":
        return "open_weather"
    if intent == "personnel":
        return "open_personnel"
    return ""


def _handle_simulate(db, user, mission, question, lang, evidence, channel):
    scenario = build_scenario_from_text(question)
    sim = run_simulation(db, mission, scenario)
    before = sim["risk_before"]
    after = sim["risk_after"]
    deltas = []
    for c in sim["after"]["survival_clock"]:
        b = next((x for x in sim["before"]["clock"] if x["category"] == c["category"]), None)
        if b and b["days_remaining"] != c["days_remaining"]:
            deltas.append(f"{c['label']}: {b['days_remaining']}d → {c['days_remaining']}d")
    facts = [
        f"Simulated scenario: {sim['scenario']}",
        f"Risk changed from {before} to {after}.",
        "Resource impact: " + ("; ".join(deltas) if deltas else "no change in critical categories."),
        "Recommended actions: " + "; ".join(sim["result"]["actions"][:4]) or "None.",
    ]
    evidence.facts.extend(facts)
    evidence.add("Full before/after comparison available in Simulations.")
    reply = _reply_for(evidence, "simulate", lang, "simulated", str(sim["id"]))
    return _build_result(reply, lang, "simulate", evidence, "open_simulations")


# ---------------------------------------------------------------------------
# Response phrasing (rule engine). Natural, multilingual.
# ---------------------------------------------------------------------------
def _reply_for(evidence: Evidence, intent: str, lang: str, mode: str, extra=""):
    facts = evidence.facts
    if lang == "hi":
        return _reply_hi(evidence, intent, mode, extra)
    if mode == "no_mission":
        return "Please select a mission first so I can pull the authorised data."
    if mode == "simulated":
        return "Simulation complete. " + " ".join(facts[:4])
    head = _head_for(intent)
    return head + " " + " ".join(facts[:6])


def _head_for(intent):
    heads = {
        "mission_status": "Here is the current mission status:",
        "fuel": "Here is the fuel situation:",
        "food": "Here is the food situation:",
        "water": "Here is the water situation:",
        "cargo_delays": "Here is the cargo status:",
        "assets": "Here is the asset/maintenance picture:",
        "alerts": "Here are the active alerts:",
        "resources_risk": "Here is the resource risk summary:",
        "emergency": "Here is the emergency overview:",
        "weather": "Here is the weather picture:",
        "personnel": "Here is the personnel summary:",
        "nearest_asset": "Here is what is available nearby:",
        "general": "Here is what I found:",
    }
    return heads.get(intent, "Here is the answer:")


def _reply_hi(evidence: Evidence, intent: str, mode: str, extra=""):
    facts = evidence.facts
    if mode == "no_mission":
        return "कृपया पहले एक मिशन चुनें ताकि मैं अधिकृत डेटा प्राप्त कर सकूं।"
    if mode == "simulated":
        return "सिमुलेशन पूरा हुआ। " + " ".join(facts[:4])
    heads = {
        "mission_status": "मिशन की वर्तमान स्थिति:",
        "fuel": "ईंधन की स्थिति:",
        "food": "भोजन की स्थिति:",
        "water": "पानी की स्थिति:",
        "cargo_delays": "कार्गो की स्थिति:",
        "assets": "संसाधनों / रखरखाव की स्थिति:",
        "alerts": "वर्तमान अलर्ट:",
        "resources_risk": "संसाधन जोखिम सारांश:",
        "emergency": "आपातकालीन जानकारी:",
        "weather": "मौसम की जानकारी:",
        "personnel": "दल की जानकारी:",
        "nearest_asset": "आस-पास उपलब्ध संसाधन:",
        "general": "मुझे यह जानकारी मिली:",
    }
    return (heads.get(intent, "उत्तर:") + " " + " ".join(facts[:6]))


# ---------------------------------------------------------------------------
# LLM phrasing path: build prompt from evidence, verify fallback.
# ---------------------------------------------------------------------------
async def answer_question_llm(db, user, question, mission_id=None, channel="text"):
    """LLM-backed path with permission-scoped retrieval. Falls back to the
    rule engine if the LLM is unavailable or fails."""
    base = answer_question(db, user, question, mission_id, channel)
    if not llm_available():
        base["llm_attempted"] = False
        return base

    system = (
        "You are DHRUVA AI, the assistant inside an Indian polar expedition "
        "mission-control platform. Answer the user's question using ONLY the "
        "evidence facts provided (they are permission-scoped). If evidence is "
        "insufficient, say so. Keep answers concise and clear. Detect the user's "
        "language and answer in that language."
    )
    prompt = f"Question: {question}\n\nEvidence facts:\n{base['evidence']}"
    text = await complete(prompt, system=system, max_tokens=600)
    if text:
        base["reply"] = text
        base["llm_attempted"] = True
    else:
        base["llm_attempted"] = True
        base["reply"] += " (LLM unavailable - showing built-in engine answer.)"
    return base