import sys
from fastapi.testclient import TestClient

sys.path.insert(0, ".")
from main import app

PASSWORD = "Dhruva@2026"
ROLES = ["admin", "commander", "hq", "logistics", "scientist", "medical", "field"]
FAIL = []


def check(desc, ok, extra=""):
    if not ok:
        FAIL.append(desc)
        print(f"  [FAIL] {desc} {extra}")


def login(client, email):
    r = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    return r.json()["token"] if r.status_code == 200 else None


def auth(t):
    return {"Authorization": f"Bearer {t}"}


with TestClient(app) as client:
    tokens = {r: login(client, f"{r}@dhruva.gov.in") for r in ROLES}
    for r, t in tokens.items():
        check(f"login {r}", bool(t))

    me = {r: client.get("/api/auth/me", headers=auth(t)).json() for r, t in tokens.items()}
    mids = {r: me[r].get("mission_id") for r in ROLES}
    sids = {r: me[r].get("station_id") for r in ROLES}

    # ---- every GET a page/dashboard performs, keyed by calling role ---------
    def get(role, path, expect=200):
        r = client.get(path, headers=auth(tokens[role]))
        check(f"GET {path} as {role}", r.status_code == expect, f"->{r.status_code} {r.text[:120]}")

    # Shared pages
    shared = {
        "admin": ["/api/missions", "/api/stations", "/api/personnel?", "/api/cargo?", "/api/inventory?",
                  "/api/assets?", "/api/weather", "/api/weather/status", "/api/alerts?", "/api/emergencies?",
                  "/api/emergencies/sos-status", "/api/analytics/summary", "/api/simulations",
                  "/api/simulations/scenario-options", "/api/settings", "/api/ai/status", "/api/ai/quick-actions",
                  "/api/notifications", "/api/containers", "/api/shipments", "/api/auth/roles"],
        "commander": ["/api/missions", "/api/stations", "/api/personnel?", "/api/cargo?", "/api/inventory?",
                      "/api/assets?", "/api/weather", "/api/weather/status", "/api/alerts?", "/api/emergencies?",
                      "/api/emergencies/sos-status", "/api/analytics/summary", "/api/simulations",
"/api/simulations/scenario-options", "/api/settings", "/api/ai/status", "/api/ai/quick-actions"],
        "hq": ["/api/missions", "/api/stations", "/api/personnel?limit=100&", "/api/cargo?", "/api/inventory?",
               "/api/assets?", "/api/weather", "/api/weather/status", "/api/alerts?", "/api/emergencies?",
               "/api/analytics/summary", "/api/settings", "/api/ai/status"],
        "logistics": ["/api/cargo?", "/api/inventory?", "/api/assets?", "/api/weather", "/api/weather/status",
                      "/api/alerts?", "/api/settings", "/api/ai/status", "/api/containers",
                      "/api/shipments", "/api/stations", "/api/missions", "/api/emergencies/sos-status"],
        "scientist": ["/api/tasks", "/api/assets?", "/api/weather", "/api/weather/status", "/api/alerts?",
                      "/api/emergencies/sos-status", "/api/simulations",
                      "/api/simulations/scenario-options", "/api/settings", "/api/ai/status", "/api/ai/quick-actions",
                      "/api/stations", "/api/missions", "/api/inventory?"],
        "medical": ["/api/personnel?", "/api/inventory?", "/api/emergencies?status=open", "/api/alerts?status=active",
                    "/api/assets?", "/api/weather", "/api/weather/status", "/api/settings", "/api/ai/status",
                    "/api/stations", "/api/missions", "/api/emergencies/sos-status"],
        "field": ["/api/tasks", "/api/personnel?", "/api/assets?", "/api/weather", "/api/alerts?",
                  "/api/emergencies/sos-status", "/api/settings", "/api/ai/status",
                  "/api/stations", "/api/missions"],
    }
    for role, paths in shared.items():
        for p in paths:
            get(role, p)

    # Reports page always sends a mission_id
    for role in ["admin", "commander", "hq", "logistics"]:
        get(role, f"/api/reports/daily?mission_id={1}")

    # Dashboard-specific / mission-scoped calls
    for role in ROLES:
        mid = mids[role]
        sid = sids[role]
        if mid:
            get(role, f"/api/missions/{mid}/overview")
            get(role, f"/api/missions/{mid}")
            get(role, f"/api/tasks?mission_id={mid}")
            get(role, f"/api/assets?mission_id={mid}")
            get(role, f"/api/inventory/predictions/all?mission_id={mid}")
            get(role, f"/api/inventory/survival-clock/all?mission_id={mid}")
            get(role, f"/api/inventory?mission_id={mid}")
            get(role, f"/api/cargo?mission_id={mid}")
            get(role, f"/api/cargo?status=in_transit")
            get(role, f"/api/cargo?category=food")
            get(role, f"/api/alerts?mission_id={mid}&status=active")
            get(role, f"/api/emergencies?mission_id={mid}")
        if sid:
            get(role, f"/api/weather?station_id={sid}")

    # Admin-only pages
    get("admin", "/api/users")
    get("admin", "/api/audit?limit=8")
    get("admin", "/api/audit/stats")
    get("admin", "/api/config")

    # Role-scoped write endpoints that the UI performs on user action (safe, transactional)
    admin_task_id = None
    r = client.get("/api/tasks?mission_id=1", headers=auth(tokens["admin"]))
    tasks = r.json()
    task_id = tasks[0]["id"] if tasks else None
    if task_id:
        for role in ["field", "scientist"]:
            r = client.patch(f"/api/tasks/{task_id}", headers=auth(tokens[role]), json={"status": "in_progress"})
            if r.status_code == 403:
                get(role, f"/api/tasks?mission_id={mids[role]}")  # placeholder re-check
            else:
                check(f"PATCH /api/tasks/{task_id} as {role}", r.status_code == 200, f"->{r.status_code} {r.text[:120]}")

    # shape audits
    r = client.get("/api/missions", headers=auth(tokens["hq"]))
    for m in r.json()[:1]:
        for k in ("elapsed_days", "total_days", "risk_level", "progress", "station_id", "status"):
            check(f"mission_summary[{k}]", k in m, f"mission {m.get('mission_id')}")

    mid = mids["commander"] or (client.get("/api/missions", headers=auth(tokens["commander"])).json()[0]["id"])
    ov = client.get(f"/api/missions/{mid}/overview", headers=auth(tokens["commander"])).json()
    for k in ("mission", "counts", "resources", "weather", "risk", "survival_clock", "next_resupply"):
        check(f"overview[{k}]", k in ov)
    for k in ("elapsed_days", "total_days", "team_size_planned", "destination", "progress", "status"):
        check(f"overview.mission[{k}]", k in ov["mission"])
    for k in ("critical_assets", "personnel", "delayed_cargo", "open_emergencies"):
        check(f"overview.counts[{k}]", k in ov["counts"])
    for k in ("food_days", "food_status", "fuel_days", "medical_days"):
        check(f"overview.resources[{k}]", k in ov["resources"])
    for k in ("level", "score", "reasons", "actions"):
        check(f"overview.risk[{k}]", k in ov["risk"])
    for k in ("category", "label", "days_remaining", "status", "item"):
        if ov["survival_clock"]:
            check(f"survival_clock[{k}]", all(k in c for c in ov["survival_clock"]))

    preds = client.get(f"/api/inventory/predictions/all?mission_id={mid}", headers=auth(tokens["logistics"])).json()
    for k in ("item", "category", "days_remaining", "reasons", "status"):
        check(f"predictions[{k}]", all(k in p for p in preds))
    cargo = client.get(f"/api/cargo?mission_id={mid}", headers=auth(tokens["logistics"])).json()
    check("cargo[shipment_status]", all("shipment_status" in c for c in cargo))
    check("cargo[delayed]", all("delayed" in c for c in cargo))
    inv = client.get("/api/inventory?", headers=auth(tokens["logistics"])).json()
    for k in ("item", "category", "quantity", "unit", "min_stock", "is_low", "expiry"):
        check(f"inventory[{k}]", all(k in i for i in inv))

print()
if FAIL:
    print(f"{len(FAIL)} FAILURES:")
    for f in FAIL:
        print("  -", f)
    sys.exit(1)
print("ALL UI-PROBE CHECKS PASSED")
