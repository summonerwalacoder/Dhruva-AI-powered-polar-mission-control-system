from pydantic import BaseModel, ConfigDict, EmailStr  # noqa: F401
from typing import Any, Optional


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: str
    password: str


class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    role: str
    designation: str = ""
    phone: str = ""
    station_id: Optional[int] = None
    mission_id: Optional[int] = None
    language: str = "en"
    active: bool = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    station_id: Optional[int] = None
    mission_id: Optional[int] = None
    language: Optional[str] = None
    active: Optional[bool] = None
    password: Optional[str] = None


class MissionCreate(BaseModel):
    mission_id: str
    name: str
    region: str = ""
    station_id: Optional[int] = None
    destination: str = ""
    start_date: str = ""
    end_date: str = ""
    duration_days: int = 0
    objective: str = ""
    team_size: int = 0
    route: Any = []
    status: str = "planned"
    commander_id: Optional[int] = None
    emergency_contact: str = ""
    planned_resupplies: Any = []
    progress: float = 0


class MissionUpdate(BaseModel):
    mission_id: Optional[str] = None
    name: Optional[str] = None
    region: Optional[str] = None
    station_id: Optional[int] = None
    destination: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    duration_days: Optional[int] = None
    objective: Optional[str] = None
    team_size: Optional[int] = None
    route: Optional[Any] = None
    status: Optional[str] = None
    commander_id: Optional[int] = None
    emergency_contact: Optional[str] = None
    planned_resupplies: Optional[Any] = None
    progress: Optional[float] = None


class AIResourceSuggestion(BaseModel):
    category: str
    quantity: float
    unit: str
    reason: str


class AIPlanRequest(BaseModel):
    duration_days: int
    team_size: int
    destination: str = ""
    objective: str = ""


class PersonnelCreate(BaseModel):
    personnel_id: str
    name: str
    role: str = ""
    team: str = ""
    mission_id: Optional[int] = None
    station_id: Optional[int] = None
    current_location: str = ""
    movement_status: str = "station"
    contact: str = ""
    emergency_contact: str = ""
    training_status: str = "certified"
    assignment: str = ""
    last_known_lat: Optional[float] = None
    last_known_lng: Optional[float] = None
    status: str = "active"
    health_status: str = "fit"
    medical_notes: str = ""


class PersonnelUpdate(BaseModel):
    personnel_id: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    team: Optional[str] = None
    mission_id: Optional[int] = None
    station_id: Optional[int] = None
    current_location: Optional[str] = None
    movement_status: Optional[str] = None
    contact: Optional[str] = None
    emergency_contact: Optional[str] = None
    training_status: Optional[str] = None
    assignment: Optional[str] = None
    last_known_lat: Optional[float] = None
    last_known_lng: Optional[float] = None
    status: Optional[str] = None
    health_status: Optional[str] = None
    medical_notes: Optional[str] = None


class MovementCreate(BaseModel):
    to_status: str
    location: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    note: str = ""


class CargoCreate(BaseModel):
    cargo_id: str
    item_name: str
    category: str = ""
    quantity: float = 0
    weight_kg: float = 0
    dimensions: str = ""
    priority: str = "normal"
    origin: str = ""
    destination: str = ""
    container_id: str = ""
    shipment_status: str = "requirement"
    expected_arrival: str = ""
    handler: str = ""
    fragile: bool = False
    temp_sensitive: bool = False
    qr_code: str = ""
    mission_id: Optional[int] = None
    notes: str = ""


class CargoUpdate(BaseModel):
    item_name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[float] = None
    weight_kg: Optional[float] = None
    dimensions: Optional[str] = None
    priority: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    container_id: Optional[str] = None
    shipment_status: Optional[str] = None
    expected_arrival: Optional[str] = None
    handler: Optional[str] = None
    fragile: Optional[bool] = None
    temp_sensitive: Optional[bool] = None
    qr_code: Optional[str] = None
    mission_id: Optional[int] = None
    notes: Optional[str] = None


class CargoMovementCreate(BaseModel):
    status: str
    location: str = ""
    note: str = ""


