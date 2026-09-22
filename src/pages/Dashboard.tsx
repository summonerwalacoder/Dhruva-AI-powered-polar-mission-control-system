import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMission } from '../context/MissionContext'
import { fmtNum } from '../lib/api'
import { Badge, Card, ErrorBox, Icon, Progress, SectionTitle, Spinner, Stat, cx, riskTone, statusTone, useApi } from '../components/ui'
import type { MissionSummary, Overview } from '../lib/types'

export default function Dashboard() {
  const { user } = useAuth()
  const { selectedId, setMissions } = useMission()
  const missions = useApi<MissionSummary[]>('/api/missions')

  useEffect(() => {
    if (missions.data && !missions.loading) setMissions(missions.data)
  }, [missions.data, missions.loading])

  return (
    <div className="space-y-5">
      <Pagerow missions={missions.data} selectedId={selectedId} />

      {!selectedId ? (
        <Card className="p-6 text-center text-sm text-slate-400">No mission selected. Create or select a mission.</Card>
      ) : (
        <MissionPanel key={selectedId} missionId={selectedId} />
      )}

      <AdminPanel user={user} />
    </div>
  )
}

function Pagerow({ missions, selectedId }: { missions?: MissionSummary[] | null; selectedId: number | null }) {
  if (!missions || !missions.length) return null
  const m = missions.find((x) => x.id === selectedId) || missions[0]
  if (!m) return null
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4 fade-up">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-lg font-bold text-slate-50">{m.mission_id}</h1>
          <Badge tone={statusTone(m.status)}>{m.status}</Badge>
          <Badge tone={riskTone(m.risk_level)}>risk {m.risk_level}</Badge>
        </div>
        <p className="truncate text-sm text-slate-400">
          {m.name} → {m.destination}
          {m.station ? ` · ${m.station.name}` : ''}
        </p>
      </div>
      <div className="flex gap-5 text-center">
        <MiniStat label="Team" value={fmtNum(m.personnel_count)} />
        <MiniStat label="Cargo" value={fmtNum(m.cargo_count)} />
        <MiniStat label="Assets" value={fmtNum(m.asset_count)} />
        <MiniStat label="Alerts" value={fmtNum(m.active_alerts)} warn={m.active_alerts > 0} />
      </div>
      <Link to={`/missions/${m.id}`} className="rounded-lg bg-ink-700/60 px-3 py-2 text-sm text-slate-200 hover:bg-ink-700">
        Open mission
      </Link>
    </Card>
  )
}

function MiniStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div className={cx('text-lg font-bold tabular-nums', warn ? 'text-amber-300' : 'text-ice-200')}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  )
}

