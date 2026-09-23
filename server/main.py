"""DHRUVA - AI-Powered Polar Mission Control – FastAPI entry point."""
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import parse_qsl, urlencode

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.seed import seed_all
from app.routers import (
    ai,
    alerts,
    analytics,
    assets,
    audit,
    auth,
    cargo,
    emergencies,
    inventory,
    missions,
    notifications,
    personnel,
    reports,
    settings as settings_module,
    simulations,
    stations,
    sync,
    users,
    weather,
)
from app.routers.personnel import tasks as tasks_router
from app.routers.cargo import containers as containers_router
from app.routers.cargo import shipments as shipments_router
from app.routers.settings import config_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_all(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "DHRUVA is an AI-powered Polar Mission Control platform that predicts "
        "mission risks, simulates future scenarios, assists expedition teams in "
        "multiple languages, and enables resilient emergency response even under "
        "unreliable connectivity."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def clean_query_params(request, call_next):
    """Strip empty / 'null' / 'undefined' query values (e.g. ?mission_id=)
    so FastAPI doesn't 422 on them. Any backend endpoint is covered."""
    raw = request.scope.get("query_string", b"")
    if raw:
        params = parse_qsl(raw.decode(), keep_blank_values=True)
        kept = [(k, v) for k, v in params if v not in ("", "null", "undefined")]
        if len(kept) != len(params):
            request.scope["query_string"] = urlencode(kept).encode()
    return await call_next(request)


# ---------- Auth & admin --------------------------------------------------
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")

# ---------- Core mission ---------------------------------------------------
app.include_router(missions.router, prefix="/api")
app.include_router(stations.router, prefix="/api")
app.include_router(personnel.router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(cargo.router, prefix="/api")
app.include_router(containers_router, prefix="/api")
app.include_router(shipments_router, prefix="/api")
app.include_router(inventory.router, prefix="/api")
app.include_router(assets.router, prefix="/api")

# ---------- Environment ----------------------------------------------------
app.include_router(weather.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(emergencies.router, prefix="/api")

# ---------- Intelligence ---------------------------------------------------
app.include_router(ai.router, prefix="/api")
app.include_router(simulations.router, prefix="/api")

# ---------- Analytics / reports --------------------------------------------
app.include_router(analytics.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

# ---------- Admin / sync ---------------------------------------------------
app.include_router(settings_module.router, prefix="/api")
app.include_router(config_router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(sync.router, prefix="/api")


# ---------- Health ----------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name, "version": settings.app_version}


# ---------- Static client (single-origin production serving) ---------------
# When a production build of the frontend exists (client/dist), the backend
# serves it same-origin so /api calls need no CORS and the PWA works on /. In
# local dev this block is skipped and Vite's dev server/proxy is used instead.
_DIST = Path(__file__).resolve().parent.parent / "client" / "dist"
if _DIST.is_dir():
    _ASSETS = _DIST / "assets"
    if _ASSETS.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_ASSETS)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/") or full_path == "health":
            raise HTTPException(404, "Not found")
        candidate = _DIST / full_path
        if full_path and candidate.is_file() and candidate.resolve().is_relative_to(_DIST.resolve()):
            return FileResponse(candidate)
        return FileResponse(_DIST / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

