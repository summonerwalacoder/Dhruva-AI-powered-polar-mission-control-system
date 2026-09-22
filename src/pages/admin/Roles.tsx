import { can } from '../../lib/perms'
import { Badge, Card, SectionTitle } from '../../components/ui'

const ROLES = ['admin', 'commander', 'hq', 'logistics', 'scientist', 'medical', 'field'] as const

const PERM_GROUPS: Array<{ group: string; perms: Array<[string, string]> }> = [
  { group: 'Missions', perms: [['mission:read', 'View missions'], ['mission:write', 'Create / edit missions'], ['mission:delete', 'Delete missions']] },
  { group: 'Personnel', perms: [['personnel:read', 'View personnel'], ['personnel:write', 'Edit personnel'], ['medical:read', 'Read medical notes'], ['medical:write', 'Edit medical notes']] },
  { group: 'Cargo & inventory', perms: [['cargo:read', 'View cargo'], ['cargo:write', 'Manage cargo'], ['inventory:read', 'View inventory'], ['inventory:write', 'Manage inventory']] },
  { group: 'Assets & maps', perms: [['assets:read', 'View assets'], ['assets:write', 'Update assets'], ['maps:read', 'Operations map']] },
  { group: 'Weather & alerts', perms: [['weather:read', 'View weather'], ['weather:write', 'Record weather'], ['alerts:read', 'View alerts'], ['alerts:write', 'Create alerts']] },
  { group: 'Emergencies', perms: [['emergency:report', 'Report emergency'], ['emergency:read', 'View emergencies'], ['emergency:respond', 'Respond / resolve']] },
  { group: 'Intelligence', perms: [['simulate:use', 'Simulations'], ['ai:use', 'AI assistant'], ['reports:use', 'Reports'], ['analytics:use', 'Analytics']] },
  { group: 'Platform', perms: [['users:read', 'View users'], ['users:manage', 'Manage users'], ['audit:read', 'Audit logs'], ['notify:send', 'Send notifications']] },
]

export default function AdminRoles() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">Roles & Permissions</h1>
        <p className="text-xs text-slate-400">Read-only RBAC matrix mirroring the server authority</p>
      </div>
      <Card className="overflow-x-auto">
        <div className="min-w-[840px]">
          <div className="grid grid-cols-[200px_repeat(7,minmax(90px,1fr))] gap-x-1 border-b border-ink-700/50 px-4 py-3 text-xs font-semibold text-slate-300">
            <span>Permission</span>
            {ROLES.map((r) => (
              <span key={r} className="text-center">{r}</span>
            ))}
          </div>
          {PERM_GROUPS.map((g) => (
            <div key={g.group}>
              <div className="bg-ink-800/60 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-ice-300">{g.group}</div>
              {g.perms.map(([perm, label]) => (
                <div key={perm} className="grid grid-cols-[200px_repeat(7,minmax(90px,1fr))] items-center gap-x-1 border-b border-ink-700/30 px-4 py-2">
                  <div>
                    <div className="text-sm text-slate-200">{label}</div>
                    <code className="text-[10px] text-ice-400">{perm}</code>
                  </div>
                  {ROLES.map((r) => (
                    <div key={r} className="text-center">
                      {can(r, perm) ? <Badge tone="green">✓</Badge> : <span className="text-slate-600">·</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
      <SectionTitle title="" sub="admin holds wildcard (*) across all permissions. Server-side enforcement is authoritative." />
    </div>
  )
}