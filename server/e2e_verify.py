import sys
from fastapi.testclient import TestClient

sys.path.insert(0, ".")
from main import app

PASSWORD = "Dhruva@2026"
ROLES = ["admin", "commander", "hq", "logistics", "scientist", "medical", "field"]
FAIL = []


def check(desc, ok, extra=""):
    mark = "PASS" if ok else "FAIL"
    print(f"  [{mark}] {desc} {extra}")
    if not ok:
        FAIL.append(desc)


def login(client, email):
    r = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    if r.status_code != 200:
        return None
    return r.json()["token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


with TestClient(app) as client:
    tokens = {r: login(client, f"{r}@dhruva.gov.in") for r in ROLES}
    for r, t in tokens.items():
        check(f"login {r}", bool(t), "MISSING" if not t else "")

    A = tokens["admin"]

    for r, t in tokens.items():
        r_ = client.get("/api/tasks", headers=auth(t))
        check(f"/api/tasks as {r}", r_.status_code == 200)
        r_ = client.get("/api/weather", headers=auth(t))
        check(f"/api/weather as {r}", r_.status_code == 200)

    r_ = client.get("/api/containers", headers=auth(tokens["logistics"]))
    check("/api/containers logistics", r_.status_code == 200, f"->{r_.status_code}")
    r_ = client.get("/api/shipments", headers=auth(tokens["logistics"]))
    check("/api/shipments logistics", r_.status_code == 200, f"->{r_.status_code}")
    r_ = client.get("/api/cargo", headers=auth(tokens["logistics"]))
    check("/api/cargo logistics", r_.status_code == 200, f"->{r_.status_code}")

    r_ = client.get("/api/config", headers=auth(A))
    check("/api/config admin", r_.status_code == 200, f"->{r_.status_code}")
    r_ = client.get("/api/config", headers=auth(tokens["logistics"]))
    check("/api/config denied for logistics", r_.status_code == 403, f"->{r_.status_code}")

    r_ = client.get("/api/personnel", headers=auth(tokens["field"]))
    check("/api/personnel field", r_.status_code == 200, f"->{r_.status_code}")
    r_ = client.get("/api/personnel", headers=auth(tokens["medical"]))
    check("/api/personnel medical", r_.status_code == 200, f"->{r_.status_code}")

    mids = [m["id"] for m in client.get("/api/missions", headers=auth(A)).json()]
    for m in mids:
        for ep in ("/api/inventory/survival-clock/all", "/api/inventory/predictions/all"):
            r_ = client.get(f"{ep}?mission_id={m}", headers=auth(tokens["logistics"]))
            check(f"{ep} m{m}", r_.status_code == 200, f"->{r_.status_code}")

    r_ = client.post("/api/ai/chat", headers=auth(tokens["commander"]), json={"mission_id": mids[0] if mids else None, "message": "Brief the mission"})
    check("/api/ai/chat commander", r_.status_code == 200 and "reply" in r_.json(), f"->{r_.status_code} {list(r_.json())[:3] if r_.status_code == 200 else r_.text[:120]}")

    r_ = client.get("/api/audit", headers=auth(A))
    check("/api/audit admin", r_.status_code == 200, f"->{r_.status_code}")
    r_ = client.get("/api/audit", headers=auth(tokens["field"]))
    check("/api/audit denied for field", r_.status_code == 403, f"->{r_.status_code}")

    r_ = client.get("/api/settings", headers=auth(tokens["field"]))
    check("/api/settings field", r_.status_code == 200, f"->{r_.status_code}")

print()
if FAIL:
    print(f"{len(FAIL)} FAILURES:")
    for f in FAIL:
        print("  -", f)
    sys.exit(1)
print("ALL CHECKS PASSED")