function MissionPanel({ missionId }: { missionId: number }) {
  const { data, loading, error, reload } = useApi<Overview>(`/api/missions/${missionId}/overview`)
  const { can } = useAuth()
  const { selected } = useMission()

  if (loading) return <Spinner label="Loading mission overview…" />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (!data) return null

  const ov = data
  const risk = ov.risk

  return (
    <div className="space-y-4">
      {/* Risk banner */}
      <Card className={cx('border p-4', riskTone(risk.level) === 'red' ? 'border-rose-400/40' : 'border-ink-700/60')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-400">Mission risk</span>
              <Badge tone={riskTone(risk.level)}>{risk.level}</Badge>
              <span className="text-xs text-slate-500">score {fmtNum(risk.score)}</span>
            </div>
            <div className="mt-1.5 space-y-0.5 text-sm text-slate-300">
              {(risk.reasons || []).slice(0, 2).map((r, i) => (
                <div key={i} className="flex gap-1.5"><span className="text-ice-400">•</span>{r}</div>
              ))}
            </div>
            {(risk.actions || []).length ? (
              <div className="mt-1.5 text-sm text-emerald-300">
                <span className="font-medium">Recommended:</span> {(risk.actions || []).slice(0, 2).join(' • ')}
              </div>
            ) : null}
          </div>
          <Badge tone={riskTone(risk.level)}>
            <Icon name="alert" size={12} /> {ov.counts.active_alerts} active alerts
          </Badge>
        </div>
      </Card>

      {/* KPI stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Progress" value={`${ov.mission.progress || 0}%`} sub={`day ${ov.mission.elapsed_days} of ${ov.mission.total_days}`} tone="ice" />
        <Stat label="Personnel" value={fmtNum(ov.counts.personnel)} sub={`planned ${fmtNum(ov.mission.team_size_planned)}`} />
        <Stat label="Cargo items" value={fmtNum(ov.counts.cargo_items)} sub={ov.counts.delayed_cargo ? `${ov.counts.delayed_cargo} delayed` : 'on schedule'} tone={ov.counts.delayed_cargo ? 'warn' : 'default'} />
        <Stat label="Food supply" value={ov.resources.food_days != null ? `${ov.resources.food_days}d` : '—'} sub={ov.resources.food_status || ''} tone={ov.resources.food_status === 'ok' ? 'good' : ov.resources.food_status === 'critical' || ov.resources.food_status === 'shortage' ? 'bad' : 'default'} />
        <Stat label="Fuel supply" value={ov.resources.fuel_days != null ? `${ov.resources.fuel_days}d` : '—'} sub={ov.resources.fuel_status || 'not tracked'} tone={ov.resources.fuel_status === 'ok' ? 'good' : ov.resources.fuel_status === 'shortage' ? 'bad' : 'default'} />
        <Stat label="Medical supply" value={ov.resources.medical_days != null ? `${ov.resources.medical_days}d` : '—'} sub={ov.resources.medical_status || 'not tracked'} tone={ov.resources.medical_status === 'ok' ? 'good' : ov.resources.medical_status === 'shortage' ? 'bad' : 'default'} />
        <Stat label="Critical assets" value={fmtNum(ov.counts.critical_assets)} sub="need maintenance" tone={ov.counts.critical_assets ? 'bad' : 'good'} />
        <Stat label="Open emergencies" value={fmtNum(ov.counts.open_emergencies)} sub="active incidents" tone={ov.counts.open_emergencies ? 'warn' : 'good'} />
      </div>

      {/* Resources clock + weather + resupply */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <SectionTitle title="Survival clock" sub="Days of supply left by category (leading item)" />
          <ClockGrid clock={ov.survival_clock || []} />
          <div className="mt-4 rounded-lg bg-ink-800/60 p-3 text-sm">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Resupply</div>
            {ov.next_resupply || ov.resupply_plan ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-slate-200">
                  Next resupply: <b className="text-ice-300">{ov.next_resupply || ov.resupply_plan}</b>
                </span>
                <Progress value={ov.mission.progress || 0} />
              </div>
            ) : (
              <span className="text-slate-400">No future resupply scheduled (resupply by mission end).</span>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle title="Weather" sub={ov.weather?.label || ''} />
            {ov.weather?.source === 'none' ? (
              <div className="text-sm text-slate-400">No weather data recorded.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Temperature</div>
                  <div className="text-2xl font-bold tabular-nums text-slate-100">{fmtNum(ov.weather?.temperature_c, 1)}°C</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Wind</div>
                  <div className="text-2xl font-bold tabular-nums text-slate-100">{fmtNum(ov.weather?.wind_speed, 0)} km/h</div>
                </div>
                <div className="col-span-2 flex flex-wrap items-center gap-2">
                  <Badge tone="ice">{ov.weather?.condition || '—'}</Badge>
                  {ov.weather?.storm ? <Badge tone="red">STORM</Badge> : null}
                  <span className="text-xs text-slate-500">source: {ov.weather?.source}</span>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <SectionTitle title="Quick actions" />
            <div className="grid grid-cols-2 gap-2">
              {can('simulate:use') ? <QuickLink to="/simulations" icon="simulate" label="What-if simulation" /> : null}
              {can('ai:use') ? <QuickLink to="/assistant" icon="ai" label="Ask DHRUVA AI" /> : null}
              {can('reports:use') ? <QuickLink to="/reports" icon="report" label="Daily report" /> : null}
              {can('analytics:use') ? <QuickLink to="/analytics" icon="analytics" label="Analytics" /> : null}
              <QuickLink to={`/missions/${ov.mission.id}`} icon="mission" label="Mission detail" />
            </div>
          </Card>
        </div>
      </div>

      {selected?.objective ? (
        <Card className="p-4">
          <SectionTitle title="Mission objective" />
          <p className="text-sm leading-relaxed text-slate-300">{selected.objective}</p>
        </Card>
      ) : null}
    </div>
  )
}

function ClockGrid({ clock }: { clock: Overview['survival_clock'] }) {
  const order = ['food', 'water', 'fuel', 'medical', 'emergency']
  const ordered = [...clock].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {ordered.map((c) => {
        const tone = statusTone(c.status)
        const d = c.days_remaining
        return (
          <div key={c.category} className="rounded-xl border border-ink-700/50 bg-ink-800/50 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{c.label}</div>
            <div className={cx('my-1 text-2xl font-bold tabular-nums', d == null ? 'text-slate-600' : tone === 'green' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : tone === 'red' ? 'text-rose-300' : 'text-slate-100')}>
              {d == null ? '—' : `${d}d`}
            </div>
            <div className="truncate text-[11px] text-slate-500">{c.item || 'not tracked'}</div>
            <div className="mt-1.5">
              <Progress
                value={d == null ? 0 : Math.max(0, Math.min(100, (d / 60) * 100))}
                tone={d == null ? 'ice' : statusTone(c.status) === 'green' ? 'green' : statusTone(c.status) === 'amber' ? 'amber' : 'red'}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function QuickLink({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-lg border border-ink-700/60 bg-ink-800/50 px-3 py-2.5 text-sm text-slate-200 hover:border-ice-500 hover:text-ice-200">
      <Icon name={icon} size={16} />
      <span className="truncate">{label}</span>
    </Link>
  )
}

function AdminPanel({ user }: { user: any }) {
  if (user?.role !== 'admin') return null
  return (
    <Card className="border-ice-500/20 p-4">
      <SectionTitle title="Administration" sub="System-wide controls" />
      <div className="flex flex-wrap gap-2">
        <QuickLink to="/admin" icon="admin" label="Users & roles" />
        <QuickLink to="/settings" icon="settings" label="Settings" />
      </div>
    </Card>
  )
}