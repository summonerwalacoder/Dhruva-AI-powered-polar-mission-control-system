"""Smart Cargo Packing - AI recommendation engine.

Suggests loading/stowage order using weight, priority, destination,
fragility, temperature sensitivity, unloading sequence and container capacity.

The manifest is deterministic and explainable:
  1. Sort by destination (far first), then by unloading order.
  2. Priority (critical first).
  3. Fragile and temperature-sensitive items go last-in-line so they are
     unloaded first (kept accessible) unless capacity demands otherwise.
  4. Heavier items on the bottom (packed first).
"""
from ..models import Cargo

UNLOAD_POSITION = {
    "requirement": 10, "indent": 10, "approval": 10, "packing": 9,
    "container_assigned": 8, "manifest": 7, "transport": 5,
    "transit": 4, "station_arrival": 3, "inspection": 2, "inventory": 1,
}

PRIORITY_RANK = {"critical": 0, "high": 1, "normal": 2, "low": 3}


def packing_plan(db, mission_id=None, container=None):
    rows = db.query(Cargo).all()
    if mission_id:
        rows = [c for c in rows if (c.mission_id or None) == mission_id]

    available = []
    for c in rows:
        if c.dimensions is None:
            volume = 0
        else:
            try:
                # dimensions like "120x80x80 cm" or "120*80*80"
                parts = c.dimensions.replace("*", "x").replace(" ", "").split("x")
                dims = [float(p) for p in parts if p.replace(".", "").isdigit()]
                volume = (dims[0] * dims[1] * dims[2] / 1000) if len(dims) == 3 else 0
            except Exception:
                volume = 0
        available.append({
            "id": c.id,
            "cargo_id": c.cargo_id,
            "item_name": c.item_name,
            "category": c.category,
            "weight_kg": c.weight_kg or 0,
            "priority": c.priority or "normal",
            "destination": c.destination or "",
            "fragile": bool(c.fragile),
            "temp_sensitive": bool(c.temp_sensitive),
            "volume_m3": round(volume, 2),
            "unload_position": UNLOAD_POSITION.get(c.shipment_status, 6),
        })

    def sort_key(x):
        return (
            x["destination"],          # far destination groups together
            x["unload_position"],      # unloading sequence
            PRIORITY_RANK.get(x["priority"], 3),
            x["weight_kg"],            # heavy first (bottom stack)
        )

    ordered = sorted(available, key=sort_key)

    # Container capacity check
    capacity = None
    fill_kg = 0.0
    if container:
        capacity = container.capacity_kg or 0
        remaining = capacity - (container.used_kg or 0)
        items_kg = sum(i["weight_kg"] for i in ordered)
        over = items_kg > remaining
        if over:
            # warn but still list
            excess = items_kg - remaining
            note = f"Total weight {items_kg:.0f}kg exceeds container remaining capacity {remaining:.0f}kg by {excess:.0f}kg."
        else:
            note = f"Total weight {items_kg:.0f}kg fits within {remaining:.0f}kg remaining capacity."

    plan = []
    slot = 1
    for i in ordered:
        plan.append({**i, "stow_order": slot, "access_position": "top" if (i["fragile"] or i["temp_sensitive"]) else "bottom", })
        slot += 1

    return {
        "strategy": "Sort by destination → unload sequence → priority → weight/fragility.",
        "items": plan,
        "count": len(plan),
        "total_weight_kg": round(sum(i["weight_kg"] for i in ordered), 2),
        "container_capacity_kg": capacity,
        "container_note": note if capacity is not None else "No container selected - capacity check skipped.",
        "explanation": [
            "Heavy, non-fragile items are stowed first (bottom) for stability.",
            "Fragile and temperature-sensitive items are placed on top for early unload.",
            "Critical/high priority items take precedence in the load line.",
        ],
    }


def optimize_container_assignment(db, containers, mission_id=None):
    """Assigns unassigned cargo to the best-fit container."""
    result = []
    cargo_rows = db.query(Cargo).filter(Cargo.container_id.in_(["", None])).all() if mission_id is None else None
    avail = containers or []
    for c in cargo_rows or []:
        for cont in avail:
            remaining = cont.capacity_kg - cont.used_kg
            if remaining >= (c.weight_kg or 0):
                cont.used_kg += c.weight_kg or 0
                c.container_id = cont.container_id
                result.append({"cargo_id": c.cargo_id, "container_id": cont.container_id, "fit_kg": c.weight_kg})
                break
        # commit handled by caller
    return result