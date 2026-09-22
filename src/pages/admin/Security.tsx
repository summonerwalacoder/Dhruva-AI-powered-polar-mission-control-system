import { Badge, Card, SectionTitle, useApi } from '../../components/ui'

const ROLES = ['admin', 'commander', 'hq', 'logistics', 'scientist', 'medical', 'field'] as const

export default function AdminSecurity() {
  const users = useApi<any[]>('/api/users')
  const auditStats = useApi<any>('/api/audit/stats')
  const emergencyPolicy = useApi<any>('/api/emergencies/sos-status')

  const byRole = (users.data || []).reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">Security</h1>
        <p className="text-xs text-slate-400">Access control posture, segmentation and incident policy</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle title="Role segmentation" sub="accounts per role" />
          <div className="space-y-2">
            {ROLES.map((r) => (
              <div key={r} className="flex items-center justify-between rounded-lg bg-ink-800/50 px-3 py-2 text-sm">
                <code className="text-ice-300">{r}</code>
                <Badge tone="slate">{byRole[r] || 0} account{(byRole[r] || 0) === 1 ? '' : 's'}</Badge>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-ink-800/40 px-3 py-2 text-xs text-slate-400">
            <b className="text-slate-200">Data scoping:</b> field sees only assigned mission; medical notes masked outside
            admin/commander/medical/hq; server enforces every permission.
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle title="Controls active" sub="enforcement layers" />
            <ul className="space-y-1.5 text-sm text-slate-300">
              <Check label="JWT bearer auth on every API route" />
              <Check label="Role-scoped frontend routing + RequireRole denial" />
              <Check label="Backend permission gating via require()" />
              <Check label="Medical notes masking on all personnel reads" />
              <Check label="Offline outbox replay (audited writes)" />
              <Check label="Audit trail for logins, mutation & config" />
            </ul>
          </Card>
          <Card className="p-4">
            <SectionTitle title="Emergency policy" sub="from system config" />
            <div className="text-sm text-slate-300">{emergencyPolicy.data?.message || 'Emergency policy from system config.'}</div>
            {auditStats.data ? (
              <div className="mt-2 text-xs text-slate-400">{auditStats.data.total || 0} total audit events recorded.</div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  )
}

function Check({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="text-emerald-400">✓</span> {label}
    </li>
  )
}