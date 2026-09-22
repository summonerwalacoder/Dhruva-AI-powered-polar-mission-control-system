"""AI Emergency Assistant + SOS workflow.

Understands a natural language situation, classifies emergency type/severity,
checks mission resources, provides immediate guidance and builds the outbound
alert payload. Honours the configured emergency policy and connectivity state.

Critical-safety note: DHRUVA provides decision support and follows configured
policy; it does NOT claim to independently guarantee anyone's safety.
"""
import re
from datetime import datetime, timezone

from ..i18n import detect_language
from .llm import complete, llm_available, provider_name

EMERGENCY_TYPES = [
    "medical", "fire", "vehicle_failure", "generator_failure", "communication_failure",
    "extreme_weather", "missing_person", "cargo_emergency", "fuel_shortage",
    "equipment_failure", "other",
]

TYPE_LABELS = {
    "medical": "Medical Emergency",
    "fire": "Fire",
    "vehicle_failure": "Vehicle Failure",
    "generator_failure": "Generator Failure",
    "communication_failure": "Communication Failure",
    "extreme_weather": "Extreme Weather",
    "missing_person": "Missing Person",
    "cargo_emergency": "Cargo Emergency",
    "fuel_shortage": "Fuel Shortage",
    "equipment_failure": "Equipment Failure",
    "other": "Other",
}

GUIDANCE = {
    "medical": "Move the person to shelter, provide first aid, contact the Medical Officer and prepare medevac if required.",
    "fire": "Evacuate the area, use fire extinguishers, isolate fuel/power sources and alert the station commander.",
    "vehicle_failure": "Stop movement, secure the vehicle, maintain radio contact, and send recovery coordinates.",
    "generator_failure": "Switch to backup power, conserve heating capacity, and check fuel/ignition systems.",
    "communication_failure": "Switch to fallback comms (satellite), conserve battery, broadcast periodic status.",
    "extreme_weather": "Cease outdoor operations, secure exposed assets, stay indoors and monitor shelter integrity.",
    "missing_person": "Initiate search protocol, log last known GPS, freeze movement and alert HQ.",
    "cargo_emergency": "Contain the issue, take inventory photos, and log hazard flags.",
    "fuel_shortage": "Conserve fuel, shut non-critical loads, and expedite resupply."
    ,
    "equipment_failure": "Tag the equipment, switch to alternate units and schedule inspection.",
    "other": "Describe the situation, secure the area and notify the commander.",
}


def detect_emergency_type(text: str) -> str:
    t = text.lower()
    pairs = [
        ("medical", [r"medic", r"hurt", r"injured", r"injur", r"unwell", r"ill\b", r"bleed", r"fever", r"chest", r"बीमार", r"चोट", r"मदद", r"heart"]),
        ("fire", [r"fire", r"आग", r"burn", r"smoke", r"धुआं"]),
        ("generator_failure", [r"generator", r"जनरेटर", r"power out", r"बिजली", r"band ho gaya"]),
        ("vehicle_failure", [r"vehicle", r"snowmobile", r"ski", r"truck", r"van", r"वाहन", r"गाड़ी"]),
        ("communication_failure", [r"comm", r"radio", r"internet", r"signal", r"satellite", r"संपर्क", r"रेडियो"]),
        ("extreme_weather", [r"storm", r"blizzard", r"whiteout", r"weather", r"तूफान", r"मौसम"]),
        ("missing_person", [r"missing", r"lost", r"not returned", r"गायब", r"लापता", r"जोश"]),
        ("cargo_emergency", [r"cargo", r"container", r"कार्गो"]),
        ("fuel_shortage", [r"fuel", r"petrol", r"diesel", r"ईंधन", r"petrol"]),
        ("equipment_failure", [r"equipment", r"machine", r"broken", r"fail", r"उपकरण", r"टूट"]),
    ]
    for etype, pats in pairs:
        for p in pats:
            if re.search(p, t):
                return etype
    return "other"