class MovementCreateAll(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class InventoryCreate(BaseModel):
    item: str
    category: str = "consumable"
    quantity: float = 0
    unit: str = "kg"
    location: str = ""
    batch: str = ""
    expiry: str = ""
    consumption_rate: float = 0
    reorder_level: float = 0
    criticality: str = "normal"
    responsible_officer: str = ""
    mission_id: Optional[int] = None
    station_id: Optional[int] = None


class InventoryUpdate(BaseModel):
    item: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    location: Optional[str] = None
    batch: Optional[str] = None
    expiry: Optional[str] = None
    consumption_rate: Optional[float] = None
    reorder_level: Optional[float] = None
    criticality: Optional[str] = None
    responsible_officer: Optional[str] = None
    mission_id: Optional[int] = None
    station_id: Optional[int] = None


class InventoryTxCreate(BaseModel):
    change: float
    type: str = "out"
    unit: str = ""
    note: str = ""


class AssetCreate(BaseModel):
    asset_id: str
    name: str
    category: str = ""
    location: str = ""
    condition: str = "good"
    runtime_hours: float = 0
    last_maintenance: str = ""
    next_maintenance: str = ""
    maintenance_interval_hours: float = 0
    assigned_person: str = ""
    operational_status: str = "operational"
    sensor_data: Any = None
    mission_id: Optional[int] = None


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    condition: Optional[str] = None
    runtime_hours: Optional[float] = None
    last_maintenance: Optional[str] = None
    next_maintenance: Optional[str] = None
    maintenance_interval_hours: Optional[float] = None
    assigned_person: Optional[str] = None
    operational_status: Optional[str] = None
    sensor_data: Optional[Any] = None
    mission_id: Optional[int] = None


class MaintenanceCreate(BaseModel):
    date: str = ""
    type: str = "preventive"
    note: str = ""
    performed_by: str = ""
    next_due: str = ""


class WeatherCreate(BaseModel):
    station_id: Optional[int] = None
    source: str = "manual"
    source_label: str = "Manual entry"
    temperature_c: float = 0
    wind_speed: float = 0
    wind_direction: str = ""
    visibility_km: float = 0
    condition: str = "clear"
    snow: float = 0
    storm: bool = False
    ice_route_condition: str = "open"
    humidity: float = 0
    forecast_alerts: Any = []


class AlertCreate(BaseModel):
    mission_id: Optional[int] = None
    type: str
    severity: str = "medium"
    title: str
    message: str = ""
    entity_type: str = ""
    entity_id: str = ""
    status: str = "active"
    source: str = "system"


class EmergencyCreate(BaseModel):
    mission_id: Optional[int] = None
    type: str
    severity: str = "warning"
    location: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: str = ""
    recommended_response: str = ""
    status: str = "reported"
    connectivity_status: str = "online"
    offline_queued: bool = False
    personnel_id: str = ""


class EmergencyAIRequest(BaseModel):
    mission_id: Optional[int] = None
    description: str
    connectivity_status: str = "online"
    voice: bool = False


class SimulationCreate(BaseModel):
    mission_id: int
    scenario: Any = {}
    name: str = "Scenario simulation"


class ChatRequest(BaseModel):
    message: str
    mission_id: Optional[int] = None
    channel: str = "text"
    voice: bool = False


class StationCreate(BaseModel):
    code: str
    name: str
    type: str = "station"
    region: str = ""
    latitude: float = 0
    longitude: float = 0
    elevation_m: float = 0
    country: str = "India"
    description: str = ""
    active: bool = True


class TaskCreate(BaseModel):
    mission_id: Optional[int] = None
    personnel_id: Optional[int] = None
    title: str
    description: str = ""
    status: str = "open"
    priority: str = "normal"
    due_date: str = ""


class TaskUpdate(BaseModel):
    personnel_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None


class NotificationRead(BaseModel):
    read: bool = True


class SettingsUpdate(BaseModel):
    language: Optional[str] = None
    voice_enabled: Optional[bool] = None
    voice_lang: Optional[str] = None
    notify_inapp: Optional[bool] = None
    notify_email: Optional[bool] = None
    notify_push: Optional[bool] = None


class SyncPush(BaseModel):
    items: list[Any] = []
    batch_id: str = ""
    device: str = ""


class RoleCreate(BaseModel):
    code: str
    name: str
    description: str = ""
    permissions: Any = []


class AlertUpdate(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    title: Optional[str] = None
    message: Optional[str] = None


class EmergencyUpdate(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    recommended_response: Optional[str] = None
    hq_notification: Optional[str] = None
    connectivity_status: Optional[str] = None


class PredictionResolve(BaseModel):
    actual_days: float
    note: str = ""


class ConfigUpdate(BaseModel):
    value: Any