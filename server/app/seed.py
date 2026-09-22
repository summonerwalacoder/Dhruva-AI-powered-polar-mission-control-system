"""Seed demo data for DHRUVA.

Runs only when the users table is empty, so it never overwrites real data.
All seeded records are realistic sample data and remain fully editable.
"""
from datetime import date, datetime, timedelta

from .models import (
    AIPrediction,
    Alert,
    Asset,
    Cargo,
    CargoMovement,
    Container,
    Emergency,
    InventoryItem,
    InventoryTransaction,
    Mission,
    Notification,
    Personnel,
    PersonnelMovement,
    Role,
    Simulation,
    Station,
    Task,
    User,
    WeatherRecord,
)
from .security import PERMISSIONS, hash_password

ROLE_LABELS = {
    "admin": "System Administrator",
    "commander": "Expedition Commander",
    "hq": "HQ / Government Official",
    "logistics": "Logistics Officer",
    "scientist": "Scientist / Researcher",
    "medical": "Medical Officer",
    "field": "Field Operator",
}

DEFAULT_PASSWORD = "Dhruva@2026"


def seed_all(db):
    if db.query(User).count() > 0:
        return

    # ---- Roles ------------------------------------------------------------
    for code, label in ROLE_LABELS.items():
        db.add(Role(code=code, name=label, description=f"{label} role for DHRUVA", permissions=PERMISSIONS[code]))

    # ---- Stations -----------------------------------------------------------
    maitri = Station(code="MAT", name="Maitri Station", type="station", region="Antarctica",
                     latitude=-70.767, longitude=11.727, elevation_m=117, country="India",
                     description="Maitri - Indian Antarctic research station (Schirmacher Oasis).")
    bharati = Station(code="BHR", name="Bharati Station", type="station", region="Antarctica",
                      latitude=-69.409, longitude=76.187, elevation_m=35, country="India",
                      description="Bharati - Indian Antarctic research station (Larsemann Hills).")
    himadri = Station(code="HIM", name="Himadri Station", type="station", region="Arctic / Svalbard",
                      latitude=78.925, longitude=11.936, elevation_m=15, country="India",
                      description="Himadri - Indian Arctic research station (Ny-Alesund, Svalbard).")
    camp1 = Station(code="FC-BHR-1", name="Field Camp Larsemann 1", type="field_camp", region="Antarctica",
                    latitude=-69.40, longitude=76.19, elevation_m=40, country="India",
                    description="Forward field camp near Bharati for traverse staging.")
    db.add_all([maitri, bharati, himadri, camp1])
    db.flush()

    # ---- Users ----------------------------------------------------------------
    def mk_user(email, name, role, mission=None, station=None):
        return User(email=email, name=name, password_hash=hash_password(DEFAULT_PASSWORD),
                    role=role, designation=ROLE_LABELS[role], mission_id=mission.id if mission else None,
                    station_id=station.id if station else None, language="en", active=True)

    admin = mk_user("admin@dhruva.gov.in", "Dr. Rana Verma", "admin")
    commander = mk_user("commander@dhruva.gov.in", "Cmdr. Aditi Rao", "commander")
    hq = mk_user("hq@dhruva.gov.in", "Sec. Mehul Desai", "hq")
    logistics = mk_user("logistics@dhruva.gov.in", "Lt. Sameer Khan", "logistics")
    scientist = mk_user("scientist@dhruva.gov.in", "Dr. Kavya Menon", "scientist")
    medical = mk_user("medical@dhruva.gov.in", "Dr. I. N. Sharma", "medical")
    field = mk_user("field@dhruva.gov.in", "Rohit Chauhan", "field")
    db.add_all([admin, commander, hq, logistics, scientist, medical, field])
    db.flush()

    # ---- Missions ----------------------------------------------------------------
    today = date.today()
    m1_start = today - timedelta(days=60)
    m1 = Mission(
        mission_id="EXP-2026-01", name="Bharati Winter Overwinter Expedition 2026",
        region="Antarctica", station_id=bharati.id, destination="Bharati Station",
        start_date=m1_start.isoformat(), end_date=(m1_start + timedelta(days=350)).isoformat(),
        duration_days=350, objective="Overwintering research: atmospheric, glaciological and marine observations; logistics validation for a permanent polar hub.",
        team_size=41, status="active", progress=17,
        emergency_contact="+91-11-2419-0000 (NCAOR HQ, Delhi)",
        planned_resupplies=[{"date": (today + timedelta(days=22)).isoformat(), "kind": "shipment"},
                            {"date": (today + timedelta(days=120)).isoformat(), "kind": "airdrop"}],
        route=[
            {"point": "Delhi", "lat": 28.61, "lng": 77.21, "lead_days": 5, "note": "HQ staging"},
            {"point": "Cape Town", "lat": -33.92, "lng": 18.42, "lead_days": 7, "note": "Transit port"},
            {"point": "Bharati Station", "lat": -69.409, "lng": 76.187, "lead_days": 3, "note": "Arrival terminal"},
        ],
    )
    m2 = Mission(
        mission_id="EXP-2026-02", name="Maitri Logistics & Research Rotation",
        region="Antarctica", station_id=maitri.id, destination="Maitri Station",
        start_date=(today - timedelta(days=120)).isoformat(), end_date=(today + timedelta(days=180)).isoformat(),
        duration_days=300, objective="Seasonal logistics rotation, geological sampling and upper-atmospheric research.",
        team_size=24, status="active", progress=40,
        emergency_contact="+91-11-2419-0000 (NCAOR HQ, Delhi)",
        planned_resupplies=[{"date": (today + timedelta(days=45)).isoformat(), "kind": "shipment"}],
        route=[{"point": "Delhi", "lat": 28.61, "lng": 77.21, "lead_days": 5, "note": "HQ"},
               {"point": "Maitri", "lat": -70.767, "lng": 11.727, "lead_days": 4, "note": "Arrival"}],
    )
    m3 = Mission(
        mission_id="EXP-2026-03", name="Himadri Arctic Atmosphere Campaign",
        region="Arctic", station_id=himadri.id, destination="Himadri Station, Ny-Alesund",
        start_date=(today + timedelta(days=90)).isoformat(), end_date=(today + timedelta(days=190)).isoformat(),
        duration_days=100, objective="Atmospheric trace gas and aerosol measurements above 78 degrees North.",
        team_size=12, status="planned", progress=0,
        emergency_contact="+91-11-2419-0000 (NCAOR HQ, Delhi)",
        planned_resupplies=[{"date": (today + timedelta(days=140)).isoformat(), "kind": "shipment"}],
        route=[{"point": "Delhi", "lat": 28.61, "lng": 77.21, "lead_days": 5, "note": "HQ"},
               {"point": "Oslo", "lat": 59.91, "lng": 10.75, "lead_days": 4, "note": "Transit"},
               {"point": "Ny-Alesund", "lat": 78.925, "lng": 11.936, "lead_days": 3, "note": "Arrival"}],
    )
    db.add_all([m1, m2, m3])
    db.flush()

    # ---- Personnel ---------------------------------------------------------------
    def mk_personnel(pid, name, role, team, mission, station, status="active", movement="station",
                     lat=None, lng=None, health="fit", notes="", assignment="", contact="--"):
        return Personnel(
            personnel_id=pid, name=name, role=role, team=team,
            mission_id=mission.id if mission else None,
            station_id=station.id if station else None,
            current_location=station.name if station else "",
            movement_status=movement,
            contact=contact + " (sat)", emergency_contact="NCAOR HQ +91-11-2419-0000",
            training_status="certified", assignment=assignment,
            last_known_lat=lat, last_known_lng=lng, status=status,
            health_status=health, medical_notes=notes,
        )

    p1 = mk_personnel("P-BHR-001", "Cmdr. Aditi Rao", "Expedition Commander", "Command", m1, bharati,
                      lat=-69.409, lng=76.187, assignment="Overall mission command")
    p2 = mk_personnel("P-BHR-002", "Dr. I. N. Sharma", "Medical Officer", "Support", m1, bharati,
                      lat=-69.409, lng=76.187, assignment="Health & cold-injury response lead")
    p3 = mk_personnel("P-BHR-003", "K. Ramakrishnan", "Station Leader", "Operations", m1, bharati,
                      lat=-69.409, lng=76.187, assignment="Station operations")
    p4 = mk_personnel("P-BHR-004", "Rohit Chauhan", "Field Operator", "Traverse", m1, bharati,
                      movement="field_camp", lat=-69.40, lng=76.19, assignment="Field camp maintenance & traverse")
    p5 = mk_personnel("P-BHR-005", "Nadia Fernandes", "Scientist", "Atmospheric", m1, bharati,
                      lat=-69.409, lng=76.187, assignment="Atmospheric sampling")
    p6 = mk_personnel("P-BHR-006", "Ishaan Gupta", "Mechanic", "Operations", m1, bharati,
                      lat=-69.409, lng=76.187, assignment="Fleet maintenance", health="ok",
                      notes="Requires follow-up on mild frostbite - monitor hands.")
    p7 = mk_personnel("P-BHR-007", "Arun Pillai", "Logistics Officer", "Logistics", m1, bharati,
                      lat=-69.409, lng=76.187, assignment="Cargo & resupply coordination")
    p8 = mk_personnel("P-BHR-008", "Meera Das", "Field Operator", "Science Support", m1, camp1,
                      movement="transit", lat=-69.42, lng=76.21, assignment="Camp resupply shuttle")
    p9 = mk_personnel("P-MAI-001", "S. Krishnamurthy", "Station Leader", "Operations", m2, maitri,
                      lat=-70.767, lng=11.727, assignment="Maitri operations")
    p10 = mk_personnel("P-MAI-002", "Anjali Rao", "Scientist", "Glaciology", m2, maitri,
                       lat=-70.767, lng=11.727, assignment="Ice core sampling")
    p11 = mk_personnel("P-HIM-001", "Devika Nair", "Scientist", "Atmospheric", m3, himadri,
                       assignment="Campaign science lead")
    p12 = mk_personnel("P-POOL-01", "Vikram Sethi", "Field Operator", "Pool", None, bharati,
                       assignment="On-call traverse support")
    db.add_all([p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12])
    db.flush()

    m1.commander_id = p1.id
    m2.commander_id = p9.id

    # Personnel movement history
    db.add_all([
        PersonnelMovement(personnel_id=p4.id, from_status="station", to_status="field_camp",
                          location="Field Camp Larsemann 1", latitude=-69.40, longitude=76.19,
                          timestamp=datetime.utcnow() - timedelta(days=4), note="Deployed to field camp."),
        PersonnelMovement(personnel_id=p8.id, from_status="station", to_status="transit",
                          location="Between Bharati and FC-1", latitude=-69.42, longitude=76.21,
                          timestamp=datetime.utcnow() - timedelta(hours=9), note="Shuttle run en route."),
    ])

    # ---- Cargo --------------------------------------------------------------
    def mk_cargo(cid, name, cat, qty, weight, status, eta, priority="normal", fragile=False,
                 temp=False, container="", dest="Bharati Station", mission=m1, handler="Trans-Ice Logistics",
                 origin="Goa Port"):
        return Cargo(cargo_id=f"CG-{cid}", item_name=name, category=cat, quantity=qty,
                     weight_kg=weight, dimensions="120x100x90 cm", priority=priority,
                     origin=origin, destination=dest, container_id=container,
                     shipment_status=status, expected_arrival=eta, handler=handler,
                     fragile=fragile, temp_sensitive=temp, mission_id=mission.id,
                     qr_code=f"DHU-CG-{cid}-QR",
                     notes="")

    db.add_all([
        Container(container_id="CNT-01", capacity_kg=8000, used_kg=3200, location="Bharati wharf", status="packing", mission_id=m1.id),
        Container(container_id="CNT-02", capacity_kg=8000, used_kg=8100, location="In transit", status="in_transit", mission_id=m1.id),
        Container(container_id="CNT-03", capacity_kg=5000, used_kg=500, location="Bharati cold store", status="arrived", mission_id=m1.id),
        Container(container_id="CNT-M1", capacity_kg=10000, used_kg=6000, location="Maitri yard", status="arrived", mission_id=m2.id),
    ])

    cargo = [
        mk_cargo("C001", "Annexed food rations container", "food", 120, 2800, "transit", (today + timedelta(days=30)).isoformat(), priority="high"),
        mk_cargo("C002", "Diesel fuel drums - pack of 24", "fuel", 24, 1920, "container_assigned", (today + timedelta(days=60)).isoformat(), priority="critical", container="CNT-01"),
        mk_cargo("C003", "Medical cold-chain supplies", "medical", 40, 480, "packing", (today + timedelta(days=25)).isoformat(), priority="critical", temp=True, fragile=True),
        mk_cargo("C004", "Snow vehicle spares kit", "spares", 8, 640, "manifest", (today + timedelta(days=20)).isoformat()),
        mk_cargo("C005", "Remote atmospheric sensors (10 units)", "scientific", 10, 120, "transport", (today + timedelta(days=12)).isoformat(), priority="high", fragile=True, temp=True),
        mk_cargo("C006", "Emergency shelters / bivvy packs", "emergency", 25, 220, "requirement", "", priority="high", dest="Maitri Station", mission=m2),
        mk_cargo("C007", "Generator spare alternators", "spares", 4, 300, "transit", (today - timedelta(days=6)).isoformat(), priority="high"),  # delayed
        mk_cargo("C008", "Jet fuel (helicopter ops) - 2000L", "fuel", 2000, 1600, "manifest", (today + timedelta(days=28)).isoformat()),
        mk_cargo("C009", "Freeze-dried meal trays", "food", 400, 560, "inventory", (today - timedelta(days=20)).isoformat()),
        mk_cargo("C010", "Communication relay kit", "comms", 3, 90, "transit", (today - timedelta(days=3)).isoformat(), priority="high", fragile=True),
        mk_cargo("C011", "Lab reagent shipment", "scientific", 30, 210, "approval", (today + timedelta(days=15)).isoformat(), temp=True),
        mk_cargo("C012", "Water purification spares", "spares", 15, 160, "transport", (today + timedelta(days=8)).isoformat()),
    ]
    db.add_all(cargo)
    db.flush()
    for c in cargo:
        db.add(CargoMovement(cargo_id=c.id, status=c.shipment_status, location=c.origin, note="Status on record."))

    # ---- Inventory ---------------------------------------------------------------
    def mk_inv(item, cat, qty, unit, rate, reorder, crit, loc="Bharati cold store", expiry=None, officer="A. Pillai", mission=m1):
        return InventoryItem(item=item, category=cat, quantity=qty, unit=unit, location=loc,
                             batch=f"B{abs(hash(item)) % 9000 + 1000}", expiry=expiry or "",
                             consumption_rate=rate, reorder_level=reorder, criticality=crit,
                             responsible_officer=officer, mission_id=mission.id, station_id=bharati.id)

    inv_m1 = [
        mk_inv("Ration food (dry)", "food", 1200, "kg", 34, 400, "critical"),
        mk_inv("Drinking water (melted)", "water", 900, "L", 120, 350, "critical"),
        mk_inv("Diesel (heating/genset)", "fuel", 4200, "L", 280, 1000, "critical", "Fuel farm"),
        mk_inv("Aviation fuel", "fuel", 1600, "L", 0, 500, "high", "Fuel farm"),
        mk_inv("First-aid kits", "medical", 28, "kit", 0.4, 8, "critical", "Sick bay", expiry=(today + timedelta(days=70)).isoformat()),
        mk_inv("Cold-injury medication", "medical", 62, "dose", 1.1, 20, "critical", "Sick bay", expiry=(today + timedelta(days=120)).isoformat()),
        mk_inv("Oxygen cylinders", "medical", 9, "cyl", 0.0, 4, "high"),
        mk_inv("Spare belts (snow mobiles)", "spares", 12, "unit", 0.1, 4, "medium"),
        mk_inv("Generator filters", "spares", 18, "unit", 0.2, 6, "medium"),
        mk_inv("Ice-core drill bits", "scientific", 6, "unit", 0.05, 2, "medium", "Lab"),
        mk_inv("Sampling bottles (Niskin)", "scientific", 40, "unit", 0.3, 10, "medium", "Lab"),
        mk_inv("Emergency rations", "emergency", 45, "pack", 0.2, 15, "critical"),
        mk_inv("Survival suits", "emergency", 38, "set", 0.0, 10, "high"),
        mk_inv("Cleaning consumables", "consumable", 80, "unit", 2.0, 25, "low"),
    ]

    inv_m2 = [
        mk_inv("Maitri ration food", "food", 800, "kg", 22, 250, "critical", "Maitri store", mission=m2),
        mk_inv("Maitri diesel", "fuel", 2600, "L", 180, 800, "critical", "Maitri fuel farm", mission=m2),
        mk_inv("Maitri med kit", "medical", 22, "kit", 0.3, 6, "critical", "Maitri sick bay", mission=m2),
    ]
    inv_m3 = [
        mk_inv("Himadri rations (planned)", "food", 500, "kg", 6, 150, "medium", "NYA store", mission=m3),
        mk_inv("Himadri instrument spares", "spares", 25, "unit", 0.2, 8, "medium", "NYA lab", mission=m3),
    ]
    db.add_all(inv_m1 + inv_m2 + inv_m3)
    db.flush()

    # transaction history for ML consumption (past ~25 days)
    rng = __import__("random").Random(42)
    for item, qty_used in [
        ("Ration food (dry)", 34), ("Drinking water (melted)", 120),
        ("Diesel (heating/genset)", 280), ("Cold-injury medication", 1.1),
        ("First-aid kits", 0.4), ("Emergency rations", 0.2),
    ]:
        inv = next(i for i in inv_m1 if i.item == item)
        for days_back in range(3, 26):
            jitter = 0.85 + (rng.random() * 0.3)
            change = -round(qty_used * jitter if item != "Cold-injury medication" else qty_used, 1)
            db.add(InventoryTransaction(inventory_id=inv.id, change=change, unit=inv.unit, type="out",
                                        note="daily consumption", timestamp=datetime.utcnow() - timedelta(days=days_back)))

    # ---- Assets --------------------------------------------------------------------
    def mk_asset(aid, name, cat, loc, runtime, interval, next_maint, status="operational", condition="good", person="", sensor=None, mission=m1):
        last_m = (date.today() - timedelta(days=max(1, int(runtime / max(interval, 1) * 60)))).isoformat()
        return Asset(asset_id=f"A-{aid}", name=name, category=cat, location=loc,
                     condition=condition, runtime_hours=runtime, last_maintenance=last_m,
                     next_maintenance=next_maint, maintenance_interval_hours=interval,
                     assigned_person=person, operational_status=status, sensor_data=sensor, mission_id=mission.id)

    assets = [
        mk_asset("SC01", "Häg TV-100 Snow Vehicle", "snow_vehicle", "Bharati garage", 340, 300, (today - timedelta(days=4)).isoformat(), status="operational", person="I. Gupta", sensor={"temperature_c": 42, "vibration": 0.6, "source": "manual entry"}, ),
        mk_asset("SC02", "Kässbohrer PistenBully", "snow_vehicle", "Bharati garage", 480, 400, (date.today() + timedelta(days=40)).isoformat(), condition="good", person="I. Gupta", sensor=None),
        mk_asset("GEN1", "Cummins 100kVA Generator", "generator", "Power house", 1450, 800, (today - timedelta(days=2)).isoformat(), status="offline", condition="needs repair", person="I. Gupta",
                 sensor={"temperature_c": 88, "vibration": 2.4, "source": "manual entry"}),
        mk_asset("GEN2", "Backup Generator (standby)", "generator", "Power house", 610, 800, (today + timedelta(days=90)).isoformat()),
        mk_asset("CR1", "Diesel Snow Crane 5T", "crane", "Wharf area", 220, 500, (today + timedelta(days=60)).isoformat()),
        mk_asset("CM1", "VHF/Satcom Relay Tower", "communication", "Comms shack", 4000, 2000, (today + timedelta(days=150)).isoformat(), person="Comms team"),
        mk_asset("HT1", "Station Heating Module A", "heating", "Hab 1", 2600, 1500, (today + timedelta(days=30)).isoformat()),
        mk_asset("PW1", "Solar Array 40kW", "power", "Solar field", 500, 8760, (today + timedelta(days=300)).isoformat()),
        mk_asset("EQ1", "Ice coring rig", "scientific_equipment", "Lab annex", 90, 600, (today + timedelta(days=200)).isoformat()),
        mk_asset("EM1", "Emergency rescue sledge", "emergency_equipment", "Garage bay", 0, 0, (today + timedelta(days=365)).isoformat(), person="R. Chauhan"),
    ]
    db.add_all(assets)
    db.flush()

    # ---- Weather (simulated entries - clearly labelled) -----------------------------------
    db.add_all([
        WeatherRecord(station_id=bharati.id, source="simulated", source_label="Simulated (live API not configured)",
                      temperature_c=-31.5, wind_speed=34, wind_direction="SE", visibility_km=0.8,
                      condition="Blowing snow / blizzard warning", snow=12, storm=True,
                      ice_route_condition="closed", humidity=82,
                      forecast_alerts=[{"text": "Blizzard expected for 36h"}],
                      recorded_at=datetime.utcnow() - timedelta(hours=2)),
        WeatherRecord(station_id=bharati.id, source="simulated", source_label="Simulated (live API not configured)",
                      temperature_c=-26.2, wind_speed=22, wind_direction="SE", visibility_km=4.5,
                      condition="Overcast, light snow", snow=4, storm=False,
                      ice_route_condition="unstable", humidity=74,
                      recorded_at=datetime.utcnow() - timedelta(days=2)),
        WeatherRecord(station_id=maitri.id, source="simulated", source_label="Simulated (live API not configured)",
                      temperature_c=-18.9, wind_speed=14, wind_direction="E", visibility_km=12,
                      condition="Clear, partly cloudy", snow=0, storm=False,
                      ice_route_condition="open", humidity=60,
                      recorded_at=datetime.utcnow() - timedelta(hours=5)),
        WeatherRecord(station_id=himadri.id, source="simulated", source_label="Simulated (live API not configured)",
                      temperature_c=-9.4, wind_speed=10, wind_direction="N", visibility_km=20,
                      condition="Clear sky", snow=0, storm=False,
                      ice_route_condition="open", humidity=55,
                      recorded_at=datetime.utcnow() - timedelta(days=1)),
    ])

    # ---- Alerts --------------------------------------------------------------------
    db.add_all([
        Alert(mission_id=m1.id, type="fuel_low", severity="high", title="Diesel consumption above plan",
              message="Current diesel usage is above the forecast curve; survival clock at ~15 days vs 22 days to resupply.",
              entity_type="inventory", entity_id="fuel", status="active", source="system"),
        Alert(mission_id=m1.id, type="cargo_delay", severity="high", title="Cargo delayed in transit",
              message="CG-C007 (generator alternators) and CG-C010 (comm relay kit) are past expected arrival.",
              entity_type="cargo", entity_id="CG-C007", status="active", source="system"),
        Alert(mission_id=m1.id, type="asset_maintenance", severity="high", title="Generator GEN1 offline",
              message="Primary generator shows overheating sensors and is offline. Switch to backup and schedule repair.",
              entity_type="asset", entity_id="A-GEN1", status="active", source="system"),
        Alert(mission_id=m1.id, type="severe_weather", severity="critical", title="Blizzard warning 36h",
              message="Blowing snow with near-zero visibility; route status CLOSED. Cancel all outdoor movement.",
              entity_type="weather", entity_id="BHR", status="active", source="system"),
        Alert(mission_id=m2.id, type="resupply_planning", severity="medium", title="Resupply window closing",
              message="Maitri resupply scheduled in 45 days; review manifests to avoid delay.", status="active", source="system"),
        Alert(mission_id=m1.id, type="medical", severity="medium", title="Frostbite follow-up",
              message="P-BHR-006 (Ishaan Gupta) has a mild frostbite follow-up due this week.", entity_type="personnel", entity_id="P-BHR-006", status="active", source="medical"),
    ])

    # ---- Emergency (open - ties into demo) ------------------------------------------------
    db.add_all([
        Emergency(emergency_id="EMR-PRIME001", mission_id=m1.id, reporter_id=field.id,
                  type="generator_failure", severity="serious",
                  location="Bharati power house", latitude=-69.409, longitude=76.187,
                  description="Main generator high temp alarm and shutdown; weather is deteriorating outside.",
                  recommended_response="Switch to backup generator, restrict non-critical load, keep comms on satellite.",
                  status="in_progress", hq_notification="sent", connectivity_status="online",
                  reported_at=datetime.utcnow() - timedelta(hours=1)),
        Emergency(emergency_id="EMR-MAT-R1", mission_id=m2.id, reporter_id=None,
                  type="vehicle_failure", severity="warning", location="Maitri dock",
                  description="Skidoo battery dead during dock run; no injuries.",
                  recommended_response="Replace battery from spares; log for morning inspection.",
                  status="resolved", hq_notification="confirmed", connectivity_status="online",
                  reported_at=datetime.utcnow() - timedelta(days=3),
                  resolved_at=datetime.utcnow() - timedelta(days=3, hours=-2)),
    ])

    # ---- Tasks --------------------------------------------------------------------------------
    db.add_all([
        Task(mission_id=m1.id, personnel_id=p4.id, title="Verify field camp shelter integrity",
             description="Post-storm inspection of FC-L1 tents and guidance lines.", status="open",
             priority="high", due_date=(today + timedelta(days=1)).isoformat(), assigned_by=commander.id),
        Task(mission_id=m1.id, personnel_id=p6.id, title="Generator GEN1 diagnostic",
             description="Thermal scan and alternator check on primary generator.", status="open",
             priority="critical", due_date=today.isoformat(), assigned_by=commander.id),
        Task(mission_id=m1.id, personnel_id=p5.id, title="Download morning radiosonde",
             description="Retrieve and archive radiosonde burst data.", status="in_progress",
             priority="normal", due_date=today.isoformat(), assigned_by=scientist.id),
    ])

    # ---- Simulations (history) -----------------------------------------------------------------
    db.add_all([
        Simulation(mission_id=m1.id, name="Resupply +10d scenario",
                   scenario={"resupply_delay_days": 10}, baseline={"risk": "MODERATE"},
                   result={"risk": "HIGH", "notes": "Food&fuel deplete close to depletion line."},
                   risk_before="MODERATE", risk_after="HIGH", created_by=commander.id),
    ])

    # ---- AI predictions + feedback loop -------------------------------------------------------
    db.add_all([
        AIPrediction(mission_id=m1.id, category="fuel", label="Diesel availability",
                     predicted_days=18, predicted_date=(today + timedelta(days=18)).isoformat(),
                     actual_days=19, actual_date=(today + timedelta(days=19)).isoformat(),
                     error_days=1, model="rule+ml", resolved=True,
                     params={"consumption_rate": 280}, features={"weather_factor": 1.06},
                     reasons=["Weather adjustment for storms.", "Resupply 22 days out."]),
        AIPrediction(mission_id=m1.id, category="food", label="Ration food availability",
                     predicted_days=35, predicted_date="", actual_days=34, actual_date="",
                     error_days=-1, model="ml-linear", resolved=True,
                     features={"history_points": 23}),
        AIPrediction(mission_id=m1.id, category="medical", label="First-aid kit availability",
                     predicted_days=70, predicted_date="", actual_days=None, actual_date="",
                     error_days=None, model="rule", resolved=False,
                     reasons=["Consumption 0.4 kit/day."]),
    ])

    # ---- Notifications ------------------------------------------------------------------------
    db.add_all([
        Notification(user_id=None, mission_id=m1.id, title="Blizzard warning in effect",
                     body="Blizzard expected for 36h. All outdoor movement cancelled.", type="weather", channel="inapp"),
        Notification(user_id=commander.id, mission_id=m1.id, title="GEN1 offline",
                     body="Primary generator offline; backup engaged.", type="asset", channel="inapp"),
    ])

    db.commit()