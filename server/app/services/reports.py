"""AI Daily Mission Report builder + CSV export + PDF export."""
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

from ..models import Alert, Asset, Cargo, Emergency, InventoryItem, Mission, Personnel, WeatherRecord
from .assets import maintenance_risk
from .prediction import survival_clock
from .risk_engine import compute_mission_risk


def daily_report(db, mission_id: int):
    mission = db.get(Mission, mission_id)
    if not mission:
        return None
    today = date.today().isoformat()

    persons = db.query(Personnel).filter(Personnel.mission_id == mission_id).count()
    active_persons = db.query(Personnel).filter(Personnel.mission_id == mission_id, Personnel.status == "active").count()
    cargo_total = db.query(Cargo).filter(Cargo.mission_id == mission_id).count()
    alerts = db.query(Alert).filter(Alert.mission_id == mission_id, Alert.status == "active").all()
    inventory = db.query(InventoryItem).filter(InventoryItem.mission_id == mission_id).all()
    assets = db.query(Asset).filter(Asset.mission_id == mission_id).all()
    emergencies = db.query(Emergency).filter(Emergency.mission_id == mission_id).order_by(Emergency.reported_at.desc()).limit(10).all()
    weather = db.query(WeatherRecord).filter(WeatherRecord.station_id == mission.station_id).order_by(WeatherRecord.recorded_at.desc()).first()
    clock = survival_clock(db, mission_id)
    risk = compute_mission_risk(db, mission)

    sections = [
        {"title": "Mission Overview", "text": (
            f"Mission {mission.mission_id} ({mission.name}) at {mission.destination}. "
            f"Status: {mission.status}. Progress: {mission.progress or 0}%. "
            f"Start {mission.start_date}, end {mission.end_date}."
        )},
        {"title": "Personnel", "text": f"{persons} personnel, {active_persons} active. Movement status aggregated."},
        {"title": "Cargo", "text": f"{cargo_total} cargo items tracked."},
        {"title": "Risk Assessment", "text": (
            f"Overall risk: {risk['level']} (score {risk['score']}). "
            " ".join(risk["reasons"][:3])
        )},
        {"title": "Resources", "text": (
            "Survival clock: " + ", ".join(f"{c['label']} {c['days_remaining']}d" for c in clock if c["days_remaining"] is not None)
        )},
    ]

    if alerts:
        sections.append({"title": "Active Alerts", "text": "\n".join(f"[{a.severity.upper()}] {a.title}: {a.message}" for a in alerts[:6])})
    else:
        sections.append({"title": "Active Alerts", "text": "No active alerts."})

    if weather:
        sections.append({"title": "Weather", "text": (
            f"Station: {mission.station.code if mission.station else 'N/A'} | "
            f"Temp {weather.temperature_c}C, wind {weather.wind_speed}km/h, "
            f"condition {weather.condition}, storm {'yes' if weather.storm else 'no'}."
        )})
    else:
        sections.append({"title": "Weather", "text": "No weather data."})

    risky_assets = [maintenance_risk(a) for a in assets if a.operational_status != "operational" or maintenance_risk(a)["status"] != "healthy"]
    if risky_assets:
        sections.append({"title": "Asset Condition", "text": "\n".join(f"{r['name']}: {r['status_label']}" for r in risky_assets[:5])})

    if emergencies:
        sections.append({"title": "Recent Emergencies", "text": "\n".join(
            f"{e.emergency_id}: {e.type} ({e.severity}) - {e.status}" for e in emergencies[:4])})

    recommendations = []
    if risk["level"] in ("HIGH", "CRITICAL"):
        recommendations.extend(risk["actions"][:3])
    short = [c for c in clock if c["days_remaining"] is not None and c["days_remaining"] < 10]
    if short:
        recommendations.append("Resource low: " + ", ".join(f"{c['label']} {c['days_remaining']}d" for c in short))
    if not recommendations:
        recommendations.append("Continue routine monitoring.")

    return {
        "date": today,
        "mission": {"id": mission.id, "code": mission.mission_id, "name": mission.name},
        "sections": sections,
        "recommendations": recommendations,
        "generated_by": "DHRUVA AI",
        "disclaimer": (
            "This report is AI-assisted and should be verified by the Expedition Commander."
        ),
    }


def report_csv_rows(report):
    rows = []
    rows.append(["Date", "Mission", "Status", "Risk"])
    rows.append([report["date"], report["mission"]["code"], "Generated", ""])
    rows.append([])
    rows.append(["Section", "Content"])
    for sec in report["sections"]:
        rows.append([sec["title"], sec["text"]])
    rows.append([])
    rows.append(["Recommendations"])
    for r in report["recommendations"]:
        rows.append([r])
    return rows


def report_to_pdf_bytes(report: dict) -> bytes:
    import io
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    elements = []
    elements.append(Paragraph(f"DHRUVA Mission Report – {report['mission']['code']} ({report['date']})", styles["Title"]))
    elements.append(Paragraph(report["mission"]["name"], styles["Heading2"]))
    elements.append(Spacer(1, 0.5 * cm))
    for sec in report["sections"]:
        elements.append(Paragraph(sec["title"], styles["Heading2"]))
        for line in sec["text"].split("\n"):
            elements.append(Paragraph(line, styles["BodyText"]))
        elements.append(Spacer(1, 0.3 * cm))
    elements.append(Paragraph("Recommendations", styles["Heading2"]))
    for rec in report["recommendations"]:
        elements.append(Paragraph(f"• {rec}", styles["BodyText"]))
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph(report.get("disclaimer", ""), styles["Italic"]))
    doc.build(elements)
    return buf.getvalue()