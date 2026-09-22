"""Predictive maintenance risk.

Uses asset runtime, maintenance interval and optional sensor data entries
(manually entered, from sensors, or from an API). Sensor claims are only ever
reported when the data is actually provided - never fabricated.
"""
from datetime import date

STATUS_LABELS = {
    "healthy": {"label": "Healthy", "class": "good"},
    "due": {"label": "Maintenance Due", "class": "warning"},
    "high": {"label": "High Risk", "class": "danger"},
    "critical": {"label": "Critical", "class": "critical"},
}


def maintenance_risk(asset):
    reasons = []
    runtime = asset.runtime_hours or 0
    interval = asset.maintenance_interval_hours or 0
    status = "healthy"

    if interval and runtime:
        ratio = runtime / interval
        if ratio >= 1.25:
            status = "critical"
            reasons.append(f"Runtime {runtime:.0f}h exceeds service interval by {((ratio-1)*100):.0f}%.")
        elif ratio >= 1.0:
            status = "high"
            reasons.append(f"Runtime {runtime:.0f}h passed {interval:.0f}h maintenance interval.")
        elif ratio >= 0.85:
            status = "due"
            reasons.append(f"Maintenance due soon (runtime {runtime:.0f}h of {interval:.0f}h interval).")
        else:
            reasons.append(f"Runtime {runtime:.0f}h with {interval:.0f}h maintenance interval - healthy.")

    if asset.condition and asset.condition.lower() in ("poor", "faulty", "needs repair"):
        if status == "healthy":
            status = "high"
        reasons.append(f"Reported condition: {asset.condition}.")

    if asset.next_maintenance:
        try:
            due = date.fromisoformat(asset.next_maintenance)
            days = (due - date.today()).days
            if days < 0:
                if status in ("healthy", "due"):
                    status = "high"
                reasons.append(f"Next scheduled maintenance ({due}) is already due.")
            elif days <= 3:
                if status == "healthy":
                    status = "due"
                reasons.append(f"Next maintenance due in {days} day(s).")
        except Exception:
            pass

    if asset.operational_status == "failed":
        status = "critical"
        reasons.append("Marked as failed/offline.")

    sensor = asset.sensor_data or {}
    if sensor:
        temp = sensor.get("temperature_c")
        if temp is not None:
            if temp > 65:
                reasons.append(f"Sensor temperature {temp}C above threshold - thermal stress risk.")
                if status == "healthy":
                    status = "high"
            else:
                reasons.append(f"Sensor temperature {temp}C within range.")
        vib = sensor.get("vibration")
        if vib is not None and vib > 1.2:
            reasons.append(f"High vibration level {vib} mm/s - bearing wear suspected.")
            if status == "healthy":
                status = "high"
        source = sensor.get("source", "manual")
        reasons.append(f"Sensor data source: {source}.")

    if not reasons:
        reasons.append("No runtime/maintenance thresholds reached yet.")

    return {
        "id": asset.id,
        "asset_id": asset.asset_id,
        "name": asset.name,
        "category": asset.category,
        "operational_status": asset.operational_status,
        "runtime_hours": runtime,
        "maintenance_interval_hours": interval,
        "next_maintenance": asset.next_maintenance,
        "status": status,
        "status_label": STATUS_LABELS[status]["label"],
        "reasons": reasons,
    }


def asset_status_ranges():
    return STATUS_LABELS