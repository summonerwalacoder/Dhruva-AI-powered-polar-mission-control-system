from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


def utcnow():
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True)
    code = Column(String(40), unique=True, index=True)
    name = Column(String(120))
    description = Column(Text, default="")
    permissions = Column(JSON, default=list)


class User(TimestampMixin, Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, index=True)
    name = Column(String(160))
    password_hash = Column(String(255))
    role = Column(String(40), index=True)
    designation = Column(String(160), default="")
    phone = Column(String(40), default="")
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=True)
    language = Column(String(8), default="en")
    active = Column(Boolean, default=True)


class Station(TimestampMixin, Base):
    __tablename__ = "stations"
    id = Column(Integer, primary_key=True)
    code = Column(String(24), unique=True, index=True)
    name = Column(String(160))
    type = Column(String(40), default="station")  # station | field_camp | base
    region = Column(String(120), default="")
    latitude = Column(Float, default=0)
    longitude = Column(Float, default=0)
    elevation_m = Column(Float, default=0)
    country = Column(String(80), default="India")
    description = Column(Text, default="")
    active = Column(Boolean, default=True)


class Mission(TimestampMixin, Base):
    __tablename__ = "missions"
    id = Column(Integer, primary_key=True)
    mission_id = Column(String(40), unique=True, index=True)
    name = Column(String(200))
    region = Column(String(120))
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)
    destination = Column(String(160), default="")
    start_date = Column(String(20), default="")
    end_date = Column(String(20), default="")
    duration_days = Column(Integer, default=0)
    objective = Column(Text, default="")
    team_size = Column(Integer, default=0)
    route = Column(JSON, default=list)
    status = Column(String(30), default="planned")  # planned | active | completed | paused | aborted
    commander_id = Column(Integer, ForeignKey("personnel.id"), nullable=True)
    emergency_contact = Column(String(200), default="")
    planned_resupplies = Column(JSON, default=list)
    progress = Column(Float, default=0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    station = relationship("Station", foreign_keys=[station_id])
    commander = relationship("Personnel", foreign_keys=[commander_id])


class Personnel(TimestampMixin, Base):
    __tablename__ = "personnel"
    id = Column(Integer, primary_key=True)
    personnel_id = Column(String(40), unique=True, index=True)
    name = Column(String(160))
    role = Column(String(60))
    team = Column(String(60), default="")
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=True)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)
    current_location = Column(String(160), default="")
    movement_status = Column(String(30), default="station")  # departure|transit|station|field_camp|return
    contact = Column(String(60), default="")
    emergency_contact = Column(String(200), default="")
    training_status = Column(String(30), default="certified")
    assignment = Column(Text, default="")
    last_known_lat = Column(Float, nullable=True)
    last_known_lng = Column(Float, nullable=True)
    status = Column(String(30), default="active")  # active|on_leave|inactive|emergency
    health_status = Column(String(30), default="fit")
    medical_notes = Column(Text, default="")  # restricted field


class PersonnelMovement(Base):
    __tablename__ = "personnel_movements"
    id = Column(Integer, primary_key=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), index=True)
    from_status = Column(String(30), default="")
    to_status = Column(String(30))
    location = Column(String(160), default="")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow)
    note = Column(Text, default="")


class Container(Base):
    __tablename__ = "containers"
    id = Column(Integer, primary_key=True)
    container_id = Column(String(40), unique=True, index=True)
    capacity_kg = Column(Float, default=0)
    used_kg = Column(Float, default=0)
    location = Column(String(160), default="")
    status = Column(String(30), default="empty")  # empty|packing|sealed|in_transit|arrived
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=True)


class Cargo(TimestampMixin, Base):
    __tablename__ = "cargo"
    id = Column(Integer, primary_key=True)
    cargo_id = Column(String(40), unique=True, index=True)
    item_name = Column(String(200))
    category = Column(String(80))
    quantity = Column(Float, default=0)
    weight_kg = Column(Float, default=0)
    dimensions = Column(String(80), default="")
    priority = Column(String(20), default="normal")  # low|normal|high|critical
    origin = Column(String(160), default="")
    destination = Column(String(160), default="")
    container_id = Column(String(40), default="")
    shipment_status = Column(String(40), default="requirement")
    # lifecycle: requirement|indent|approval|packing|container_assigned|manifest|
    #            transport|transit|station_arrival|inspection|inventory
    expected_arrival = Column(String(20), default="")
    handler = Column(String(120), default="")
    fragile = Column(Boolean, default=False)
    temp_sensitive = Column(Boolean, default=False)
    qr_code = Column(String(120), default="")
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=True)
    notes = Column(Text, default="")

    movements = relationship("CargoMovement", backref="cargo", cascade="all, delete-orphan")


