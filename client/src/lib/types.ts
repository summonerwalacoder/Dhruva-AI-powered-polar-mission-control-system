export interface User {
  id: number
  email: string
  name: string
  role: string
  designation?: string | null
  phone?: string | null
  station_id?: number | null
  station_name?: string | null
  mission_id?: number | null
  active: boolean
  language?: string
}

export interface Task {
  id: number
  mission_id?: number | null
  personnel_id?: number | null
  title: string
  description?: string | null
  status: string
  priority?: string | null
  due_date?: string | null
  assigned_by?: number | null
  created_at?: string | null
}

export interface LoginResponse {
  token: string
  user: User
}

export interface Station {
  id: number
  code: string
  name: string
  type: string
  region: string
  latitude: number
  longitude: number
  elevation_m?: number
  active: boolean
}

export interface MissionSummary {
  id: number
  mission_id: string
  name: string
  region?: string
  destination?: string
  start_date?: string
  end_date?: string
  duration_days?: number
  objective?: string
  team_size?: number
  status: string
  progress: number
  emergency_contact?: string
  planned_resupplies?: any
  route?: any
  station?: { id: number; name: string; code: string } | null
  station_id?: number | null
  active_alerts: number
  risk_level: string
  food_days?: number
  fuel_days?: number
  personnel_count: number
  cargo_count: number
  asset_count: number
  elapsed_days?: number
  total_days?: number
}

export interface Risk {
  level: string
  score: number
  label?: string
  reasons: string[]
  actions: string[]
}

export interface Overview {
  mission: {
    id: number
    mission_id: string
    name: string
    destination?: string
    status: string
    progress: number
    elapsed_days: number
    total_days: number
    remaining_days: number
    team_size_planned: number
    team_size_actual: number
    start_date?: string
    end_date?: string
    objective?: string
    emergency_contact?: string
    station?: { id: number; name: string; code: string } | null
  }
  counts: Record<string, number>
  resources: {
    food_days?: number
    food_status?: string
    fuel_days?: number
    fuel_status?: string
    medical_days?: number
    medical_status?: string
    resupply_date?: string
  }
  weather: {
    source: string
    label: string
    temperature_c?: number
    wind_speed?: number
    condition?: string
    storm?: boolean
    visibility_km?: number
    ice_route_condition?: string
  }
  risk: Risk
  survival_clock: SurvivalClock[]
  resupply_plan?: string
  next_resupply?: string
}

export interface SurvivalClock {
  category: string
  label: string
  days_remaining?: number
  item?: string
  depletion_date?: string
  status: string
  days_to_resupply?: number
  resupply_date?: string
  resupply_ok?: boolean
}

export interface Prediction {
  item: string
  category: string
  quantity: number
  unit: string
  days_remaining?: number
  depletion_date?: string
  shortage_probability?: number
  reorder_recommended: boolean
  resupply_date?: string
  consumption_rate?: number
  status: string
  reasons: string[]
}

export interface Personnel {
  id: number
  personnel_id: string
  name: string
  role: string
  team?: string
  mission_id?: number
  station_id?: number
  current_location?: string
  movement_status: string
  health_status?: string
  medical_notes?: string
  last_known_lat?: number
  last_known_lng?: number
  contact?: string
  status?: string
  movement?: { to_status: string; location: string; timestamp: string; note?: string }[]
}

export interface CargoItem {
  id: number
  cargo_id: string
  mission_id?: number
  item_name: string
  category?: string
  quantity?: number
  unit?: string
  weight_kg?: number
  container_id?: string
  shipment_status: string
  qr_code?: string
  priority?: string
  expected_arrival?: string
  delayed?: boolean
  history?: { status: string; location?: string; note?: string; timestamp?: string }[]
}

export interface Container {
  id: number
  container_id: string
  capacity_kg: number
  used_kg: number
  location?: string
  status?: string
  mission_id?: number
}

export interface InventoryItem {
  id: number
  item: string
  category: string
  quantity: number
  unit: string
  batch?: string
  mission_id?: number
  location?: string
  reorder_level?: number
  criticality?: string
  consumption_rate?: number
  expiry_date?: string
  supplier?: string
}

export interface Asset {
  id: number
  asset_id: string
  name: string
  category?: string
  mission_id?: number
  location?: string
  operational_status: string
  last_maintenance?: string
  next_maintenance?: string
  runtime_hours?: number
  fuel_type?: string
  risk?: { status: string; status_label: string; days_since_maintenance?: number; reasons?: string[] }
}

export interface WeatherRecord {
  id: number
  station_id: number
  source: string
  source_label?: string
  temperature_c?: number
  wind_speed?: number
  wind_direction?: number
  visibility_km?: number
  condition?: string
  humidity?: number
  storm: boolean
  ice_route_condition?: string
  forecast_alerts?: string[]
  recorded_at?: string
}

export interface Alert {
  id: number
  mission_id?: number
  type?: string
  severity: string
  title: string
  message?: string
  status: string
  source?: string
  created_at?: string
  resolved_at?: string
}

export interface Emergency {
  id: number
  emergency_id: string
  mission_id?: number
  type?: string
  severity: string
  location?: string
  latitude?: number
  longitude?: number
  description?: string
  recommended_response?: string
  status: string
  connectivity_status?: string
  offline_queued?: boolean
  reported_at?: string
  resolved_at?: string
}

export interface SimulationResult {
  id: number
  scenario: Record<string, any>
  risk_before: string
  risk_after: string
  baseline: any
  result: any
  impact?: { severity: string; critical_dependencies: any[]; mission_impact: any[] }
  before?: { risk: string; clock: SurvivalClock[] }
  after?: { risk: string; clock: SurvivalClock[] }
}

export interface ChatReply {
  reply: string
  language: string
  intent: string
  provider: string
  model?: string | null
  evidence: string[]
  warnings?: string[]
  action?: { type: string } | null
}

export interface EmergencyInterpret {
  emergency_type: string
  type_label: string
  severity: string
  severity_reasons: string[]
  language: string
  provider: string
  recommended_next_steps: string[]
  suggested_emergency_create: {
    mission_id?: number
    type: string
    severity: string
    description: string
    recommended_response: string
  }
}

export interface Analytics {
  cargo: { total: number; in_transit: number; delivered: number; delayed: number; delay_rate: number }
  inventory: { consumption_30d: Record<string, number>; by_category: Record<string, number> }
  assets: { total: number; healthy: number; due: number; high: number; critical: number; uptime: number }
  personnel: { total: number; by_movement: Record<string, number>; by_role: Record<string, number> }
  emergency: { total: number; open: number; by_severity: Record<string, number>; avg_response_hours?: number }
  alerts: { total: number; by_severity: Record<string, number>; last_7d: Record<string, number> }
  simulations: { total: number; risk_after: Record<string, number> }
}

export interface Notification {
  id: number
  title: string
  body?: string
  type?: string
  read: boolean
  timestamp?: string
}