def estimate_severity(text: str, db=None, mission=None) -> dict:
    t = text.lower()
    score = 0
    reasons = []

    critical = [r"critical", r"unconscious", r"not breathing", r"severe", r"heavy bleeding", r"heart attack",
                r"fire", r"explosion", r"missing", r"गंभीर", r"तुरंत", r"जला", r"आग"]
    serious = [r"serious", r"broken", r"fracture", r"storm", r"blizzard", r"stranded", r"गंभीर", r"बर्फीला तूफान"]
    warning = [r"warning", r"low", r"damage", r"outage", r"खतरा", r"कम"]

    for w in critical:
        if re.search(w, t):
            score += 2
            reasons.append(f"keyword '{w}'")
    for w in serious:
        if re.search(w, t):
            score += 1
            reasons.append(f"keyword '{w}'")
    for w in warning:
        if re.search(w, t):
            score += 0.5

    if mission and db:
        from .risk_engine import _weather_health
        w = _weather_health(db, mission, {})
        if w and w["score"] >= 2.6:
            score += 1
            reasons.append("situational weather risk high")

    if score >= 4:
        level = "critical"
    elif score >= 2.5:
        level = "serious"
    elif score >= 1:
        level = "warning"
    else:
        level = "normal"
    return {"severity": level, "score": round(score, 1), "reasons": reasons or ["based on description keywords"]}


def build_guidance(etype, severity):
    base = GUIDANCE.get(etype, GUIDANCE["other"])
    if severity in ("serious", "critical"):
        base += " Escalate immediately to the Expedition Commander and keep HQ informed per policy."
    return base


def sos_payload(db, mission, user, data, etype, severity, location, lat, lng, description, connectivity, recommended):
    now = datetime.now(timezone.utc)
    payload = {
        "mission_id": mission.mission_id if mission else data.get("mission_id", ""),
        "mission_name": mission.name if mission else "",
        "reporter_name": user.name if user else data.get("reporter_name", ""),
        "personnel_id": data.get("personnel_id", ""),
        "emergency_type": etype,
        "emergency_type_label": TYPE_LABELS.get(etype, etype),
        "severity": severity,
        "location": location or "",
        "latitude": lat,
        "longitude": lng,
        "time": now.isoformat(),
        "description": description or "",
        "recommended_response": recommended,
        "connectivity": connectivity,
        "guidance": GUIDANCE.get(etype, GUIDANCE["other"]),
    }
    return payload


async def interpret_emergency(db, user, mission, description, connectivity="online", voice=False):
    lang = detect_language(description)
    etype = detect_emergency_type(description)
    sev = estimate_severity(description, db, mission)
    guidance = build_guidance(etype, sev["severity"])

    # optional LLM refinement
    if llm_available():
        prompt = (
            f"Classify this polar expedition emergency report. Return a single JSON: "
            f"{{'type': one of {EMERGENCY_TYPES}, 'severity': normal|warning|serious|critical, "
            f"'summary': <short>, 'guidance': <immediate steps>}}. Report: {description}"
        )
        text = await complete(prompt, max_tokens=300)
        if text:
            # best-effort parse
            try:
                import json
                obj = json.loads(text.strip().strip("`"))
                if isinstance(obj, dict):
                    if obj.get("type") in EMERGENCY_TYPES:
                        etype = obj["type"]
                    if obj.get("severity") in ("normal", "warning", "serious", "critical"):
                        sev["severity"] = obj["severity"]
                    guidance = obj.get("guidance", guidance)
            except Exception:
                pass

    return {
        "emergency_type": etype,
        "type_label": TYPE_LABELS.get(etype, etype),
        "severity": sev["severity"],
        "severity_reasons": sev["reasons"],
        "language": lang,
        "guidance": guidance,
        "provider": provider_name(),
    }


def policy_check(db, severity):
    """Returns whether auto-SOS is allowed from the configured policy."""
    from ..models import SystemConfig

    cfg = db.query(SystemConfig).filter(SystemConfig.key == "emergency_policy").first()
    policy = (cfg.value if cfg and isinstance(cfg.value, dict) else {}) or {
        "auto_sos": {"normal": False, "warning": False, "serious": True, "critical": True},
        "confirm_required": ["normal", "warning"],
        "hq_contacts": [],
        "enable_sms_fallback": True,
    }
    auto = policy.get("auto_sos", {}).get(severity, False)
    confirm = severity in policy.get("confirm_required", [])
    return {"auto_sos": auto, "require_confirmation": confirm, "policy": policy}