class CargoMovement(Base):
    __tablename__ = "cargo_movements"
    id = Column(Integer, primary_key=True)
    cargo_id = Column(Integer, ForeignKey("cargo.id"), index=True)
    status = Column(String(40))
    location = Column(String(160), default="")
    note = Column(Text, default="")
    timestamp = Column(DateTime(timezone=True), default=utcnow)


class Shipment(TimestampMixin, Base):
    __tablename__ = "shipments"
    id = Column(Integer, primary_key=True)
    shipment_id = Column(String(40), unique=True, index=True)
    name = Column(String(160), default="")
    origin = Column(String(160), default="")
    destination = Column(String(160), default="")
    status = Column(String(40), default="planned")
    eta = Column(String(20), default="")
    carrier = Column(String(120), default="")
    handler = Column(String(120), default="")
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=True)
    cargo_ids = Column(JSON, default=list)


class InventoryItem(TimestampMixin, Base):
    __tablename__ = "inventory"
    id = Column(Integer, primary_key=True)
    item = Column(String(200))
    category = Column(String(80))  # food|water|fuel|medical|spares|scientific|emergency|consumable
    quantity = Column(Float, default=0)
    unit = Column(String(20), default="kg")
    location = Column(String(160), default="")
    batch = Column(String(60), default="")
    expiry = Column(String(20), default="")
    consumption_rate = Column(Float, default=0)  # per day
    reorder_level = Column(Float, default=0)
    criticality = Column(String(20), default="normal")
    responsible_officer = Column(String(120), default="")
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=True)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"
    id = Column(Integer, primary_key=True)
    inventory_id = Column(Integer, ForeignKey("inventory.id"), index=True)
    change = Column(Float, default=0)  # negative = consumed/out, positive = stock in
    unit = Column(String(20), default="")
    type = Column(String(20), default="out")  # in|out|adjustment
    note = Column(Text, default="")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow)


class Asset(TimestampMixin, Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True)
    asset_id = Column(String(40), unique=True, index=True)
    name = Column(String(160))
    category = Column(String(80))
    location = Column(String(160), default="")
    condition = Column(String(30), default="good")
    runtime_hours = Column(Float, default=0)
    last_maintenance = Column(String(20), default="")
    next_maintenance = Column(String(20), default="")
    maintenance_interval_hours = Column(Float, default=0)
    assigned_person = Column(String(120), default="")
    operational_status = Column(String(30), default="operational")  # operational|offline|maintenance|failed
    sensor_data = Column(JSON, nullable=True)  # optional manual/sensor/API data
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=True)


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), index=True)
    date = Column(String(20), default="")
    type = Column(String(60), default="preventive")
    note = Column(Text, default="")
    performed_by = Column(String(120), default="")
    next_due = Column(String(20), default="")


class LocationRecord(Base):
    __tablename__ = "location_records"
    id = Column(Integer, primary_key=True)
    code = Column(String(40), index=True)
    name = Column(String(160))
    type = Column(String(40), default="point")  # station|field_camp|depot|route|emergency
    latitude = Column(Float, default=0)
    longitude = Column(Float, default=0)
    region = Column(String(120), default="")
    description = Column(Text, default="")


class WeatherRecord(Base):
    __tablename__ = "weather_records"
    id = Column(Integer, primary_key=True)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)
    source = Column(String(30), default="manual")  # manual|api|simulated
    source_label = Column(String(160), default="")
    temperature_c = Column(Float, default=0)
    wind_speed = Column(Float, default=0)
    wind_direction = Column(String(20), default="")
    visibility_km = Column(Float, default=0)
    condition = Column(String(80), default="clear")
    snow = Column(Float, default=0)
    storm = Column(Boolean, default=False)
    ice_route_condition = Column(String(80), default="open")
    humidity = Column(Float, default=0)
    forecast_alerts = Column(JSON, default=list)
    recorded_at = Column(DateTime(timezone=True), default=utcnow)


