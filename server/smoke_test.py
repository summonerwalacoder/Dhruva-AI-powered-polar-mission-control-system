import os, sys
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("DATABASE_URL", "sqlite:///./data/test_check.db")

from fastapi.testclient import TestClient
from main import app


def report(label, resp):
    ok = resp.status_code < 400
    print(f"{'OK ' if ok else 'ERR'} [{resp.status_code}] {label}")
    if not ok:
        try:
            print("  ", resp.json())
        except Exception:
            print("  ", resp.text[:200])
    return resp


def exec_tests(client):
    r = client.get("/health")
    report("health", r)

    r = client.post("/api/auth/login", json={"email": "commander@dhruva.gov.in", "password": "Dhruva@2026"})
    report("login commander", r)
    tok = r.json()["token"]
    H = {"Authorization": f"Bearer {tok}"}

    r = client.get("/api/missions", headers=H)
    report("missions list", r)
    missions = r.json()
    print("  missions:", [(m["mission_id"], m["risk_level"], m["food_days"], m["fuel_days"]) for m in missions])

    mid = missions[0]["id"]
    r = client.get(f"/api/missions/{mid}/overview", headers=H)
    report("mission overview", r)

    r = client.get(f"/api/inventory/survival-clock/all?mission_id={mid}", headers=H)
    report("survival clock", r)
    try:
        print("  clock:", [{c['category']: c['days_remaining']} for c in r.json()])
    except UnicodeEncodeError:
        print("  clock: <ok>")

    r = client.get(f"/api/inventory/predictions/all?mission_id={mid}", headers=H)
    report("predictions", r)

    r = client.post("/api/ai/chat", headers=H, json={"message": "How much fuel do we have?", "mission_id": mid})
    report("ai chat fuel", r)
    try:
        print("  reply:", r.json().get("reply", "")[:200])
    except UnicodeEncodeError:
        print("  reply: <unicode ok>")

    r = client.post("/api/ai/chat", headers=H, json={"message": "What happens if resupply is delayed by 10 days?"})
    report("ai chat simulate", r)

    r = client.post("/api/emergencies/ai-interpret", headers=H, json={
        "mission_id": mid, "description": "Generator band ho gaya hai aur weather kharab ho raha hai."})
    report("emergency ai interpret", r)
    try:
        print("  ->", r.json())
    except UnicodeEncodeError:
        print("  -> <unicode ok>")

    r = client.post("/api/simulations", headers=H, json={"mission_id": mid, "scenario": {"resupply_delay_days": 10}})
    report("simulation run", r)

    r = client.post(f"/api/cargo/pack-plan?mission_id={mid}", headers=H)
    report("pack plan", r)

    r = client.get(f"/api/reports/daily?mission_id={mid}", headers=H)
    report("daily report", r)

    r = client.get(f"/api/analytics/summary?mission_id={mid}", headers=H)
    report("analytics", r)

    r = client.post("/api/auth/login", json={"email": "admin@dhruva.gov.in", "password": "Dhruva@2026"})
    report("login admin", r)
    AH = {"Authorization": f"Bearer {r.json()['token']}"}
    r = client.get("/api/users", headers=AH)
    report("users list (admin)", r)
    r = client.get("/api/audit", headers=AH)
    report("audit list (admin)", r)

    r = client.post("/api/auth/login", json={"email": "field@dhruva.gov.in", "password": "Dhruva@2026"})
    report("login field", r)
    FH = {"Authorization": f"Bearer {r.json()['token']}"}
    r = client.get("/api/users", headers=FH)
    report("field users list (should be 403)", r)
    r = client.get("/api/personnel", headers=FH)
    report("field personnel (masked)", r)
    print("  medical_notes hidden:", all("medical_notes" not in p or p["medical_notes"] == "" for p in r.json()))

    print("\nALL CHECKS DONE")


with TestClient(app) as client:
    exec_tests(client)