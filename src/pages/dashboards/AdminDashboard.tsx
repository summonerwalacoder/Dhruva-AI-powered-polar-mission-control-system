import { Link } from 'react-router-dom'
import { fmtNum } from '../../lib/api'
import { Badge, Card, Icon, SectionTitle, Spinner, Stat, useApi } from '../../components/ui'

export default function AdminDashboard() {
  const users = useApi<any[]>('/api/users')
  const missions = useApi<any[]>('/api/missions')
  const audit = useApi<any[]>('/api/audit?limit=8')
  const config = useApi<any[]>('/api/config')
  const alerts = useApi<any[]>('/api/alerts?status=active')
  const emergencies = useApi<any[]>('/api/emergencies?status=open')
  const cargo = useApi<any[]>('/api/cargo?')

  const logs = audit.data || []
  const alarms = alerts.data || []
  const open = emergencies.data || []
  const cfg = config.data || []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-50">System Control Center</h1>
          <p className="text-sm text-slate-400">Platform health, users, audit trail and external integrations</p>
        </div>
        <Link to="/admin/system" className="rounded-lg border border-ice-400/40 px-3 py-2 text-sm font-medium text-ice-300 hover:bg-ice-400/10">System monitor →</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Registered users" value={fmtNum(users.data?.length || 0)} sub="across 7 roles" tone="ice" />
        <Stat label="Missions" value={fmtNum(missions.data?.length || 0)} sub="managed on platform" tone="default" />
        <Stat label="Integrations" value={fmtNum(cfg.length)} sub="config keys" tone="default" />
        <Stat label="Active alarms" value={fmtNum(alarms.length)} sub="system-wide" tone={alarms.length ? 'warn' : 'good'} />
        <Stat label="Open emergencies" value={fmtNum(open.length)} sub="live" tone={open.length ? 'warn' : 'good'} />
        <Stat label="Cargo items" value={fmtNum(cargo.data?.length || 0)} sub="tracked" tone="default" />
        <Stat label="Audit events" value={fmtNum(audit.data?.length || 0)} sub="recent" tone="default" />
        <Stat label="Phones/roles matrix" value="7" sub="role-scoped UIs" tone="default" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle title="Recent audit trail" sub="who did what — full integrity trail" right={<Link to="/admin/audit" className="text-xs text-ice-300">view all</Link>} />
          {audit.loading ? <Spinner /> : null}
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {logs.map((l, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-ink-800/50 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-medium text-ice-300">{l.action}</span>
                    <span className="truncate text-slate-200">{l.entity}</span>
                    <span className="text-xs text-slate-500">{l.entity_id}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-500">{l.user_email} · {l.timestamp}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle title="Integration status" sub="external service connectivity" right={<Link to="/admin/integrations" className="text-xs text-ice-300">manage</Link>} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {cfg.slice(0, 6).map((c) => (
                <div key={c.key} className="flex items-center justify-between rounded-lg bg-ink-800/50 px-3 py-2 text-sm">
                  <span className="truncate text-slate-300">{c.key}</span>
                  <Badge tone={fieldSet(c.value) ? 'green' : 'slate'}>{fieldSet(c.value) ? 'configured' : 'not set'}</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <SectionTitle title="Security posture" sub="RBAC enforcement" />
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Icon name="shield" size={16} className="text-emerald-300" />
              Role-scoped routing + backend permission checks active.
            </div>
            <Link to="/admin/security" className="mt-3 inline-block text-sm text-ice-300 hover:underline">Security console →</Link>
          </Card>
        </div>
      </div>

      {/* Admin modules */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Module to="/admin/users" icon="users" label="Users" />
        <Module to="/admin/roles" icon="key" label="Roles & Permissions" />
        <Module to="/admin/system" icon="monitor" label="System Monitoring" />
        <Module to="/admin/audit" icon="clip" label="Audit Logs" />
        <Module to="/admin/integrations" icon="plug" label="Integrations" />
        <Module to="/admin/security" icon="shield" label="Security" />
        <Module to="/admin/config" icon="settings" label="System Config" />
        <Module to="/settings" icon="sliders" label="Preferences" />
      </div>
    </div>
  )
}

function fieldSet(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === 'string') return v.trim().length > 0 && v !== 'not_configured'
  return Object.keys(v as object).length > 0
}

function Module({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-xl border border-ink-700/60 bg-ink-800/50 px-3 py-3 text-sm text-slate-200 transition-colors hover:border-ice-500 hover:text-ice-200">
      <Icon name={icon} size={17} />
      <span className="truncate">{label}</span>
    </Link>
  )
}