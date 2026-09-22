// Per-role UI configuration — every role gets its own navigation, theme and
// context label so the interface is purpose-specific, never a copy.
import { can } from './perms'

export type RoleKey = 'admin' | 'commander' | 'hq' | 'logistics' | 'scientist' | 'medical' | 'field'

export interface NavEntry {
  to: string
  key: string
  icon: string
  perm?: string
  anyPerm?: string[]
}

export interface RoleTheme {
  chip: string
  text: string
  active: string
  border: string
  glow: string
  dot: string
}

interface RoleConfig {
  label: string
  short: string
  context: string
  dashboard: string
  missionSelector: boolean
  theme: RoleTheme
  nav: NavEntry[]
}

export const ROLE_THEMES: Record<RoleKey, RoleTheme> = {
  admin: {
    chip: 'from-violet-500 to-violet-700',
    text: 'text-violet-300',
    active: 'bg-violet-500/15 text-violet-200 border-violet-400/40',
    border: 'border-violet-400/30',
    glow: 'shadow-violet-500/20',
    dot: 'bg-violet-400',
  },
  commander: {
    chip: 'from-ice-400 to-ice-600',
    text: 'text-ice-300',
    active: 'bg-ice-500/15 text-ice-200 border-ice-400/40',
    border: 'border-ice-400/30',
    glow: 'shadow-ice-500/20',
    dot: 'bg-ice-300',
  },
  hq: {
    chip: 'from-amber-400 to-amber-600',
    text: 'text-amber-300',
    active: 'bg-amber-500/15 text-amber-200 border-amber-400/40',
    border: 'border-amber-400/30',
    glow: 'shadow-amber-500/20',
    dot: 'bg-amber-400',
  },
  logistics: {
    chip: 'from-emerald-400 to-emerald-600',
    text: 'text-emerald-300',
    active: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40',
    border: 'border-emerald-400/30',
    glow: 'shadow-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  scientist: {
    chip: 'from-sky-400 to-sky-600',
    text: 'text-sky-300',
    active: 'bg-sky-500/15 text-sky-200 border-sky-400/40',
    border: 'border-sky-400/30',
    glow: 'shadow-sky-500/20',
    dot: 'bg-sky-400',
  },
  medical: {
    chip: 'from-rose-400 to-rose-600',
    text: 'text-rose-300',
    active: 'bg-rose-500/15 text-rose-200 border-rose-400/40',
    border: 'border-rose-400/30',
    glow: 'shadow-rose-500/20',
    dot: 'bg-rose-400',
  },
  field: {
    chip: 'from-lime-400 to-lime-600',
    text: 'text-lime-300',
    active: 'bg-lime-500/15 text-lime-200 border-lime-400/40',
    border: 'border-lime-400/30',
    glow: 'shadow-lime-500/20',
    dot: 'bg-lime-400',
  },
}

