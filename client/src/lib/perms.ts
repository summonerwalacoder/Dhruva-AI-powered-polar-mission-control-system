// Client-side mirror of the server RBAC matrix (server remains authoritative).
export const ROLE_NAMES: Record<string, string> = {
  admin: 'System Administrator',
  commander: 'Expedition Commander',
  hq: 'HQ / Government Official',
  logistics: 'Logistics Officer',
  scientist: 'Scientist / Researcher',
  medical: 'Medical Officer',
  field: 'Field Operator',
}

const PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  commander: [
    'mission:read', 'mission:write', 'personnel:read', 'personnel:write', 'medical:read',
    'cargo:read', 'cargo:write', 'inventory:read', 'inventory:write',
    'assets:read', 'assets:write', 'weather:read', 'weather:write',
    'alerts:read', 'alerts:write', 'emergency:report', 'emergency:respond', 'emergency:read',
    'simulate:use', 'ai:use', 'reports:use', 'maps:read', 'audit:read', 'users:read',
    'analytics:use', 'notify:send',
  ],
  hq: [
    'mission:read', 'personnel:read', 'cargo:read', 'inventory:read', 'assets:read',
    'weather:read', 'alerts:read', 'alerts:write', 'emergency:read', 'emergency:respond',
    'simulate:use', 'ai:use', 'reports:use', 'maps:read', 'analytics:use', 'medical:read', 'notify:send',
  ],
  logistics: [
    'mission:read', 'personnel:read', 'cargo:read', 'cargo:write', 'inventory:read',
    'inventory:write', 'assets:read', 'weather:read', 'alerts:read', 'alerts:write',
    'simulate:use', 'ai:use', 'reports:use', 'maps:read', 'emergency:report', 'analytics:use', 'notify:send',
  ],
  scientist: [
    'mission:read', 'personnel:read', 'cargo:read', 'inventory:read', 'assets:read',
    'weather:read', 'alerts:read', 'maps:read', 'simulate:use', 'ai:use', 'reports:use', 'emergency:report',
    'tasks:use',
  ],
  medical: [
    'mission:read', 'personnel:read', 'personnel:write', 'medical:read', 'medical:write',
    'inventory:read', 'weather:read', 'alerts:read', 'alerts:write', 'emergency:report',
    'emergency:read', 'ai:use', 'maps:read', 'assets:read', 'cargo:read', 'tasks:use',
  ],
  field: [
    'mission:read', 'personnel:read', 'cargo:read', 'inventory:read', 'assets:read',
    'assets:write', 'weather:read', 'alerts:read', 'emergency:report', 'ai:use', 'maps:read',
    'tasks:use', 'notify:send',
  ],
}

export function can(role: string | undefined, permission: string): boolean {
  if (!role) return false
  const perms = PERMISSIONS[role] || []
  if (perms.includes('*')) return true
  return perms.includes(permission)
}

export function canAny(role: string | undefined, ...permissions: string[]): boolean {
  return permissions.some((p) => can(role, p))
}

/** Entry a page must satisfy to be included in navigation. */
export const NAV_REQ: Record<string, string> = {
  dashboard: 'mission:read',
  missions: 'mission:read',
  personnel: 'personnel:read',
  cargo: 'cargo:read',
  inventory: 'inventory:read',
  assets: 'assets:read',
  map: 'maps:read',
  weather: 'weather:read',
  alerts: 'alerts:read',
  simulations: 'simulate:use',
  assistant: 'ai:use',
  emergency: 'emergency:read',
  reports: 'reports:use',
  analytics: 'analytics:use',
  admin: 'users:read',
}