class Alert(TimestampMixin, Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True)
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=True)
    type = Column(String(60))
    severity = Column(String(20), default="medium")  # low|medium|high|critical
    title = Column(String(200))
    message = Column(Text, default="")
    entity_type = Column(String(40), default="")
    entity_id = Column(String(60), default="")
    status = Column(String(20), default="active")  # active|acknowledged|resolved
    source = Column(String(30), default="system")
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class Emergency(TimestampMixin, Base):
    __tablename__ = "emergencies"
    id = Column(Integer, primary_key=True)
    emergency_id = Column(String(40), unique=True, index=True)
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    type = Column(String(60))
    severity = Column(String(20), default="warning")  # normal|warning|serious|critical
    location = Column(String(160), default="")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    description = Column(Text, default="")
    recommended_response = Column(Text, default="")
    status = Column(String(30), default="reported")  # reported|acknowledged|in_progress|resolved
    hq_notification = Column(String(30), default="queued")  # pending|queued|sent|confirmed|offline
    connectivity_status = Column(String(20), default="online")  # online|offline
    offline_queued = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    reported_at = Column(DateTime(timezone=True), default=utcnow)


class Task(TimestampMixin, Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True)
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=True)
    title = Column(String(200))
    description = Column(Text, default="")
    status = Column(String(30), default="open")  # open|assigned|in_progress|completed|overdue
    priority = Column(String(20), default="normal")
    due_date = Column(String(20), default="")
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class AIPrediction(TimestampMixin, Base):
    __tablename__ = "ai_predictions"
    id = Column(Integer, primary_key=True)
    mission_id = Column(Integer, ForeignKey("missions.id"), index=True)
    category = Column(String(40))
    label = Column(String(120))
    predicted_days = Column(Float, nullable=True)
    predicted_date = Column(String(20), default="")
    actual_days = Column(Float, nullable=True)
    actual_date = Column(String(20), default="")
    error_days = Column(Float, nullable=True)
    model = Column(String(60), default="rule+ml")
    params = Column(JSON, default=dict)
    features = Column(JSON, default=dict)
    reasons = Column(JSON, default=list)
    resolved = Column(Boolean, default=False)


class Simulation(Base):
    __tablename__ = "simulations"
    id = Column(Integer, primary_key=True)
    mission_id = Column(Integer, ForeignKey("missions.id"), index=True)
    name = Column(String(200))
    scenario = Column(JSON, default=dict)
    baseline = Column(JSON, default=dict)
    result = Column(JSON, default=dict)
    risk_before = Column(String(20), default="")
    risk_after = Column(String(20), default="")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=True)
    user_email = Column(String(255), default="")
    action = Column(String(120))
    entity = Column(String(60))
    entity_id = Column(String(80), default="")
    prev = Column(JSON, nullable=True)
    new = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    mission_id = Column(Integer, nullable=True)
    title = Column(String(200))
    body = Column(Text, default="")
    type = Column(String(40), default="info")
    read = Column(Boolean, default=False)
    channel = Column(String(30), default="inapp")
    external_status = Column(String(30), default="not_configured")  # sent|queued|not_configured|failed
    timestamp = Column(DateTime(timezone=True), default=utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    mission_id = Column(Integer, nullable=True)
    role = Column(String(20))  # user|assistant
    content = Column(Text)
    language = Column(String(8), default="en")
    intent = Column(String(60), default="")
    channel = Column(String(20), default="text")  # text|voice
    timestamp = Column(DateTime(timezone=True), default=utcnow)


class UserSetting(Base):
    __tablename__ = "user_settings"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    language = Column(String(8), default="en")
    voice_enabled = Column(Boolean, default=True)
    voice_lang = Column(String(8), default="en")
    notify_inapp = Column(Boolean, default=True)
    notify_email = Column(Boolean, default=False)
    notify_push = Column(Boolean, default=False)


class SystemConfig(Base):
    __tablename__ = "system_config"
    id = Column(Integer, primary_key=True)
    key = Column(String(60), unique=True, index=True)
    value = Column(JSON, default=dict)


class SyncOutbox(Base):
    __tablename__ = "sync_outbox"
    id = Column(Integer, primary_key=True)
    entity = Column(String(40))
    entity_id = Column(String(80), default="")
    operation = Column(String(20), default="upsert")  # upsert|delete|emergency
    payload = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class SyncLog(Base):
    __tablename__ = "sync_logs"
    id = Column(Integer, primary_key=True)
    action = Column(String(40))
    detail = Column(Text, default="")
    timestamp = Column(DateTime(timezone=True), default=utcnow)