export const ROLE_CONFIG: Record<RoleKey, RoleConfig> = {
  admin: {
    label: 'Administrator',
    short: 'admin',
    context: 'System Control Center',
    dashboard: '/admin/dashboard',
    missionSelector: false,
    theme: ROLE_THEMES.admin,
    nav: [
      { to: '/admin/dashboard', key: 'dashboard', icon: 'dashboard', perm: 'users:read' },
      { to: '/admin/users', key: 'users', icon: 'users', perm: 'users:read' },
      { to: '/admin/roles', key: 'roles', icon: 'key', perm: 'users:read' },
      { to: '/missions', key: 'missions', icon: 'mission', perm: 'mission:read' },
      { to: '/admin/system', key: 'system', icon: 'monitor', perm: 'users:read' },
      { to: '/admin/audit', key: 'auditLogs', icon: 'report', perm: 'audit:read' },
      { to: '/admin/integrations', key: 'integrations', icon: 'plug', perm: 'users:read' },
      { to: '/admin/security', key: 'security', icon: 'shield', perm: 'users:read' },
      { to: '/settings', key: 'settings', icon: 'settings', perm: 'users:read' },
    ],
  },
  commander: {
    label: 'Expedition Commander',
    short: 'commander',
    context: 'Polar Mission Control',
    dashboard: '/commander/dashboard',
    missionSelector: true,
    theme: ROLE_THEMES.commander,
    nav: [
      { to: '/commander/dashboard', key: 'missionControl', icon: 'dashboard', perm: 'mission:read' },
      { to: '/personnel', key: 'personnel', icon: 'personnel', perm: 'personnel:read' },
      { to: '/cargo', key: 'cargo', icon: 'cargo', perm: 'cargo:read' },
      { to: '/inventory', key: 'inventory', icon: 'inventory', perm: 'inventory:read' },
      { to: '/assets', key: 'assets', icon: 'asset', perm: 'assets:read' },
      { to: '/map', key: 'map', icon: 'map', perm: 'maps:read' },
      { to: '/weather', key: 'weather', icon: 'weather', perm: 'weather:read' },
      { to: '/alerts', key: 'alerts', icon: 'alert', perm: 'alerts:read' },
      { to: '/simulations', key: 'simulations', icon: 'simulate', perm: 'simulate:use' },
      { to: '/assistant', key: 'assistant', icon: 'ai', perm: 'ai:use' },
      { to: '/emergency', key: 'emergency', icon: 'emergency', perm: 'emergency:read' },
      { to: '/reports', key: 'reports', icon: 'report', perm: 'reports:use' },
    ],
  },
  hq: {
    label: 'HQ / Government Official',
    short: 'hq',
    context: 'Multi-Mission Strategic Overview',
    dashboard: '/hq/dashboard',
    missionSelector: true,
    theme: ROLE_THEMES.hq,
    nav: [
      { to: '/hq/dashboard', key: 'hqOverview', icon: 'analytics', perm: 'mission:read' },
      { to: '/missions', key: 'missions', icon: 'mission', perm: 'mission:read' },
      { to: '/stations', key: 'stations', icon: 'building', perm: 'mission:read' },
      { to: '/alerts', key: 'alerts', icon: 'alert', perm: 'alerts:read' },
      { to: '/emergency', key: 'emergencies', icon: 'emergency', perm: 'emergency:read' },
      { to: '/analytics', key: 'analytics', icon: 'chart', perm: 'analytics:use' },
      { to: '/reports', key: 'reports', icon: 'report', perm: 'reports:use' },
    ],
  },
  logistics: {
    label: 'Logistics Officer',
    short: 'logistics',
    context: 'Cargo & Supply Control',
    dashboard: '/logistics/dashboard',
    missionSelector: true,
    theme: ROLE_THEMES.logistics,
    nav: [
      { to: '/logistics/dashboard', key: 'logisticsDashboard', icon: 'cargo', perm: 'cargo:read' },
      { to: '/cargo', key: 'cargo', icon: 'cargo', perm: 'cargo:read' },
      { to: '/logistics/shipments', key: 'shipments', icon: 'route', perm: 'cargo:read' },
      { to: '/logistics/containers', key: 'containers', icon: 'box', perm: 'cargo:read' },
      { to: '/inventory', key: 'inventory', icon: 'inventory', perm: 'inventory:read' },
      { to: '/logistics/resupply', key: 'resupply', icon: 'refresh', perm: 'cargo:read' },
      { to: '/logistics/scan', key: 'qrScanner', icon: 'scan', perm: 'cargo:read' },
      { to: '/alerts', key: 'logisticsAlerts', icon: 'alert', perm: 'alerts:read' },
      { to: '/reports', key: 'reports', icon: 'report', perm: 'reports:use' },
    ],
  },
  scientist: {
    label: 'Scientist / Researcher',
    short: 'scientist',
    context: 'Research Mission Workspace',
    dashboard: '/scientist/dashboard',
    missionSelector: true,
    theme: ROLE_THEMES.scientist,
    nav: [
      { to: '/scientist/dashboard', key: 'myMission', icon: 'mission', perm: 'mission:read' },
      { to: '/scientist/tasks', key: 'researchTasks', icon: 'check', perm: 'tasks:use' },
      { to: '/scientist/equipment', key: 'equipment', icon: 'asset', perm: 'assets:read' },
      { to: '/map', key: 'locationMap', icon: 'map', perm: 'maps:read' },
      { to: '/weather', key: 'weather', icon: 'weather', perm: 'weather:read' },
      { to: '/assistant', key: 'assistant', icon: 'ai', perm: 'ai:use' },
      { to: '/emergency', key: 'emergency', icon: 'emergency', perm: 'emergency:report' },
    ],
  },
  medical: {
    label: 'Medical Officer',
    short: 'medical',
    context: 'Medical & Emergency Center',
    dashboard: '/medical/dashboard',
    missionSelector: true,
    theme: ROLE_THEMES.medical,
    nav: [
      { to: '/medical/dashboard', key: 'medicalDashboard', icon: 'heart', perm: 'medical:read' },
      { to: '/personnel', key: 'personnel', icon: 'personnel', perm: 'personnel:read' },
      { to: '/medical/cases', key: 'medicalCases', icon: 'clip', perm: 'medical:read' },
      { to: '/medical/inventory', key: 'medicalInventory', icon: 'inventory', perm: 'inventory:read' },
      { to: '/emergency', key: 'emergencies', icon: 'emergency', perm: 'emergency:read' },
      { to: '/map', key: 'emergencyMap', icon: 'map', perm: 'maps:read' },
      { to: '/alerts', key: 'alerts', icon: 'alert', perm: 'alerts:read' },
      { to: '/assistant', key: 'aiEmergency', icon: 'ai', perm: 'ai:use' },
    ],
  },
  field: {
    label: 'Field Operator',
    short: 'field',
    context: 'Field Operations Mobile Console',
    dashboard: '/field/dashboard',
    missionSelector: false,
    theme: ROLE_THEMES.field,
    nav: [
      { to: '/field/dashboard', key: 'myTasks', icon: 'check', perm: 'tasks:use' },
      { to: '/field/equipment', key: 'myEquipment', icon: 'asset', perm: 'assets:read' },
      { to: '/map', key: 'map', icon: 'map', perm: 'maps:read' },
      { to: '/weather', key: 'weather', icon: 'weather', perm: 'weather:read' },
      { to: '/assistant', key: 'assistant', icon: 'ai', perm: 'ai:use' },
      { to: '/emergency', key: 'emergency', icon: 'emergency', perm: 'emergency:report' },
      { to: '/field/profile', key: 'profile', icon: 'settings', perm: 'mission:read' },
    ],
  },
}

export function roleConfig(role?: string): RoleConfig | null {
  return ROLE_CONFIG[role as RoleKey] || null
}

export function roleDashboardPath(role?: string): string {
  return roleConfig(role)?.dashboard || '/login'
}

/** Filter a role's nav to entries the role is actually allowed to open. */
export function navForRole(role?: string): NavEntry[] {
  const cfg = roleConfig(role)
  if (!cfg) return []
  return cfg.nav.filter((e) => {
    if (e.anyPerm) return e.anyPerm.some((p) => can(role, p))
    return can(role, e.perm ?? '')
  })
}

export function canByRole(role: string | undefined, perm: string): boolean {
  return can(role, perm)
}