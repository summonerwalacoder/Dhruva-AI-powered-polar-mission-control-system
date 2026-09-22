from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..audit import audit
from ..database import get_db
from ..models import Mission, Simulation, User
from ..schemas import SimulationCreate
from ..security import get_current_user, require
from ..services.simulation import build_scenario_from_text, run_simulation, SCENARIO_FIELDS

router = APIRouter(prefix="/simulations", tags=["simulations"])


@router.get("")
def list_simulations(db: Session = Depends(get_db), user: User = Depends(require("simulate:use")), mission_id: int = None):
    q = db.query(Simulation)
    if mission_id:
        q = q.filter(Simulation.mission_id == mission_id)
    rows = q.order_by(Simulation.created_at.desc()).limit(100).all()
    return [_out(s) for s in rows]


@router.post("")
def create_simulation(body: SimulationCreate, db: Session = Depends(get_db), user: User = Depends(require("simulate:use"))):
    mission = db.get(Mission, body.mission_id)
    if not mission:
        raise HTTPException(404, "Mission not found.")
    scenario = body.scenario or build_scenario_from_text(body.name)
    sim = run_simulation(db, mission, scenario)
    sim["created_by"] = user.id
    audit(db, user, "create", "simulation", str(sim["id"]), new=scenario)
    return sim


@router.get("/scenario-options")
def scenario_options(user: User = Depends(get_current_user)):
    return {"fields": SCENARIO_FIELDS, "text_hints": [
        "resupply delayed by 10 days", "fuel consumption increases by 20%",
        "team size increases by 5", "generator fails",
        "vehicle becomes unavailable", "severe weather blocks route",
        "cargo lost", "communication outage"
    ]}


@router.get("/{simulation_id}")
def get_simulation(simulation_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.get(Simulation, simulation_id)
    if not s:
        raise HTTPException(404, "Simulation not found.")
    return _out(s)


def _out(s):
    return {col.name: getattr(s, col.name) for col in s.__table__.columns}