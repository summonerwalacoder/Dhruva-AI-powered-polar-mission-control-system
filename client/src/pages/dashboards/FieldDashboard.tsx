import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { Badge, Btn, Card, Icon, SectionTitle, Spinner, Stat, statusTone, useApi } from '../../components/ui'

export default function FieldDashboard() {
  const nav = useNavigate()
  const { user, can } = useAuth()
  const mid = user?.mission_id
  const tasks = useApi<any[]>(mid ? `/api/tasks?mission_id=${mid}` : null)
  const assets = useApi<any[]>(mid ? `/api/assets?mission_id=${mid}` : null)
  const weather = useApi<any[]>(user?.station_id ? `/api/weather?station_id=${user.station_id}` : null)
  const alerts = useApi<any[]>(mid ? `/api/alerts?mission_id=${mid}&status=active` : null)

  const myTasks = (tasks.data || []).filter((t) => !t.personnel_id || t.personnel_id === user?.id)
  const myAssets = (assets.data || []).slice(0, 8)
  const latestW = (weather.data || [])[0]
  const actAlerts = alerts.data || []

  const startTask = async (id: number) => {
    try {
      await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'in_progress' }) })
      tasks.reload()
    } catch {
      /* offline queue handles it */
    }
  }
  const completeTask = async (id: number) => {
    try {
      await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) })
      tasks.reload()
    } catch {
      /* offline queue handles it */
    }
  }

  return (
    <div className="space-y-5">
      {/* Mobile-field hero */}
      <Card className="border-ice-700/40 bg-gradient-to-b from-ink-900 to-ice-900/20 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-ice-400">{user?.designation || 'Field Operator'}</div>
            <h1 className="mt-1 text-2xl font-black text-slate-50">{user?.name}</h1>
            <p className="text-sm text-slate-400">Mission {user?.mission_id ? `#${user.mission_id}` : '—'} · Station {user?.station_id || '—'}</p>
            {latestW ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-200">
                <Badge tone={latestW.storm ? 'red' : 'ice'}>{latestW.condition || '—'}</Badge>
                <span>{latestW.temperature_c != null ? `${latestW.temperature_c.toFixed?.(1) ?? latestW.temperature_c}°C` : '—'} · wind {latestW.wind_speed ?? '—'} km/h</span>
              </div>
            ) : null}
          </div>
          <Btn kind="danger" className="!px-4 !py-3" onClick={() => nav('/emergency')}>
            <Icon name="sos" size={20} /> SOS
          </Btn>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="My tasks" value={myTasks.length} sub={`${myTasks.filter((t) => ['done', 'cancelled'].includes(t.status)).length} completed`} tone="ice" />
        <Stat label="Assigned gear" value={myAssets.length} sub="usable equipment" tone="default" />
        <Stat label="Alerts" value={actAlerts.length} sub="open notices" tone={actAlerts.length ? 'warn' : 'good'} />
        <Stat label="Location" value={user?.station_id ? 'Deployed' : 'Base'} sub="field assignment" tone="default" />
      </div>

      {/* My tasks */}
      <Card className="p-4">
        <SectionTitle title="My tasks" sub="assigned field work" />
        {tasks.loading ? <Spinner /> : null}
        {!tasks.loading && !myTasks.length ? <p className="text-sm text-slate-400">No tasks assigned to you yet.</p> : null}
        <div className="space-y-2">
          {myTasks.slice(0, 12).map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-700/50 bg-ink-800/40 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-100">{t.title}</span>
                  <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                  {t.priority === 'critical' || t.priority === 'high' ? <Badge tone={t.priority === 'critical' ? 'red' : 'amber'}>{t.priority}</Badge> : null}
                </div>
                {t.description ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{t.description}</p> : null}
              </div>
              <div className="flex gap-2">
                {(t.status === 'pending' || t.status === 'assigned') ? (
                  <Btn kind="outline" className="!px-2.5 !py-1 text-xs" onClick={() => startTask(t.id)}>Start</Btn>
                ) : null}
                {t.status === 'in_progress' ? (
                  <Btn kind="primary" className="!px-2.5 !py-1 text-xs" onClick={() => completeTask(t.id)}>Complete</Btn>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Assigned equipment */}
      <Card className="p-4">
        <SectionTitle title="My equipment" sub="gear assigned to this expedition" />
        {assets.loading ? <Spinner /> : null}
        {!assets.loading && !myAssets.length ? <p className="text-sm text-slate-400">No equipment assigned.</p> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {myAssets.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl border border-ink-700/50 bg-ink-800/40 px-3 py-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-700"><Icon name="box" size={16} className="text-ice-300" /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-100">{a.name || a.asset_id}</div>
                <div className="truncate text-xs text-slate-500">{a.category || ''} · {a.location || '—'}</div>
              </div>
              <Badge tone={statusTone(a.operational_status || a.risk?.status)}>{a.operational_status || a.risk?.status}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick field access */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <QuickAction to="/map" icon="map" label="Map" nav={nav} />
        <QuickAction to="/weather" icon="weather" label="Weather" nav={nav} />
        {can('ai:use') ? <QuickAction to="/assistant" icon="ai" label="Ask DHRUVA" nav={nav} /> : null}
        <QuickAction to="/alerts" icon="alert" label="Alerts" nav={nav} />
        <QuickAction to="/field/equipment" icon="box" label="Equipment" nav={nav} />
        <QuickAction to="/field/profile" icon="personnel" label="My profile" nav={nav} />
      </div>
    </div>
  )
}

function QuickAction({ to, icon, label, nav }: { to: string; icon: string; label: string; nav: ReturnType<typeof useNavigate> }) {
  return (
    <Btn kind="ghost" className="!justify-start !px-3 !py-3" onClick={() => nav(to)}>
      <Icon name={icon} size={17} />
      <span className="truncate">{label}</span>
    </Btn>
  )
}